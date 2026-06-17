import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from "fs";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

// --- Mock TELETON_ROOT to a temp directory ---
// vi.hoisted runs before vi.mock hoisting, so TEST_ROOT is available in the factory
const { TEST_ROOT } = vi.hoisted(() => {
  const { join } = require("path");
  const { tmpdir } = require("os");
  const { randomBytes } = require("crypto");
  return {
    TEST_ROOT: join(tmpdir(), `teleton-secrets-test-${randomBytes(8).toString("hex")}`),
  };
});

vi.mock("../../workspace/paths.js", () => ({
  TELETON_ROOT: TEST_ROOT,
}));

// Import AFTER mock is registered
import {
  createSecretsSDK,
  writePluginSecret,
  deletePluginSecret,
  listPluginSecretKeys,
  requireEncryptionKey,
} from "../secrets.js";
import { PluginSDKError } from "@teleton-agent/sdk";
import type { PluginLogger } from "@teleton-agent/sdk";

const SECRETS_DIR = join(TEST_ROOT, "plugins", "data");

function secretsPath(pluginName: string): string {
  return join(SECRETS_DIR, `${pluginName}.secrets.json`);
}

const mockLog: PluginLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// Valid 64-char hex key for tests (32 bytes)
const TEST_KEY = randomBytes(32).toString("hex");

// Env vars set during tests — cleaned up in afterEach
const envKeysToClean: string[] = [];

function setEnv(key: string, value: string): void {
  process.env[key] = value;
  envKeysToClean.push(key);
}

beforeEach(() => {
  mkdirSync(SECRETS_DIR, { recursive: true });
  vi.clearAllMocks();
  setEnv("TELETON_SECRETS_KEY", TEST_KEY);
});

afterEach(() => {
  // Clean env vars
  for (const key of envKeysToClean) {
    delete process.env[key];
  }
  envKeysToClean.length = 0;

  // Remove temp directory
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// requireEncryptionKey tests
// ---------------------------------------------------------------------------
describe("requireEncryptionKey()", () => {
  it("returns Buffer when TELETON_SECRETS_KEY is set", () => {
    const key = requireEncryptionKey();
    expect(Buffer.isBuffer(key)).toBe(true);
    expect(key.length).toBe(32);
  });

  it("falls back to TELETON_WALLET_KEY when TELETON_SECRETS_KEY is absent", () => {
    delete process.env.TELETON_SECRETS_KEY;
    setEnv("TELETON_WALLET_KEY", TEST_KEY);
    const key = requireEncryptionKey();
    expect(Buffer.isBuffer(key)).toBe(true);
    expect(key.length).toBe(32);
  });

  it("throws when no encryption key is configured", () => {
    delete process.env.TELETON_SECRETS_KEY;
    delete process.env.TELETON_WALLET_KEY;
    expect(() => requireEncryptionKey()).toThrow("No encryption key configured");
  });

  it("throws when key is not 64 hex chars", () => {
    setEnv("TELETON_SECRETS_KEY", "too-short");
    expect(() => requireEncryptionKey()).toThrow("64-character hex string");
  });
});

// ---------------------------------------------------------------------------
// Resolution chain tests
// ---------------------------------------------------------------------------
describe("SecretsSDK resolution chain", () => {
  it("returns env var first (highest priority)", () => {
    // All three sources have the value
    setEnv("MYPLUGIN_API_KEY", "from-env");
    writeFileSync(secretsPath("myplugin"), JSON.stringify({ API_KEY: "from-file" }), {
      mode: 0o600,
    });
    const sdk = createSecretsSDK("myplugin", { API_KEY: "from-config" }, mockLog);

    expect(sdk.get("API_KEY")).toBe("from-env");
    // Debug log should NOT contain key name or env var name
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining("myplugin"));
    expect(mockLog.debug).not.toHaveBeenCalledWith(expect.stringContaining("API_KEY"));
    expect(mockLog.debug).not.toHaveBeenCalledWith(expect.stringContaining("MYPLUGIN_API_KEY"));
  });

  it("falls back to secrets file when no env var", () => {
    writeFileSync(secretsPath("myplugin"), JSON.stringify({ API_KEY: "from-file" }), {
      mode: 0o600,
    });
    const sdk = createSecretsSDK("myplugin", { API_KEY: "from-config" }, mockLog);

    expect(sdk.get("API_KEY")).toBe("from-file");
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining("myplugin"));
    expect(mockLog.debug).not.toHaveBeenCalledWith(expect.stringContaining("API_KEY"));
  });

  it("falls back to pluginConfig when no env var and no file", () => {
    const sdk = createSecretsSDK("myplugin", { API_KEY: "from-config" }, mockLog);

    expect(sdk.get("API_KEY")).toBe("from-config");
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining("myplugin"));
    expect(mockLog.debug).not.toHaveBeenCalledWith(expect.stringContaining("API_KEY"));
  });

  it("returns undefined when secret not found anywhere", () => {
    const sdk = createSecretsSDK("myplugin", {}, mockLog);

    expect(sdk.get("NONEXISTENT")).toBeUndefined();
  });

  it("env var wins over file, file wins over config (priority order)", () => {
    // Set up all three with different values
    setEnv("MYPLUGIN_TOKEN", "env-token");
    writeFileSync(
      secretsPath("myplugin"),
      JSON.stringify({ TOKEN: "file-token", DB_URL: "file-db" }),
      { mode: 0o600 }
    );
    const sdk = createSecretsSDK(
      "myplugin",
      { TOKEN: "cfg-token", DB_URL: "cfg-db", EXTRA: "cfg-extra" },
      mockLog
    );

    // TOKEN: env wins
    expect(sdk.get("TOKEN")).toBe("env-token");
    // DB_URL: no env, file wins over config
    expect(sdk.get("DB_URL")).toBe("file-db");
    // EXTRA: only in config
    expect(sdk.get("EXTRA")).toBe("cfg-extra");
  });
});

// ---------------------------------------------------------------------------
// require() tests
// ---------------------------------------------------------------------------
describe("SecretsSDK.require()", () => {
  it("returns value when found", () => {
    setEnv("MYPLUGIN_TOKEN", "secret-value");
    const sdk = createSecretsSDK("myplugin", {}, mockLog);

    expect(sdk.require("TOKEN")).toBe("secret-value");
  });

  it("throws PluginSDKError with SECRET_NOT_FOUND when missing", () => {
    const sdk = createSecretsSDK("myplugin", {}, mockLog);

    expect(() => sdk.require("MISSING_KEY")).toThrowError(PluginSDKError);

    try {
      sdk.require("MISSING_KEY");
    } catch (err) {
      expect(err).toBeInstanceOf(PluginSDKError);
      expect((err as PluginSDKError).code).toBe("SECRET_NOT_FOUND");
      // Error message should NOT leak the key name
      expect((err as PluginSDKError).message).not.toContain("MISSING_KEY");
      expect((err as PluginSDKError).message).toContain("myplugin");
      expect((err as PluginSDKError).message).toContain("/plugin set");
    }
  });
});

// ---------------------------------------------------------------------------
// has() tests
// ---------------------------------------------------------------------------
describe("SecretsSDK.has()", () => {
  it("returns true when secret exists", () => {
    setEnv("MYPLUGIN_KEY", "value");
    const sdk = createSecretsSDK("myplugin", {}, mockLog);

    expect(sdk.has("KEY")).toBe(true);
  });

  it("returns false when secret does not exist", () => {
    const sdk = createSecretsSDK("myplugin", {}, mockLog);

    expect(sdk.has("NOPE")).toBe(false);
  });

  it("returns true for secrets found in file only", () => {
    writeFileSync(secretsPath("myplugin"), JSON.stringify({ FILE_KEY: "val" }), { mode: 0o600 });
    const sdk = createSecretsSDK("myplugin", {}, mockLog);

    expect(sdk.has("FILE_KEY")).toBe(true);
  });

  it("returns true for secrets found in config only", () => {
    const sdk = createSecretsSDK("myplugin", { CFG_KEY: 42 }, mockLog);

    expect(sdk.has("CFG_KEY")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Admin functions: writePluginSecret
// ---------------------------------------------------------------------------
describe("writePluginSecret()", () => {
  it("creates encrypted secrets file", () => {
    writePluginSecret("testplugin", "API_KEY", "supersecret");

    const filePath = secretsPath("testplugin");
    const content = JSON.parse(readFileSync(filePath, "utf-8"));
    expect(content.encrypted).toBe(true);
    expect(content.iv).toBeDefined();
    expect(content.tag).toBeDefined();
    expect(content.ciphertext).toBeDefined();
    expect(content.API_KEY).toBeUndefined();

    // Windows does not support Unix file permissions in the same way
    if (process.platform !== "win32") {
      const mode = statSync(filePath).mode & 0o777;
      expect(mode).toBe(0o600);
    }
  });

  it("merges with existing secrets", () => {
    writePluginSecret("testplugin", "KEY_A", "aaa");
    writePluginSecret("testplugin", "KEY_B", "bbb");

    const keys = listPluginSecretKeys("testplugin");
    expect(keys).toEqual(expect.arrayContaining(["KEY_A", "KEY_B"]));
    expect(keys).toHaveLength(2);
  });

  it("overwrites existing key value", () => {
    writePluginSecret("testplugin", "KEY", "old");
    writePluginSecret("testplugin", "KEY", "new");

    const sdk = createSecretsSDK("testplugin", {}, mockLog);
    expect(sdk.get("KEY")).toBe("new");
  });

  it("creates data directory if it does not exist", () => {
    // Remove the dir that beforeEach created
    rmSync(SECRETS_DIR, { recursive: true, force: true });

    writePluginSecret("testplugin", "KEY", "value");

    const sdk = createSecretsSDK("testplugin", {}, mockLog);
    expect(sdk.get("KEY")).toBe("value");
  });

  it("throws when no encryption key is configured", () => {
    delete process.env.TELETON_SECRETS_KEY;
    delete process.env.TELETON_WALLET_KEY;
    expect(() => writePluginSecret("testplugin", "KEY", "value")).toThrow(
      "No encryption key configured"
    );
  });
});

// ---------------------------------------------------------------------------
// Admin functions: deletePluginSecret
// ---------------------------------------------------------------------------
describe("deletePluginSecret()", () => {
  it("removes a key from the secrets file", () => {
    writePluginSecret("testplugin", "A", "1");
    writePluginSecret("testplugin", "B", "2");

    const result = deletePluginSecret("testplugin", "A");

    expect(result).toBe(true);
    const sdk = createSecretsSDK("testplugin", {}, mockLog);
    expect(sdk.has("A")).toBe(false);
    expect(sdk.get("B")).toBe("2");
  });

  it("returns false if key not found", () => {
    writePluginSecret("testplugin", "A", "1");

    const result = deletePluginSecret("testplugin", "NONEXISTENT");

    expect(result).toBe(false);
  });

  it("returns false when no secrets file exists", () => {
    const result = deletePluginSecret("noplugin", "KEY");

    expect(result).toBe(false);
  });

  it("throws when no encryption key is configured", () => {
    delete process.env.TELETON_SECRETS_KEY;
    delete process.env.TELETON_WALLET_KEY;
    expect(() => deletePluginSecret("testplugin", "KEY")).toThrow("No encryption key configured");
  });
});

// ---------------------------------------------------------------------------
// Admin functions: listPluginSecretKeys
// ---------------------------------------------------------------------------
describe("listPluginSecretKeys()", () => {
  it("lists keys without values", () => {
    writePluginSecret("testplugin", "API_KEY", "secret1");
    writePluginSecret("testplugin", "DB_PASS", "secret2");

    const keys = listPluginSecretKeys("testplugin");

    expect(keys).toEqual(expect.arrayContaining(["API_KEY", "DB_PASS"]));
    expect(keys).toHaveLength(2);
  });

  it("returns empty array when no secrets file exists", () => {
    const keys = listPluginSecretKeys("nonexistent");

    expect(keys).toEqual([]);
  });

  it("returns empty array after all keys deleted", () => {
    writePluginSecret("testplugin", "KEY", "val");
    deletePluginSecret("testplugin", "KEY");

    const keys = listPluginSecretKeys("testplugin");

    expect(keys).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Encryption round-trip
// ---------------------------------------------------------------------------
describe("Encryption round-trip", () => {
  it("written secrets can be read back via SDK", () => {
    writePluginSecret("roundtrip", "TOKEN", "my-secret-token");
    writePluginSecret("roundtrip", "PASSWORD", "my-password");
    const sdk = createSecretsSDK("roundtrip", {}, mockLog);
    expect(sdk.get("TOKEN")).toBe("my-secret-token");
    expect(sdk.get("PASSWORD")).toBe("my-password");
  });

  it("file on disk is encrypted - no plaintext secrets visible", () => {
    writePluginSecret("visibletest", "SECRET", "should-not-be-visible");
    const raw = readFileSync(secretsPath("visibletest"), "utf-8");
    expect(raw).not.toContain("should-not-be-visible");
    const parsed = JSON.parse(raw);
    expect(parsed.encrypted).toBe(true);
  });

  it("delete after write leaves no plaintext on disk", () => {
    writePluginSecret("deletetest", "KEY1", "val1");
    writePluginSecret("deletetest", "KEY2", "val2");
    deletePluginSecret("deletetest", "KEY1");
    const raw = readFileSync(secretsPath("deletetest"), "utf-8");
    expect(raw).not.toContain("val1");
    expect(raw).not.toContain("val2");
    const sdk = createSecretsSDK("deletetest", {}, mockLog);
    expect(sdk.has("KEY1")).toBe(false);
    expect(sdk.get("KEY2")).toBe("val2");
  });

  it("reading encrypted file without key returns empty (does not crash SDK)", () => {
    writePluginSecret("nokeytest", "TOKEN", "secret-value");
    // Remove encryption key
    delete process.env.TELETON_SECRETS_KEY;
    delete process.env.TELETON_WALLET_KEY;
    // SDK should not crash — should return undefined for all secrets
    const sdk = createSecretsSDK("nokeytest", {}, mockLog);
    expect(sdk.get("TOKEN")).toBeUndefined();
    expect(sdk.has("TOKEN")).toBe(false);
    // Restore key for other tests
    setEnv("TELETON_SECRETS_KEY", TEST_KEY);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe("Edge cases", () => {
  it("plugin name with hyphens converts to uppercase underscores for env prefix", () => {
    setEnv("MY_COOL_PLUGIN_SECRET", "hyphen-env-value");
    const sdk = createSecretsSDK("my-cool-plugin", {}, mockLog);

    expect(sdk.get("SECRET")).toBe("hyphen-env-value");
  });

  it("empty string env var is treated as falsy — falls through to next source", () => {
    setEnv("MYPLUGIN_KEY", "");
    writeFileSync(secretsPath("myplugin"), JSON.stringify({ KEY: "from-file" }), { mode: 0o600 });
    const sdk = createSecretsSDK("myplugin", {}, mockLog);

    // Empty string is falsy in the `if (envValue)` check, so file value wins
    expect(sdk.get("KEY")).toBe("from-file");
  });

  it("empty string in secrets file is treated as falsy — falls through to config", () => {
    writeFileSync(secretsPath("myplugin"), JSON.stringify({ KEY: "" }), { mode: 0o600 });
    const sdk = createSecretsSDK("myplugin", { KEY: "from-config" }, mockLog);

    // `stored[key]` is empty string which is falsy, so config wins
    expect(sdk.get("KEY")).toBe("from-config");
  });

  it("numeric config value is stringified", () => {
    const sdk = createSecretsSDK("myplugin", { PORT: 3000 }, mockLog);

    expect(sdk.get("PORT")).toBe("3000");
  });

  it("null config value is skipped", () => {
    const sdk = createSecretsSDK("myplugin", { KEY: null }, mockLog);

    expect(sdk.get("KEY")).toBeUndefined();
  });

  it("require() throws on empty string from all sources", () => {
    setEnv("MYPLUGIN_KEY", "");
    const sdk = createSecretsSDK("myplugin", { KEY: "" }, mockLog);

    // get() returns undefined since all values are empty/falsy
    // (env is empty -> file doesn't exist -> config is empty string which gets
    //  String("") = "" -> but the condition is `configValue !== undefined && configValue !== null`
    //  so it returns "" which is a string)
    // Actually, String("") = "" and get() returns it, but require() checks `if (!value)` which
    // catches empty string. So require() throws.
    expect(() => sdk.require("KEY")).toThrowError(PluginSDKError);
  });

  it("corrupted secrets file is handled gracefully (returns empty)", () => {
    writeFileSync(secretsPath("myplugin"), "not-valid-json{{{", { mode: 0o600 });
    const sdk = createSecretsSDK("myplugin", {}, mockLog);

    expect(sdk.get("KEY")).toBeUndefined();
  });
});
