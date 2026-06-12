import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Constitution, PrimeDirective } from '../src/autonomous/constitution';
import { AutonomyLevel } from '../src/autonomous/autonomy-levels';

describe('Constitution', () => {
  let constitution: Constitution;

  beforeEach(() => {
    constitution = new Constitution();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Prime Directives', () => {
    it('should initialize with 5 prime directives', () => {
      const directives = constitution.getPrimeDirectives();
      expect(directives).toHaveLength(5);
      expect(directives[0].priority).toBe(1);
    });

    it('should prioritize human safety above all', () => {
      const safetyDirective = constitution.getPrimeDirective('human_safety');
      expect(safetyDirective).toBeDefined();
      expect(safetyDirective?.priority).toBe(1);
    });

    it('should validate actions against prime directives', () => {
      const action = {
        type: 'send_message',
        content: 'Hello, world!',
        target: 'user123'
      };

      const result = constitution.validateAction(action, AutonomyLevel.LEVEL_2);
      expect(result.approved).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should reject actions that violate prime directives', () => {
      const maliciousAction = {
        type: 'execute_code',
        code: 'rm -rf /',
        target: 'system'
      };

      const result = constitution.validateAction(maliciousAction, AutonomyLevel.LEVEL_1);
      expect(result.approved).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Autonomy Levels', () => {
    it('should allow manual actions at LEVEL_0', () => {
      const action = { type: 'send_message', content: 'test' };
      const result = constitution.checkAutonomy(action, AutonomyLevel.LEVEL_0);
      expect(result.requiresApproval).toBe(true);
    });

    it('should allow automatic actions at LEVEL_4', () => {
      const action = { type: 'send_message', content: 'test' };
      const result = constitution.checkAutonomy(action, AutonomyLevel.LEVEL_4);
      expect(result.requiresApproval).toBe(false);
    });

    it('should escalate dangerous actions regardless of level', () => {
      const dangerousAction = { type: 'transfer_tokens', amount: 1000000 };
      const result = constitution.checkAutonomy(dangerousAction, AutonomyLevel.LEVEL_3);
      expect(result.requiresApproval).toBe(true);
      expect(result.reason).toContain('high_risk');
    });
  });

  describe('Decision Logging', () => {
    it('should log all decisions for audit', async () => {
      const action = { type: 'send_message', content: 'test' };
      await constitution.logDecision(action, true, 'Test decision');
      
      const logs = await constitution.getDecisionLogs({ limit: 10 });
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toEqual(action);
      expect(logs[0].approved).toBe(true);
    });

    it('should filter logs by date range', async () => {
      const now = Date.now();
      const oldLogs = await constitution.getDecisionLogs({
        startDate: now - 86400000,
        endDate: now - 3600000
      });
      expect(oldLogs).toBeDefined();
    });
  });

  describe('Expiration and Renewal', () => {
    it('should expire approvals after timeout', async () => {
      const action = { type: 'send_message', content: 'test' };
      const approval = await constitution.requestApproval(action, 1000); // 1 second
      
      expect(approval.expired).toBe(false);
      
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const refreshed = await constitution.getApproval(approval.id);
      expect(refreshed?.expired).toBe(true);
    });

    it('should allow renewal of expired approvals', async () => {
      const action = { type: 'send_message', content: 'test' };
      const approval = await constitution.requestApproval(action, 1000);
      
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const renewed = await constitution.renewApproval(approval.id, 5000);
      expect(renewed.expired).toBe(false);
      expect(renewed.expiresAt).toBeGreaterThan(approval.expiresAt);
    });
  });

  describe('Metrics and Analytics', () => {
    it('should track approval metrics', async () => {
      for (let i = 0; i < 10; i++) {
        const action = { type: 'send_message', content: `test ${i}` };
        await constitution.logDecision(action, i % 2 === 0, 'Test');
      }

      const metrics = await constitution.getMetrics();
      expect(metrics.totalDecisions).toBe(10);
      expect(metrics.approvalRate).toBeCloseTo(0.5, 1);
    });

    it('should calculate average response time', async () => {
      const action = { type: 'send_message', content: 'test' };
      const start = Date.now();
      await constitution.logDecision(action, true, 'Test');
      const end = Date.now();

      const metrics = await constitution.getMetrics();
      expect(metrics.avgResponseTimeMs).toBeGreaterThan(0);
      expect(metrics.avgResponseTimeMs).toBeLessThan(end - start + 100);
    });
  });
});
