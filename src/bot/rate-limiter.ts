/**
 * Sliding window rate limiter for plugin bot actions.
 * In-memory, per-plugin, no external dependencies.
 *
 * Memory safety: entries are cleaned up in two ways:
 * 1. Per-key pruning — expired timestamps are removed on every `check()` call
 * 2. Global sweep — a periodic interval removes stale keys (no timestamps within 2x the
 *    default window) to prevent unbounded growth from many unique plugin/action combinations.
 */

export class PluginRateLimiter {
  private windows = new Map<string, number[]>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly cleanupIntervalMs: number;
  private readonly maxWindowMs: number;

  /**
   * @param cleanupIntervalMs - How often to run global cleanup (default: 5 minutes)
   * @param maxWindowMs - Maximum expected window size for stale-key detection (default: 2 minutes)
   */
  constructor(cleanupIntervalMs = 300_000, maxWindowMs = 120_000) {
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.maxWindowMs = maxWindowMs;
    this.startCleanup();
  }

  /**
   * Check if an action is allowed under the rate limit.
   * Throws if the limit is exceeded.
   *
   * @param pluginName - Plugin identifier
   * @param action - Action type (e.g. "inline", "callback")
   * @param limit - Max actions per window
   * @param windowMs - Window duration in ms (default: 60000)
   */
  check(pluginName: string, action: string, limit: number, windowMs = 60_000): void {
    const key = `${pluginName}:${action}`;
    const now = Date.now();
    const cutoff = now - windowMs;

    let timestamps = this.windows.get(key);
    if (!timestamps) {
      timestamps = [];
      this.windows.set(key, timestamps);
    }

    // Remove expired entries
    const firstValid = timestamps.findIndex((t) => t > cutoff);
    if (firstValid > 0) {
      timestamps.splice(0, firstValid);
    } else if (firstValid === -1) {
      timestamps.length = 0;
    }

    // Remove empty keys to prevent memory leak from many unique plugin/action combos
    if (timestamps.length === 0) {
      this.windows.delete(key);
    }

    if (timestamps.length >= limit) {
      throw new Error(
        `Rate limit exceeded for plugin "${pluginName}" action "${action}": ${limit} per ${windowMs / 1000}s`
      );
    }

    timestamps.push(now);
  }

  /** Clear all rate limit windows (for testing) */
  clear(): void {
    this.windows.clear();
  }

  /** Stop the cleanup interval (for testing / graceful shutdown) */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /** Start periodic cleanup of stale entries */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.sweep();
    }, this.cleanupIntervalMs);
  }

  /**
   * Remove entries that have no timestamps within the max window.
   * This prevents unbounded memory growth from many unique plugin/action keys.
   */
  private sweep(): void {
    const now = Date.now();
    const cutoff = now - this.maxWindowMs;

    for (const [key, timestamps] of this.windows) {
      // Remove expired timestamps from this key
      const firstValid = timestamps.findIndex((t) => t > cutoff);
      if (firstValid > 0) {
        timestamps.splice(0, firstValid);
      } else if (firstValid === -1) {
        // All timestamps are stale — remove the entire key
        this.windows.delete(key);
      }
    }
  }
}
