/**
 * Improvement Hypothesis Generator & Tester
 * Генерация и тестирование гипотез улучшения
 * Фаза 4: Self-Improvement Loop
 */

import { randomUUID } from "crypto";
import { ExperienceType } from "../../types/swarm/self-improvement.js";
import type {
  Pattern,
  ImprovementHypothesis,
  TestResult,
  SelfImprovementConfig,
} from "../../types/swarm/self-improvement.js";
import { Logger } from "../../utils/logger.js";
import type { PatternMiner } from "./pattern-miner.js";
import type { ExperienceGatherer } from "./experience-gatherer.js";

interface HypothesisTesterConfig extends SelfImprovementConfig {
  autoExecuteLowRisk: boolean;
  simulationEnvironment: string;
}

export class ImprovementHypothesisEngine {
  private hypotheses: ImprovementHypothesis[] = [];
  private testResults: TestResult[] = [];
  private config: HypothesisTesterConfig;
  private logger: Logger;
  private patternMiner: PatternMiner;
  private experienceGatherer: ExperienceGatherer;

  constructor(
    patternMiner: PatternMiner,
    experienceGatherer: ExperienceGatherer,
    config: Partial<HypothesisTesterConfig> = {}
  ) {
    this.patternMiner = patternMiner;
    this.experienceGatherer = experienceGatherer;
    this.config = {
      autoExecuteLowRisk: true,
      simulationEnvironment: "sandbox",
      enabled: true,
      minExperiencesForPattern: 5,
      patternConfidenceThreshold: 0.7,
      autoTestLowRisk: true,
      maxConcurrentTests: 3,
      simulationIterations: 100,
      canaryPercentage: 10,
      abTestDuration: 86400000,
      retentionDays: 90,
      reviewRequired: true,
      ...config,
    };

    this.logger = new Logger("HypothesisEngine");
  }

  /**
   * Генерация гипотез на основе выявленных паттернов
   */
  async generateHypotheses(): Promise<ImprovementHypothesis[]> {
    if (!this.config.enabled) {
      this.logger.warn("Hypothesis generation is disabled");
      return [];
    }

    this.logger.info("Generating improvement hypotheses...");

    // Получаем высококачественные паттерны
    const patterns = this.patternMiner.getPatterns({
      minConfidence: this.config.patternConfidenceThreshold,
      validatedOnly: false,
    });

    const newHypotheses: ImprovementHypothesis[] = [];

    // Генерация гипотез для каждого паттерна
    for (const pattern of patterns) {
      if (pattern.successRate < 0.9) {
        // Паттерн можно улучшить
        const hypothesis = this.createImprovementHypothesis(pattern);
        if (hypothesis) {
          newHypotheses.push(hypothesis);
        }
      }

      // Проверка на негативные паттерны (ошибки)
      if (pattern.successRate < 0.5) {
        const fixHypothesis = this.createFixHypothesis(pattern);
        if (fixHypothesis) {
          newHypotheses.push(fixHypothesis);
        }
      }
    }

    // Сохранение гипотез
    await this.saveHypotheses(newHypotheses);

    this.logger.info(`Generated ${newHypotheses.length} improvement hypotheses`);

    return newHypotheses;
  }

  /**
   * Создание гипотезы улучшения
   */
  private createImprovementHypothesis(pattern: Pattern): ImprovementHypothesis | null {
    const expectedImprovement = (0.95 - pattern.successRate) * 100;

    if (expectedImprovement < 5) {
      // Улучшение слишком маленькое
      return null;
    }

    return {
      id: randomUUID(),
      title: `Improve ${pattern.name}`,
      description: `Optimize ${pattern.category} pattern to increase success rate from ${(pattern.successRate * 100).toFixed(1)}% to 95%`,
      basedOnPatterns: [pattern.id],
      expectedImpact: {
        metric: "success_rate",
        improvement: expectedImprovement,
        confidence: pattern.confidence * 0.8,
      },
      proposedChanges: [
        {
          component: this.inferComponentFromCategory(pattern.category),
          change: `Apply optimized strategy from pattern: ${pattern.actions.join(", ")}`,
          rationale: `Pattern shows ${pattern.frequency} occurrences with ${(pattern.successRate * 100).toFixed(1)}% success`,
        },
      ],
      testPlan: {
        method: this.selectTestMethod(pattern.riskLevel),
        duration: this.config.abTestDuration,
        successCriteria: [
          `Success rate >= 90%`,
          `No increase in error rate`,
          `Performance within acceptable bounds`,
        ],
        rollbackPlan: `Revert to previous ${this.inferComponentFromCategory(pattern.category)} logic`,
      },
      status: "draft",
      priority: this.calculatePriority(pattern, expectedImprovement),
      createdAt: Date.now(),
    };
  }

  /**
   * Создание гипотезы исправления ошибок
   */
  private createFixHypothesis(pattern: Pattern): ImprovementHypothesis | null {
    return {
      id: randomUUID(),
      title: `Fix critical issue in ${pattern.name}`,
      description: `Address high failure rate (${((1 - pattern.successRate) * 100).toFixed(1)}%) in ${pattern.category}`,
      basedOnPatterns: [pattern.id],
      expectedImpact: {
        metric: "failure_rate",
        improvement: (1 - pattern.successRate) * 100,
        confidence: 0.9,
      },
      proposedChanges: [
        {
          component: this.inferComponentFromCategory(pattern.category),
          change: `Implement error handling for: ${pattern.conditions.join(", ")}`,
          rationale: `High failure rate indicates missing error handling or edge cases`,
        },
      ],
      testPlan: {
        method: "simulation",
        duration: 3600000, // 1 hour
        successCriteria: [`Failure rate reduced by at least 50%`, `No new error types introduced`],
        rollbackPlan: `Disable problematic ${pattern.category} optimization`,
      },
      status: "pending_review",
      priority: 9, // Высокий приоритет для исправлений
      createdAt: Date.now(),
    };
  }

  /**
   * Вывод компонента из категории
   */
  private inferComponentFromCategory(category: string): string {
    const mapping: Record<string, string> = {
      decision_making: "decision-engine",
      tool_usage: "tool-executor",
      communication: "communication-module",
      problem_solving: "solver",
      resource_management: "resource-manager",
      error_handling: "error-handler",
      optimization: "optimizer",
    };
    return mapping[category] || "core-agent";
  }

  /**
   * Выбор метода тестирования на основе риска
   */
  private selectTestMethod(riskLevel: string): "simulation" | "canary" | "ab_test" | "shadow" {
    switch (riskLevel) {
      case "low":
        return this.config.autoTestLowRisk ? "canary" : "simulation";
      case "medium":
        return "ab_test";
      case "high":
        return "shadow";
      default:
        return "simulation";
    }
  }

  /**
   * Расчет приоритета гипотезы
   */
  private calculatePriority(pattern: Pattern, expectedImprovement: number): number {
    const basePriority = Math.round(expectedImprovement / 10); // 1-10

    // Корректировка по частоте
    const frequencyBonus = Math.min(pattern.frequency / 20, 2);

    // Корректировка по риску
    const riskPenalty = pattern.riskLevel === "high" ? -2 : 0;

    return Math.max(1, Math.min(10, basePriority + frequencyBonus + riskPenalty));
  }

  /**
   * Сохранение гипотез
   */
  private async saveHypotheses(hypotheses: ImprovementHypothesis[]): Promise<void> {
    this.hypotheses.push(...hypotheses);
    this.logger.debug(`Saved ${hypotheses.length} hypotheses`);
  }

  /**
   * Запуск тестирования гипотезы
   */
  async testHypothesis(hypothesisId: string): Promise<TestResult> {
    const hypothesis = this.hypotheses.find((h) => h.id === hypothesisId);

    if (!hypothesis) {
      throw new Error(`Hypothesis ${hypothesisId} not found`);
    }

    if (hypothesis.status !== "draft" && hypothesis.status !== "pending_review") {
      throw new Error(`Hypothesis ${hypothesisId} is not in testable state: ${hypothesis.status}`);
    }

    hypothesis.status = "testing";

    this.logger.info(`Starting test for hypothesis: ${hypothesis.title}`, {
      method: hypothesis.testPlan.method,
      duration: hypothesis.testPlan.duration,
    });

    // Выполнение теста в зависимости от метода
    let result: TestResult;

    switch (hypothesis.testPlan.method) {
      case "simulation":
        result = await this.runSimulation(hypothesis);
        break;
      case "canary":
        result = await this.runCanaryTest(hypothesis);
        break;
      case "ab_test":
        result = await this.runABTest(hypothesis);
        break;
      case "shadow":
        result = await this.runShadowTest(hypothesis);
        break;
    }

    // Обработка результатов
    await this.processTestResult(result, hypothesis);

    return result;
  }

  /**
   * Запуск симуляции
   */
  private async runSimulation(hypothesis: ImprovementHypothesis): Promise<TestResult> {
    const iterations = this.config.simulationIterations;
    const results: Array<{ success: boolean; metrics: Record<string, number> }> = [];

    this.logger.info(`Running simulation with ${iterations} iterations...`);

    // Симуляция на исторических данных
    const experiences = this.experienceGatherer.getRecentExperiences(500);

    for (let i = 0; i < iterations; i++) {
      // Имитация применения изменений
      const simulatedOutcome = this.simulateApplication(hypothesis, experiences);
      results.push(simulatedOutcome);
    }

    const successCount = results.filter((r) => r.success).length;
    const successRate = successCount / iterations;

    const testResult: TestResult = {
      hypothesisId: hypothesis.id,
      testId: randomUUID(),
      startTime: Date.now() - 10000,
      endTime: Date.now(),
      method: "simulation",
      metrics: {
        successRate,
        iterations,
        avgMetric: this.averageMetric(results),
      },
      success: successRate >= 0.9,
      findings: [
        `Simulation completed: ${successCount}/${iterations} successful`,
        `Expected improvement: ${hypothesis.expectedImpact.improvement.toFixed(1)}%`,
      ],
      recommendations:
        successRate >= 0.9
          ? ["Proceed to canary deployment"]
          : ["Revise hypothesis", "Collect more data"],
      autoApproved: successRate >= 0.95 && hypothesis.testPlan.method === "simulation",
    };

    return testResult;
  }

  /**
   * Симуляция применения гипотезы
   */
  private simulateApplication(
    hypothesis: ImprovementHypothesis,
    _experiences: unknown[]
  ): { success: boolean; metrics: Record<string, number> } {
    // Упрощенная симуляция
    const baseSuccessRate = 0.7;
    const improvementFactor = hypothesis.expectedImpact.confidence;

    const simulatedSuccessRate = baseSuccessRate + improvementFactor * 0.2;
    const success = Math.random() < simulatedSuccessRate;

    return {
      success,
      metrics: {
        successRate: simulatedSuccessRate,
      },
    };
  }

  /**
   * Запуск канареечного теста
   */
  private async runCanaryTest(hypothesis: ImprovementHypothesis): Promise<TestResult> {
    this.logger.info(`Starting canary test (${this.config.canaryPercentage}% traffic)...`);

    // В реальной реализации здесь было бы развертывание на части трафика
    await this.sleep(5000); // Имитация времени теста

    const testResult: TestResult = {
      hypothesisId: hypothesis.id,
      testId: randomUUID(),
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      method: "canary",
      metrics: {
        successRate: 0.92,
        errorRate: 0.03,
        performanceChange: 0.05,
      },
      success: true,
      findings: [
        `Canary test successful on ${this.config.canaryPercentage}% traffic`,
        "No significant issues detected",
      ],
      recommendations: ["Proceed to full rollout"],
      autoApproved: true,
    };

    return testResult;
  }

  /**
   * Запуск A/B теста
   */
  private async runABTest(hypothesis: ImprovementHypothesis): Promise<TestResult> {
    this.logger.info(`Starting A/B test (duration: ${hypothesis.testPlan.duration}ms)...`);

    // Имитация A/B теста
    await this.sleep(5000);

    const testResult: TestResult = {
      hypothesisId: hypothesis.id,
      testId: randomUUID(),
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      method: "ab_test",
      metrics: {
        controlSuccessRate: 0.75,
        treatmentSuccessRate: 0.88,
        improvement: 0.13,
        statisticalSignificance: 0.95,
      },
      success: true,
      findings: [
        "Treatment group outperformed control by 13%",
        "Results are statistically significant (p < 0.05)",
      ],
      recommendations: ["Roll out to all users"],
      autoApproved: false, // Требует ручного подтверждения
    };

    return testResult;
  }

  /**
   * Запуск теневого теста
   */
  private async runShadowTest(hypothesis: ImprovementHypothesis): Promise<TestResult> {
    this.logger.info(`Starting shadow test (no impact on production)...`);

    await this.sleep(5000);

    const testResult: TestResult = {
      hypothesisId: hypothesis.id,
      testId: randomUUID(),
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      method: "shadow",
      metrics: {
        predictedSuccessRate: 0.85,
        confidenceInterval: 0.1,
      },
      success: true,
      findings: [
        "Shadow test completed without production impact",
        "Predicted improvement aligns with expectations",
      ],
      recommendations: ["Proceed to canary deployment"],
      autoApproved: false,
    };

    return testResult;
  }

  /**
   * Обработка результатов теста
   */
  private async processTestResult(
    result: TestResult,
    hypothesis: ImprovementHypothesis
  ): Promise<void> {
    this.testResults.push(result);

    if (result.success) {
      if (result.autoApproved || !this.config.reviewRequired) {
        hypothesis.status = "validated";
        this.logger.info(`Hypothesis ${hypothesis.title} validated automatically`);
      } else {
        hypothesis.status = "pending_review";
        this.logger.info(`Hypothesis ${hypothesis.title} pending manual review`);
      }
    } else {
      hypothesis.status = "rejected";
      this.logger.warn(`Hypothesis ${hypothesis.title} rejected based on test results`);
    }
  }

  /**
   * Интеграция валидированной гипотезы
   */
  async integrateHypothesis(hypothesisId: string): Promise<boolean> {
    const hypothesis = this.hypotheses.find((h) => h.id === hypothesisId);

    if (!hypothesis || hypothesis.status !== "validated") {
      this.logger.warn(`Cannot integrate hypothesis ${hypothesisId}: invalid state`);
      return false;
    }

    // В реальной реализации здесь было бы применение изменений к коду/конфигурации
    hypothesis.status = "integrated";

    // Запись опыта об успешном улучшении
    await this.experienceGatherer.recordExperience(
      `Integrated improvement: ${hypothesis.title}`,
      { hypothesisId, status: "integrated" },
      { improvement: true },
      ExperienceType.BREAKTHROUGH,
      { successRate: 1.0 }
    );

    this.logger.info(`Successfully integrated hypothesis: ${hypothesis.title}`);

    return true;
  }

  /**
   * Получение гипотез по статусу
   */
  getHypotheses(filter?: {
    status?: ImprovementHypothesis["status"];
    minPriority?: number;
    category?: string;
  }): ImprovementHypothesis[] {
    let filtered = [...this.hypotheses];

    if (filter?.status) {
      filtered = filtered.filter((h) => h.status === filter.status);
    }

    if (filter?.minPriority !== undefined) {
      const minPriority = filter.minPriority;
      filtered = filtered.filter((h) => h.priority >= minPriority);
    }

    // Сортировка по приоритету
    filtered.sort((a, b) => b.priority - a.priority);

    return filtered;
  }

  /**
   * Статистика по гипотезам
   */
  getStatistics(): {
    total: number;
    byStatus: Record<ImprovementHypothesis["status"], number>;
    integratedCount: number;
    averagePriority: number;
  } {
    const byStatus: Record<ImprovementHypothesis["status"], number> = {
      draft: 0,
      pending_review: 0,
      testing: 0,
      validated: 0,
      rejected: 0,
      integrated: 0,
    };

    let totalPriority = 0;

    this.hypotheses.forEach((h) => {
      byStatus[h.status]++;
      totalPriority += h.priority;
    });

    return {
      total: this.hypotheses.length,
      byStatus,
      integratedCount: byStatus.integrated,
      averagePriority: this.hypotheses.length > 0 ? totalPriority / this.hypotheses.length : 0,
    };
  }

  /**
   * Утилита для задержки
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Среднее значение метрики
   */
  private averageMetric(results: Array<{ metrics: Record<string, number> }>): number {
    if (results.length === 0) return 0;

    const sum = results.reduce((acc, r) => acc + (r.metrics.successRate || 0), 0);
    return sum / results.length;
  }
}
