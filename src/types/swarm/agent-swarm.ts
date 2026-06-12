/**
 * Типы данных для мульти-агентной системы (Swarm)
 * Фаза 4: Agent Swarm Architecture
 */

import { z } from 'zod';

/**
 * Роли специализированных агентов
 */
export enum AgentRole {
  ORCHESTRATOR = 'orchestrator',      // Главный координатор
  RESEARCHER = 'researcher',          // Поиск информации
  PLANNER = 'planner',                // Стратегическое планирование
  EXECUTOR = 'executor',              // Выполнение задач
  CRITIC = 'critic',                  // Критика и валидация
  SECURITY = 'security',              // Проверка безопасности
  COMMUNICATOR = 'communicator',      // Коммуникация с пользователем
  LEARNER = 'learner',                // Анализ и обучение
}

/**
 * Статус агента в swarm
 */
export enum AgentStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  WAITING = 'waiting',
  ERROR = 'error',
  OFFLINE = 'offline',
}

/**
 * Методы консенсуса
 */
export enum ConsensusMethod {
  MAJORITY_VOTE = 'majority_vote',
  WEIGHTED_VOTE = 'weighted_vote',
  UNANIMOUS = 'unanimous',
  DEBATE = 'debate',
  TIMEOUT = 'timeout',
}

/**
 * Схема сообщения между агентами
 */
const AgentRoleEnum = z.enum([AgentRole.ORCHESTRATOR, AgentRole.RESEARCHER, AgentRole.PLANNER, AgentRole.EXECUTOR, AgentRole.CRITIC, AgentRole.SECURITY, AgentRole.COMMUNICATOR, AgentRole.LEARNER]);
const ConsensusMethodEnum = z.enum([ConsensusMethod.MAJORITY_VOTE, ConsensusMethod.WEIGHTED_VOTE, ConsensusMethod.UNANIMOUS, ConsensusMethod.DEBATE, ConsensusMethod.TIMEOUT]);

export const AgentMessageSchema = z.object({
  id: z.string().uuid(),
  from: AgentRoleEnum,
  to: z.union([AgentRoleEnum, z.literal('all')]),
  type: z.enum(['request', 'response', 'proposal', 'vote', 'result', 'error']),
  content: z.record(z.string(), z.unknown()),
  timestamp: z.number(),
  priority: z.number().min(1).max(10).default(5),
  requiresResponse: z.boolean().default(false),
  timeout: z.number().optional(),
  threadId: z.string().optional(),
  inReplyTo: z.string().uuid().optional(),
});

export type AgentMessage = z.infer<typeof AgentMessageSchema>;

/**
 * Схема голоса агента
 */
export const AgentVoteSchema = z.object({
  agentId: z.string(),
  agentRole: z.enum([AgentRole.ORCHESTRATOR, AgentRole.RESEARCHER, AgentRole.PLANNER, AgentRole.EXECUTOR, AgentRole.CRITIC, AgentRole.SECURITY, AgentRole.COMMUNICATOR, AgentRole.LEARNER]),
  proposalId: z.string().uuid(),
  vote: z.enum(['yes', 'no', 'abstain']),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
  timestamp: z.number(),
  weight: z.number().min(0).max(1).default(1),
});

export type AgentVote = z.infer<typeof AgentVoteSchema>;

/**
 * Схема предложения (proposal)
 */
export const ProposalSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  proposer: z.enum([AgentRole.ORCHESTRATOR, AgentRole.RESEARCHER, AgentRole.PLANNER, AgentRole.EXECUTOR, AgentRole.CRITIC, AgentRole.SECURITY, AgentRole.COMMUNICATOR, AgentRole.LEARNER]),
  type: z.enum(['action', 'strategy', 'plan', 'decision']),
  content: z.record(z.string(), z.unknown()),
  status: z.enum(['draft', 'active', 'voting', 'accepted', 'rejected', 'expired']),
  votes: z.array(z.string().uuid()).default([]),
  createdAt: z.number(),
  expiresAt: z.number(),
  requiredConsensus: ConsensusMethodEnum,
  minVotes: z.number().int().positive(),
});

export type Proposal = z.infer<typeof ProposalSchema>;

/**
 * Конфигурация отдельного агента
 */
export const AgentConfigSchema = z.object({
  role: AgentRoleEnum,
  enabled: z.boolean().default(true),
  maxConcurrentTasks: z.number().int().positive().default(3),
  priority: z.number().min(1).max(10).default(5),
  specialization: z.array(z.string()).optional(),
  llmProvider: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  systemPrompt: z.string().optional(),
  tools: z.array(z.string()).optional(),
  memoryLimit: z.number().int().positive().optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Конфигурация swarm
 */
export const SwarmConfigSchema = z.object({
  enabled: z.boolean().default(true),
  agents: z.array(AgentConfigSchema),
  consensusTimeout: z.number().positive().default(30000),
  debateRounds: z.number().int().positive().default(3),
  quorumPercentage: z.number().min(50).max(100).default(60),
  messageQueueSize: z.number().int().positive().default(1000),
  enableLogging: z.boolean().default(true),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type SwarmConfig = z.infer<typeof SwarmConfigSchema>;

/**
 * Результат достижения консенсуса
 */
export interface ConsensusResult {
  proposalId: string;
  method: ConsensusMethod;
  achieved: boolean;
  votes: AgentVote[];
  result: 'accepted' | 'rejected' | 'timeout';
  summary: string;
  dissentingOpinions?: Array<{
    agentRole: AgentRole;
    rationale: string;
  }>;
  timestamp: number;
}

/**
 * Статистика swarm
 */
export interface SwarmMetrics {
  totalAgents: number;
  activeAgents: number;
  messagesProcessed: number;
  proposalsCreated: number;
  consensusReached: number;
  averageConsensusTime: number;
  tasksCompleted: number;
  successRate: number;
  byRole: Record<AgentRole, {
    tasksCompleted: number;
    successRate: number;
    averageResponseTime: number;
  }>;
}

/**
 * Задача для выполнения агентом
 */
export interface AgentTask {
  id: string;
  assignedTo: AgentRole;
  description: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  dependencies?: string[];
}
