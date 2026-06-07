import { spawn, type SpawnOptions } from "child_process";
import type { ExecResult, RunOptions } from "./types.js";
import { createLogger } from "../../../utils/logger.js";
import fs from "fs/promises";

const log = createLogger("Exec");

export const MAX_CONCURRENT = 10;
let activeCount = 0;

const SAFE_ENV = new Set([
  "PATH",
  "HOME",
  "USER",
  "LANG",
  "LC_ALL",
  "TERM",
  "TMPDIR",
  "TMP",
  "TEMP",
]);

const DANGEROUS_PATTERNS = [
  /API_KEY/i,
  /SECRET/i,
  /TOKEN/i,
  /PASSWORD/i,
  /PRIVATE/i,
  /MNEMONIC/i,
  /PASSPHRASE/i,
];

export function sanitizeEnv(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    if (SAFE_ENV.has(key)) {
      out[key] = value;
      continue;
    }
    if (DANGEROUS_PATTERNS.some((p) => p.test(key))) {
      out[key] = undefined;
      continue;
    }
  }
  return out;
}

export async function validateCwd(cwd: string): Promise<void> {
  try {
    const stat = await fs.stat(cwd);
    if (!stat.isDirectory()) {
      throw new Error(`Exec sandbox is not a directory: ${cwd}`);
    }
  } catch {
    try {
      await fs.mkdir(cwd, { recursive: true });
    } catch {
      throw new Error(`Cannot create exec sandbox directory: ${cwd}`);
    }
  }
}

export async function runCommand(
  command: string,
  options: RunOptions,
  sandboxCwd?: string,
): Promise<ExecResult> {
  if (activeCount >= MAX_CONCURRENT) {
    throw new Error(`Max concurrent processes (${MAX_CONCURRENT}) reached`);
  }
  activeCount++;

  const { timeout, maxOutput } = options;
  const startTime = Date.now();
  const cwd = sandboxCwd ?? process.cwd();

  try {
    if (sandboxCwd) {
      await validateCwd(cwd);
    }

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let truncated = false;
      let timedOut = false;
      let resolved = false;

      const env = sanitizeEnv(process.env);

      log.info({ command, cwd }, "Executing command");

      const child = spawn("bash", ["-c", command], {
        stdio: ["ignore", "pipe", "pipe"],
        cwd,
        env,
        encoding: "utf8",
      } as SpawnOptions & { encoding: string });

      const finish = (exitCode: number | null, signal: string | null) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutTimer);
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
        activeCount--;
        finish(code, sig);
      });

      child.on("error", (err) => {
        activeCount--;
        log.error({ err }, "Spawn error");
        stderr += err.message;
        finish(1, null);
      });

      let killTimer: ReturnType<typeof setTimeout>;
      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        log.warn({ command, timeout }, "Command timed out, sending SIGTERM");
        try {
          process.kill(-child.pid!, "SIGTERM");
        } catch {
          // Process already dead
        }
        killTimer = setTimeout(() => {
          log.warn({ command }, "Grace period expired, sending SIGKILL");
          try {
            process.kill(-child.pid!, "SIGKILL");
          } catch {
            // Process already dead
          }
        }, 5000);
      }, timeout);
    });
  } catch (err) {
    activeCount--;
    throw err;
  }
}
