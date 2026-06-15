/**
 * MCP (Model Context Protocol) client loader.
 *
 * Connects to external MCP servers (stdio or SSE) declared in config.yaml,
 * discovers their tools, and registers them in the ToolRegistry.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { sanitizeForContext } from "../../utils/sanitize.js";
import type { Tool, ToolExecutor, ToolResult, ToolScope } from "./types.js";
import type { ToolRegistry } from "./registry.js";
import type { McpConfig, McpServerConfig } from "../../config/schema.js";
import { getErrorMessage } from "../../utils/errors.js";
import { createLogger } from "../../utils/logger.js";

const log = createLogger("MCP");

export interface McpConnection {
  serverName: string;
  client: Client;
  scope: ToolScope;
}

import { TOOL_EXECUTION_TIMEOUT_MS } from "../../constants/timeouts.js";

const MCP_CONNECT_TIMEOUT_MS = 30_000;

/**
 * Allowed MCP server command binaries.
 * Only these commands are permitted to spawn MCP stdio servers.
 */
const ALLOWED_MCP_COMMANDS = new Set(["npx", "node", "python3", "python", "uvx", "deno", "bun"]);

/**
 * Shell metacharacters that must not appear in a command string.
 * Their presence indicates an attempt to inject shell commands.
 */
const SHELL_METACHARACTERS = /[|;&$()`{}\\]/;

/**
 * Validate an MCP server command string.
 * Throws if the command is not in the allowlist or contains shell metacharacters.
 */
function validateMcpCommand(command: string): void {
  if (SHELL_METACHARACTERS.test(command)) {
    throw new Error(
      `MCP server command contains shell metacharacters: "${command}". ` +
        "Use the explicit 'args' array instead of inline command strings with pipes/redirects."
    );
  }

  const binary = command.split(/\s+/)[0];

  // Allow absolute paths only if they resolve to an allowed binary
  if (binary.startsWith("/")) {
    const baseName = binary.split("/").pop() ?? binary;
    if (!ALLOWED_MCP_COMMANDS.has(baseName)) {
      throw new Error(
        `MCP server command "${binary}" is not in the allowed commands list. ` +
          `Allowed: ${[...ALLOWED_MCP_COMMANDS].join(", ")}. ` +
          "Use the explicit 'args' array for custom commands."
      );
    }
  } else if (!ALLOWED_MCP_COMMANDS.has(binary)) {
    throw new Error(
      `MCP server command "${binary}" is not in the allowed commands list. ` +
        `Allowed: ${[...ALLOWED_MCP_COMMANDS].join(", ")}. ` +
        "Use the explicit 'args' array for custom commands."
    );
  }
}

/**
 * Parse a command string into command + args.
 * If explicit args are provided in config, uses those instead.
 * Validates the command against the allowlist.
 */
function parseCommand(config: McpServerConfig): { command: string; args: string[] } {
  if (!config.command) throw new Error("No command specified");

  // Validate command before any parsing
  validateMcpCommand(config.command);

  if (config.args) {
    return { command: config.command, args: config.args };
  }

  const parts = config.command.split(/\s+/);
  return { command: parts[0], args: parts.slice(1) };
}

/**
 * Extract text content from MCP tool result content array.
 */
function extractText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text ?? "")
    .join("\n");
}

/**
 * Connect to all configured MCP servers in parallel.
 * Failed connections are logged and skipped.
 */
export async function loadMcpServers(config: McpConfig): Promise<McpConnection[]> {
  const entries = Object.entries(config.servers).filter(([, cfg]) => cfg.enabled !== false);

  if (entries.length === 0) return [];

  const results = await Promise.allSettled(
    entries.map(async ([name, serverConfig]): Promise<McpConnection> => {
      let transport;

      if (serverConfig.command) {
        const { command, args } = parseCommand(serverConfig);
        // Only forward essential environment vars to child processes
        const safeEnv: Record<string, string> = {};
        for (const key of ["PATH", "HOME", "NODE_PATH", "LANG", "TERM"]) {
          if (process.env[key]) safeEnv[key] = process.env[key] ?? "";
        }

        // Block dangerous env vars that could enable code injection or credential theft
        const BLOCKED_ENV_KEYS = new Set([
          // Library injection
          "LD_PRELOAD",
          "LD_LIBRARY_PATH",
          "DYLD_INSERT_LIBRARIES",
          "DYLD_LIBRARY_PATH",
          // Node.js injection
          "NODE_OPTIONS",
          "NODE_EXTRA_CA_CERTS",
          "ELECTRON_RUN_AS_NODE",
          // Python injection
          "PYTHONPATH",
          "PYTHONSTARTUP",
          "PYTHONINSPECT",
          // Ruby/Perl injection
          "RUBYLIB",
          "PERL5LIB",
          "PERLLIB",
          // SSL/TLS interception
          "SSL_CERT_FILE",
          "SSL_CERT_DIR",
          // Path manipulation
          "PATH",
          // Home directory manipulation
          "HOME",
        ]);
        const filteredEnv: Record<string, string> = {};
        for (const [k, v] of Object.entries(serverConfig.env ?? {})) {
          if (BLOCKED_ENV_KEYS.has(k.toUpperCase())) {
            log.warn({ key: k, server: name }, "Blocked dangerous env var for MCP server");
          } else {
            filteredEnv[k] = v;
          }
        }

        transport = new StdioClientTransport({
          command,
          args,
          env: { ...safeEnv, ...filteredEnv },
          stderr: "pipe",
        });
      } else if (serverConfig.url) {
        transport = new StreamableHTTPClientTransport(new URL(serverConfig.url));
      } else {
        throw new Error(`MCP server "${name}": needs 'command' or 'url'`);
      }

      const client = new Client({ name: `teleton-${name}`, version: "1.0.0" });

      // Connect with timeout; for URL servers, try Streamable HTTP then fall back to SSE
      let timeoutHandle: ReturnType<typeof setTimeout>;
      try {
        await Promise.race([
          client.connect(transport),
          new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(
              () =>
                reject(new Error(`Connection timed out after ${MCP_CONNECT_TIMEOUT_MS / 1000}s`)),
              MCP_CONNECT_TIMEOUT_MS
            );
          }),
        ]).finally(() => clearTimeout(timeoutHandle));
      } catch (err) {
        // If Streamable HTTP failed on a URL server, retry with SSE
        if (serverConfig.url && transport instanceof StreamableHTTPClientTransport) {
          await client.close().catch(() => {});
          log.info({ server: name }, "Streamable HTTP failed, falling back to SSE");
          transport = new SSEClientTransport(new URL(serverConfig.url));
          const fallbackClient = new Client({ name: `teleton-${name}`, version: "1.0.0" });
          await Promise.race([
            fallbackClient.connect(transport),
            new Promise<never>((_, reject) => {
              timeoutHandle = setTimeout(
                () =>
                  reject(
                    new Error(`SSE fallback timed out after ${MCP_CONNECT_TIMEOUT_MS / 1000}s`)
                  ),
                MCP_CONNECT_TIMEOUT_MS
              );
            }),
          ]).finally(() => clearTimeout(timeoutHandle));
          return {
            serverName: name,
            client: fallbackClient,
            scope: serverConfig.scope ?? "admin-only",
          };
        }
        throw err;
      }

      return { serverName: name, client, scope: serverConfig.scope ?? "admin-only" };
    })
  );

  const connections: McpConnection[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const [name] = entries[i];
    if (result.status === "fulfilled") {
      connections.push(result.value);
    } else {
      const reason =
        result.reason instanceof Error
          ? (result.reason.stack ?? result.reason.message)
          : result.reason;
      log.warn({ server: name, reason }, `MCP server "${name}" failed to connect`);
    }
  }

  return connections;
}

/**
 * Discover tools from connected MCP servers and register them in the ToolRegistry.
 * Tool names are prefixed: mcp_<server>_<tool_name>
 */
export async function registerMcpTools(
  connections: McpConnection[],
  registry: ToolRegistry
): Promise<{ count: number; names: string[] }> {
  let totalCount = 0;
  const serverNames: string[] = [];

  for (const conn of connections) {
    try {
      const { tools: mcpTools } = await conn.client.listTools();

      if (!mcpTools || mcpTools.length === 0) continue;

      const registryTools: Array<{ tool: Tool; executor: ToolExecutor; scope?: ToolScope }> = [];

      for (const mcpTool of mcpTools) {
        const prefixedName = `mcp_${conn.serverName}_${mcpTool.name}`;

        const executor: ToolExecutor = async (params): Promise<ToolResult> => {
          try {
            let timeoutHandle: ReturnType<typeof setTimeout>;
            const result = await Promise.race([
              conn.client.callTool({
                name: mcpTool.name,
                arguments: params as Record<string, unknown>,
              }),
              new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(
                  () =>
                    reject(
                      new Error(
                        `MCP tool "${mcpTool.name}" timed out after ${TOOL_EXECUTION_TIMEOUT_MS / 1000}s`
                      )
                    ),
                  TOOL_EXECUTION_TIMEOUT_MS
                );
              }),
            ]).finally(() => clearTimeout(timeoutHandle));

            if (result.isError) {
              const errorText = extractText(
                result.content as Array<{ type: string; text?: string }>
              );
              return {
                success: false,
                error: sanitizeForContext(errorText) || "MCP tool returned error",
              };
            }

            const text = extractText(result.content as Array<{ type: string; text?: string }>);
            return { success: true, data: sanitizeForContext(text) };
          } catch (error) {
            return {
              success: false,
              error: `MCP tool "${mcpTool.name}" failed: ${getErrorMessage(error)}`,
            };
          }
        };

        const schema = mcpTool.inputSchema ?? { type: "object", properties: {} };
        if (
          !schema.properties ||
          Object.keys(schema.properties as Record<string, unknown>).length === 0
        ) {
          log.warn(
            { tool: mcpTool.name, server: conn.serverName },
            "MCP tool has no parameter schema — inputs will not be validated"
          );
        }

        registryTools.push({
          tool: {
            name: prefixedName,
            description: mcpTool.description || `MCP tool from ${conn.serverName}`,
            parameters: schema as unknown as Tool["parameters"],
          },
          executor,
          scope: conn.scope,
        });
      }

      const count = registry.registerPluginTools(`mcp_${conn.serverName}`, registryTools);
      if (count > 0) {
        totalCount += count;
        serverNames.push(conn.serverName);
      }
    } catch (error) {
      log.warn(
        `MCP server "${conn.serverName}" tool discovery failed: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  return { count: totalCount, names: serverNames };
}

/**
 * Gracefully close all MCP connections (kills stdio child processes).
 */
export async function closeMcpServers(connections: McpConnection[]): Promise<void> {
  await Promise.allSettled(
    connections.map(async (conn) => {
      try {
        await conn.client.close();
      } catch (error) {
        log.warn(
          `MCP server "${conn.serverName}" close failed: ${error instanceof Error ? error.message : error}`
        );
      }
    })
  );
}
