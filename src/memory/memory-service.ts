/**
 * Memory Service Stub
 *
 * Placeholder for the actual MemoryService interface.
 * Replace with real implementation.
 */

export interface MemoryService {
  store(key: string, value: unknown): Promise<void>;
  retrieve(key: string): Promise<unknown>;
  search(query: string): Promise<unknown[]>;
  delete(key: string): Promise<void>;
}

export class StubMemoryService implements MemoryService {
  private data = new Map<string, unknown>();

  async store(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }

  async retrieve(key: string): Promise<unknown> {
    return this.data.get(key);
  }

  async search(_query: string): Promise<unknown[]> {
    return [];
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}
