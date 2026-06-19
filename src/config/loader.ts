import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { parse, stringify } from "yaml";
import { homedir } from "os";
import { dirname, join } from "path";
import { ConfigSchema, type Config } from "./schema.js";
import { getProviderMetadata, type SupportedProvider } from "./providers.js";
import { TELETON_ROOT } from "../workspace/paths.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("Config");

const DEFAULT_CONFIG_PATH = join(TELETON_ROOT, "config.yaml");

export function expandPath(path: string): string {
  if (path.startsWith("~")) {
    return join(homedir(), path.slice(1));
  }
  return path;
}

/**
 * Known placeholder strings that appear in config.example.yaml.
 * If any of these values are found in the loaded config, a warning is emitted
 * so users know they forgot to replace example secrets with real ones.
 */
const PLACEHOLDER_PATTERNS = [
  /^YOUR_/i,
  /^your_/,
  /^\+1234567890$/,
  /^0$/, // telegram.api_id = 0 is the example default
];

interface PlaceholderCheck {
  field: string;
  value: string | number | undefined | null;
}

function isPlaceholder(value: string | number | undefined | null): boolean {
  if (value === null || value === undefined) return false;
  const str = String(value);
  return PLACEHOLDER_PATTERNS.some((re) => re.test(str));
}

/**
 * Emit warnings for any config fields that still contain placeholder values
 * from config.example.yaml. Does not throw — the config is still usable,
 * but the agent will likely fail to connect with placeholder credentials.
 */
function warnPlaceholders(config: Config): void {
  const checks: PlaceholderCheck[] = [
    { field: "agent.api_key", value: config.agent.api_key },
    { field: "telegram.api_hash", value: config.telegram.api_hash },
    { field: "telegram.phone", value: config.telegram.phone },
    { field: "telegram.api_id", value: config.telegram.api_id },
  ];

  for (const { field, value } of checks) {
    if (isPlaceholder(value)) {
      log.warn(
        { field },
        `Config field '${field}' still contains a placeholder value. ` +
          "Replace it with a real value or run 'teleton setup'."
      );
    }
  }
}

export function loadConfig(configPath: string = DEFAULT_CONFIG_PATH): Config {
  const fullPath = expandPath(configPath);

  if (!existsSync(fullPath)) {
    throw new Error(`Config file not found: ${fullPath}\nRun 'teleton setup' to create one.`);
  }

  let content: string;
  try {
    content = readFileSync(fullPath, "utf-8");
  } catch (error) {
    throw new Error(`Cannot read config file ${fullPath}: ${(error as Error).message}`);
  }

  let raw: unknown;
  try {
    // SECURITY FIX L-01: Use JSON_SCHEMA to prevent YAML deserialization attacks (CWE-502)
    // SECURITY FIX L-01: Use 'core' schema (YAML 1.2) for safe deserialization.
    // This rejects unsafe YAML tags like !!js/function that could execute arbitrary code
    // while still supporting standard YAML types (strings, numbers, booleans, etc.).
    raw = parse(content, { schema: "core" });
  } catch (error) {
    throw new Error(`Invalid YAML in ${fullPath}: ${(error as Error).message}`);
  }

  // Backward compatibility: remove deprecated market key before parsing
  if (raw && typeof raw === "object" && "market" in (raw as Record<string, unknown>)) {
    log.warn("config.market is deprecated and ignored. Use market-api plugin instead.");
    delete (raw as Record<string, unknown>).market;
  }

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid config: ${result.error.message}`);
  }

  const config = result.data;
  const provider = config.agent.provider as SupportedProvider;
  if (
    provider !== "anthropic" &&
    provider !== "claude-code" &&
    !(raw as Record<string, Record<string, unknown>>).agent?.model
  ) {
    const meta = getProviderMetadata(provider);
    config.agent.model = meta.defaultModel;
  }

  config.telegram.session_path = expandPath(config.telegram.session_path);
  config.storage.sessions_file = expandPath(config.storage.sessions_file);
  config.storage.memory_file = expandPath(config.storage.memory_file);

  // Warn when example-file placeholder values are still present in the config.
  // These indicate the user copied config.example.yaml without filling in real values.
  warnPlaceholders(config);

  // ─── Environment Variable Overrides (with validation) ─────────────────────
  // All env vars are validated against the same Zod constraints before assignment.
  // After all overrides, the full config is re-validated to catch any divergence.

  if (process.env.TELETON_API_KEY !== undefined) {
    const key = process.env.TELETON_API_KEY.trim();
    if (key.length === 0) {
      throw new Error("Invalid TELETON_API_KEY: empty string");
    }
    if (key.length < 8) {
      throw new Error(`Invalid TELETON_API_KEY: too short (${key.length} chars, minimum 8)`);
    }
    config.agent.api_key = key;
  }

  if (process.env.TELETON_TG_API_ID !== undefined) {
    const apiId = parseInt(process.env.TELETON_TG_API_ID, 10);
    if (isNaN(apiId)) {
      throw new Error(
        `Invalid TELETON_TG_API_ID: "${process.env.TELETON_TG_API_ID}" is not a valid integer`
      );
    }
    config.telegram.api_id = apiId;
  }

  if (process.env.TELETON_TG_API_HASH !== undefined) {
    const hash = process.env.TELETON_TG_API_HASH.trim();
    if (hash.length === 0) {
      throw new Error("Invalid TELETON_TG_API_HASH: empty string");
    }
    config.telegram.api_hash = hash;
  }

  if (process.env.TELETON_TG_PHONE !== undefined) {
    const phone = process.env.TELETON_TG_PHONE.trim();
    if (phone.length === 0) {
      throw new Error("Invalid TELETON_TG_PHONE: empty string");
    }
    config.telegram.phone = phone;
  }

  // WebUI environment variable overrides
  if (process.env.TELETON_WEBUI_ENABLED) {
    const val = process.env.TELETON_WEBUI_ENABLED.toLowerCase();
    if (val !== "true" && val !== "false") {
      throw new Error(
        `Invalid TELETON_WEBUI_ENABLED: "${process.env.TELETON_WEBUI_ENABLED}" — must be "true" or "false"`
      );
    }
    config.webui.enabled = val === "true";
  }

  if (process.env.TELETON_WEBUI_PORT) {
    const port = parsePort(process.env.TELETON_WEBUI_PORT, "TELETON_WEBUI_PORT");
    config.webui.port = port;
  }

  if (process.env.TELETON_WEBUI_HOST) {
    const host = process.env.TELETON_WEBUI_HOST.trim();
    if (host.length === 0) {
      throw new Error("Invalid TELETON_WEBUI_HOST: empty string");
    }
    // Hard-block non-loopback when no auth_token is configured
    if (!config.webui.auth_token && !["127.0.0.1", "localhost", "::1"].includes(host)) {
      throw new Error(
        `Refusing to bind WebUI to non-loopback address "${host}" without auth_token. ` +
          "Set webui.auth_token in config or TELETON_WEBUI_AUTH_TOKEN env var, " +
          "or use a loopback address (127.0.0.1, localhost, ::1)."
      );
    }
    config.webui.host = host;
    if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
      log.warn({ host }, "WebUI bound to non-loopback address — ensure auth_token is set");
    }
  }

  // WebUI auth token override
  if (process.env.TELETON_WEBUI_AUTH_TOKEN) {
    const token = process.env.TELETON_WEBUI_AUTH_TOKEN.trim();
    if (token.length === 0) {
      throw new Error("Invalid TELETON_WEBUI_AUTH_TOKEN: empty string");
    }
    config.webui.auth_token = token;
  }

  // Management API environment variable overrides
  if (process.env.TELETON_API_ENABLED) {
    const val = process.env.TELETON_API_ENABLED.toLowerCase();
    if (val !== "true" && val !== "false") {
      throw new Error(
        `Invalid TELETON_API_ENABLED: "${process.env.TELETON_API_ENABLED}" — must be "true" or "false"`
      );
    }
    if (!config.api) config.api = { enabled: false, port: 7778, key_hash: "", allowed_ips: [] };
    config.api.enabled = val === "true";
  }

  if (process.env.TELETON_API_PORT) {
    const port = parsePort(process.env.TELETON_API_PORT, "TELETON_API_PORT");
    if (!config.api) config.api = { enabled: false, port: 7778, key_hash: "", allowed_ips: [] };
    config.api.port = port;
  }

  // Local LLM base URL override — must be valid URL with http/https scheme
  if (process.env.TELETON_BASE_URL) {
    const raw = process.env.TELETON_BASE_URL.trim();
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error(`Invalid TELETON_BASE_URL: "${raw}" is not a valid URL`);
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(
        `Invalid TELETON_BASE_URL: "${raw}" — scheme must be http or https, got "${parsed.protocol}"`
      );
    }
    config.agent.base_url = raw;
  }

  // Optional API key overrides — reject empty strings
  // Use `!== undefined` instead of truthy check so empty string "" is caught
  if (process.env.TELETON_TAVILY_API_KEY !== undefined) {
    const key = process.env.TELETON_TAVILY_API_KEY.trim();
    if (key.length === 0) throw new Error("Invalid TELETON_TAVILY_API_KEY: empty string");
    config.tavily_api_key = key;
  }
  if (process.env.TELETON_TONAPI_KEY !== undefined) {
    const key = process.env.TELETON_TONAPI_KEY.trim();
    if (key.length === 0) throw new Error("Invalid TELETON_TONAPI_KEY: empty string");
    config.tonapi_key = key;
  }
  if (process.env.TELETON_TONCENTER_API_KEY !== undefined) {
    const key = process.env.TELETON_TONCENTER_API_KEY.trim();
    if (key.length === 0) throw new Error("Invalid TELETON_TONCENTER_API_KEY: empty string");
    config.toncenter_api_key = key;
  }

  // ─── Re-validate after all env var overrides ───────────────────────────────
  // This catches any divergence between the validated config and the final state
  // after all environment variable mutations have been applied.
  const revalidated = ConfigSchema.safeParse(config);
  if (!revalidated.success) {
    throw new Error(
      `Config validation failed after environment variable overrides: ${revalidated.error.message}`
    );
  }

  return revalidated.data;
}

/**
 * Parse and validate a port number from a string env var.
 * Enforces the same range as the Zod schema: 1024-65535 (non-privileged ports).
 */
function parsePort(raw: string, varName: string): number {
  const port = parseInt(raw, 10);
  if (isNaN(port)) {
    throw new Error(`Invalid ${varName}: "${raw}" is not a valid integer`);
  }
  if (port < 1024 || port > 65535) {
    throw new Error(`Invalid ${varName}: ${port} — must be between 1024 and 65535`);
  }
  return port;
}

export function saveConfig(config: Config, configPath: string = DEFAULT_CONFIG_PATH): void {
  const result = ConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Refusing to save invalid config: ${result.error.message}`);
  }

  const fullPath = expandPath(configPath);
  const dir = dirname(fullPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  config.meta.last_modified_at = new Date().toISOString();
  writeFileSync(fullPath, stringify(config), { encoding: "utf-8", mode: 0o600 });
}

export function configExists(configPath: string = DEFAULT_CONFIG_PATH): boolean {
  return existsSync(expandPath(configPath));
}

export function getDefaultConfigPath(): string {
  return DEFAULT_CONFIG_PATH;
}
