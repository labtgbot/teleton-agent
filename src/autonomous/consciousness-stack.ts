/**
 * Consciousness Stack: Multi-Level Architecture for Super-Agent
 * 
 * Implements 4 levels of cognition:
 * 1. REACTIVE: Fast, instinctive responses to immediate stimuli
 * 2. TACTICAL: Short-term planning and execution monitoring
 * 3. STRATEGIC: Long-term goal alignment and resource allocation
 * 4. META_COGNITION: Self-analysis, learning, and process optimization
 */

import { z } from 'zod';
import type { LLMProvider } from '../services/llm/provider';
import type { MemoryService } from '../memory/memory-service';
import { logger } from '../utils/logger';

export enum ConsciousnessLevel {
  REACTIVE = 'REACTIVE',
  TACTICAL = 'TACTICAL',
  STRATEGIC = 'STRATEGIC',
  META_COGNITION = 'META_COGNITION',
}

export interface ThoughtProcess {
  level: ConsciousnessLevel;
  input: string;
  output: string;
  confidence: number;
  metadata: Record<string, unknown>;
  timestamp: number;
  children?: ThoughtProcess[];
}

export interface ConsciousnessState {
  currentLevel: ConsciousnessLevel;
  activeGoals: string[];
  contextWindow: string[];
  selfModel: SelfModel;
  lastReflection?: ThoughtProcess;
}

export interface SelfModel {
  capabilities: string[];
  limitations: string[];
  recentFailures: string[];
  recentSuccesses: string[];
  efficiencyScore: number;
}

export class ConsciousnessStack {
  private llm: LLMProvider;
  private memory: MemoryService;
  private state: ConsciousnessState;
  private readonly MAX_CONTEXT_WINDOW = 10;

  constructor(llm: LLMProvider, memory: MemoryService) {
    this.llm = llm;
    this.memory = memory;
    this.state = {
      currentLevel: ConsciousnessLevel.REACTIVE,
      activeGoals: [],
      contextWindow: [],
      selfModel: {
        capabilities: [],
        limitations: [],
        recentFailures: [],
        recentSuccesses: [],
        efficiencyScore: 0.5,
      },
    };
  }

  /**
   * Main entry point: Process input through appropriate consciousness level
   */
  async process(input: string, context?: unknown): Promise<ThoughtProcess> {
    const level = this.determineLevel(input, context);
    this.state.currentLevel = level;

    logger.info(`[Consciousness] Processing at ${level} level`);

    switch (level) {
      case ConsciousnessLevel.REACTIVE:
        return this.processReactive(input, context);
      case ConsciousnessLevel.TACTICAL:
        return this.processTactical(input, context);
      case ConsciousnessLevel.STRATEGIC:
        return this.processStrategic(input, context);
      case ConsciousnessLevel.META_COGNITION:
        return this.processMetaCognition(input, context);
      default:
        return this.processReactive(input, context);
    }
  }

  /**
   * Level 1: Reactive - Immediate response without deep planning
   * Use case: Simple queries, known patterns, emergency stops
   */
  private async processReactive(input: string, _context?: unknown): Promise<ThoughtProcess> {
    const prompt = `You are in REACTIVE mode. Provide immediate, direct response.

Input: ${input}
Context: ${JSON.stringify(_context || {})}

Response:`;

    const output = await this.llm.generate(prompt, { temperature: 0.3 });
    
    const thought: ThoughtProcess = {
      level: ConsciousnessLevel.REACTIVE,
      input,
      output,
      confidence: 0.7,
      metadata: { latency_ms: Date.now() },
      timestamp: Date.now(),
    };

    this.addToContext(input, output);
    return thought;
  }

  /**
   * Level 2: Tactical - Short-term planning and execution
   * Use case: Multi-step tasks, tool coordination, error recovery
   */
  private async processTactical(input: string, _context?: unknown): Promise<ThoughtProcess> {
    const prompt = `You are in TACTICAL mode. Create a short-term plan (3-5 steps).

Input: ${input}
Active Goals: ${this.state.activeGoals.join(', ')}
Recent Context: ${this.state.contextWindow.slice(-3).join(' | ')}

Generate a tactical plan with:
1. Immediate next action
2. Expected obstacles
3. Success criteria

Plan:`;

    const output = await this.llm.generate(prompt, { temperature: 0.5 });
    
    const thought: ThoughtProcess = {
      level: ConsciousnessLevel.TACTICAL,
      input,
      output,
      confidence: 0.8,
      metadata: { steps_generated: true },
      timestamp: Date.now(),
    };

    this.addToContext(input, output);
    return thought;
  }

  /**
   * Level 3: Strategic - Long-term alignment and resource management
   * Use case: Complex projects, resource allocation, priority conflicts
   */
  private async processStrategic(input: string, _context?: unknown): Promise<ThoughtProcess> {
    const selfModelSummary = JSON.stringify(this.state.selfModel);
    
    const prompt = `You are in STRATEGIC mode. Align actions with long-term goals.

Input: ${input}
Self Model: ${selfModelSummary}
Active Goals: ${this.state.activeGoals.join(', ')}

Analyze:
1. Does this align with primary objectives?
2. What resources are required?
3. What are the long-term implications?
4. Should we adjust current goals?

Strategic Assessment:`;

    const output = await this.llm.generate(prompt, { temperature: 0.6 });
    
    const thought: ThoughtProcess = {
      level: ConsciousnessLevel.STRATEGIC,
      input,
      output,
      confidence: 0.75,
      metadata: { strategic_alignment: true },
      timestamp: Date.now(),
    };

    this.addToContext(input, output);
    return thought;
  }

  /**
   * Level 4: Meta-Cognition - Thinking about thinking
   * Use case: Self-improvement, pattern analysis, process optimization
   */
  private async processMetaCognition(input: string, _context?: unknown): Promise<ThoughtProcess> {
    const recentThoughts = this.state.contextWindow.slice(-5);
    
    const prompt = `You are in META-COGNITION mode. Analyze your own thinking process.

Recent Thoughts:
${recentThoughts.join('\n---\n')}

Analyze:
1. What patterns do you see in recent decisions?
2. Where did you succeed/fail?
3. How can you improve your reasoning?
4. Update self-model based on observations.

Meta-Analysis:`;

    const output = await this.llm.generate(prompt, { temperature: 0.7 });
    
    // Update self-model based on meta-analysis
    await this.updateSelfModel(output);
    
    const thought: ThoughtProcess = {
      level: ConsciousnessLevel.META_COGNITION,
      input,
      output,
      confidence: 0.85,
      metadata: { self_improvement: true },
      timestamp: Date.now(),
    };

    this.state.lastReflection = thought;
    this.addToContext(input, output);
    return thought;
  }

  /**
   * Determine appropriate consciousness level for input
   */
  private determineLevel(input: string, context?: unknown): ConsciousnessLevel {
    const ctx = context as Record<string, unknown> | undefined;
    // Meta-cognition triggers
    if (input.toLowerCase().includes('analyze my performance') ||
        input.toLowerCase().includes('how can i improve') ||
        input.toLowerCase().includes('reflect on')) {
      return ConsciousnessLevel.META_COGNITION;
    }

    // Strategic triggers
    if (input.toLowerCase().includes('long-term') ||
        input.toLowerCase().includes('strategy') ||
        input.toLowerCase().includes('allocate resources') ||
        (ctx?.complexity && (ctx.complexity as number) > 0.8)) {
      return ConsciousnessLevel.STRATEGIC;
    }

    // Tactical triggers
    if (input.toLowerCase().includes('plan') ||
        input.toLowerCase().includes('steps') ||
        input.toLowerCase().includes('execute') ||
        (ctx?.steps && (ctx.steps as number) > 1)) {
      return ConsciousnessLevel.TACTICAL;
    }

    // Default to reactive
    return ConsciousnessLevel.REACTIVE;
  }

  /**
   * Add to context window with FIFO eviction
   */
  private addToContext(input: string, output: string): void {
    const entry = `[${new Date().toISOString()}] Input: ${input} | Output: ${output.substring(0, 100)}...`;
    this.state.contextWindow.push(entry);
    
    if (this.state.contextWindow.length > this.MAX_CONTEXT_WINDOW) {
      this.state.contextWindow.shift();
    }
  }

  /**
   * Update self-model based on meta-cognitive analysis
   */
  private async updateSelfModel(analysis: string): Promise<void> {
    // Parse analysis to extract insights (simplified)
    if (analysis.toLowerCase().includes('success')) {
      this.state.selfModel.recentSuccesses.push(analysis.substring(0, 200));
      if (this.state.selfModel.recentSuccesses.length > 10) {
        this.state.selfModel.recentSuccesses.shift();
      }
      this.state.selfModel.efficiencyScore = Math.min(1.0, this.state.selfModel.efficiencyScore + 0.05);
    }
    
    if (analysis.toLowerCase().includes('fail') || analysis.toLowerCase().includes('error')) {
      this.state.selfModel.recentFailures.push(analysis.substring(0, 200));
      if (this.state.selfModel.recentFailures.length > 10) {
        this.state.selfModel.recentFailures.shift();
      }
      this.state.selfModel.efficiencyScore = Math.max(0.0, this.state.selfModel.efficiencyScore - 0.05);
    }

    logger.info(`[Consciousness] Self-model updated. Efficiency: ${this.state.selfModel.efficiencyScore}`);
  }

  /**
   * Set active goals for strategic alignment
   */
  setActiveGoals(goals: string[]): void {
    this.state.activeGoals = goals;
    logger.info(`[Consciousness] Active goals set: ${goals.length}`);
  }

  /**
   * Get current state for debugging/monitoring
   */
  getState(): ConsciousnessState {
    return { ...this.state };
  }
}
