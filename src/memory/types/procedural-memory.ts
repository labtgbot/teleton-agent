/**
 * Procedural Memory: Skill and pattern-based memory system
 * 
 * Stores:
 * - Action sequences (skills)
 * - Decision patterns (heuristics)
 * - Success/failure templates
 * - Optimization rules
 */

import { logger } from '../../utils/logger';

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  steps: SkillStep[];
  successRate: number;
  usageCount: number;
  lastUsed?: number;
  createdAt: number;
  tags: string[];
  preconditions: string[];
  postconditions: string[];
}

export interface SkillStep {
  order: number;
  action: string;
  description: string;
  expectedOutcome: string;
  failureMode?: string;
  recoveryAction?: string;
}

export interface DecisionPattern {
  id: string;
  name: string;
  context: string;
  condition: string;
  action: string;
  confidence: number;
  successCount: number;
  failureCount: number;
  examples: string[];
}

export interface Heuristic {
  id: string;
  rule: string;
  domain: string;
  weight: number;
  applicability: string[];
}

export enum SkillCategory {
  COMMUNICATION = 'COMMUNICATION',
  RESEARCH = 'RESEARCH',
  ANALYSIS = 'ANALYSIS',
  EXECUTION = 'EXECUTION',
  PLANNING = 'PLANNING',
  ERROR_RECOVERY = 'ERROR_RECOVERY',
  OPTIMIZATION = 'OPTIMIZATION',
}

export interface SkillQuery {
  category?: SkillCategory;
  tags?: string[];
  minSuccessRate?: number;
  search?: string;
  limit?: number;
}

export class ProceduralMemory {
  private skills: Map<string, Skill>;
  private patterns: Map<string, DecisionPattern>;
  private heuristics: Map<string, Heuristic>;
  private readonly MIN_SUCCESS_RATE = 0.6;

  constructor() {
    this.skills = new Map();
    this.patterns = new Map();
    this.heuristics = new Map();
    
    // Initialize with basic skills
    this.initializeBasicSkills();
  }

  /**
   * Store a new skill
   */
  async storeSkill(
    name: string,
    description: string,
    category: SkillCategory,
    steps: SkillStep[],
    tags: string[] = []
  ): Promise<string> {
    const id = `skill_${name.toLowerCase().replace(/\s+/g, '_')}`;
    
    const skill: Skill = {
      id,
      name,
      description,
      category,
      steps: steps.sort((a, b) => a.order - b.order),
      successRate: 1.0, // Start optimistic
      usageCount: 0,
      createdAt: Date.now(),
      tags,
      preconditions: [],
      postconditions: [],
    };
    
    this.skills.set(id, skill);
    logger.info(`[ProceduralMemory] Stored skill: ${name} (${steps.length} steps)`);
    return id;
  }

  /**
   * Record skill execution result
   */
  recordSkillExecution(skillId: string, success: boolean, duration?: number): void {
    const skill = this.skills.get(skillId);
    if (!skill) {
      logger.warn(`[ProceduralMemory] Skill not found: ${skillId}`);
      return;
    }
    
    skill.usageCount++;
    skill.lastUsed = Date.now();
    
    // Update success rate with exponential moving average
    const alpha = 0.3; // Weight for new observations
    skill.successRate = skill.successRate * (1 - alpha) + (success ? 1 : 0) * alpha;
    
    logger.debug(`[ProceduralMemory] Recorded execution for ${skill.name}: ${success ? 'SUCCESS' : 'FAILURE'} (rate: ${skill.successRate.toFixed(2)})`);
    
    // Mark for optimization if success rate drops
    if (skill.successRate < this.MIN_SUCCESS_RATE && skill.usageCount > 5) {
      logger.warn(`[ProceduralMemory] Skill ${skill.name} has low success rate: ${skill.successRate.toFixed(2)}`);
    }
  }

  /**
   * Query skills
   */
  querySkills(filters: SkillQuery): Skill[] {
    let results = Array.from(this.skills.values());
    
    // Filter by category
    if (filters.category) {
      results = results.filter(s => s.category === filters.category);
    }
    
    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(s => 
        filters.tags!.some(tag => s.tags.includes(tag))
      );
    }
    
    // Filter by success rate
    if (filters.minSuccessRate !== undefined) {
      results = results.filter(s => s.successRate >= filters.minSuccessRate!);
    }
    
    // Search in name/description
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(s => 
        s.name.toLowerCase().includes(searchLower) ||
        s.description.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort by success rate and usage
    results.sort((a, b) => {
      const scoreA = a.successRate * 0.7 + Math.min(1, a.usageCount / 100) * 0.3;
      const scoreB = b.successRate * 0.7 + Math.min(1, b.usageCount / 100) * 0.3;
      return scoreB - scoreA;
    });
    
    // Limit results
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }
    
    return results;
  }

  /**
   * Get skill by ID
   */
  getSkill(skillId: string): Skill | null {
    return this.skills.get(skillId) || null;
  }

  /**
   * Store decision pattern
   */
  async storePattern(
    name: string,
    context: string,
    condition: string,
    action: string,
    examples: string[] = []
  ): Promise<string> {
    const id = `pattern_${name.toLowerCase().replace(/\s+/g, '_')}`;
    
    const pattern: DecisionPattern = {
      id,
      name,
      context,
      condition,
      action,
      confidence: 0.8,
      successCount: 0,
      failureCount: 0,
      examples,
    };
    
    this.patterns.set(id, pattern);
    logger.info(`[ProceduralMemory] Stored pattern: ${name}`);
    return id;
  }

  /**
   * Record pattern application result
   */
  recordPatternApplication(patternId: string, success: boolean): void {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return;
    
    if (success) {
      pattern.successCount++;
      pattern.confidence = Math.min(1.0, pattern.confidence + 0.05);
    } else {
      pattern.failureCount++;
      pattern.confidence = Math.max(0.0, pattern.confidence - 0.1);
    }
    
    logger.debug(`[ProceduralMemory] Pattern ${pattern.name}: ${success ? 'SUCCESS' : 'FAILURE'} (confidence: ${pattern.confidence.toFixed(2)})`);
  }

  /**
   * Find matching pattern for current context
   */
  findMatchingPattern(context: string, condition: string): DecisionPattern | null {
    const candidates = Array.from(this.patterns.values())
      .filter(p => p.confidence > 0.5)
      .filter(p => 
        context.toLowerCase().includes(p.context.toLowerCase()) ||
        condition.toLowerCase().includes(p.condition.toLowerCase())
      );
    
    if (candidates.length === 0) return null;
    
    // Return highest confidence match
    return candidates.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
  }

  /**
   * Store heuristic rule
   */
  async storeHeuristic(
    rule: string,
    domain: string,
    weight: number = 0.8,
    applicability: string[] = []
  ): Promise<string> {
    const id = `heuristic_${domain}_${Math.random().toString(36).substr(2, 9)}`;
    
    const heuristic: Heuristic = {
      id,
      rule,
      domain,
      weight: Math.max(0, Math.min(1, weight)),
      applicability,
    };
    
    this.heuristics.set(id, heuristic);
    logger.info(`[ProceduralMemory] Stored heuristic for ${domain}`);
    return id;
  }

  /**
   * Get applicable heuristics for domain
   */
  getHeuristics(domain: string): Heuristic[] {
    return Array.from(this.heuristics.values())
      .filter(h => h.domain === domain || h.applicability.includes(domain))
      .sort((a, b) => b.weight - a.weight);
  }

  /**
   * Optimize skill based on execution history
   */
  async optimizeSkill(skillId: string, feedback: string): Promise<void> {
    const skill = this.skills.get(skillId);
    if (!skill) return;
    
    logger.info(`[ProceduralMemory] Optimizing skill: ${skill.name}`);
    
    // Analyze feedback (simplified)
    if (feedback.toLowerCase().includes('too slow') || feedback.toLowerCase().includes('inefficient')) {
      // Mark steps for potential parallelization
      logger.info(`[ProceduralMemory] Identified optimization opportunity: parallelization`);
    }
    
    if (feedback.toLowerCase().includes('error') || feedback.toLowerCase().includes('fail')) {
      // Add failure modes to steps
      logger.info(`[ProceduralMemory] Identified optimization opportunity: error handling`);
    }
    
    // Boost success rate if positive feedback
    if (feedback.toLowerCase().includes('good') || feedback.toLowerCase().includes('excellent')) {
      skill.successRate = Math.min(1.0, skill.successRate + 0.05);
    }
  }

  /**
   * Consolidate procedural memory
   */
  async consolidate(): Promise<{ optimized: number; deprecated: number }> {
    logger.info('[ProceduralMemory] Starting consolidation...');
    
    let optimized = 0;
    let deprecated = 0;
    
    // Optimize frequently used skills
    for (const skill of this.skills.values()) {
      if (skill.usageCount > 50 && skill.successRate > 0.8) {
        // Strengthen high-performing skills
        skill.successRate = Math.min(1.0, skill.successRate + 0.02);
        optimized++;
      }
      
      // Deprecate low-performing, rarely used skills
      if (skill.successRate < 0.5 && skill.usageCount < 10) {
        logger.warn(`[ProceduralMemory] Deprecated skill: ${skill.name} (low performance)`);
        deprecated++;
      }
    }
    
    // Clean up low-confidence patterns
    for (const [id, pattern] of this.patterns.entries()) {
      if (pattern.confidence < 0.3 && pattern.failureCount > pattern.successCount) {
        this.patterns.delete(id);
        deprecated++;
        logger.info(`[ProceduralMemory] Removed low-confidence pattern: ${pattern.name}`);
      }
    }
    
    logger.info(`[ProceduralMemory] Consolidation complete: ${optimized} optimized, ${deprecated} deprecated`);
    return { optimized, deprecated };
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalSkills: number;
    byCategory: Record<string, number>;
    avgSuccessRate: number;
    totalPatterns: number;
    totalHeuristics: number;
  } {
    const byCategory: Record<string, number> = {};
    let totalSuccessRate = 0;
    
    for (const skill of this.skills.values()) {
      byCategory[skill.category] = (byCategory[skill.category] || 0) + 1;
      totalSuccessRate += skill.successRate;
    }
    
    return {
      totalSkills: this.skills.size,
      byCategory,
      avgSuccessRate: this.skills.size > 0 ? totalSuccessRate / this.skills.size : 0,
      totalPatterns: this.patterns.size,
      totalHeuristics: this.heuristics.size,
    };
  }

  /**
   * Initialize with basic skills
   */
  private async initializeBasicSkills(): Promise<void> {
    // Communication skill
    await this.storeSkill(
      'Active Listening',
      'Understand user intent through careful analysis',
      SkillCategory.COMMUNICATION,
      [
        { order: 1, action: 'parse_input', description: 'Parse user message', expectedOutcome: 'Structured input' },
        { order: 2, action: 'identify_intent', description: 'Identify primary intent', expectedOutcome: 'Intent classification' },
        { order: 3, action: 'extract_context', description: 'Extract contextual information', expectedOutcome: 'Context object' },
        { order: 4, action: 'formulate_response', description: 'Generate appropriate response', expectedOutcome: 'Response draft' },
      ],
      ['communication', 'understanding', 'nlp']
    );
    
    // Error recovery skill
    await this.storeSkill(
      'API Error Recovery',
      'Handle and recover from API failures',
      SkillCategory.ERROR_RECOVERY,
      [
        { order: 1, action: 'detect_error', description: 'Identify error type', expectedOutcome: 'Error classification' },
        { order: 2, action: 'log_error', description: 'Log error details', expectedOutcome: 'Error logged' },
        { order: 3, action: 'retry_with_backoff', description: 'Retry with exponential backoff', expectedOutcome: 'Success or max retries' },
        { order: 4, action: 'fallback_strategy', description: 'Execute fallback plan', expectedOutcome: 'Alternative solution' },
      ],
      ['error-handling', 'api', 'resilience']
    );
    
    // Basic heuristics
    await this.storeHeuristic(
      'If user asks twice, prioritize their request',
      'communication',
      0.9,
      ['user-interaction', 'priority']
    );
    
    await this.storeHeuristic(
      'When uncertain, ask clarifying questions before acting',
      'decision-making',
      0.95,
      ['uncertainty', 'clarification']
    );
    
    logger.info('[ProceduralMemory] Initialized with basic skills and heuristics');
  }
}
