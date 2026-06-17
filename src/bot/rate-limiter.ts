/**
 * Sliding window rate limiter for plugin bot actions.
 * In-memory, per-plugin, no external dependencies.
 *
 * Memory safety: expired timestamps are pruned on every `check()` call,
 * and empty keys are deleted immediately. A periodic background sweep
 * removes stale keys (no recent activity) to prevent unbounded growth
 * from many unique plugin/action combinations.
 */

export class PluginRateLimiter {
  private windows = new Map<string, number[]>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private sweepCounter = 0;
  private readonly sweepEveryNCalls: number;

  /**
   * @param cleanupIntervalMs - How often to run global cleanup via background interval (default: 5 minutes).
   *                            Set to 0 to disable the background interval (relying on per-check pruning).
   * @param sweepEveryNCalls - Perform an incremental sweep every N `check()` calls (default: 100).
   *                           Set to 0 to disable call-count-based sweeping.
   */
  constructor(
    private readonly cleanupIntervalMs = 300_000,
    sweepEveryNCalls = 100
  ) {
    this.sweepEveryNCalls = sweepEveryNCalls;
    if (cleanupIntervalMs > 0) {
      this.startCleanup(cleanupIntervalMs);
    }
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

    // Incremental sweep every N calls (avokes setInterval interference with fake timers)
    if (this.sweepEveryNCalls > 0) {
      this.sweepCounter++;
      if (this.sweepCounter >= this.sweepEveryNCalls) {
        this.sweepCounter = 0;
        this.sweep(now);
      }
    }
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
  private startCleanup(intervalMs: number): void {
    this.cleanupInterval = setInterval(() => {
      this.sweep(Date.now());
    }, intervalMs);
  }

  /**
   * Remove entries that have no timestamps within a reasonable window.
   * This prevents unbounded memory growth from many unique plugin/action keys.
   */
  private sweep(now: number): void {
    // Use a generous cutoff: 2x the default window (120s) or 5 minutes, whichever is larger
    const cutoff = now - Math.max(120_000, this.cleanupIntervalMs / 2);

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
