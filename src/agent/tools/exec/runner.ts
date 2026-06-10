import { spawn, type SpawnOptions } from "child_process";
import fs from "fs";
import type { ExecResult, RunOptions, RunSecurityOptions } from "./types.js";
import { createLogger } from "../../../utils/logger.js";

const log = createLogger("Exec");

const KILL_GRACE_MS = 5000;

export function runCommand(
  command: string,
  options: RunOptions,
  security?: RunSecurityOptions
): Promise<ExecResult> {
  const { timeout, maxOutput } = options;
  const { cwd, env } = security ?? {};
  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;
    let resolved = false;

    const spawnOpts: SpawnOptions & { encoding: string; cwd?: string; env?: NodeJS.ProcessEnv } = {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    };
    if (cwd) spawnOpts.cwd = cwd;
    if (env) spawnOpts.env = env;

    const child = spawn("bash", ["-c", command], spawnOpts);

    const finish = (exitCode: number | null, signal: string | null) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutTimer);
      clearTimeout(killTimer);
      resolve({
        stdout,
        stderr,
        exitCode,
        signal,
        duration: Date.now() - startTime,
        truncated,
        timedOut,
      });
    };

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (chunk: string) => {
      if (stdout.length < maxOutput) {
        stdout += chunk;
        if (stdout.length > maxOutput) {
          stdout = stdout.slice(0, maxOutput);
          truncated = true;
        }
      }
    });

    child.stderr?.on("data", (chunk: string) => {
      if (stderr.length < maxOutput) {
        stderr += chunk;
        if (stderr.length > maxOutput) {
          stderr = stderr.slice(0, maxOutput);
          truncated = true;
        }
      }
    });

    child.on("close", (code, sig) => {
      finish(code, sig);
    });

    child.on("error", (err) => {
      log.error({ err }, "Spawn error");
      stderr += err.message;
      finish(1, null);
    });

    // Timeout handling: SIGTERM then SIGKILL
    let killTimer: ReturnType<typeof setTimeout>;
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      log.warn({ command, timeout }, "Command timed out, sending SIGTERM");
      if (child.pid) killProcessGroup(child.pid, "SIGTERM");

      killTimer = setTimeout(() => {
        log.warn({ command }, "Grace period expired, sending SIGKILL");
        if (child.pid) killProcessGroup(child.pid, "SIGKILL");
      }, KILL_GRACE_MS);
    }, timeout);
  });
}

function killProcessGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
  } catch {
    // Process already dead — expected
  }
}

/** Ensure the sandbox directory exists on disk. */
export function ensureSandboxDir(sandboxDir: string): void {
  if (!fs.existsSync(sandboxDir)) {
    fs.mkdirSync(sandboxDir, { recursive: true, mode: 0o755 });
  }
}
