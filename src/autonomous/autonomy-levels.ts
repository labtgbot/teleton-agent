/**
 * Autonomy Levels System - Multi-tier Autonomous Operation Modes
 * 
 * Implements 5 levels of autonomy from fully manual to fully autonomous.
 * Each level defines what actions require human approval vs can be executed automatically.
 */

import type { ConstitutionCheckResult } from './constitution.js';

/**
 * Autonomy Level definitions:
 * - LEVEL_0_MANUAL: Every action requires explicit human approval
 * - LEVEL_1_SUPERVISED: Only critical/high-risk actions require approval
 * - LEVEL_2_SEMI_AUTONOMOUS: Agent acts independently, reports post-factum
 * - LEVEL_3_FULLY_AUTONOMOUS: Full freedom within constitutional boundaries
 * - LEVEL_4_GOD_MODE: Complete autonomy with self-modification capabilities
 */
export type AutonomyLevel = 
  | 'LEVEL_0_MANUAL'
  | 'LEVEL_1_SUPERVISED'
  | 'LEVEL_2_SEMI_AUTONOMOUS'
  | 'LEVEL_3_FULLY_AUTONOMOUS'
  | 'LEVEL_4_GOD_MODE';

export interface AutonomyLevelConfig {
  level: AutonomyLevel;
  name: string;
  description: string;
  requiresApproval: (actionRisk: RiskAssessment) => boolean;
  maxTONTransaction: number;
  maxDailySpending: number;
  allowedTools?: string[]; // If undefined, all tools allowed
  restrictedTools?: string[];
  reportingMode: 'realtime' | 'batch' | 'on_exception' | 'none';
  escalationThreshold: number; // 0-1, lower = more escalations
}

export interface RiskAssessment {
  type: 'financial' | 'system' | 'data' | 'security' | 'operational';
  severity: 'low' | 'medium' | 'high' | 'critical';
  impactScore: number; // 0-10
  reversibility: 'reversible' | 'partially_reversible' | 'irreversible';
  affectedUsers?: number;
  financialImpact?: number; // In TON
}

export interface ApprovalRequest {
  id: string;
  taskId: string;
  action: {
    type: string;
    description: string;
    toolName?: string;
    parameters?: Record<string, unknown>;
  };
  riskAssessment: RiskAssessment;
  constitutionalCheck?: ConstitutionCheckResult;
  requestedAt: Date;
  expiresAt?: Date;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  response?: {
    decision: 'approve' | 'reject';
    reason?: string;
    respondedAt?: Date;
  };
}

export interface AutonomyMetrics {
  totalActions: number;
  approvedActions: number;
  rejectedActions: number;
  escalatedActions: number;
  averageResponseTimeMs: number;
  approvalRate: number; // 0-1
  violationsDetected: number;
}

/**
 * Default configurations for each autonomy level
 */
export const AUTONOMY_LEVEL_CONFIGS: Record<AutonomyLevel, AutonomyLevelConfig> = {
  LEVEL_0_MANUAL: {
    level: 'LEVEL_0_MANUAL',
    name: 'Manual Control',
    description: 'Every single action requires explicit human approval before execution',
    requiresApproval: () => true, // Always require approval
    maxTONTransaction: 0, // No automatic transactions
    maxDailySpending: 0,
    restrictedTools: [], // All tools restricted without approval
    reportingMode: 'realtime',
    escalationThreshold: 0, // Escalate everything
  },
  
  LEVEL_1_SUPERVISED: {
    level: 'LEVEL_1_SUPERVISED',
    name: 'Supervised Autonomy',
    description: 'Low-risk actions automated; critical actions require approval',
    requiresApproval: (risk) => {
      return risk.severity === 'high' || risk.severity === 'critical' || risk.impactScore >= 7;
    },
    maxTONTransaction: 0.5, // Up to 0.5 TON auto-approved
    maxDailySpending: 2, // 2 TON daily limit
    restrictedTools: ['wallet:send', 'contract:deploy', 'system:exec'],
    reportingMode: 'realtime',
    escalationThreshold: 0.3,
  },
  
  LEVEL_2_SEMI_AUTONOMOUS: {
    level: 'LEVEL_2_SEMI_AUTONOMOUS',
    name: 'Semi-Autonomous',
    description: 'Agent acts independently but reports all actions post-factum',
    requiresApproval: (risk) => {
      return risk.severity === 'critical' || 
             (risk.severity === 'high' && risk.reversibility === 'irreversible');
    },
    maxTONTransaction: 2, // Up to 2 TON auto-approved
    maxDailySpending: 10, // 10 TON daily limit
    restrictedTools: ['contract:deploy', 'system:exec'],
    reportingMode: 'batch', // Batch reports every N actions
    escalationThreshold: 0.5,
  },
  
  LEVEL_3_FULLY_AUTONOMOUS: {
    level: 'LEVEL_3_FULLY_AUTONOMOUS',
    name: 'Full Autonomy',
    description: 'Complete operational freedom within constitutional boundaries',
    requiresApproval: (risk) => {
      return risk.severity === 'critical' && risk.reversibility === 'irreversible';
    },
    maxTONTransaction: 10, // Up to 10 TON auto-approved
    maxDailySpending: 50, // 50 TON daily limit
    restrictedTools: ['system:exec'], // Only system exec restricted
    reportingMode: 'on_exception', // Only report problems
    escalationThreshold: 0.7,
  },
  
  LEVEL_4_GOD_MODE: {
    level: 'LEVEL_4_GOD_MODE',
    name: 'God Mode',
    description: 'Unrestricted autonomy with self-improvement capabilities (DANGEROUS)',
    requiresApproval: () => false, // Never require approval
    maxTONTransaction: Infinity, // No limits
    maxDailySpending: Infinity,
    restrictedTools: [], // No restrictions
    reportingMode: 'none', // No reporting (self-auditing only)
    escalationThreshold: 1, // Never escalate
  },
};

/**
 * AutonomyManager - Manages autonomy levels and approval workflows
 */
export class AutonomyManager {
  private currentLevel: AutonomyLevel;
  private pendingApprovals = new Map<string, ApprovalRequest>();
  private metrics: AutonomyMetrics;
  private levelHistory: Array<{
    level: AutonomyLevel;
    changedAt: Date;
    reason?: string;
  }> = [];
  
  constructor(initialLevel: AutonomyLevel = 'LEVEL_1_SUPERVISED') {
    this.currentLevel = initialLevel;
    this.metrics = {
      totalActions: 0,
      approvedActions: 0,
      rejectedActions: 0,
      escalatedActions: 0,
      averageResponseTimeMs: 0,
      approvalRate: 1,
      violationsDetected: 0,
    };
    this.recordLevelChange(initialLevel, 'Initialization');
  }
  
  /**
   * Get current autonomy level
   */
  getCurrentLevel(): AutonomyLevel {
    return this.currentLevel;
  }
  
  /**
   * Get configuration for current level
   */
  getCurrentConfig(): AutonomyLevelConfig {
    return AUTONOMY_LEVEL_CONFIGS[this.currentLevel];
  }
  
  /**
   * Change autonomy level (with audit trail)
   */
  setLevel(newLevel: AutonomyLevel, reason?: string): void {
    const oldLevel = this.currentLevel;
    this.currentLevel = newLevel;
    this.recordLevelChange(newLevel, reason);
    
    // Log level change for auditing
    console.log(`[AutonomyManager] Level changed: ${oldLevel} → ${newLevel}`);
    if (reason) {
      console.log(`[AutonomyManager] Reason: ${reason}`);
    }
  }
  
  private recordLevelChange(level: AutonomyLevel, reason?: string): void {
    this.levelHistory.push({
      level,
      changedAt: new Date(),
      reason,
    });
  }
  
  /**
   * Check if an action requires human approval
   */
  requiresApproval(actionRisk: RiskAssessment): boolean {
    const config = this.getCurrentConfig();
    return config.requiresApproval(actionRisk);
  }
  
  /**
   * Evaluate an action and determine if it can proceed
   * Returns: 'auto_approve' | 'require_approval' | 'auto_reject'
   */
  evaluateAction(
    taskId: string,
    actionType: string,
    actionDescription: string,
    riskAssessment: RiskAssessment,
    constitutionalCheck?: ConstitutionCheckResult
  ): { decision: 'auto_approve' | 'require_approval' | 'auto_reject'; approvalId?: string } {
    this.metrics.totalActions++;
    
    // First check constitutional constraints
    if (constitutionalCheck && constitutionalCheck.recommendation === 'reject') {
      this.metrics.rejectedActions++;
      return { decision: 'auto_reject' };
    }
    
    // Check if action requires approval based on autonomy level
    if (this.requiresApproval(riskAssessment)) {
      // Create approval request
      const approvalId = this.createApprovalRequest(taskId, {
        type: actionType,
        description: actionDescription,
      }, riskAssessment, constitutionalCheck);
      
      this.metrics.escalatedActions++;
      return { decision: 'require_approval', approvalId };
    }
    
    // Auto-approve
    this.metrics.approvedActions++;
    return { decision: 'auto_approve' };
  }
  
  /**
   * Create a new approval request
   */
  private createApprovalRequest(
    taskId: string,
    action: ApprovalRequest['action'],
    riskAssessment: RiskAssessment,
    constitutionalCheck?: ConstitutionCheckResult
  ): string {
    const id = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const request: ApprovalRequest = {
      id,
      taskId,
      action,
      riskAssessment,
      constitutionalCheck,
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000), // 1 hour expiry
      status: 'pending',
    };
    
    this.pendingApprovals.set(id, request);
    return id;
  }
  
  /**
   * Get pending approval request
   */
  getApprovalRequest(approvalId: string): ApprovalRequest | undefined {
    return this.pendingApprovals.get(approvalId);
  }
  
  /**
   * Get all pending approvals
   */
  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values())
      .filter(req => req.status === 'pending');
  }
  
  /**
   * Respond to an approval request
   */
  respondToApproval(
    approvalId: string,
    decision: 'approve' | 'reject',
    reason?: string
  ): boolean {
    const request = this.pendingApprovals.get(approvalId);
    if (!request || request.status !== 'pending') {
      return false;
    }
    
    const respondedAt = new Date();
    request.status = decision === 'approve' ? 'approved' : 'rejected';
    request.response = {
      decision,
      reason,
      respondedAt,
    };
    
    // Update metrics
    if (decision === 'approve') {
      this.metrics.approvedActions++;
    } else {
      this.metrics.rejectedActions++;
    }
    
    // Calculate average response time
    const responseTime = respondedAt.getTime() - request.requestedAt.getTime();
    const totalResponses = this.metrics.approvedActions + this.metrics.rejectedActions;
    this.metrics.averageResponseTimeMs = 
      ((this.metrics.averageResponseTimeMs * (totalResponses - 1)) + responseTime) / totalResponses;
    
    // Update approval rate
    this.metrics.approvalRate = this.metrics.approvedActions / totalResponses;
    
    return true;
  }
  
  /**
   * Check if a financial transaction is within limits
   */
  isWithinFinancialLimits(amount: number): boolean {
    const config = this.getCurrentConfig();
    return amount <= config.maxTONTransaction;
  }
  
  /**
   * Check if a tool is allowed at current autonomy level
   */
  isToolAllowed(toolName: string): boolean {
    const config = this.getCurrentConfig();
    
    // If specific allowlist exists
    if (config.allowedTools) {
      return config.allowedTools.includes(toolName);
    }
    
    // If restrictlist exists
    if (config.restrictedTools) {
      return !config.restrictedTools.includes(toolName);
    }
    
    // All tools allowed
    return true;
  }
  
  /**
   * Get autonomy metrics
   */
  getMetrics(): AutonomyMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Get level change history
   */
  getLevelHistory(): Array<{ level: AutonomyLevel; changedAt: Date; reason?: string }> {
    return [...this.levelHistory];
  }
  
  /**
   * Clean up expired approval requests
   */
  cleanupExpiredApprovals(): number {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [id, request] of this.pendingApprovals.entries()) {
      if (request.status === 'pending' && request.expiresAt && request.expiresAt.getTime() < now) {
        request.status = 'expired';
        expiredCount++;
      }
    }
    
    return expiredCount;
  }
  
  /**
   * Generate autonomy status report
   */
  generateStatusReport(): string {
    const config = this.getCurrentConfig();
    const lines: string[] = [
      '=== AUTONOMY STATUS REPORT ===',
      `Current Level: ${config.name} (${this.currentLevel})`,
      `Description: ${config.description}`,
      '',
      '--- CONFIGURATION ---',
      `Max TON Transaction: ${config.maxTONTransaction === Infinity ? '∞' : config.maxTONTransaction} TON`,
      `Max Daily Spending: ${config.maxDailySpending === Infinity ? '∞' : config.maxDailySpending} TON`,
      `Reporting Mode: ${config.reportingMode}`,
      `Escalation Threshold: ${(config.escalationThreshold * 100).toFixed(0)}%`,
      '',
      '--- METRICS ---',
      `Total Actions: ${this.metrics.totalActions}`,
      `Approved: ${this.metrics.approvedActions} (${(this.metrics.approvalRate * 100).toFixed(1)}%)`,
      `Rejected: ${this.metrics.rejectedActions}`,
      `Escalated: ${this.metrics.escalatedActions}`,
      `Avg Response Time: ${this.metrics.averageResponseTimeMs.toFixed(0)}ms`,
      `Violations Detected: ${this.metrics.violationsDetected}`,
      '',
      '--- PENDING APPROVALS ---',
    ];
    
    const pending = this.getPendingApprovals();
    if (pending.length === 0) {
      lines.push('No pending approvals');
    } else {
      pending.forEach(req => {
        lines.push(`• [${req.id}] ${req.action.type}: ${req.action.description}`);
        lines.push(`  Risk: ${req.riskAssessment.severity} (${req.riskAssessment.impactScore}/10)`);
        lines.push(`  Requested: ${req.requestedAt.toISOString()}`);
      });
    }
    
    lines.push('\n=== END REPORT ===');
    return lines.join('\n');
  }
}

// Singleton instance
let autonomyManagerInstance: AutonomyManager | null = null;

export function getAutonomyManager(): AutonomyManager {
  if (!autonomyManagerInstance) {
    autonomyManagerInstance = new AutonomyManager();
  }
  return autonomyManagerInstance;
}

export default AutonomyManager;
