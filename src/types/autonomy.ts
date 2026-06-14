/**
 * Autonomy Types
 *
 * Type definitions for the autonomy dashboard frontend.
 */

export type AutonomyLevel =
  | "LEVEL_0_MANUAL"
  | "LEVEL_1_SUPERVISED"
  | "LEVEL_2_SEMI_AUTONOMOUS"
  | "LEVEL_3_FULLY_AUTONOMOUS"
  | "LEVEL_4_GOD_MODE";

export interface AutonomyLevelConfig {
  level: AutonomyLevel;
  name: string;
  description: string;
  maxTONTransaction: number;
  maxDailySpending: number;
  reportingMode: string;
  escalationThreshold: number;
}

export interface ConsciousnessState {
  currentLevel: string;
  activeGoals: string[];
  efficiencyScore: number;
}

export interface SwarmMetrics {
  agentCount: number;
  activeAgents: number;
  taskCount: number;
  completedTasks: number;
  successRate: number;
}
