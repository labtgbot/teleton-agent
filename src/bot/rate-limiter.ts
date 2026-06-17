/**
 * Sliding window rate limiter for plugin bot actions.
 * In-memory, per-plugin, no external dependencies.
 *
 * Memory safety: expired timestamps are pruned on every `check()` call,
 * and empty keys are deleted immediately. An incremental sweep every N
 * calls removes stale keys to prevent unbounded growth from many unique
 * plugin/action combinations.
 */

export class PluginRateLimiter {
  private windows = new Map<string, number[]>();
  private sweepCounter = 0;

  /**
   * @param sweepEveryNCalls - Perform an incremental sweep every N `check()` calls (default: 100).
   *                           Set to 0 to disable sweeping entirely.
   */
  constructor(private readonly sweepEveryNCalls = 100) {}

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

    if (timestamps.length >= limit) {
      throw new Error(
        `Rate limit exceeded for plugin "${pluginName}" action "${action}": ${limit} per ${windowMs / 1000}s`
      );
    }

    timestamps.push(now);

    // Incremental sweep every N calls to clean up stale keys
    if (this.sweepEveryNCalls > 0 && ++this.sweepCounter >= this.sweepEveryNCalls) {
      this.sweepCounter = 0;
      this.sweepStaleKeys(now);
    }
  }

  /** Clear all rate limit windows (for testing) */
  clear(): void {
    this.windows.clear();
  }

  /**
   * Remove entries that have no recent timestamps.
   * Uses a 5-minute cutoff to avoid deleting keys that are still active.
   */
  private sweepStaleKeys(now: number): void {
    const cutoff = now - 300_000;

    for (const [key, timestamps] of this.windows) {
      const firstValid = timestamps.findIndex((t) => t > cutoff);
      if (firstValid > 0) {
        timestamps.splice(0, firstValid);
      } else if (firstValid === -1) {
        this.windows.delete(key);
      }
    }
  }
}
