/**
 * Episodic Memory: Event-based temporal memory system
 * 
 * Stores specific experiences with:
 * - Timestamps and temporal ordering
 * - Emotional weight/importance
 * - Contextual associations
 * - Decay and forgetting mechanisms
 */

import { z } from 'zod';
import { logger } from '../../utils/logger.js';

export interface EpisodicEvent {
  id: string;
  timestamp: number;
  type: EventType;
  content: string;
  context: Record<string, any>;
  emotionalWeight: number; // -1.0 to 1.0
  importance: number; // 0.0 to 1.0
  tags: string[];
  relatedEvents: string[];
  recalledCount: number;
  lastRecalled?: number;
}

export enum EventType {
  ACTION = 'ACTION',
  DECISION = 'DECISION',
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  INTERACTION = 'INTERACTION',
  LEARNING = 'LEARNING',
  ANOMALY = 'ANOMALY',
}

export interface EpisodicQuery {
  timeRange?: { start: number; end: number };
  types?: EventType[];
  tags?: string[];
  minImportance?: number;
  minEmotionalWeight?: number;
  limit?: number;
}

export class EpisodicMemory {
  private events: Map<string, EpisodicEvent>;
  private timeline: EpisodicEvent[];
  private readonly MAX_EVENTS = 1000;
  private readonly DECAY_RATE = 0.01; // Per hour
  private readonly FORGET_THRESHOLD = 0.2;

  constructor() {
    this.events = new Map();
    this.timeline = [];
  }

  /**
   * Store a new episodic event
   */
  async store(
    content: string,
    type: EventType,
    context: Record<string, any> = {},
    emotionalWeight: number = 0,
    importance: number = 0.5
  ): Promise<string> {
    const id = `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const event: EpisodicEvent = {
      id,
      timestamp: Date.now(),
      type,
      content,
      context,
      emotionalWeight: Math.max(-1, Math.min(1, emotionalWeight)),
      importance: Math.max(0, Math.min(1, importance)),
      tags: this.extractTags(content, type),
      relatedEvents: [],
      recalledCount: 0,
    };

    this.events.set(id, event);
    this.insertIntoTimeline(event);
    
    // Find related events
    await this.findRelatedEvents(event);
    
    // Apply decay and forget old/low-importance events
    this.applyDecayAndForgetting();
    
    logger.debug(`[EpisodicMemory] Stored event ${id}: ${type} (importance: ${importance})`);
    return id;
  }

  /**
   * Query events with filters
   */
  query(filters: EpisodicQuery): EpisodicEvent[] {
    let results = Array.from(this.events.values());
    
    // Time range filter
    if (filters.timeRange) {
      results = results.filter(e => 
        e.timestamp >= filters.timeRange!.start && 
        e.timestamp <= filters.timeRange!.end
      );
    }
    
    // Type filter
    if (filters.types && filters.types.length > 0) {
      results = results.filter(e => filters.types!.includes(e.type));
    }
    
    // Tag filter
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(e => 
        filters.tags!.some(tag => e.tags.includes(tag))
      );
    }
    
    // Importance filter
    if (filters.minImportance !== undefined) {
      results = results.filter(e => e.importance >= filters.minImportance!);
    }
    
    // Emotional weight filter
    if (filters.minEmotionalWeight !== undefined) {
      results = results.filter(e => e.emotionalWeight >= filters.minEmotionalWeight!);
    }
    
    // Sort by relevance (combination of recency, importance, and emotional weight)
    results.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a);
      const scoreB = this.calculateRelevanceScore(b);
      return scoreB - scoreA;
    });
    
    // Limit results
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }
    
    return results;
  }

  /**
   * Get chronological timeline
   */
  getTimeline(startTime?: number, endTime?: number, limit: number = 50): EpisodicEvent[] {
    let filtered = this.timeline;
    
    if (startTime) {
      filtered = filtered.filter(e => e.timestamp >= startTime);
    }
    if (endTime) {
      filtered = filtered.filter(e => e.timestamp <= endTime);
    }
    
    return filtered.slice(0, limit);
  }

  /**
   * Recall specific event (increases recall count)
   */
  recall(eventId: string): EpisodicEvent | null {
    const event = this.events.get(eventId);
    if (!event) return null;
    
    event.recalledCount++;
    event.lastRecalled = Date.now();
    
    // Boost importance on recall
    event.importance = Math.min(1.0, event.importance + 0.05);
    
    logger.debug(`[EpisodicMemory] Recalled event ${eventId} (count: ${event.recalledCount})`);
    return event;
  }

  /**
   * Get events similar to current context
   */
  async findSimilar(context: string, limit: number = 5): Promise<EpisodicEvent[]> {
    // Simple similarity based on tag overlap and keyword matching
    const contextTags = this.extractTags(context, EventType.ACTION);
    const scoredEvents = Array.from(this.events.values()).map(event => {
      const tagOverlap = event.tags.filter(t => contextTags.includes(t)).length;
      const keywordMatches = this.countKeywordMatches(context, event.content);
      const score = (tagOverlap * 0.6 + keywordMatches * 0.4) * event.importance;
      return { event, score };
    });
    
    scoredEvents.sort((a, b) => b.score - a.score);
    return scoredEvents.slice(0, limit).map(x => x.event);
  }

  /**
   * Consolidate memories (called during "sleep" cycles)
   */
  async consolidate(): Promise<{ preserved: number; forgotten: number }> {
    logger.info('[EpisodicMemory] Starting consolidation cycle...');
    
    let preserved = 0;
    let forgotten = 0;
    
    for (const [id, event] of this.events.entries()) {
      // High-importance or frequently recalled events are preserved
      if (event.importance > 0.7 || event.recalledCount > 5) {
        // Strengthen important memories
        event.importance = Math.min(1.0, event.importance + 0.02);
        preserved++;
      } else if (event.importance < this.FORGET_THRESHOLD) {
        // Forget low-importance events
        this.events.delete(id);
        this.removeFromTimeline(id);
        forgotten++;
      }
    }
    
    logger.info(`[EpisodicMemory] Consolidation complete: ${preserved} preserved, ${forgotten} forgotten`);
    return { preserved, forgotten };
  }

  /**
   * Extract tags from content (simplified NLP)
   */
  private extractTags(content: string, type: EventType): string[] {
    const tags: string[] = [];
    const lowerContent = content.toLowerCase();
    
    // Type-based tags
    tags.push(type.toLowerCase());
    
    // Keyword-based tags (simplified)
    const keywords: Record<EventType, string[]> = {
      [EventType.ACTION]: ['action', 'execute', 'perform', 'do'],
      [EventType.DECISION]: ['decide', 'choose', 'select', 'option'],
      [EventType.SUCCESS]: ['success', 'completed', 'achieved', 'won'],
      [EventType.FAILURE]: ['fail', 'error', 'mistake', 'lost'],
      [EventType.INTERACTION]: ['user', 'message', 'conversation', 'response'],
      [EventType.LEARNING]: ['learn', 'understand', 'realize', 'insight'],
      [EventType.ANOMALY]: ['anomaly', 'unusual', 'unexpected', 'abnormal'],
    };
    
    const typeKeywords = keywords[type] || [];
    typeKeywords.forEach(keyword => {
      if (lowerContent.includes(keyword)) {
        tags.push(keyword);
      }
    });
    
    // Entity extraction (very simplified)
    const entityPatterns = [
      /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b/g, // Proper nouns
      /@\w+/g, // Mentions
      /#\w+/g, // Hashtags
    ];
    
    entityPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        tags.push(...matches.map(m => m.toLowerCase()));
      }
    });
    
    return [...new Set(tags)];
  }

  /**
   * Find related events based on similarity
   */
  private async findRelatedEvents(event: EpisodicEvent): Promise<void> {
    const similar = await this.findSimilar(event.content, 5);
    event.relatedEvents = similar
      .filter(e => e.id !== event.id)
      .map(e => e.id);
  }

  /**
   * Insert event into timeline in chronological order
   */
  private insertIntoTimeline(event: EpisodicEvent): void {
    const index = this.timeline.findIndex(e => e.timestamp < event.timestamp);
    if (index === -1) {
      this.timeline.push(event);
    } else {
      this.timeline.splice(index, 0, event);
    }
    
    // Trim timeline if too long
    if (this.timeline.length > this.MAX_EVENTS) {
      this.timeline = this.timeline.slice(0, this.MAX_EVENTS);
    }
  }

  /**
   * Remove event from timeline
   */
  private removeFromTimeline(eventId: string): void {
    const index = this.timeline.findIndex(e => e.id === eventId);
    if (index !== -1) {
      this.timeline.splice(index, 1);
    }
  }

  /**
   * Calculate relevance score for sorting
   */
  private calculateRelevanceScore(event: EpisodicEvent): number {
    const now = Date.now();
    const hoursSinceEvent = (now - event.timestamp) / (1000 * 60 * 60);
    
    // Recency decay (exponential)
    const recencyScore = Math.exp(-0.1 * hoursSinceEvent);
    
    // Combined score
    return (
      recencyScore * 0.3 +
      event.importance * 0.4 +
      Math.abs(event.emotionalWeight) * 0.2 +
      Math.min(1, event.recalledCount / 10) * 0.1
    );
  }

  /**
   * Count keyword matches between two texts
   */
  private countKeywordMatches(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 3));
    
    return words1.filter(w => words2.has(w)).length;
  }

  /**
   * Apply decay to all events and forget low-importance ones
   */
  private applyDecayAndForgetting(): void {
    const now = Date.now();
    const hoursElapsed = 1; // Assume called hourly
    
    for (const [id, event] of this.events.entries()) {
      // Decay importance over time
      event.importance *= (1 - this.DECAY_RATE * hoursElapsed);
      
      // Boost if recently recalled
      if (event.lastRecalled && now - event.lastRecalled < 1000 * 60 * 60) {
        event.importance = Math.min(1.0, event.importance + 0.1);
      }
      
      // Forget if below threshold
      if (event.importance < this.FORGET_THRESHOLD && event.recalledCount === 0) {
        this.events.delete(id);
        this.removeFromTimeline(id);
      }
    }
    
    // Enforce max events limit
    if (this.events.size > this.MAX_EVENTS) {
      const sortedByImportance = Array.from(this.events.entries())
        .sort((a, b) => b[1].importance - a[1].importance);
      
      const toRemove = sortedByImportance.slice(this.MAX_EVENTS);
      toRemove.forEach(([id]) => {
        this.events.delete(id);
        this.removeFromTimeline(id);
      });
    }
  }

  /**
   * Get statistics about memory
   */
  getStats(): { total: number; byType: Record<string, number>; avgImportance: number } {
    const byType: Record<string, number> = {};
    let totalImportance = 0;
    
    for (const event of this.events.values()) {
      byType[event.type] = (byType[event.type] || 0) + 1;
      totalImportance += event.importance;
    }
    
    return {
      total: this.events.size,
      byType,
      avgImportance: this.events.size > 0 ? totalImportance / this.events.size : 0,
    };
  }
}
