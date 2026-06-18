/**
 * Plugin secrets service — secure access to API keys, tokens, and credentials.
 *
 * Resolution order:
 *   1. Environment variable  (PLUGINNAME_KEY)  — Docker/CI
 *   2. Secrets store file    (via /plugin set)  — Admin via Telegram
 *   3. pluginConfig          (config.yaml)      — legacy/manual
 *
 * Secrets store: ~/.teleton/plugins/data/<plugin-name>.secrets.json
 * Secrets are encrypted at rest with AES-256-GCM using TELETON_SECRETS_KEY
 * (falls back to TELETON_WALLET_KEY if not set).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { TELETON_ROOT } from "../workspace/paths.js";
import { PluginSDKError } from "@teleton-agent/sdk";
import type { SecretsSDK, PluginLogger } from "@teleton-agent/sdk";

const SECRETS_DIR = join(TELETON_ROOT, "plugins", "data");

// ─── Encryption helpers ──────────────────────────────────────────────

interface EncryptedFile {
  encrypted: true;
  iv: string;
  tag: string;
  ciphertext: string;
}

/**
 * Resolve the encryption key for secrets.
 * Prefers TELETON_SECRETS_KEY, falls back to TELETON_WALLET_KEY.
 * Returns null only if neither is configured (legacy unencrypted mode).
 */
function resolveSecretsEncryptionKey(): Buffer | null {
  // SECURITY FIX H-14: No fallback to wallet key — require explicit secrets key
  const envKey = process.env.TELETON_SECRETS_KEY;
  if (!envKey) return null;
  if (envKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(envKey)) {
    throw new Error(
      "TELETON_SECRETS_KEY / TELETON_WALLET_KEY must be a 64-character hex string (32 bytes)."
    );
  }
  return Buffer.from(envKey, "hex");
}

function encryptJson(data: Record<string, string>, key: Buffer): EncryptedFile {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: true,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    ciphertext: encrypted.toString("hex"),
  };
}

function decryptJson(file: EncryptedFile, key: Buffer): Record<string, string> {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(file.iv, "hex"));
  decipher.setAuthTag(Buffer.from(file.tag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(file.ciphertext, "hex")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as Record<string, string>;
}

// ─── File I/O ─────────────────────────────────────────────────────────

function getSecretsPath(pluginName: string): string {
  return join(SECRETS_DIR, `${pluginName}.secrets.json`);
}

/** Read persisted secrets from the JSON file (handles both encrypted and legacy plaintext) */
function readSecretsFile(pluginName: string): Record<string, string> {
  const filePath = getSecretsPath(pluginName);
  try {
    if (!existsSync(filePath)) return {};
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    // Encrypted format
    if (parsed.encrypted === true) {
      const key = resolveSecretsEncryptionKey();
      if (!key) {
        // Key not configured — cannot decrypt. Return empty and log warning.
        return {};
      }
      try {
        return decryptJson(parsed as EncryptedFile, key);
      } catch {
        // Decryption failed — wrong key or corrupted file
        return {};
      }
    }

    // Legacy plaintext format — return as-is (will be re-encrypted on next write)
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Require an encryption key to be configured.
 * Throws an error with setup instructions if no key is available.
 *
 * This prevents silent fallback to plaintext storage of secrets,
 * addressing OWASP A07:2021 (Identification and Authentication Failures).
 */
export function requireEncryptionKey(): Buffer {
  const key = resolveSecretsEncryptionKey();
  if (!key) {
    throw new Error(
      "No encryption key configured. Refusing to write secrets as plaintext.\n" +
        "Set one of the following environment variables:\n" +
        "  TELETON_SECRETS_KEY — preferred, dedicated key for plugin secrets\n" +
        "  TELETON_WALLET_KEY  — fallback, reuses the wallet encryption key\n" +
        "Generate a key with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return key;
}

/**
 * Write a secret to the persisted secrets file.
 * Used by admin commands (/plugin set).
 *
 * Requires an encryption key (TELETON_SECRETS_KEY or TELETON_WALLET_KEY).
 * Throws if no key is configured — secrets are never stored as plaintext.
 */
export function writePluginSecret(pluginName: string, key: string, value: string): void {
  const encryptionKey = requireEncryptionKey();
  mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });
  const filePath = getSecretsPath(pluginName);
  const existing = readSecretsFile(pluginName);
  existing[key] = value;

  const encrypted = encryptJson(existing, encryptionKey);
  writeFileSync(filePath, JSON.stringify(encrypted, null, 2), { mode: 0o600 });
}

/**
 * Delete a secret from the persisted secrets file.
 * Used by admin commands (/plugin unset).
 *
 * Requires an encryption key (TELETON_SECRETS_KEY or TELETON_WALLET_KEY).
 * Throws if no key is configured — secrets are never stored as plaintext.
 */
export function deletePluginSecret(pluginName: string, key: string): boolean {
  const encryptionKey = requireEncryptionKey();
  const existing = readSecretsFile(pluginName);
  if (!(key in existing)) return false;
  delete existing[key];
  const filePath = getSecretsPath(pluginName);

  const encrypted = encryptJson(existing, encryptionKey);
  writeFileSync(filePath, JSON.stringify(encrypted, null, 2), { mode: 0o600 });
  return true;
}

/** List all persisted secret keys for a plugin (values NOT returned for security). */
export function listPluginSecretKeys(pluginName: string): string[] {
  return Object.keys(readSecretsFile(pluginName));
}

/**
 * Create a SecretsSDK instance for a plugin.
 */
export function createSecretsSDK(
  pluginName: string,
  pluginConfig: Record<string, unknown>,
  log: PluginLogger
): SecretsSDK {
  const envPrefix = pluginName.replace(/-/g, "_").toUpperCase();

  function get(key: string): string | undefined {
    // 1. Environment variable (highest priority — Docker/CI)
    const envKey = `${envPrefix}_${key.toUpperCase()}`;
    const envValue = process.env[envKey];
    if (envValue) {
      log.debug(`Secret resolved for ${pluginName}`);
      return envValue;
    }

    // 2. Persisted secrets store (set via /plugin set)
    const stored = readSecretsFile(pluginName);
    if (key in stored && stored[key]) {
      log.debug(`Secret resolved for ${pluginName}`);
      return stored[key];
    }

    // 3. pluginConfig from config.yaml (legacy/manual)
    const configValue = pluginConfig[key];
    if (configValue !== undefined && configValue !== null) {
      log.debug(`Secret resolved for ${pluginName}`);
      return String(configValue);
    }

    return undefined;
  }

  return {
    get,

    require(key: string): string {
      const value = get(key);
      if (!value) {
        throw new PluginSDKError(
          `Missing required secret for plugin "${pluginName}". Set it via: /plugin set ${pluginName} <key> <value>`,
          "SECRET_NOT_FOUND"
        );
      }
      return value;
    },

    has(key: string): boolean {
      return get(key) !== undefined;
    },
  };
}
