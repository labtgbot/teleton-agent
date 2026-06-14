/**
 * Agent Memory Types Stub
 *
 * Placeholder for agent memory types.
 */

export interface MemoryEvent {
  type: string;
  userId?: string;
  data?: unknown;
  timestamp: number;
  priority?: string;
  [key: string]: unknown;
}

export interface AgentMemory {
  id: string;
  type: "episodic" | "semantic" | "procedural";
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  getEvents(query: Record<string, unknown>): Promise<MemoryEvent[]>;
  saveEvent(event: MemoryEvent): Promise<void>;
}

export interface MemorySearchResult {
  memory: AgentMemory;
  score: number;
}
