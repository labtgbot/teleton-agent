import { Type } from "@sinclair/typebox";
import type { Tool, ToolExecutor, ToolResult } from "../types.js";
import type { ExecConfig } from "../../../config/schema.js";
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

/**
 * Shell metacharacters that could be used for command injection.
 * If a command contains any of these, it is rejected in allowlist mode
 * unless the allowlist entry itself contains the same metacharacter
 * (indicating the owner explicitly intended a compound command).
 */
const SHELL_METACHARACTERS = /[;|&`$(){}[\]<>!#*?\\]/;

export function isCommandAllowed(command: string, commandAllowlist: string[]): boolean {
  const trimmed = command.trim();

  // Reject empty commands
  if (!trimmed) return false;

  return commandAllowlist.some((pattern) => {
    const p = pattern.trim();
    if (!p) return false;

    // Exact match — always allowed
    if (trimmed === p) return true;

    // Prefix match: the command must start with the pattern followed by
    // a space, AND the remainder must not contain shell metacharacters
    // that would enable injection (e.g., "ls; rm -rf /").
    if (trimmed.startsWith(p + " ")) {
      const remainder = trimmed.slice(p.length + 1);
      // If the pattern itself contains metacharacters, trust the owner's
      // allowlist entry. Otherwise, reject if remainder has metacharacters.
      if (SHELL_METACHARACTERS.test(p)) return true;
      return !SHELL_METACHARACTERS.test(remainder);
    }

    return false;
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
      env:
        execConfig.security.env_whitelist.length > 0
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
      result = await runCommand(
        command,
        {
          timeout: timeout * 1000,
          maxOutput: max_output,
        },
        security
      );
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
