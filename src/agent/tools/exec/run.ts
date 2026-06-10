import { Type } from "@sinclair/typebox";
import type { Tool, ToolExecutor, ToolResult, ToolContext } from "../types.js";
import type { Config, ExecConfig } from "../../../config/schema.js";
import { runCommand, ensureSandboxDir } from "./runner.js";
import { insertAuditEntry, updateAuditEntry } from "./audit.js";
import type Database from "better-sqlite3";

interface ExecRunParams {
  command: string;
}

export const execRunTool: Tool = {
  name: "exec_run",
  description:
    "Execute an arbitrary bash command on the host system. Returns stdout, stderr, and exit code. Use for any system administration task: file management, process control, Docker, networking, etc.",
  parameters: Type.Object({
    command: Type.String({
      description: "The bash command to execute (supports pipes, &&, redirects, etc.)",
    }),
  }),
};

export function isCommandAllowed(command: string, commandAllowlist: string[]): boolean {
  const trimmed = command.trim();
  return commandAllowlist.some((pattern) => {
    const p = pattern.trim();
    return trimmed === p || trimmed.startsWith(p + " ");
  });
}

function buildFilteredEnv(envWhitelist: string[]): NodeJS.ProcessEnv {
  const allowed = new Set(envWhitelist);
  const filtered: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (allowed.has(key) && value !== undefined) {
      filtered[key] = value;
    }
  }
  return filtered;
}

function isUserAdmin(senderId: number, config?: Config): boolean {
  if (!config) return false;
  return config.telegram.admin_ids.includes(senderId);
}

export function createExecRunExecutor(
  db: Database.Database,
  execConfig: ExecConfig
): ToolExecutor<ExecRunParams> {
  return async (params, context): Promise<ToolResult> => {
    const { command } = params;
    const { timeout, max_output } = execConfig.limits;

    if (execConfig.mode === "yolo") {
      return {
        success: false,
        error:
          "YOLO exec mode is disabled for security. Use 'allowlist' mode with explicit command_allowlist instead. See issue #10 (CWE-78).",
      };
    }

    if (execConfig.mode === "allowlist") {
      if (!isCommandAllowed(command, execConfig.command_allowlist)) {
        return {
          success: false,
          error: `Command not permitted. Allowed prefixes: ${execConfig.command_allowlist.length > 0 ? execConfig.command_allowlist.join(", ") : "(none configured)"}`,
        };
      }
    }

    // YOLO mode: require admin user
    if (execConfig.mode === "yolo" && execConfig.security.yolo_confirmation) {
      if (!isUserAdmin(context.senderId, context.config)) {
        await notifyAdmin(context, command);
        return {
          success: false,
          error: "YOLO mode requires admin privileges. Your command was logged and admin notified.",
        };
      }
    }

    // Ensure sandbox directory exists
    const sandboxDir = execConfig.security.sandbox_dir;
    if (sandboxDir) {
      try {
        ensureSandboxDir(sandboxDir);
      } catch {
        // If sandbox can't be created, proceed without cwd restriction
      }
    }

    // Build security options
    const security = {
      cwd: sandboxDir || undefined,
      env: execConfig.security.env_whitelist.length > 0
        ? buildFilteredEnv(execConfig.security.env_whitelist)
        : undefined,
    };

    let auditId: number | undefined;
    if (execConfig.audit.log_commands) {
      auditId = insertAuditEntry(db, {
        userId: context.senderId,
        username: undefined,
        tool: "exec_run",
        command,
        status: "running",
        truncated: false,
      });
    }

    let result;
    try {
      result = await runCommand(command, {
        timeout: timeout * 1000,
        maxOutput: max_output,
      }, security);
    } catch (err) {
      if (auditId !== undefined) {
        updateAuditEntry(db, auditId, {
          status: "failed",
          stderr: err instanceof Error ? err.message : String(err),
        });
      }
      return {
        success: false,
        error: `Execution failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    const status = result.timedOut ? "timeout" : result.exitCode === 0 ? "success" : "failed";

    if (auditId !== undefined) {
      updateAuditEntry(db, auditId, {
        status,
        exitCode: result.exitCode ?? undefined,
        signal: result.signal ?? undefined,
        duration: result.duration,
        stdout: result.stdout,
        stderr: result.stderr,
        truncated: result.truncated,
      });
    }

    return {
      success: result.exitCode === 0 && !result.timedOut,
      data: {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration: result.duration,
        truncated: result.truncated,
        timedOut: result.timedOut,
      },
      ...(result.timedOut
        ? { error: `Command timed out after ${timeout}s` }
        : result.exitCode !== 0
          ? { error: `Command exited with code ${result.exitCode}` }
          : {}),
    };
  };
}

async function notifyAdmin(context: ToolContext, command: string): Promise<void> {
  try {
    await context.bridge.sendMessage({
      chatId: context.chatId,
      text: `⚠️ Non-admin user ${context.senderId} attempted yolo command: ${command}`,
    });
  } catch {
    // Best-effort notification
  }
}
