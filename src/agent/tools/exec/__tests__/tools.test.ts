import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { ensureSchema } from "../../../../memory/schema.js";
import type { ExecConfig } from "../../../../config/schema.js";
import type { ToolContext } from "../../types.js";
import { createExecRunExecutor, isCommandAllowed } from "../run.js";
import { createExecInstallExecutor } from "../install.js";
import { createExecServiceExecutor } from "../service.js";
import { createExecStatusExecutor } from "../status.js";

// Mock the runner to avoid real command execution
vi.mock("../runner.js", () => ({
  runCommand: vi.fn(),
  spawnInstallCommand: vi.fn(),
  ensureSandboxDir: vi.fn(),
}));

// Mock concurrency to avoid real semaphore blocking across tests
vi.mock("../concurrency.js", () => ({
  execConcurrency: {
    acquire: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
    count: 0,
  },
}));

import { runCommand, spawnInstallCommand } from "../runner.js";

const mockRunCommand = vi.mocked(runCommand);
const mockSpawnInstall = vi.mocked(spawnInstallCommand);

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  ensureSchema(db);
  return db;
}

function makeExecConfig(overrides?: Partial<ExecConfig>): ExecConfig {
  return {
    mode: "allowlist",
    scope: "admin-only",
    allowlist: [],
    command_allowlist: [
      "echo",
      "ls",
      "git status",
      "nonexistent",
      "any command",
      "apt",
      "pip",
      "npm",
      "docker",
      "systemctl",
      "free",
      "df",
      "uptime",
      "cat /proc/loadavg",
      "uname",
      "nproc",
    ],
    limits: { timeout: 120, max_output: 50000 },
    audit: { log_commands: true },
    security: {
      yolo_confirmation: true,
      sandbox_dir: "/tmp/teleton-exec-sandbox",
      env_whitelist: ["HOME", "PATH", "LANG", "TERM", "USER", "SHELL"],
      max_concurrent: 5,
    },
    ...overrides,
  };
}

function makeContext(overrides?: Partial<ToolContext>): ToolContext {
  return {
    bridge: {} as any,
    db: new Database(":memory:"),
    chatId: "123",
    senderId: 42,
    isGroup: false,
    ...overrides,
  };
}

describe("exec_run", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    vi.clearAllMocks();
  });

  it("calls runner with correct command and returns result", async () => {
    mockRunCommand.mockResolvedValue({
      stdout: "hello\n",
      stderr: "",
      exitCode: 0,
      signal: null,
      duration: 50,
      truncated: false,
      timedOut: false,
    });

    const executor = createExecRunExecutor(db, makeExecConfig());
    const result = await executor({ command: "echo hello" }, makeContext());

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      stdout: "hello\n",
      exitCode: 0,
      timedOut: false,
    });
    expect(mockRunCommand).toHaveBeenCalledWith(
      "echo hello",
      { timeout: 120000, maxOutput: 50000 },
      expect.objectContaining({ cwd: expect.any(String) })
    );
  });

  it("returns error when command fails", async () => {
    mockRunCommand.mockResolvedValue({
      stdout: "",
      stderr: "not found\n",
      exitCode: 127,
      signal: null,
      duration: 10,
      truncated: false,
      timedOut: false,
    });

    const executor = createExecRunExecutor(db, makeExecConfig());
    const result = await executor({ command: "nonexistent" }, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain("127");
  });

  it("logs audit entry before and after execution", async () => {
    mockRunCommand.mockResolvedValue({
      stdout: "ok",
      stderr: "",
      exitCode: 0,
      signal: null,
      duration: 100,
      truncated: false,
      timedOut: false,
    });

    const executor = createExecRunExecutor(db, makeExecConfig());
    await executor({ command: "ls" }, makeContext());

    const rows = db.prepare("SELECT * FROM exec_audit").all() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].tool).toBe("exec_run");
    expect(rows[0].command).toBe("ls");
    expect(rows[0].status).toBe("success");
    expect(rows[0].exit_code).toBe(0);
    expect(rows[0].duration_ms).toBe(100);
  });

  it("skips audit when log_commands is false", async () => {
    mockRunCommand.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      signal: null,
      duration: 10,
      truncated: false,
      timedOut: false,
    });

    const executor = createExecRunExecutor(db, makeExecConfig({ audit: { log_commands: false } }));
    await executor({ command: "ls" }, makeContext());

    const rows = db.prepare("SELECT * FROM exec_audit").all();
    expect(rows).toHaveLength(0);
  });
});

describe("exec_install", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    vi.clearAllMocks();
  });

  it("rejects URL-based packages", async () => {
    const executor = createExecInstallExecutor(db, makeExecConfig());
    const result = await executor(
      { manager: "pip", packages: "https://evil.com/malware.tar.gz" },
      makeContext()
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("URL-based packages not allowed");
    expect(mockSpawnInstall).not.toHaveBeenCalled();
  });

  it("rejects archive-based packages", async () => {
    const executor = createExecInstallExecutor(db, makeExecConfig());
    const result = await executor({ manager: "pip", packages: "malware.whl" }, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain("archive download not allowed");
  });

  it("rejects package names with shell metacharacters", async () => {
    const executor = createExecInstallExecutor(db, makeExecConfig());
    const result = await executor({ manager: "npm", packages: "pkg; rm -rf /" }, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain("invalid package name");
  });

  it("rejects too many packages", async () => {
    const many = Array.from({ length: 25 }, (_, i) => `pkg${i}`).join(" ");
    const executor = createExecInstallExecutor(db, makeExecConfig());
    const result = await executor({ manager: "pip", packages: many }, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain("Too many packages");
  });

  it("rejects empty package name", async () => {
    const executor = createExecInstallExecutor(db, makeExecConfig());
    const result = await executor({ manager: "apt", packages: "" }, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain("No packages specified");
  });

  it("calls spawnInstallCommand with correct args for apt", async () => {
    mockSpawnInstall.mockResolvedValue({
      stdout: "installed",
      stderr: "",
      exitCode: 0,
      signal: null,
      duration: 5000,
      truncated: false,
      timedOut: false,
    });

    const executor = createExecInstallExecutor(db, makeExecConfig());
    const result = await executor({ manager: "apt", packages: "nginx curl" }, makeContext());

    expect(result.success).toBe(true);
    expect(mockSpawnInstall).toHaveBeenCalledWith("apt", ["nginx", "curl"], 120000, 50000);
  });

  it("calls spawnInstallCommand with correct args for pip", async () => {
    mockSpawnInstall.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      signal: null,
      duration: 1000,
      truncated: false,
      timedOut: false,
    });

    const executor = createExecInstallExecutor(db, makeExecConfig());
    const result = await executor({ manager: "pip", packages: "flask" }, makeContext());

    expect(result.success).toBe(true);
    expect(mockSpawnInstall).toHaveBeenCalledWith("pip", ["flask"], 120000, 50000);
  });

  it("calls spawnInstallCommand with correct args for npm", async () => {
    mockSpawnInstall.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      signal: null,
      duration: 1000,
      truncated: false,
      timedOut: false,
    });

    const executor = createExecInstallExecutor(db, makeExecConfig());
    const result = await executor({ manager: "npm", packages: "pm2" }, makeContext());

    expect(result.success).toBe(true);
    expect(mockSpawnInstall).toHaveBeenCalledWith("npm", ["pm2"], 120000, 50000);
  });

  it("calls spawnInstallCommand with correct args for docker", async () => {
    mockSpawnInstall.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      signal: null,
      duration: 3000,
      truncated: false,
      timedOut: false,
    });

    const executor = createExecInstallExecutor(db, makeExecConfig());
    const result = await executor({ manager: "docker", packages: "nginx:latest" }, makeContext());

    expect(result.success).toBe(true);
    expect(mockSpawnInstall).toHaveBeenCalledWith("docker", ["nginx:latest"], 120000, 50000);
  });

  it("logs audit entry", async () => {
    mockSpawnInstall.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      signal: null,
      duration: 1000,
      truncated: false,
      timedOut: false,
    });

    const executor = createExecInstallExecutor(db, makeExecConfig());
    await executor({ manager: "apt", packages: "nginx" }, makeContext());

    const rows = db.prepare("SELECT * FROM exec_audit").all() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].tool).toBe("exec_install");
    expect(rows[0].command).toBe("apt install -y nginx");
  });

  it("returns error when spawnInstallCommand throws", async () => {
    mockSpawnInstall.mockRejectedValue(new Error("spawn ENOENT"));

    const executor = createExecInstallExecutor(db, makeExecConfig());
    const result = await executor({ manager: "apt", packages: "nginx" }, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain("Install failed");
  });

  it("returns error when install times out", async () => {
    mockSpawnInstall.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: null,
      signal: "SIGTERM",
      duration: 120000,
      truncated: false,
      timedOut: true,
    });

    const executor = createExecInstallExecutor(db, makeExecConfig());
    const result = await executor({ manager: "apt", packages: "huge-package" }, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain("timed out");
  });
});

describe("exec_service", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    vi.clearAllMocks();
  });

  it("constructs systemctl command", async () => {
    mockRunCommand.mockResolvedValue({
      stdout: "active",
      stderr: "",
      exitCode: 0,
      signal: null,
      duration: 100,
      truncated: false,
      timedOut: false,
    });

    const executor = createExecServiceExecutor(db, makeExecConfig());
    await executor({ action: "status", name: "nginx" }, makeContext());

    expect(mockRunCommand).toHaveBeenCalledWith(
      "systemctl status nginx",
      expect.any(Object),
      expect.objectContaining({ cwd: expect.any(String) })
    );
  });

  it("logs audit entry", async () => {
    mockRunCommand.mockResolvedValue({
      stdout: "",
      stderr: "",
      exitCode: 0,
      signal: null,
      duration: 200,
      truncated: false,
      timedOut: false,
    });

    const executor = createExecServiceExecutor(db, makeExecConfig());
    await executor({ action: "restart", name: "docker" }, makeContext());

    const rows = db.prepare("SELECT * FROM exec_audit").all() as any[];
    expect(rows[0].tool).toBe("exec_service");
    expect(rows[0].command).toBe("systemctl restart docker");
  });
});

describe("isCommandAllowed", () => {
  it("allows exact match", () => {
    expect(isCommandAllowed("git status", ["git status"])).toBe(true);
  });

  it("allows command with extra args when prefix matches", () => {
    expect(isCommandAllowed("git diff HEAD~1", ["git"])).toBe(true);
  });

  it("blocks command not in allowlist", () => {
    expect(isCommandAllowed("rm -rf /", ["ls", "cat"])).toBe(false);
  });

  it("blocks empty allowlist", () => {
    expect(isCommandAllowed("ls", [])).toBe(false);
  });

  it("does not allow prefix substring without whitespace boundary", () => {
    // 'git' should not match 'gitconfig' without a space after it
    expect(isCommandAllowed("gitconfig --list", ["git"])).toBe(false);
  });

  it("trims whitespace before matching", () => {
    expect(isCommandAllowed("  ls  /tmp", ["ls"])).toBe(true);
  });
});

describe("exec_run allowlist mode", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    vi.clearAllMocks();
  });

  it("blocks commands not in allowlist without calling runner", async () => {
    const config = makeExecConfig({
      mode: "allowlist",
      command_allowlist: ["git status", "ls"],
    });
    const executor = createExecRunExecutor(db, config);
    const result = await executor({ command: "rm -rf /" }, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain("not permitted");
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  it("allows commands matching an allowlist prefix", async () => {
    mockRunCommand.mockResolvedValue({
      stdout: "main\n",
      stderr: "",
      exitCode: 0,
      signal: null,
      duration: 30,
      truncated: false,
      timedOut: false,
    });

    const config = makeExecConfig({
      mode: "allowlist",
      command_allowlist: ["git"],
    });
    const executor = createExecRunExecutor(db, config);
    const result = await executor({ command: "git status" }, makeContext());

    expect(result.success).toBe(true);
    expect(mockRunCommand).toHaveBeenCalledWith(
      "git status",
      expect.any(Object),
      expect.objectContaining({ cwd: expect.any(String) })
    );
  });

  it("error message lists configured prefixes", async () => {
    const config = makeExecConfig({
      mode: "allowlist",
      command_allowlist: ["git status", "npm run"],
    });
    const executor = createExecRunExecutor(db, config);
    const result = await executor({ command: "cat /etc/passwd" }, makeContext());

    expect(result.error).toContain("git status");
    expect(result.error).toContain("npm run");
  });

  it("error message says none configured when allowlist is empty", async () => {
    const config = makeExecConfig({
      mode: "allowlist",
      command_allowlist: [],
    });
    const executor = createExecRunExecutor(db, config);
    const result = await executor({ command: "ls" }, makeContext());

    expect(result.error).toContain("none configured");
  });

  it("yolo mode is disabled for security — returns error", async () => {
    const config = makeExecConfig({ mode: "yolo", command_allowlist: [] });
    const executor = createExecRunExecutor(db, config);
    const result = await executor({ command: "any command" }, makeContext());

    expect(result.success).toBe(false);
    expect(result.error).toContain("YOLO exec mode is disabled");
    expect(mockRunCommand).not.toHaveBeenCalled();
  });
});

describe("exec_status", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
    vi.clearAllMocks();
  });

  it("returns structured status data", async () => {
    mockRunCommand.mockResolvedValue({
      stdout: "some output",
      stderr: "",
      exitCode: 0,
      signal: null,
      duration: 50,
      truncated: false,
      timedOut: false,
    });

    const executor = createExecStatusExecutor(db, makeExecConfig());
    const result = await executor({} as any, makeContext());

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("disk");
    expect(result.data).toHaveProperty("memory");
    expect(result.data).toHaveProperty("uptime");
    expect(result.data).toHaveProperty("load");
    expect(result.data).toHaveProperty("os");
    expect(result.data).toHaveProperty("cpu");
  });

  it("handles partial command failures gracefully", async () => {
    let callCount = 0;
    mockRunCommand.mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        return {
          stdout: "",
          stderr: "free: command not found",
          exitCode: 127,
          signal: null,
          duration: 10,
          truncated: false,
          timedOut: false,
        };
      }
      return {
        stdout: "some data",
        stderr: "",
        exitCode: 0,
        signal: null,
        duration: 10,
        truncated: false,
        timedOut: false,
      };
    });

    const executor = createExecStatusExecutor(db, makeExecConfig());
    const result = await executor({} as any, makeContext());

    expect(result.success).toBe(true);
    // memory should contain the failure message
    expect(result.data.memory).toContain("failed");
    // other keys should have data
    expect(result.data.disk).toBe("some data");
  });
});
