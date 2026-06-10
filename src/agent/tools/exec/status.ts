import { Type } from "@sinclair/typebox";
import type { Tool, ToolExecutor, ToolResult } from "../types.js";
import type { ExecConfig } from "../../../config/schema.js";
import { runCommand, ensureSandboxDir } from "./runner.js";
import { execConcurrency } from "./concurrency.js";
import { insertAuditEntry, updateAuditEntry } from "./audit.js";
import type Database from "better-sqlite3";

export const execStatusTool: Tool = {
  name: "exec_status",
  description:
    "Get structured server status: disk usage, RAM, CPU load, uptime, and OS info. Returns all available data even if some commands fail.",
  parameters: Type.Object({}),
};

const STATUS_COMMANDS: Array<{ key: string; command: string }> = [
  { key: "disk", command: "df -h --output=target,size,used,avail,pcent 2>/dev/null || df -h" },
  { key: "memory", command: "free -h" },
  { key: "uptime", command: "uptime" },
  { key: "load", command: "cat /proc/loadavg" },
  { key: "os", command: "uname -a" },
  { key: "cpu", command: "nproc" },
];

export function createExecStatusExecutor(
  db: Database.Database,
  execConfig: ExecConfig
): ToolExecutor<Record<string, never>> {
  return async (_params, context): Promise<ToolResult> => {
    const { max_output } = execConfig.limits;

    await execConcurrency.acquire(execConfig.security.max_concurrent);

    let auditId: number | undefined;
    if (execConfig.audit.log_commands) {
      auditId = insertAuditEntry(db, {
        userId: context.senderId,
        username: undefined,
        tool: "exec_status",
        command: "exec_status (system health check)",
        status: "running",
        truncated: false,
      });
    }

    try {
      const sandboxDir = execConfig.security.sandbox_dir;
      if (sandboxDir) ensureSandboxDir(sandboxDir);

      const security = {
        cwd: sandboxDir || undefined,
        env: execConfig.security.env_whitelist.length > 0
          ? buildFilteredEnv(execConfig.security.env_whitelist)
          : undefined,
      };

      // Run each command individually so partial failures don't stop the rest
      const results: Record<string, string> = {};
      const startTime = Date.now();

      for (const { key, command } of STATUS_COMMANDS) {
        const result = await runCommand(command, {
          timeout: 10000,
          maxOutput: max_output,
        }, security);
        results[key] =
          result.exitCode === 0 ? result.stdout.trim() : `(failed: ${result.stderr.trim()})`;
      }

      const duration = Date.now() - startTime;

      if (auditId !== undefined) {
        updateAuditEntry(db, auditId, {
          status: "success",
          exitCode: 0,
          duration,
          stdout: JSON.stringify(results),
          truncated: false,
        });
      }

      return {
        success: true,
        data: results,
      };
    } finally {
      execConcurrency.release();
    }
  };
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
