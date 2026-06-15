import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { existsSync, mkdirSync, writeFileSync, unlinkSync, rmdirSync } from "fs";
import { dirname, join } from "path";
import { tmpdir, homedir } from "os";
import {
  loadConfig,
  saveConfig,
  configExists,
  expandPath,
  getDefaultConfigPath,
} from "../loader.js";
import type { Config } from "../schema.js";

// ─── Test Fixtures ─────────────────────────────────────────────────────────────

const TEST_DIR = join(tmpdir(), "teleton-config-test");
const TEST_CONFIG_PATH = join(TEST_DIR, "test-config.yaml");

// Minimal valid config
const MINIMAL_CONFIG = `
agent:
  api_key: sk-ant-api03-test123
  provider: anthropic
telegram:
  api_id: 12345
  api_hash: abcdef1234567890
  phone: "+1234567890"
`;

// Full config with all optional fields
const FULL_CONFIG = `
meta:
  version: "1.0.0"
  created_at: "2026-01-01T00:00:00.000Z"
  onboard_command: "teleton setup"

agent:
  provider: anthropic
  api_key: sk-ant-api03-fulltest456
  model: claude-opus-4-5-20251101
  utility_model: claude-haiku-4-5-20251001
  max_tokens: 8192
  temperature: 0.8
  system_prompt: "Custom system prompt"
  max_agentic_iterations: 10
  session_reset_policy:
    daily_reset_enabled: true
    daily_reset_hour: 3
    idle_expiry_enabled: false
    idle_expiry_minutes: 720

telegram:
  api_id: 99999
  api_hash: "test_hash_9999"
  phone: "+9999999999"
  session_name: "custom_session"
  session_path: "~/custom_path"
  dm_policy: allowlist
  allow_from: [111, 222, 333]
  group_policy: disabled
  group_allow_from: []
  require_mention: false
  max_message_length: 2048
  typing_simulation: false
  rate_limit_messages_per_second: 0.5
  rate_limit_groups_per_minute: 10
  admin_ids: [444, 555]
  agent_channel: "@testchannel"
  owner_name: "TestOwner"
  owner_username: "testuser"
  owner_id: 666
  debounce_ms: 2000
  bot_token: "1234567890:ABCDEF"
  bot_username: "testbot"

storage:
  sessions_file: "~/custom_sessions.json"
  memory_file: "~/custom_memory.json"
  history_limit: 50

deals:
  enabled: false
  expiry_seconds: 60
  buy_max_floor_percent: 90
  sell_min_floor_percent: 110
  poll_interval_ms: 3000
  max_verification_retries: 5
  expiry_check_interval_ms: 30000

webui:
  enabled: true
  port: 8888
  host: "0.0.0.0"
  auth_token: "custom_token_123"
  cors_origins: ["http://localhost:3000"]
  log_requests: true

dev:
  hot_reload: true

plugins:
  casino:
    max_bet: 1000
  market_api:
    api_key: "market_test_key"

tonapi_key: "tonapi_test_key_456"
`;

// Config with missing required fields
const INVALID_MISSING_FIELDS = `
agent:
  provider: anthropic
telegram:
  api_id: 12345
`;

// Config with invalid types
const INVALID_TYPES = `
agent:
  api_key: sk-ant-test
  provider: anthropic
telegram:
  api_id: "not_a_number"
  api_hash: abcdef
  phone: "+1234567890"
`;

// Config with invalid provider
const INVALID_PROVIDER = `
agent:
  api_key: sk-ant-test
  provider: invalid_provider
telegram:
  api_id: 12345
  api_hash: abcdef
  phone: "+1234567890"
`;

// Config with deprecated market field
const DEPRECATED_MARKET = `
agent:
  api_key: sk-ant-test
  provider: anthropic
telegram:
  api_id: 12345
  api_hash: abcdef
  phone: "+1234567890"
market:
  enabled: true
  deprecated_field: "should be ignored"
`;

// Config for non-anthropic provider (should auto-set model)
const OPENAI_CONFIG = `
agent:
  api_key: sk-proj-test123
  provider: openai
telegram:
  api_id: 12345
  api_hash: abcdef
  phone: "+1234567890"
`;

// ─── Test Utilities ────────────────────────────────────────────────────────────

function writeTestConfig(content: string, path: string = TEST_CONFIG_PATH): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, content, "utf-8");
}

function cleanupTestFiles(): void {
  try {
    if (existsSync(TEST_CONFIG_PATH)) {
      unlinkSync(TEST_CONFIG_PATH);
    }
    if (existsSync(TEST_DIR)) {
      const files = require("fs").readdirSync(TEST_DIR);
      files.forEach((file: string) => {
        const filePath = join(TEST_DIR, file);
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
      });
      rmdirSync(TEST_DIR);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe("Config Loader", () => {
  // Store original env vars to restore after tests
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save original env vars
    const envKeys = [
      "TELETON_API_KEY",
      "TELETON_TG_API_ID",
      "TELETON_TG_API_HASH",
      "TELETON_TG_PHONE",
      "TELETON_WEBUI_ENABLED",
      "TELETON_WEBUI_PORT",
      "TELETON_WEBUI_HOST",
      "TELETON_WEBUI_AUTH_TOKEN",
      "TELETON_API_ENABLED",
      "TELETON_API_PORT",
      "TELETON_BASE_URL",
      "TELETON_TAVILY_API_KEY",
      "TELETON_TONAPI_KEY",
      "TELETON_TONCENTER_API_KEY",
    ];
    for (const key of envKeys) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore original env vars after each test
    for (const key of Object.keys(originalEnv)) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  afterAll(() => {
    cleanupTestFiles();
  });

  // ─── Path Expansion Tests ──────────────────────────────────────────────────

  describe("expandPath", () => {
    it("should expand tilde to home directory", () => {
      const expanded = expandPath("~/test/path");
      expect(expanded).toBe(join(homedir(), "test/path"));
    });

    it("should not modify absolute paths", () => {
      const absolute = "/absolute/path";
      expect(expandPath(absolute)).toBe(absolute);
    });

    it("should not modify relative paths without tilde", () => {
      const relative = "relative/path";
      expect(expandPath(relative)).toBe(relative);
    });

    it("should handle tilde-only path", () => {
      const expanded = expandPath("~");
      expect(expanded).toBe(homedir());
    });
  });

  // ─── Basic Loading Tests ───────────────────────────────────────────────────

  describe("loadConfig - basic functionality", () => {
    it("should load minimal valid config successfully", () => {
      writeTestConfig(MINIMAL_CONFIG);
      const config = loadConfig(TEST_CONFIG_PATH);

      expect(config.agent.api_key).toBe("sk-ant-api03-test123");
      expect(config.agent.provider).toBe("anthropic");
      expect(config.telegram.api_id).toBe(12345);
      expect(config.telegram.api_hash).toBe("abcdef1234567890");
      expect(config.telegram.phone).toBe("+1234567890");
    });

    it("should load full config with all optional fields", () => {
      writeTestConfig(FULL_CONFIG);
      const config = loadConfig(TEST_CONFIG_PATH);

      // Meta
      expect(config.meta.version).toBe("1.0.0");
      expect(config.meta.created_at).toBe("2026-01-01T00:00:00.000Z");

      // Agent
      expect(config.agent.model).toBe("claude-opus-4-5-20251101");
      expect(config.agent.utility_model).toBe("claude-haiku-4-5-20251001");
      expect(config.agent.max_tokens).toBe(8192);
      expect(config.agent.temperature).toBe(0.8);
      expect(config.agent.max_agentic_iterations).toBe(10);
      expect(config.agent.session_reset_policy.daily_reset_hour).toBe(3);
      expect(config.agent.session_reset_policy.idle_expiry_enabled).toBe(false);

      // Telegram
      expect(config.telegram.session_name).toBe("custom_session");
      expect(config.telegram.dm_policy).toBe("allowlist");
      expect(config.telegram.allow_from).toEqual([111, 222, 333]);
      expect(config.telegram.owner_name).toBe("TestOwner");
      expect(config.telegram.debounce_ms).toBe(2000);

      // Storage
      expect(config.storage.history_limit).toBe(50);

      // Deals
      expect(config.deals.enabled).toBe(false);
      expect(config.deals.expiry_seconds).toBe(60);

      // WebUI
      expect(config.webui.enabled).toBe(true);
      expect(config.webui.port).toBe(8888);

      // Dev
      expect(config.dev.hot_reload).toBe(true);

      // Plugins
      expect(config.plugins.casino).toEqual({ max_bet: 1000 });

      // TonAPI
      expect(config.tonapi_key).toBe("tonapi_test_key_456");
    });

    it("should throw error when config file does not exist", () => {
      const nonExistentPath = join(TEST_DIR, "nonexistent.yaml");
      expect(() => loadConfig(nonExistentPath)).toThrow(/Config file not found/);
    });

    it("should throw error on invalid YAML syntax", () => {
      writeTestConfig("invalid: yaml: syntax: [unclosed");
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(/Invalid YAML/);
    });

    it("should throw error on missing required fields", () => {
      writeTestConfig(INVALID_MISSING_FIELDS);
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(/Invalid config/);
    });

    it("should throw error on invalid field types", () => {
      writeTestConfig(INVALID_TYPES);
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(/Invalid config/);
    });

    it("should reject invalid provider names", () => {
      writeTestConfig(INVALID_PROVIDER);
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(/Invalid config/);
    });
  });

  // ─── Default Values Tests ──────────────────────────────────────────────────

  describe("loadConfig - default values", () => {
    it("should apply default values for optional fields", () => {
      writeTestConfig(MINIMAL_CONFIG);
      const config = loadConfig(TEST_CONFIG_PATH);

      // Agent defaults
      expect(config.agent.model).toBe("claude-opus-4-6");
      expect(config.agent.max_tokens).toBe(4096);
      expect(config.agent.temperature).toBe(0.7);
      expect(config.agent.max_agentic_iterations).toBe(5);
      expect(config.agent.session_reset_policy.daily_reset_enabled).toBe(true);
      expect(config.agent.session_reset_policy.daily_reset_hour).toBe(4);
      expect(config.agent.session_reset_policy.idle_expiry_enabled).toBe(true);
      expect(config.agent.session_reset_policy.idle_expiry_minutes).toBe(1440);

      // Telegram defaults
      expect(config.telegram.session_name).toBe("teleton_session");
      expect(config.telegram.dm_policy).toBe("allowlist");
      expect(config.telegram.group_policy).toBe("open");
      expect(config.telegram.require_mention).toBe(true);
      expect(config.telegram.typing_simulation).toBe(true);
      expect(config.telegram.debounce_ms).toBe(1500);

      // Storage defaults
      expect(config.storage.history_limit).toBe(100);

      // Deals defaults
      expect(config.deals.enabled).toBe(true);
      expect(config.deals.expiry_seconds).toBe(120);

      // WebUI defaults
      expect(config.webui.enabled).toBe(false);
      expect(config.webui.port).toBe(7777);
      expect(config.webui.host).toBe("127.0.0.1");

      // Dev defaults
      expect(config.dev.hot_reload).toBe(false);

      // Plugins defaults
      expect(config.plugins).toEqual({});
    });

    it("should auto-set model for non-anthropic providers", () => {
      writeTestConfig(OPENAI_CONFIG);
      const config = loadConfig(TEST_CONFIG_PATH);

      expect(config.agent.provider).toBe("openai");
      expect(config.agent.model).toBe("gpt-5.4");
    });

    it("should not override explicit model for non-anthropic providers", () => {
      const configWithModel = `
agent:
  api_key: sk-proj-test
  provider: openai
  model: gpt-4o-mini
telegram:
  api_id: 12345
  api_hash: abcdef
  phone: "+1234567890"
`;
      writeTestConfig(configWithModel);
      const config = loadConfig(TEST_CONFIG_PATH);

      expect(config.agent.model).toBe("gpt-4o-mini");
    });
  });

  // ─── Environment Variable Override Tests ───────────────────────────────────

  describe("loadConfig - environment variable overrides", () => {
    it("should override api_key with TELETON_API_KEY", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_API_KEY = "sk-ant-override-key";

      const config = loadConfig(TEST_CONFIG_PATH);
      expect(config.agent.api_key).toBe("sk-ant-override-key");
    });

    it("should override telegram api_id with TELETON_TG_API_ID", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_TG_API_ID = "99999";

      const config = loadConfig(TEST_CONFIG_PATH);
      expect(config.telegram.api_id).toBe(99999);
    });

    it("should throw error on invalid TELETON_TG_API_ID format", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_TG_API_ID = "not_a_number";

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        /Invalid TELETON_TG_API_ID.*not a valid integer/
      );
    });

    it("should override telegram api_hash with TELETON_TG_API_HASH", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_TG_API_HASH = "override_hash";

      const config = loadConfig(TEST_CONFIG_PATH);
      expect(config.telegram.api_hash).toBe("override_hash");
    });

    it("should override telegram phone with TELETON_TG_PHONE", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_TG_PHONE = "+9999999999";

      const config = loadConfig(TEST_CONFIG_PATH);
      expect(config.telegram.phone).toBe("+9999999999");
    });

    it("should override webui enabled with TELETON_WEBUI_ENABLED=true", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_WEBUI_ENABLED = "true";

      const config = loadConfig(TEST_CONFIG_PATH);
      expect(config.webui.enabled).toBe(true);
    });

    it("should override webui enabled with TELETON_WEBUI_ENABLED=false", () => {
      writeTestConfig(FULL_CONFIG); // WebUI enabled in config
      process.env.TELETON_WEBUI_ENABLED = "false";

      const config = loadConfig(TEST_CONFIG_PATH);
      expect(config.webui.enabled).toBe(false);
    });

    it("should override webui port with TELETON_WEBUI_PORT", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_WEBUI_PORT = "9999";

      const config = loadConfig(TEST_CONFIG_PATH);
      expect(config.webui.port).toBe(9999);
    });

    it("should throw error on invalid TELETON_WEBUI_PORT", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_WEBUI_PORT = "not_a_number";

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        /Invalid TELETON_WEBUI_PORT.*not a valid integer/
      );
    });

    it("should throw error on TELETON_WEBUI_PORT below 1024", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_WEBUI_PORT = "80";

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        /Invalid TELETON_WEBUI_PORT.*must be between 1024 and 65535/
      );
    });

    it("should throw error on TELETON_WEBUI_PORT above 65535", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_WEBUI_PORT = "99999";

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        /Invalid TELETON_WEBUI_PORT.*must be between 1024 and 65535/
      );
    });

    it("should override webui host with TELETON_WEBUI_HOST when auth_token is set", () => {
      writeTestConfig(FULL_CONFIG); // has auth_token
      process.env.TELETON_WEBUI_HOST = "0.0.0.0";

      const config = loadConfig(TEST_CONFIG_PATH);
      expect(config.webui.host).toBe("0.0.0.0");
    });

    it("should throw error on non-loopback TELETON_WEBUI_HOST without auth_token", () => {
      writeTestConfig(MINIMAL_CONFIG); // no auth_token
      process.env.TELETON_WEBUI_HOST = "0.0.0.0";

      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        /Refusing to bind WebUI to non-loopback address/
      );
    });

    it("should allow loopback TELETON_WEBUI_HOST without auth_token", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_WEBUI_HOST = "127.0.0.1";

      const config = loadConfig(TEST_CONFIG_PATH);
      expect(config.webui.host).toBe("127.0.0.1");
    });

    it("should handle multiple env var overrides simultaneously", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_API_KEY = "sk-multi-override";
      process.env.TELETON_TG_API_ID = "77777";
      process.env.TELETON_WEBUI_ENABLED = "true";
      process.env.TELETON_WEBUI_PORT = "8080";

      const config = loadConfig(TEST_CONFIG_PATH);
      expect(config.agent.api_key).toBe("sk-multi-override");
      expect(config.telegram.api_id).toBe(77777);
      expect(config.webui.enabled).toBe(true);
      expect(config.webui.port).toBe(8080);
    });
  });

  // ─── Env Var Validation Tests ──────────────────────────────────────────────

  describe("loadConfig - env var validation", () => {
    // TELETON_API_KEY validation
    it("should reject empty TELETON_API_KEY", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_API_KEY = "";
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(/Invalid TELETON_API_KEY: empty string/);
    });

    it("should reject whitespace-only TELETON_API_KEY", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_API_KEY = "   ";
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(/Invalid TELETON_API_KEY: empty string/);
    });

    it("should reject short TELETON_API_KEY (< 8 chars)", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_API_KEY = "short";
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(/Invalid TELETON_API_KEY: too short/);
    });

    // TELETON_TG_API_HASH validation
    it("should reject empty TELETON_TG_API_HASH", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_TG_API_HASH = "";
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        /Invalid TELETON_TG_API_HASH: empty string/
      );
    });

    // TELETON_TG_PHONE validation
    it("should reject empty TELETON_TG_PHONE", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_TG_PHONE = "";
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(/Invalid TELETON_TG_PHONE: empty string/);
    });

    // TELETON_WEBUI_ENABLED validation
    it("should reject invalid TELETON_WEBUI_ENABLED value", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_WEBUI_ENABLED = "yes";
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        /Invalid TELETON_WEBUI_ENABLED.*must be "true" or "false"/
      );
    });

    it("should accept TELETON_WEBUI_ENABLED=True (case-insensitive)", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_WEBUI_ENABLED = "True";
      const config = loadConfig(TEST_CONFIG_PATH);
      expect(config.webui.enabled).toBe(true);
    });

    // TELETON_API_ENABLED validation
    it("should reject invalid TELETON_API_ENABLED value", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_API_ENABLED = "on";
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        /Invalid TELETON_API_ENABLED.*must be "true" or "false"/
      );
    });

    it("should accept TELETON_API_ENABLED=False (case-insensitive)", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_API_ENABLED = "False";
      const config = loadConfig(TEST_CONFIG_PATH);
      expect(config.api!.enabled).toBe(false);
    });

    // TELETON_API_PORT validation
    it("should throw error on invalid TELETON_API_PORT", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_API_PORT = "abc";
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        /Invalid TELETON_API_PORT.*not a valid integer/
      );
    });

    it("should throw error on TELETON_API_PORT below 1024", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_API_PORT = "22";
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        /Invalid TELETON_API_PORT.*must be between 1024 and 65535/
      );
    });

    // TELETON_BASE_URL validation
    it("should reject TELETON_BASE_URL with ftp scheme", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_BASE_URL = "ftp://example.com";
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        /Invalid TELETON_BASE_URL.*scheme must be http or https/
      );
    });

    it("should accept valid TELETON_BASE_URL with https", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_BASE_URL = "https://api.example.com/v1";
      const config = loadConfig(TEST_CONFIG_PATH);
      expect(config.agent.base_url).toBe("https://api.example.com/v1");
    });

    // Empty API key validation
    it("should reject empty TELETON_TAVILY_API_KEY", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_TAVILY_API_KEY = "";
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        /Invalid TELETON_TAVILY_API_KEY: empty string/
      );
    });

    it("should reject empty TELETON_TONAPI_KEY", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_TONAPI_KEY = "";
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        /Invalid TELETON_TONAPI_KEY: empty string/
      );
    });

    it("should reject empty TELETON_TONCENTER_API_KEY", () => {
      writeTestConfig(MINIMAL_CONFIG);
      process.env.TELETON_TONCENTER_API_KEY = "";
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(
        /Invalid TELETON_TONCENTER_API_KEY: empty string/
      );
    });

    // Re-validation after overrides
    it("should re-validate config after all env var overrides", () => {
      writeTestConfig(MINIMAL_CONFIG);
      // Set a valid api_key override — should pass re-validation
      process.env.TELETON_API_KEY = "sk-ant-valid-key-long-enough";
      const config = loadConfig(TEST_CONFIG_PATH);
      expect(config.agent.api_key).toBe("sk-ant-valid-key-long-enough");
    });
  });

  // ─── Path Expansion in Config Tests ────────────────────────────────────────

  describe("loadConfig - path expansion", () => {
    it("should expand tilde in telegram session_path", () => {
      writeTestConfig(MINIMAL_CONFIG);
      const config = loadConfig(TEST_CONFIG_PATH);

      expect(config.telegram.session_path).toBe(join(homedir(), ".teleton"));
    });

    it("should expand tilde in storage paths", () => {
      writeTestConfig(MINIMAL_CONFIG);
      const config = loadConfig(TEST_CONFIG_PATH);

      expect(config.storage.sessions_file).toBe(join(homedir(), ".teleton/sessions.json"));
      expect(config.storage.memory_file).toBe(join(homedir(), ".teleton/memory.json"));
    });

    it("should expand custom tilde paths", () => {
      const customPathConfig = `
agent:
  api_key: sk-ant-test
  provider: anthropic
telegram:
  api_id: 12345
  api_hash: abcdef
  phone: "+1234567890"
  session_path: "~/custom/session"
storage:
  sessions_file: "~/custom/sessions.json"
  memory_file: "~/custom/memory.json"
`;
      writeTestConfig(customPathConfig);
      const config = loadConfig(TEST_CONFIG_PATH);

      expect(config.telegram.session_path).toBe(join(homedir(), "custom/session"));
      expect(config.storage.sessions_file).toBe(join(homedir(), "custom/sessions.json"));
    });
  });

  // ─── Backward Compatibility Tests ──────────────────────────────────────────

  describe("loadConfig - backward compatibility", () => {
    it("should remove deprecated market field with warning", () => {
      writeTestConfig(DEPRECATED_MARKET);

      const config = loadConfig(TEST_CONFIG_PATH);

      // log.warn is pino — we verify the field is removed
      expect((config as any).market).toBeUndefined();
    });

    it("should accept config with extra unknown fields", () => {
      const configWithExtra = `
agent:
  api_key: sk-ant-test
  provider: anthropic
telegram:
  api_id: 12345
  api_hash: abcdef
  phone: "+1234567890"
unknown_field: "should be ignored"
another_unknown:
  nested: "value"
`;
      writeTestConfig(configWithExtra);

      // Zod's default behavior strips unknown fields, so this should not throw
      expect(() => loadConfig(TEST_CONFIG_PATH)).not.toThrow();
    });
  });

  // ─── Edge Cases Tests ──────────────────────────────────────────────────────

  describe("loadConfig - edge cases", () => {
    it("should handle empty config file", () => {
      writeTestConfig("");
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(/Invalid config/);
    });

    it("should handle config with only comments", () => {
      writeTestConfig("# This is a comment\n# Another comment");
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(/Invalid config/);
    });

    it("should handle config with null values", () => {
      const nullConfig = `
agent:
  api_key: sk-ant-test
  provider: anthropic
  system_prompt: null
telegram:
  api_id: 12345
  api_hash: abcdef
  phone: "+1234567890"
  agent_channel: null
`;
      writeTestConfig(nullConfig);
      const config = loadConfig(TEST_CONFIG_PATH);

      expect(config.agent.system_prompt).toBeNull();
      expect(config.telegram.agent_channel).toBeNull();
    });

    it("should handle zero values correctly", () => {
      const zeroConfig = `
agent:
  api_key: sk-ant-test
  provider: anthropic
  temperature: 0
  max_agentic_iterations: 0
telegram:
  api_id: 12345
  api_hash: abcdef
  phone: "+1234567890"
  debounce_ms: 0
`;
      writeTestConfig(zeroConfig);
      const config = loadConfig(TEST_CONFIG_PATH);

      expect(config.agent.temperature).toBe(0);
      expect(config.agent.max_agentic_iterations).toBe(0);
      expect(config.telegram.debounce_ms).toBe(0);
    });

    it("should validate provider enum values", () => {
      const providers = ["anthropic", "openai", "google", "xai", "groq", "openrouter", "moonshot"];

      providers.forEach((provider) => {
        const providerConfig = `
agent:
  api_key: sk-test-${provider}
  provider: ${provider}
telegram:
  api_id: 12345
  api_hash: abcdef
  phone: "+1234567890"
`;
        writeTestConfig(providerConfig);
        expect(() => loadConfig(TEST_CONFIG_PATH)).not.toThrow();
      });
    });

    it("should validate session_reset_policy hour range (0-23)", () => {
      const invalidHour = `
agent:
  api_key: sk-ant-test
  provider: anthropic
  session_reset_policy:
    daily_reset_hour: 24
telegram:
  api_id: 12345
  api_hash: abcdef
  phone: "+1234567890"
`;
      writeTestConfig(invalidHour);
      expect(() => loadConfig(TEST_CONFIG_PATH)).toThrow(/Invalid config/);
    });

    it("should handle empty arrays correctly", () => {
      const emptyArrays = `
agent:
  api_key: sk-ant-test
  provider: anthropic
telegram:
  api_id: 12345
  api_hash: abcdef
  phone: "+1234567890"
  allow_from: []
  admin_ids: []
`;
      writeTestConfig(emptyArrays);
      const config = loadConfig(TEST_CONFIG_PATH);

      expect(config.telegram.allow_from).toEqual([]);
      expect(config.telegram.admin_ids).toEqual([]);
    });
  });

  // ─── saveConfig Tests ──────────────────────────────────────────────────────

  describe("saveConfig", () => {
    it("should save valid config to file", () => {
      writeTestConfig(MINIMAL_CONFIG);
      const config = loadConfig(TEST_CONFIG_PATH);

      const newPath = join(TEST_DIR, "saved-config.yaml");
      saveConfig(config, newPath);

      expect(existsSync(newPath)).toBe(true);
    });

    it("should update last_modified_at timestamp", () => {
      writeTestConfig(MINIMAL_CONFIG);
      const config = loadConfig(TEST_CONFIG_PATH);

      const beforeTimestamp = config.meta.last_modified_at;
      const newPath = join(TEST_DIR, "timestamped-config.yaml");

      // Wait a tiny bit to ensure timestamp changes
      setTimeout(() => {
        saveConfig(config, newPath);
        const reloaded = loadConfig(newPath);

        expect(reloaded.meta.last_modified_at).not.toBe(beforeTimestamp);
        expect(reloaded.meta.last_modified_at).toBeDefined();
      }, 10);
    });

    it("should throw error on invalid config", () => {
      const invalidConfig = {
        agent: {
          provider: "invalid",
        },
      } as any;

      expect(() => saveConfig(invalidConfig, TEST_CONFIG_PATH)).toThrow(
        /Refusing to save invalid config/
      );
    });

    it("should create parent directory if it does not exist", () => {
      writeTestConfig(MINIMAL_CONFIG);
      const config = loadConfig(TEST_CONFIG_PATH);

      const nestedPath = join(TEST_DIR, "nested", "dir", "config.yaml");
      saveConfig(config, nestedPath);

      expect(existsSync(nestedPath)).toBe(true);
    });

    it("should set file permissions to 0o600", () => {
      // Windows does not support Unix file permissions in the same way
      if (process.platform === "win32") return;

      writeTestConfig(MINIMAL_CONFIG);
      const config = loadConfig(TEST_CONFIG_PATH);

      const secureConfigPath = join(TEST_DIR, "secure-config.yaml");
      saveConfig(config, secureConfigPath);

      const stats = require("fs").statSync(secureConfigPath);
      // Check that the file has restricted permissions (owner read/write only)
      // Mode 0o600 = 384 in decimal
      expect(stats.mode & 0o777).toBe(0o600);
    });
  });

  // ─── configExists Tests ────────────────────────────────────────────────────

  describe("configExists", () => {
    it("should return true when config exists", () => {
      writeTestConfig(MINIMAL_CONFIG);
      expect(configExists(TEST_CONFIG_PATH)).toBe(true);
    });

    it("should return false when config does not exist", () => {
      const nonExistentPath = join(TEST_DIR, "nonexistent.yaml");
      expect(configExists(nonExistentPath)).toBe(false);
    });

    it("should expand tilde paths", () => {
      // On Windows, ~ does not expand the same way — skip
      if (process.platform === "win32") return;

      const originalHome = process.env.HOME;
      process.env.HOME = TEST_DIR;
      try {
        const homePath = join(TEST_DIR, ".teleton-test-config.yaml");
        writeTestConfig(MINIMAL_CONFIG, homePath);
        expect(configExists("~/.teleton-test-config.yaml")).toBe(true);
        if (existsSync(homePath)) {
          unlinkSync(homePath);
        }
      } finally {
        if (originalHome === undefined) {
          delete process.env.HOME;
        } else {
          process.env.HOME = originalHome;
        }
      }
    });
  });

  // ─── getDefaultConfigPath Tests ────────────────────────────────────────────

  describe("getDefaultConfigPath", () => {
    it("should return the default config path", () => {
      const defaultPath = getDefaultConfigPath();
      expect(defaultPath).toContain(".teleton");
      expect(defaultPath).toContain("config.yaml");
    });

    it("should return an absolute path", () => {
      const defaultPath = getDefaultConfigPath();
      // On Unix: starts with / or ~; on Windows: starts with a drive letter like C:\
      if (process.platform === "win32") {
        expect(defaultPath).toMatch(/^[A-Za-z]:[\\/]/);
      } else {
        expect(defaultPath).toMatch(/^[\/~]/);
      }
    });
  });

  // ─── Complex Integration Tests ─────────────────────────────────────────────

  describe("loadConfig - complex integration scenarios", () => {
    it("should handle config with all enum variations", () => {
      const enumConfig = `
agent:
  api_key: sk-ant-test
  provider: anthropic
telegram:
  api_id: 12345
  api_hash: abcdef
  phone: "+1234567890"
  dm_policy: open
  group_policy: allowlist
`;
      writeTestConfig(enumConfig);
      const config = loadConfig(TEST_CONFIG_PATH);

      expect(config.telegram.dm_policy).toBe("open");
      expect(config.telegram.group_policy).toBe("allowlist");
    });

    it("should handle plugin configs with complex nested objects", () => {
      const pluginConfig = `
agent:
  api_key: sk-ant-test
  provider: anthropic
telegram:
  api_id: 12345
  api_hash: abcdef
  phone: "+1234567890"
plugins:
  my_plugin:
    nested:
      deep:
        value: 123
      array: [1, 2, 3]
    boolean: true
  another_plugin:
    config: "simple"
`;
      writeTestConfig(pluginConfig);
      const config = loadConfig(TEST_CONFIG_PATH);

      expect(config.plugins.my_plugin).toEqual({
        nested: {
          deep: { value: 123 },
          array: [1, 2, 3],
        },
        boolean: true,
      });
    });

    it("should apply all defaults and overrides in correct order", () => {
      // Config -> Defaults -> Provider Auto-Model -> Path Expansion -> Env Overrides
      const partialConfig = `
agent:
  api_key: sk-proj-partial
  provider: openai
telegram:
  api_id: 12345
  api_hash: abcdef
  phone: "+1234567890"
  session_path: ~/custom
`;
      writeTestConfig(partialConfig);
      process.env.TELETON_API_KEY = "sk-env-override";
      process.env.TELETON_WEBUI_ENABLED = "true";

      const config = loadConfig(TEST_CONFIG_PATH);

      // Env override
      expect(config.agent.api_key).toBe("sk-env-override");
      expect(config.webui.enabled).toBe(true);

      // Provider auto-model
      expect(config.agent.model).toBe("gpt-5.4");

      // Path expansion
      expect(config.telegram.session_path).toBe(join(homedir(), "custom"));

      // Defaults
      expect(config.agent.max_tokens).toBe(4096);
      expect(config.webui.port).toBe(7777);
    });
  });
});
