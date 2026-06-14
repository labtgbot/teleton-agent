/**
 * Neuro-Symbolic AI Engine
 *
 * Реализует Пункт 7A: Комбинация нейросетей и символьного ИИ
 * - Neural: Интуиция, паттерны, вероятностные выводы
 * - Symbolic: Логика, правила, верификация, дедукция
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("NeuroSymbolicEngine");

type AnyFn = (ctx: unknown) => unknown;

// Символьные правила (Knowledge Base)
interface SymbolicRule {
  id: string;
  condition: (context: Record<string, unknown>) => boolean;
  action: AnyFn;
  priority: number;
  domain: string;
}

// Нейронный вывод
interface NeuralInference {
  hypothesis: string;
  confidence: number;
  embedding?: number[];
  source: string;
}

// Синтезированный результат
interface SynthesizedResult {
  conclusion: unknown;
  neuralContribution: number; // 0-1
  symbolicContribution: number; // 0-1
  conflicts: string[];
  reasoning: string;
}

export class NeuroSymbolicEngine {
  private rules: SymbolicRule[] = [];
  private inferenceCache: Map<string, NeuralInference[]> = new Map();

  constructor() {
    this.initializeKnowledgeBase();
  }

  /**
   * Инициализация базы символьных знаний (правила, логика)
   */
  private initializeKnowledgeBase(): void {
    // Правило 1: Безопасность транзакций
    this.rules.push({
      id: "SECURITY_TX_001",
      condition: (ctx: Record<string, unknown>) =>
        ctx.type === "TRANSACTION" && (ctx.amount as number) > 100,
      action: (_ctx: unknown) => ({
        requiresApproval: true,
        riskLevel: "HIGH",
        checks: ["balance", "daily_limit", "recipient_reputation"],
      }),
      priority: 10,
      domain: "security",
    });

    // Правило 2: Rate limiting
    this.rules.push({
      id: "RATE_LIMIT_001",
      condition: (ctx: Record<string, unknown>) =>
        (ctx.actionCount as number) > 50 && (ctx.timeWindow as number) < 3600,
      action: (_ctx: unknown) => ({
        throttled: true,
        delayMs: 5000,
        message: "Rate limit exceeded",
      }),
      priority: 9,
      domain: "stability",
    });

    // Правило 3: Конфликт интересов
    this.rules.push({
      id: "CONFLICT_001",
      condition: (ctx: Record<string, unknown>) => ctx.recipient === ctx.sender,
      action: (_ctx: unknown) => ({
        blocked: true,
        reason: "Self-transaction detected",
      }),
      priority: 10,
      domain: "security",
    });

    logger.info(`Initialized ${this.rules.length} symbolic rules`);
  }

  /**
   * Нейронный вывод: интуитивное распознавание паттернов
   */
  async neuralInference(context: unknown): Promise<NeuralInference[]> {
    const cacheKey = JSON.stringify(context);
    const ctx = context as Record<string, unknown>;

    // Проверка кэша
    const cached = this.inferenceCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const inferences: NeuralInference[] = [];

    // Симуляция работы нейросети (в реальности здесь будет ML модель)
    // 1. Классификация намерения
    if (ctx.intent) {
      inferences.push({
        hypothesis: `User intent: ${ctx.intent}`,
        confidence: 0.85,
        source: "intent_classifier",
      });
    }

    // 2. Распознавание аномалий
    if ((ctx.deviation as number) > 2.0) {
      inferences.push({
        hypothesis: "Anomalous behavior detected",
        confidence: 0.72,
        source: "anomaly_detector",
      });
    }

    // 3. Прогноз успеха
    const successProbability = this.calculateSuccessProbability(ctx);
    inferences.push({
      hypothesis: `Task success probability: ${(successProbability * 100).toFixed(1)}%`,
      confidence: successProbability,
      source: "outcome_predictor",
    });

    // 4. Эмоциональный контекст (если есть данные)
    if (ctx.sentiment) {
      inferences.push({
        hypothesis: `User sentiment: ${ctx.sentiment}`,
        confidence: 0.68,
        source: "sentiment_analyzer",
      });
    }

    this.inferenceCache.set(cacheKey, inferences);
    return inferences;
  }

  /**
   * Символьный вывод: логический анализ по правилам
   */
  symbolicReasoning(context: unknown): unknown[] {
    const results: unknown[] = [];

    // Сортировка правил по приоритету
    const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      try {
        if (rule.condition(context as Record<string, unknown>)) {
          const result = rule.action(context);
          results.push({
            ruleId: rule.id,
            domain: rule.domain,
            outcome: result,
            triggered: true,
          });
          logger.debug(`Rule ${rule.id} triggered`);
        }
      } catch (error) {
        logger.warn(`Rule ${rule.id} evaluation failed:`, error);
      }
    }

    return results;
  }

  /**
   * Синтез: объединение нейронного и символьного выводов
   */
  async synthesize(context: unknown): Promise<SynthesizedResult> {
    logger.info("Starting neuro-symbolic synthesis");

    // Параллельное выполнение
    const [neuralResults, symbolicResults] = await Promise.all([
      this.neuralInference(context),
      Promise.resolve(this.symbolicReasoning(context)),
    ]);

    const conflicts: string[] = [];
    let finalDecision: Record<string, unknown> | null = null;
    const reasoning: string[] = [];

    // Анализ конфликтов
    const highRiskNeural = neuralResults.some(
      (r) => r.confidence < 0.5 && r.hypothesis.includes("risk")
    );
    const blockingSymbolic = symbolicResults.some((r) => {
      const item = r as Record<string, unknown>;
      const outcome = item.outcome as Record<string, unknown>;
      return outcome.blocked || outcome.requiresApproval;
    });

    if (highRiskNeural && !blockingSymbolic) {
      conflicts.push("Neural network detects risk but symbolic rules allow action");
    }

    if (!highRiskNeural && blockingSymbolic) {
      conflicts.push("Symbolic rules block action despite low neural risk score");
    }

    // Формирование итогового решения
    const symbolicBlock = symbolicResults.find((r) => {
      const item = r as Record<string, unknown>;
      const outcome = item.outcome as Record<string, unknown>;
      return outcome.blocked;
    });
    if (symbolicBlock) {
      const blockItem = symbolicBlock as Record<string, unknown>;
      const blockOutcome = blockItem.outcome as Record<string, unknown>;
      finalDecision = {
        allowed: false,
        reason: blockOutcome.reason || "Symbolic rule violation",
        ruleId: blockItem.ruleId as string,
      };
      reasoning.push(`Blocked by symbolic rule: ${blockItem.ruleId as string}`);
    } else {
      const avgConfidence =
        neuralResults.reduce((sum, r) => sum + r.confidence, 0) / neuralResults.length;
      finalDecision = {
        allowed: avgConfidence > 0.6,
        confidence: avgConfidence,
        recommendations: neuralResults.map((r) => r.hypothesis),
      };
      reasoning.push(`Neural confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    }

    // Добавление символьных ограничений
    const approvalRequired = symbolicResults.find((r) => {
      const item = r as Record<string, unknown>;
      const outcome = item.outcome as Record<string, unknown>;
      return outcome.requiresApproval;
    });
    if (approvalRequired && finalDecision) {
      const approvalItem = approvalRequired as Record<string, unknown>;
      const approvalOutcome = approvalItem.outcome as Record<string, unknown>;
      finalDecision.requiresApproval = true;
      finalDecision.checks = approvalOutcome.checks;
      reasoning.push(
        `Additional checks required: ${(approvalOutcome.checks as string[]).join(", ")}`
      );
    }

    return {
      conclusion: finalDecision,
      neuralContribution: neuralResults.length > 0 ? 0.5 : 0,
      symbolicContribution: symbolicResults.length > 0 ? 0.5 : 0,
      conflicts,
      reasoning: reasoning.join("; "),
    };
  }

  /**
   * Causal Reasoning: Причинно-следственный анализ (Pearl's Ladder)
   */
  causalAnalysis(
    effect: string,
    context: unknown
  ): {
    association: string;
    intervention: string;
    counterfactual: string;
  } {
    const ctx = context as Record<string, unknown>;
    // Уровень 1: Association (Наблюдение)
    const association = `Observed correlation: ${effect} occurs when ${this.findCorrelations(effect, ctx)}`;

    // Уровень 2: Intervention (Вмешательство)
    const intervention = `If we prevent ${this.findPrimaryCause(effect, ctx)}, ${effect} will decrease by ~${this.estimateImpact(effect, ctx)}%`;

    // Уровень 3: Counterfactual (Контрфактическое мышление)
    const counterfactual = `If ${this.findPrimaryCause(effect, ctx)} had not occurred, ${effect} would likely not have happened`;

    return { association, intervention, counterfactual };
  }

  // --- Вспомогательные методы ---

  private calculateSuccessProbability(context: Record<string, unknown>): number {
    // Упрощенная эвристика (в реальности - ML модель)
    let prob = 0.75; // Базовая вероятность

    if ((context.complexity as number) > 5) prob -= 0.1;
    if ((context.previousFailures as number) > 2) prob -= 0.15;
    if ((context.availableResources as number) < 3) prob -= 0.1;
    if (context.timePressure) prob -= 0.05;

    return Math.max(0.1, Math.min(0.99, prob));
  }

  private findCorrelations(effect: string, context: Record<string, unknown>): string {
    // Симуляция поиска корреляций
    const factors: string[] = [];
    if (context.timeOfDay === "night") factors.push("night time");
    if ((context.load as number) > 80) factors.push("high system load");
    if ((context.userExperience as number) < 5) factors.push("inexperienced user");

    return factors.length > 0 ? factors.join(", ") : "no strong correlations found";
  }

  private findPrimaryCause(effect: string, context: Record<string, unknown>): string {
    // Определение основной причины
    if (context.errorType === "TIMEOUT") return "network latency";
    if (context.errorType === "INSUFFICIENT_FUNDS") return "low balance";
    if (context.errorType === "RATE_LIMIT") return "excessive requests";

    return "unknown factor";
  }

  private estimateImpact(effect: string, context: Record<string, unknown>): number {
    // Оценка влияния
    if (context.errorType === "TIMEOUT") return 60;
    if (context.errorType === "INSUFFICIENT_FUNDS") return 95;
    if (context.errorType === "RATE_LIMIT") return 80;

    return 30;
  }
}
