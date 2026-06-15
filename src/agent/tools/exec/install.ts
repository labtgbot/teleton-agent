import { Type } from "@sinclair/typebox";
import type { Tool, ToolExecutor, ToolResult } from "../types.js";
import type { ExecConfig } from "../../../config/schema.js";
import { spawnInstallCommand } from "./runner.js";
import { insertAuditEntry, updateAuditEntry } from "./audit.js";
import type Database from "better-sqlite3";

interface ExecInstallParams {
  manager: "apt" | "pip" | "npm" | "docker";
  packages: string;
}

/** Maximum number of packages per install call (prevents resource exhaustion) */
const MAX_PACKAGES = 20;

/**
 * Validate a single package name token.
 * Returns the reason string if invalid, or null if valid.
 */
export function validatePackageToken(token: string): string | null {
  if (!token || token.length === 0) return "empty package name";
  if (token.length > 128) return `package name too long (${token.length} chars)`;

  // Reject URL-based package specifications
  if (/^https?:\/\//i.test(token)) return `URL-based packages not allowed: "${token}"`;
  if (/\.(deb|whl|tar\.gz|tgz|zip)$/i.test(token))
    return `archive download not allowed: "${token}"`;

  // Strict package name regex (alphanumeric, dots, hyphens, underscores, colons for docker tags)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.\-:]*$/.test(token)) {
    return `invalid package name "${token}": only alphanumeric, dots, hyphens, underscores, colons allowed`;
  }

  return null;
}

/**
 * Parse and validate a packages string.
 * Returns { valid: string[] } on success, or { error: string } on failure.
 */
export function parseAndValidatePackages(
  packages: string
): { valid: string[] } | { error: string } {
  const trimmed = packages.trim();
  if (!trimmed) return { error: "No packages specified" };

  const tokens = trimmed.split(/\s+/);
  if (tokens.length > MAX_PACKAGES) {
    return { error: `Too many packages (${tokens.length}). Maximum is ${MAX_PACKAGES}.` };
  }

  for (const token of tokens) {
    const reason = validatePackageToken(token);
    if (reason) return { error: reason };
  }

  return { valid: tokens };
}

export const execInstallTool: Tool = {
  name: "exec_install",
  description:
    "Install packages using a specified package manager (apt, pip, npm, or docker pull). Constructs the correct install command automatically.",
  parameters: Type.Object({
    manager: Type.Union(
      [Type.Literal("apt"), Type.Literal("pip"), Type.Literal("npm"), Type.Literal("docker")],
      { description: "Package manager to use" }
    ),
    packages: Type.String({
      description:
        "Space-separated package names to install (e.g. 'nginx curl'). " +
        "Only alphanumeric characters, dots, hyphens, and underscores are allowed. " +
        "URL-based and archive-based packages are rejected.",
    }),
  }),
};

export function createExecInstallExecutor(
  db: Database.Database,
  execConfig: ExecConfig
): ToolExecutor<ExecInstallParams> {
  return async (params, context): Promise<ToolResult> => {
    const { manager, packages } = params;
    const { timeout, max_output } = execConfig.limits;

    // Validate package names before any command construction
    const parsed = parseAndValidatePackages(packages);
    if ("error" in parsed) {
      return { success: false, error: `Package validation failed: ${parsed.error}` };
    }

    const flagsMap: Record<string, string> = {
      apt: "install -y",
      pip: "install",
      npm: "install -g",
      docker: "pull",
    };
    const commandDisplay = `${manager} ${flagsMap[manager]} ${parsed.valid.join(" ")}`;

    let auditId: number | undefined;
    if (execConfig.audit.log_commands) {
      auditId = insertAuditEntry(db, {
        userId: context.senderId,
        username: undefined,
        tool: "exec_install",
        command: commandDisplay,
        status: "running",
        truncated: false,
      });
    }

    let result;
    try {
      result = await spawnInstallCommand(manager, parsed.valid, timeout * 1000, max_output);
    } catch (err) {
      if (auditId !== undefined) {
        updateAuditEntry(db, auditId, {
          status: "failed",
          stderr: err instanceof Error ? err.message : String(err),
        });
      }
      return {
        success: false,
        error: `Install failed: ${err instanceof Error ? err.message : String(err)}`,
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
        manager,
        packages: parsed.valid,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration: result.duration,
        truncated: result.truncated,
        timedOut: result.timedOut,
      },
      ...(result.timedOut
        ? { error: `Install timed out after ${timeout}s` }
        : result.exitCode !== 0
          ? { error: `Install failed with exit code ${result.exitCode}` }
          : {}),
    };
  };
}
