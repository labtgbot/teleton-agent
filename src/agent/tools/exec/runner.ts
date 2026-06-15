import { spawn, type SpawnOptions } from "child_process";
import fs from "fs";
import type { ExecResult, RunOptions, RunSecurityOptions } from "./types.js";
import { createLogger } from "../../../utils/logger.js";

const log = createLogger("Exec");

const KILL_GRACE_MS = 5000;

/**
 * Path to the optional prctl-pdeathsig helper binary (Linux only).
 * If present, it is used as a wrapper so that prctl(PR_SET_PDEATHSIG, SIGKILL)
 * is called in the child's own context before exec'ing the real command.
 *
 * Build: gcc -o bin/prctl-pdeathsig src/agent/tools/exec/prctl-pdeathsig.c
 */
const PDEATHSIG_HELPER = new URL("../../../../bin/prctl-pdeathsig", import.meta.url);

export const MAX_CONCURRENT = 10;
let activeCount = 0;

/** Registry of all spawned child processes for cleanup on agent stop. */
const spawnedProcesses = new Set<ReturnType<typeof spawn>>();

/**
 * Kill all spawned child processes that are still running.
 * Called during agent shutdown to prevent zombie process accumulation.
 */
export function killAllSpawnedProcesses(): void {
  for (const child of spawnedProcesses) {
    if (child.pid && !child.killed) {
      try {
        child.kill("SIGKILL");
      } catch {
        // Process already dead
      }
    }
  }
  spawnedProcesses.clear();
}

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
    out[key] = value;
  }
  return out;
}

export function runCommand(
  command: string,
  options: RunOptions,
  security?: RunSecurityOptions
): Promise<ExecResult> {
  if (activeCount >= MAX_CONCURRENT) {
    throw new Error(`Max concurrent processes (${MAX_CONCURRENT}) reached`);
  }
  activeCount++;

  const { timeout, maxOutput } = options;
  const { cwd, env: securityEnv } = security ?? {};
  const startTime = Date.now();
  const spawnCwd = cwd ?? process.cwd();

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;
    let resolved = false;

    // Use security-provided env whitelist, or fall back to sanitized env
    const env = securityEnv ?? sanitizeEnv(process.env);

    // On Linux, use prctl-pdeathsig helper if available so the kernel kills
    // this child automatically when the parent dies (PR_SET_PDEATHSIG).
    const usePdeathsig = process.platform === "linux" && fs.existsSync(PDEATHSIG_HELPER);

    const spawnCmd = usePdeathsig
      ? (PDEATHSIG_HELPER as unknown as string).replace("file://", "")
      : "bash";
    const spawnArgs = usePdeathsig ? ["bash", "-c", command] : ["-c", command];

    const spawnOpts: SpawnOptions & { encoding: string; cwd?: string; env?: NodeJS.ProcessEnv } = {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      cwd: spawnCwd,
      env,
    };

    const child = spawn(spawnCmd, spawnArgs, spawnOpts);
    spawnedProcesses.add(child);

    const finish = (exitCode: number | null, signal: string | null) => {
      if (resolved) return;
      resolved = true;
      activeCount--;
      spawnedProcesses.delete(child);
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
      try {
        child.kill("SIGTERM");
      } catch {
        // Process already dead
      }

      killTimer = setTimeout(() => {
        log.warn({ command }, "Grace period expired, sending SIGKILL");
        try {
          child.kill("SIGKILL");
        } catch {
          // Process already dead
        }
      }, KILL_GRACE_MS);
    }, timeout);
  });
}

/** Ensure the sandbox directory exists on disk. */
export function ensureSandboxDir(sandboxDir: string): void {
  if (!fs.existsSync(sandboxDir)) {
    fs.mkdirSync(sandboxDir, { recursive: true, mode: 0o755 });
  }
}

/**
 * spawnInstallCommand — runs a package manager via spawn with argument arrays.
 * Uses sanitizeEnv() for child process env. Respects MAX_CONCURRENT limit.
 * This is the injection-safe alternative to string-interpolated shell commands.
 */
export function spawnInstallCommand(
  manager: "apt" | "pip" | "npm" | "docker",
  packages: string[],
  timeout: number,
  maxOutput: number
): Promise<ExecResult> {
  if (activeCount >= MAX_CONCURRENT) {
    throw new Error(`Max concurrent processes (${MAX_CONCURRENT}) reached`);
  }
  activeCount++;

  const argsMap: Record<string, string[]> = {
    apt: ["install", "-y", ...packages],
    pip: ["install", ...packages],
    npm: ["install", "-g", ...packages],
    docker: ["pull", ...packages],
  };

  const args = argsMap[manager];
  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;
    let resolved = false;

    const env = sanitizeEnv(process.env);

    log.info({ manager, packages }, "Installing packages");

    const child = spawn(manager, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });

    const finish = (exitCode: number | null, signal: string | null) => {
      if (resolved) return;
      resolved = true;
      activeCount--;
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

    child.on("close", (code, sig) => finish(code, sig));
    child.on("error", (err) => {
      log.error({ err }, "Spawn install error");
      stderr += err.message;
      finish(1, null);
    });

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      log.warn({ manager, packages, timeout }, "Install timed out, killing");
      try {
        if (child.pid != null) process.kill(-child.pid, "SIGTERM");
      } catch {
        /* dead */
      }
      setTimeout(() => {
        try {
          if (child.pid != null) process.kill(-child.pid, "SIGKILL");
        } catch {
          /* dead */
        }
      }, 5000);
    }, timeout);
  });
}
