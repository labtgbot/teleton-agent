/**
 * Типы данных для системы самосовершенствования агента
 * Фаза 4: Self-Improvement Loop
 */

import { z } from 'zod';

/**
 * Типы событий опыта
 */
export enum ExperienceType {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL_SUCCESS = 'partial_success',
  NEAR_MISS = 'near_miss',
  BREAKTHROUGH = 'breakthrough',
}

/**
 * Категории паттернов
 */
export enum PatternCategory {
  DECISION_MAKING = 'decision_making',
  TOOL_USAGE = 'tool_usage',
  COMMUNICATION = 'communication',
  PROBLEM_SOLVING = 'problem_solving',
  RESOURCE_MANAGEMENT = 'resource_management',
  ERROR_HANDLING = 'error_handling',
  OPTIMIZATION = 'optimization',
}

/**
 * Схема отдельного события опыта
 */
const ExperienceTypeEnum = z.enum([ExperienceType.SUCCESS, ExperienceType.FAILURE, ExperienceType.PARTIAL_SUCCESS, ExperienceType.NEAR_MISS, ExperienceType.BREAKTHROUGH]);
const PatternCategoryEnum = z.enum([PatternCategory.DECISION_MAKING, PatternCategory.TOOL_USAGE, PatternCategory.COMMUNICATION, PatternCategory.PROBLEM_SOLVING, PatternCategory.RESOURCE_MANAGEMENT, PatternCategory.ERROR_HANDLING, PatternCategory.OPTIMIZATION]);

export const ExperienceEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.number(),
  type: ExperienceTypeEnum,
  taskId: z.string().optional(),
  action: z.string(),
  context: z.record(z.string(), z.unknown()),
  outcome: z.record(z.string(), z.unknown()),
  metrics: z.object({
    duration: z.number().optional(),
    tokensUsed: z.number().optional(),
    cost: z.number().optional(),
    successRate: z.number().min(0).max(1).optional(),
    userSatisfaction: z.number().min(0).max(10).optional(),
  }).optional(),
  emotionalWeight: z.number().min(-1).max(1).optional(),
  tags: z.array(z.string()).optional(),
  lessonsLearned: z.array(z.string()).optional(),
});

export type ExperienceEvent = z.infer<typeof ExperienceEventSchema>;

/**
 * Схема выявленного паттерна
 */
export const PatternSchema = z.object({
  id: z.string().uuid(),
  category: PatternCategoryEnum,
  name: z.string(),
  description: z.string(),
  frequency: z.number().int().positive(),
  successRate: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  conditions: z.array(z.string()),
  actions: z.array(z.string()),
  outcomes: z.array(z.string()),
  examples: z.array(z.string().uuid()),
  createdAt: z.number(),
  lastUpdated: z.number(),
  isValidated: z.boolean().default(false),
  riskLevel: z.enum(['low', 'medium', 'high']).default('medium'),
});

export type Pattern = z.infer<typeof PatternSchema>;

/**
 * Схема гипотезы улучшения
 */
export const ImprovementHypothesisSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  basedOnPatterns: z.array(z.string().uuid()),
  expectedImpact: z.object({
    metric: z.string(),
    improvement: z.number().min(0),
    confidence: z.number().min(0).max(1),
  }),
  proposedChanges: z.array(z.object({
    component: z.string(),
    change: z.string(),
    rationale: z.string(),
  })),
  testPlan: z.object({
    method: z.enum(['simulation', 'canary', 'ab_test', 'shadow']),
    duration: z.number().positive(),
    successCriteria: z.array(z.string()),
    rollbackPlan: z.string(),
  }),
  status: z.enum(['draft', 'pending_review', 'testing', 'validated', 'rejected', 'integrated']),
  priority: z.number().min(1).max(10),
  createdAt: z.number(),
  createdBy: z.string().optional(),
});

export type ImprovementHypothesis = z.infer<typeof ImprovementHypothesisSchema>;

/**
 * Схема результатов тестирования
 */
export const TestResultSchema = z.object({
  hypothesisId: z.string().uuid(),
  testId: z.string().uuid(),
  startTime: z.number(),
  endTime: z.number(),
  method: z.enum(['simulation', 'canary', 'ab_test', 'shadow']),
  metrics: z.record(z.string(), z.number()),
  success: z.boolean(),
  findings: z.array(z.string()),
  recommendations: z.array(z.string()),
  autoApproved: z.boolean().default(false),
});

export type TestResult = z.infer<typeof TestResultSchema>;

/**
 * Конфигурация цикла самосовершенствования
 */
export const SelfImprovementConfigSchema = z.object({
  enabled: z.boolean().default(true),
  minExperiencesForPattern: z.number().int().positive().default(5),
  patternConfidenceThreshold: z.number().min(0).max(1).default(0.7),
  autoTestLowRisk: z.boolean().default(true),
  maxConcurrentTests: z.number().int().positive().default(3),
  simulationIterations: z.number().int().positive().default(100),
  canaryPercentage: z.number().min(0).max(100).default(10),
  abTestDuration: z.number().positive().default(86400000), // 24 часа
  retentionDays: z.number().int().positive().default(90),
  reviewRequired: z.boolean().default(true),
});

export type SelfImprovementConfig = z.infer<typeof SelfImprovementConfigSchema>;

/**
 * Метрики системы самосовершенствования
 */
export interface SelfImprovementMetrics {
  totalExperiences: number;
  experiencesByType: Record<ExperienceType, number>;
  totalPatterns: number;
  validatedPatterns: number;
  activeHypotheses: number;
  testsInProgress: number;
  integratedImprovements: number;
  averageSuccessRate: number;
  improvementVelocity: number; // улучшений в неделю
  lastConsolidation: number;
}
