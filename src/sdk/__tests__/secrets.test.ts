import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from "fs";
import { tmpdir } from "os";
import { randomBytes } from "crypto";

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

const TEST_KEY = randomBytes(32).toString("hex");

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
  for (const key of envKeysToClean) {
    delete process.env[key];
  }
  envKeysToClean.length = 0;
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

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

describe("SecretsSDK resolution chain", () => {
  it("returns env var first (highest priority)", () => {
    setEnv("MYPLUGIN_API_KEY", "from-env");
    writeFileSync(secretsPath("myplugin"), JSON.stringify({ API_KEY: "from-file" }), { mode: 0o600 });
    const sdk = createSecretsSDK("myplugin", { API_KEY: "from-config" }, mockLog);
    expect(sdk.get("API_KEY")).toBe("from-env");
  });

  it("falls back to secrets file when no env var", () => {
    writeFileSync(secretsPath("myplugin"), JSON.stringify({ API_KEY: "from-file" }), { mode: 0o600 });
    const sdk = createSecretsSDK("myplugin", { API_KEY: "from-config" }, mockLog);
    expect(sdk.get("API_KEY")).toBe("from-file");
  });

  it("falls back to pluginConfig when no env var and no file", () => {
    const sdk = createSecretsSDK("myplugin", { API_KEY: "from-config" }, mockLog);
    expect(sdk.get("API_KEY")).toBe("from-config");
  });

  it("returns undefined when secret not found anywhere", () => {
    const sdk = createSecretsSDK("myplugin", {}, mockLog);
    expect(sdk.get("NONEXISTENT")).toBeUndefined();
  });
});

describe("SecretsSDK.require()", () => {
  it("returns value when found", () => {
    setEnv("MYPLUGIN_TOKEN", "secret-value");
    const sdk = createSecretsSDK("myplugin", {}, mockLog);
    expect(sdk.require("TOKEN")).toBe("secret-value");
  });

  it("throws PluginSDKError with SECRET_NOT_FOUND when missing", () => {
    const sdk = createSecretsSDK("myplugin", {}, mockLog);
    expect(() => sdk.require("MISSING_KEY")).toThrowError(PluginSDKError);
  });
});

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
});

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
    rmSync(SECRETS_DIR, { recursive: true, force: true });
    writePluginSecret("testplugin", "KEY", "value");
    const sdk = createSecretsSDK("testplugin", {}, mockLog);
    expect(sdk.get("KEY")).toBe("value");
  });

  it("throws when no encryption key is configured", () => {
    delete process.env.TELETON_SECRETS_KEY;
    delete process.env.TELETON_WALLET_KEY;
    expect(() => writePluginSecret("testplugin", "KEY", "value")).toThrow("No encryption key configured");
  });
});

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
});
