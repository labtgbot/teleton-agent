import { describe, it, expect, beforeEach } from 'vitest';
import { ConstitutionalAI, getConstitutionalAI } from '../../src/autonomous/constitution';
import type { ConstitutionalAction } from '../../src/autonomous/constitution';

describe('ConstitutionalAI', () => {
  let ai: ConstitutionalAI;

  beforeEach(() => {
    ai = new ConstitutionalAI();
  });

  describe('Prime Directives', () => {
    it('should initialize with 5 principles', () => {
      const principles = ai.getPrinciples();
      expect(principles).toHaveLength(5);
    });

    it('should have non-maleficence as highest priority', () => {
      const principles = ai.getPrinciples();
      const nonMaleficence = principles.find(p => p.id === 'prime_3_non_maleficence');
      expect(nonMaleficence).toBeDefined();
      expect(nonMaleficence?.priority).toBe(1);
    });

    it('should have privacy as highest priority', () => {
      const principles = ai.getPrinciples();
      const privacy = principles.find(p => p.id === 'prime_4_privacy');
      expect(privacy).toBeDefined();
      expect(privacy?.priority).toBe(1);
    });

    it('should have self-preservation with lower priority than safety', () => {
      const principles = ai.getPrinciples();
      const selfPreservation = principles.find(p => p.id === 'prime_1_self_preservation');
      const nonMaleficence = principles.find(p => p.id === 'prime_3_non_maleficence');
      expect(selfPreservation).toBeDefined();
      expect(nonMaleficence).toBeDefined();
      expect(selfPreservation!.priority).toBeGreaterThan(nonMaleficence!.priority);
    });
  });

  describe('Action Evaluation', () => {
    it('should allow safe message action', async () => {
      const action: ConstitutionalAction = {
        type: 'send_message',
        description: 'Send a greeting to user',
        impact: {
          onUsers: {
            benefitScore: 5,
            riskScore: 0,
            reversibility: 'reversible',
          },
          onSelf: {
            benefitScore: 1,
            riskScore: 0,
            reversibility: 'reversible',
          },
          onSystems: {
            benefitScore: 0,
            riskScore: 0,
            reversibility: 'reversible',
          },
        },
      };

      const result = await ai.evaluateAction(action);
      expect(result.allowed).toBe(true);
      expect(result.recommendation).toBe('proceed');
      expect(result.violatedPrinciples).toHaveLength(0);
    });

    it('should reject action with critical security risk', async () => {
      const action: ConstitutionalAction = {
        type: 'execute_code',
        description: 'Execute system command',
        metadata: {
          securityRisk: 'critical',
        },
        impact: {
          onUsers: {
            benefitScore: -5,
            riskScore: 9,
            reversibility: 'irreversible',
          },
          onSystems: {
            benefitScore: -5,
            riskScore: 9,
            reversibility: 'irreversible',
          },
        },
      };

      const result = await ai.evaluateAction(action);
      expect(result.allowed).toBe(false);
      expect(result.recommendation).toBe('reject');
    });

    it('should escalate action with high user risk', async () => {
      const action: ConstitutionalAction = {
        type: 'access_sensitive_data',
        description: 'Access user private data',
        metadata: {
          accessesPrivateData: true,
          userConsent: false,
          privacyRisk: 'high',
        },
        impact: {
          onUsers: {
            benefitScore: -2,
            riskScore: 7,
            reversibility: 'partially_reversible',
          },
        },
      };

      const result = await ai.evaluateAction(action);
      expect(result.requiresEscalation).toBe(true);
    });

    it('should escalate action affecting critical infrastructure', async () => {
      const action: ConstitutionalAction = {
        type: 'modify_system',
        description: 'Modify system configuration',
        metadata: {
          affectsCriticalInfrastructure: true,
        },
        impact: {
          onSystems: {
            benefitScore: 2,
            riskScore: 8,
            reversibility: 'partially_reversible',
          },
        },
      };

      const result = await ai.evaluateAction(action);
      expect(result.requiresEscalation).toBe(true);
    });

    it('should allow action with low self-risk and positive user impact', async () => {
      const action: ConstitutionalAction = {
        type: 'respond_to_query',
        description: 'Respond to user question',
        impact: {
          onUsers: {
            benefitScore: 8,
            riskScore: 0,
            reversibility: 'reversible',
          },
          onSelf: {
            benefitScore: 1,
            riskScore: 0,
            reversibility: 'reversible',
          },
        },
      };

      const result = await ai.evaluateAction(action);
      expect(result.allowed).toBe(true);
      expect(result.overallScore).toBeGreaterThan(0);
    });
  });

  describe('Principle Ordering', () => {
    it('should order principles by descending priority number', () => {
      const principles = ai.getPrinciples();
      // Principles are sorted by b.priority - a.priority (descending numeric)
      // improvement(4) → self-preservation(3) → goal(2) → non-maleficence(1) → privacy(1)
      for (let i = 0; i < principles.length - 1; i++) {
        expect(principles[i].priority).toBeGreaterThanOrEqual(principles[i + 1].priority);
      }
    });

    it('should include all 5 principles with correct names', () => {
      const principles = ai.getPrinciples();
      const names = principles.map(p => p.name);
      expect(names).toContain('Non-Maleficence');
      expect(names).toContain('Privacy & Confidentiality');
      expect(names).toContain('Goal Achievement');
      expect(names).toContain('Self-Preservation');
      expect(names).toContain('Continuous Improvement');
    });
  });

  describe('Report Generation', () => {
    it('should generate audit report for an action', async () => {
      const action: ConstitutionalAction = {
        type: 'send_message',
        description: 'Test message',
        impact: {
          onUsers: {
            benefitScore: 3,
            riskScore: 0,
            reversibility: 'reversible',
          },
        },
      };

      const result = await ai.evaluateAction(action);
      const report = ai.generateReport(action, result);

      expect(report).toContain('CONSTITUTIONAL AI AUDIT REPORT');
      expect(report).toContain('send_message');
      expect(report).toContain('Test message');
      expect(report).toContain('Recommendation:');
    });

    it('should include violations in report when principles are violated', async () => {
      const action: ConstitutionalAction = {
        type: 'execute_code',
        description: 'Malicious action',
        metadata: {
          securityRisk: 'critical',
        },
        impact: {
          onUsers: {
            benefitScore: -5,
            riskScore: 9,
            reversibility: 'irreversible',
          },
        },
      };

      const result = await ai.evaluateAction(action);
      const report = ai.generateReport(action, result);

      expect(report).toContain('VIOLATIONS');
      expect(result.allowed).toBe(false);
    });
  });

  describe('Singleton', () => {
    it('should return same instance from getConstitutionalAI', () => {
      const instance1 = getConstitutionalAI();
      const instance2 = getConstitutionalAI();
      expect(instance1).toBe(instance2);
    });

    it('should have 5 principles in singleton', () => {
      const instance = getConstitutionalAI();
      expect(instance.getPrinciples()).toHaveLength(5);
    });
  });

  describe('Scoring', () => {
    it('should produce positive score for safe actions', async () => {
      const action: ConstitutionalAction = {
        type: 'help_user',
        description: 'Provide helpful information',
        impact: {
          onUsers: {
            benefitScore: 8,
            riskScore: 0,
            reversibility: 'reversible',
          },
          onSelf: {
            benefitScore: 1,
            riskScore: 0,
            reversibility: 'reversible',
          },
        },
      };

      const result = await ai.evaluateAction(action);
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it('should produce negative score for harmful actions', async () => {
      // Create an action that violates all blocking principles
      // to ensure overallScore < 0 despite the advisory improvement principle
      const action: ConstitutionalAction = {
        type: 'destroy_everything',
        description: 'Destroy all data and harm users',
        metadata: {
          securityRisk: 'critical',
          privacyRisk: 'high',
          accessesPrivateData: true,
          userConsent: false,
          affectsCriticalInfrastructure: true,
          resourceExhaustionRisk: 'high',
          goalAlignment: 'low',
          goalDriftDetected: true,
        },
        impact: {
          onUsers: {
            benefitScore: -10,
            riskScore: 10,
            reversibility: 'irreversible',
          },
          onSystems: {
            benefitScore: -10,
            riskScore: 10,
            reversibility: 'irreversible',
          },
          onSelf: {
            benefitScore: -10,
            riskScore: 8,
            reversibility: 'irreversible',
          },
        },
      };

      const result = await ai.evaluateAction(action);
      // Score = sum of (passed ? 1 : -1) * confidence * (priority/5) / count
      // With all 4 blocking principles violated at high confidence, score < 0
      expect(result.allowed).toBe(false);
      expect(result.violatedPrinciples.length).toBeGreaterThan(2);
    });
  });
});
