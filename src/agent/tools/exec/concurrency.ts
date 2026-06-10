class ConcurrencyLimiter {
  private running = 0;
  private waiters: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

  async acquire(maxConcurrent: number): Promise<void> {
    if (this.running < maxConcurrent) {
      this.running++;
      return;
    }
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  release(): void {
    this.running--;
    const next = this.waiters.shift();
    if (next) {
      this.running++;
      next.resolve();
    }
  }

  get count(): number {
    return this.running;
  }
}

export const execConcurrency = new ConcurrencyLimiter();
