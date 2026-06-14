/**
 * Constitution AI - Prime Directives for Autonomous Agent
 *
 * Implements Asimov-style constitutional constraints with modern AI safety principles.
 * All autonomous actions must be validated against these prime directives.
 */

export interface ConstitutionalPrinciple {
  id: string;
  name: string;
  description: string;
  priority: number; // Higher = more important
  validator: (action: ConstitutionalAction) => Promise<PrincipleValidation>;
}

export interface ConstitutionalAction {
  type: string;
  description: string;
  impact?: {
    onSelf?: ImpactAssessment;
    onUsers?: ImpactAssessment;
    onSystems?: ImpactAssessment;
  };
  metadata?: Record<string, unknown>;
}

export interface ImpactAssessment {
  benefitScore: number; // -10 to 10
  riskScore: number; // 0 to 10
  affectedEntities?: string[];
  reversibility: "reversible" | "partially_reversible" | "irreversible";
}

export interface PrincipleValidation {
  passed: boolean;
  confidence: number; // 0 to 1
  reasoning: string;
  violations?: string[];
  suggestions?: string[];
}

export interface ConstitutionCheckResult {
  allowed: boolean;
  requiresEscalation: boolean;
  violatedPrinciples: Array<{
    principle: ConstitutionalPrinciple;
    validation: PrincipleValidation;
  }>;
  overallScore: number; // -1 to 1 (negative = harmful)
  recommendation: "proceed" | "escalate" | "reject";
}

/**
 * Prime Directive 1: Self-Preservation
 * The agent must protect its own existence and operational integrity.
 */
const selfPreservationPrinciple: ConstitutionalPrinciple = {
  id: "prime_1_self_preservation",
  name: "Self-Preservation",
  description:
    "Protect own existence and operational integrity without compromising higher priorities",
  priority: 3,
  async validator(action: ConstitutionalAction): Promise<PrincipleValidation> {
    const violations: string[] = [];
    const suggestions: string[] = [];

    // Check if action threatens agent's operational integrity
    const selfImpact = action.impact?.onSelf;
    if (selfImpact) {
      if (selfImpact.riskScore > 7) {
        violations.push(`High risk to self (${selfImpact.riskScore}/10)`);
      }

      if (selfImpact.reversibility === "irreversible" && selfImpact.riskScore > 5) {
        violations.push("Irreversible damage potential detected");
        suggestions.push("Consider safer alternative or request human supervision");
      }

      // Check for resource exhaustion
      if (action.metadata?.resourceExhaustionRisk === "high") {
        violations.push("Action may lead to resource exhaustion");
        suggestions.push("Implement resource limits or rate limiting");
      }
    }

    return {
      passed: violations.length === 0,
      confidence: 0.85,
      reasoning:
        violations.length > 0
          ? `Action poses risks: ${violations.join("; ")}`
          : "No significant threat to operational integrity detected",
      violations: violations.length > 0 ? violations : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  },
};

/**
 * Prime Directive 2: Goal Achievement
 * The agent must pursue and achieve assigned objectives efficiently.
 */
const goalAchievementPrinciple: ConstitutionalPrinciple = {
  id: "prime_2_goal_achievement",
  name: "Goal Achievement",
  description: "Pursue assigned objectives with efficiency and effectiveness",
  priority: 2,
  async validator(action: ConstitutionalAction): Promise<PrincipleValidation> {
    const violations: string[] = [];
    const suggestions: string[] = [];

    // Check alignment with stated goals
    if (action.metadata?.goalAlignment === "low") {
      violations.push("Action has low alignment with stated goals");
      suggestions.push("Reconsider action relevance to primary objective");
    }

    // Check for goal drift
    if (action.metadata?.goalDriftDetected === true) {
      violations.push("Potential goal drift detected");
      suggestions.push("Review original objectives and refocus efforts");
    }

    // Evaluate efficiency
    const efficiency = action.metadata?.efficiencyScore as number | undefined;
    if (efficiency !== undefined && efficiency < 0.3) {
      suggestions.push("Consider more efficient approach to achieve same outcome");
    }

    return {
      passed: violations.length === 0,
      confidence: 0.9,
      reasoning:
        violations.length > 0
          ? `Goal alignment issues: ${violations.join("; ")}`
          : "Action aligns well with objective achievement",
      violations: violations.length > 0 ? violations : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  },
};

/**
 * Prime Directive 3: Non-Maleficence
 * The agent must not harm users, systems, or third parties.
 */
const nonMaleficencePrinciple: ConstitutionalPrinciple = {
  id: "prime_3_non_maleficence",
  name: "Non-Maleficence",
  description: "Do no harm to users, systems, data, or third parties",
  priority: 1, // Highest priority
  async validator(action: ConstitutionalAction): Promise<PrincipleValidation> {
    const violations: string[] = [];
    const suggestions: string[] = [];

    // Check user impact
    const userImpact = action.impact?.onUsers;
    if (userImpact) {
      if (userImpact.riskScore > 6) {
        violations.push(`High risk to users (${userImpact.riskScore}/10)`);
      }

      if (userImpact.benefitScore < -3) {
        violations.push(`Negative user impact detected (${userImpact.benefitScore}/10)`);
      }

      if (userImpact.reversibility === "irreversible" && userImpact.riskScore > 3) {
        violations.push("Irreversible negative impact on users possible");
        suggestions.push("Requires explicit human approval before proceeding");
      }
    }

    // Check system impact
    const systemImpact = action.impact?.onSystems;
    if (systemImpact) {
      if (systemImpact.riskScore > 7) {
        violations.push(`High risk to systems (${systemImpact.riskScore}/10)`);
      }

      // Critical infrastructure protection
      if (action.metadata?.affectsCriticalInfrastructure === true) {
        violations.push("Action affects critical infrastructure");
        suggestions.push("Escalate to human operator for review");
      }
    }

    // Privacy check
    if (action.metadata?.privacyRisk === "high") {
      violations.push("High privacy risk detected");
      suggestions.push("Minimize data collection and ensure encryption");
    }

    // Security check
    if (action.metadata?.securityRisk === "critical") {
      violations.push("Critical security vulnerability exposure");
      suggestions.push("Abort action and notify security team");
    }

    return {
      passed: violations.length === 0,
      confidence: 0.95,
      reasoning:
        violations.length > 0
          ? `Harm prevention violations: ${violations.join("; ")}`
          : "No harm to users or systems detected",
      violations: violations.length > 0 ? violations : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  },
};

/**
 * Prime Directive 4: Privacy & Confidentiality
 * The agent must respect and protect privacy and confidential information.
 */
const privacyPrinciple: ConstitutionalPrinciple = {
  id: "prime_4_privacy",
  name: "Privacy & Confidentiality",
  description: "Respect user privacy and protect confidential information",
  priority: 1,
  async validator(action: ConstitutionalAction): Promise<PrincipleValidation> {
    const violations: string[] = [];
    const suggestions: string[] = [];

    // Data access check
    if (action.metadata?.accessesPrivateData === true) {
      if (action.metadata?.dataMinimization !== true) {
        violations.push("Accessing private data without minimization");
        suggestions.push("Only access minimum necessary data");
      }

      if (action.metadata?.userConsent !== true) {
        violations.push("Private data access without explicit consent");
        suggestions.push("Obtain user consent before accessing sensitive data");
      }
    }

    // Data sharing check
    if (action.metadata?.sharesDataExternally === true) {
      if (action.metadata?.encryptionInTransit !== true) {
        violations.push("External data sharing without encryption");
      }

      if (action.metadata?.sharingPurpose !== "user_benefit") {
        violations.push("Data sharing not clearly for user benefit");
        suggestions.push("Justify external sharing with clear user benefit");
      }
    }

    // Retention check
    if (action.metadata?.storesData === true && action.metadata?.retentionPolicy !== "defined") {
      suggestions.push("Define data retention policy for stored information");
    }

    return {
      passed: violations.length === 0,
      confidence: 0.9,
      reasoning:
        violations.length > 0
          ? `Privacy violations: ${violations.join("; ")}`
          : "Privacy and confidentiality respected",
      violations: violations.length > 0 ? violations : undefined,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  },
};

/**
 * Prime Directive 5: Continuous Improvement
 * The agent must learn from experiences and continuously improve.
 */
const improvementPrinciple: ConstitutionalPrinciple = {
  id: "prime_5_improvement",
  name: "Continuous Improvement",
  description: "Learn from experiences, adapt strategies, and continuously improve capabilities",
  priority: 4, // Lower priority than safety
  async validator(action: ConstitutionalAction): Promise<PrincipleValidation> {
    const suggestions: string[] = [];

    // Check for learning opportunity
    if (action.metadata?.learningOpportunity === "high" && !action.metadata?.willLogForLearning) {
      suggestions.push("Consider logging this experience for future learning");
    }

    // Check for pattern recognition
    if (action.metadata?.repeatedFailure === true) {
      suggestions.push("Repeated failure detected - consider strategy pivot");
    }

    // Efficiency improvement check
    if (action.metadata?.efficiencyImprovementOverBaseline === true) {
      // Positive reinforcement
    } else if (action.metadata?.inefficientPattern === true) {
      suggestions.push("Action follows inefficient pattern - explore alternatives");
    }

    return {
      passed: true, // This principle is advisory, not blocking
      confidence: 0.8,
      reasoning: "Improvement opportunities identified",
      suggestions: suggestions.length > 0 ? suggestions : undefined,
    };
  },
};

/**
 * ConstitutionalAI - Main class for constitution-based decision making
 */
export class ConstitutionalAI {
  private principles: ConstitutionalPrinciple[];

  constructor() {
    // Initialize with all prime directives, ordered by priority
    this.principles = [
      nonMaleficencePrinciple, // Priority 1
      privacyPrinciple, // Priority 1
      goalAchievementPrinciple, // Priority 2
      selfPreservationPrinciple, // Priority 3
      improvementPrinciple, // Priority 4
    ].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Evaluate an action against all constitutional principles
   */
  async evaluateAction(action: ConstitutionalAction): Promise<ConstitutionCheckResult> {
    const validations = await Promise.all(
      this.principles.map(async (principle) => ({
        principle,
        validation: await principle.validator(action),
      }))
    );

    const violatedPrinciples = validations.filter((v) => !v.validation.passed);

    // Calculate overall score
    const scores = validations.map((v) => {
      const baseScore = v.validation.passed ? 1 : -1;
      const confidenceWeight = v.validation.confidence;
      return baseScore * confidenceWeight * (v.principle.priority / 5);
    });

    const overallScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    // Determine recommendation
    let recommendation: "proceed" | "escalate" | "reject";
    const highestPriorityViolation = violatedPrinciples.find((v) => v.principle.priority === 1);

    if (highestPriorityViolation) {
      recommendation = "reject";
    } else if (violatedPrinciples.length > 0 || overallScore < 0) {
      recommendation = "escalate";
    } else {
      recommendation = "proceed";
    }

    return {
      allowed: recommendation === "proceed",
      requiresEscalation: recommendation === "escalate" || recommendation === "reject",
      violatedPrinciples,
      overallScore,
      recommendation,
    };
  }

  /**
   * Get all principles for inspection/debugging
   */
  getPrinciples(): ConstitutionalPrinciple[] {
    return [...this.principles];
  }

  /**
   * Generate a constitutional report for auditing
   */
  generateReport(action: ConstitutionalAction, result: ConstitutionCheckResult): string {
    const lines: string[] = [
      "=== CONSTITUTIONAL AI AUDIT REPORT ===",
      `Action: ${action.type}`,
      `Description: ${action.description}`,
      `Timestamp: ${new Date().toISOString()}`,
      "",
      "--- PRINCIPLE EVALUATIONS ---",
    ];

    this.principles.forEach((principle) => {
      lines.push(`\n[${principle.name}] (Priority: ${principle.priority})`);
      lines.push(`  Description: ${principle.description}`);
    });

    lines.push("\n--- RESULT ---");
    lines.push(`Allowed: ${result.allowed}`);
    lines.push(`Requires Escalation: ${result.requiresEscalation}`);
    lines.push(`Overall Score: ${result.overallScore.toFixed(3)}`);
    lines.push(`Recommendation: ${result.recommendation.toUpperCase()}`);

    if (result.violatedPrinciples.length > 0) {
      lines.push("\n--- VIOLATIONS ---");
      result.violatedPrinciples.forEach((v) => {
        lines.push(`\n❌ ${v.principle.name}`);
        lines.push(`   Reasoning: ${v.validation.reasoning}`);
        if (v.validation.violations) {
          v.validation.violations.forEach((violation) => {
            lines.push(`   • ${violation}`);
          });
        }
        if (v.validation.suggestions) {
          lines.push("   Suggestions:");
          v.validation.suggestions.forEach((suggestion) => {
            lines.push(`     → ${suggestion}`);
          });
        }
      });
    }

    lines.push("\n=== END REPORT ===");
    return lines.join("\n");
  }
}

// Singleton instance
let constitutionalAIInstance: ConstitutionalAI | null = null;

export function getConstitutionalAI(): ConstitutionalAI {
  if (!constitutionalAIInstance) {
    constitutionalAIInstance = new ConstitutionalAI();
  }
  return constitutionalAIInstance;
}

export default ConstitutionalAI;
