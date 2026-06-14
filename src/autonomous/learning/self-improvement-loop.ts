/**
 * Self-Improvement Loop - Главный оркестратор цикла самосовершенствования
 * Объединяет Experience Gathering, Pattern Mining, Hypothesis Generation & Testing
 * Фаза 4: Self-Improvement Loop
 */

import { Logger } from "../../utils/logger.js";
import { ExperienceGatherer } from "./experience-gatherer.js";
import { PatternMiner } from "./pattern-miner.js";
import { ImprovementHypothesisEngine } from "./hypothesis-engine.js";
import type {
  SelfImprovementConfig,
  SelfImprovementMetrics,
  ExperienceType,
} from "../../types/swarm/self-improvement.js";

interface SelfImprovementLoopConfig extends SelfImprovementConfig {
  autoRunInterval: number; // Интервал автоматического запуска (мс)
  minExperiencesForMining: number;
  patternMiningEnabled: boolean;
  hypothesisGenerationEnabled: boolean;
}

export class SelfImprovementLoop {
  private config: SelfImprovementLoopConfig;
  private logger: Logger;

  public experienceGatherer: ExperienceGatherer;
  public patternMiner: PatternMiner;
  public hypothesisEngine: ImprovementHypothesisEngine;

  private autoRunTimer?: NodeJS.Timeout;
  private isRunning: boolean = false;
  private lastRun: number = 0;
  private totalCycles: number = 0;

  constructor(config: Partial<SelfImprovementLoopConfig> = {}) {
    this.config = {
      autoRunInterval: 3600000, // 1 час по умолчанию
      minExperiencesForMining: 50,
      patternMiningEnabled: true,
      hypothesisGenerationEnabled: true,
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

    this.logger = new Logger("SelfImprovementLoop");

    // Инициализация компонентов
    this.experienceGatherer = new ExperienceGatherer(this.config);
    this.patternMiner = new PatternMiner(this.experienceGatherer, this.config);
    this.hypothesisEngine = new ImprovementHypothesisEngine(
      this.patternMiner,
      this.experienceGatherer,
      this.config
    );

    this.logger.info("Self-Improvement Loop initialized");
  }

  /**
   * Запуск цикла самосовершенствования
   */
  async run(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.warn("Self-Improvement Loop is disabled");
      return;
    }

    if (this.isRunning) {
      this.logger.warn("Self-Improvement Loop is already running");
      return;
    }

    this.isRunning = true;
    this.lastRun = Date.now();
    this.totalCycles++;

    try {
      this.logger.info(`Starting Self-Improvement Cycle #${this.totalCycles}`);

      // Этап 1: Сбор статистики опыта
      const experienceStats = this.experienceGatherer.aggregateStatistics();
      this.logger.info("Experience Statistics", experienceStats);

      if (experienceStats.total < this.config.minExperiencesForMining) {
        this.logger.info(
          `Not enough experiences for mining: ${experienceStats.total} < ${this.config.minExperiencesForMining}`
        );
        return;
      }

      // Этап 2: Майнинг паттернов
      if (this.config.patternMiningEnabled) {
        this.logger.info("Phase 1: Mining patterns...");
        const newPatterns = await this.patternMiner.minePatterns();
        this.logger.info(`Discovered ${newPatterns.length} new patterns`);

        const patternStats = this.patternMiner.getStatistics();
        this.logger.info("Pattern Statistics", patternStats);
      }

      // Этап 3: Генерация гипотез улучшения
      if (this.config.hypothesisGenerationEnabled) {
        this.logger.info("Phase 2: Generating improvement hypotheses...");
        const newHypotheses = await this.hypothesisEngine.generateHypotheses();
        this.logger.info(`Generated ${newHypotheses.length} new hypotheses`);

        const hypothesisStats = this.hypothesisEngine.getStatistics();
        this.logger.info("Hypothesis Statistics", hypothesisStats);
      }

      // Этап 4: Автоматическое тестирование низкоуровневых гипотез
      if (this.config.autoTestLowRisk) {
        this.logger.info("Phase 3: Auto-testing low-risk hypotheses...");
        await this.autoTestLowRiskHypotheses();
      }

      this.logger.info(`Self-Improvement Cycle #${this.totalCycles} completed successfully`);
    } catch (error) {
      this.logger.error("Error in Self-Improvement Cycle", error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Автоматическое тестирование низкоуровневых гипотез
   */
  private async autoTestLowRiskHypotheses(): Promise<void> {
    const lowRiskHypotheses = this.hypothesisEngine
      .getHypotheses({
        status: "draft",
        minPriority: 1,
      })
      .filter((h) => h.priority <= 3); // Низкий приоритет = низкий риск

    let testedCount = 0;
    const maxConcurrent = this.config.maxConcurrentTests;

    for (const hypothesis of lowRiskHypotheses) {
      if (testedCount >= maxConcurrent) {
        break;
      }

      try {
        this.logger.info(`Auto-testing hypothesis: ${hypothesis.title}`);
        const result = await this.hypothesisEngine.testHypothesis(hypothesis.id);

        if (result.success && result.autoApproved) {
          await this.hypothesisEngine.integrateHypothesis(hypothesis.id);
          this.logger.info(`Hypothesis integrated: ${hypothesis.title}`);
        }

        testedCount++;
      } catch (error) {
        this.logger.error(`Error testing hypothesis ${hypothesis.id}`, error);
      }
    }

    this.logger.info(`Auto-testing complete: ${testedCount} hypotheses tested`);
  }

  /**
   * Запуск автоматического цикла
   */
  startAutoRun(): void {
    if (this.autoRunTimer) {
      this.stopAutoRun();
    }

    this.logger.info(`Starting auto-run with interval ${this.config.autoRunInterval}ms`);

    const runCycle = async () => {
      try {
        await this.run();
      } catch (error) {
        this.logger.error("Error in auto-run cycle", error);
      }
    };

    this.autoRunTimer = setInterval(() => {
      void runCycle();
    }, this.config.autoRunInterval);

    // Запуск первого цикла через небольшой интервал
    setTimeout(() => {
      void runCycle();
    }, 5000);
  }

  /**
   * Остановка автоматического цикла
   */
  stopAutoRun(): void {
    if (this.autoRunTimer) {
      clearInterval(this.autoRunTimer);
      this.autoRunTimer = undefined;
      this.logger.info("Auto-run stopped");
    }
  }

  /**
   * Ручная запись опыта
   */
  async recordExperience(
    action: string,
    outcome: Record<string, unknown>,
    context: Record<string, unknown>,
    type: ExperienceType,
    metrics?: {
      duration?: number;
      tokensUsed?: number;
      cost?: number;
      successRate?: number;
      userSatisfaction?: number;
    }
  ): Promise<void> {
    await this.experienceGatherer.recordExperience(action, outcome, context, type, metrics);
  }

  /**
   * Получение общей статистики
   */
  getMetrics(): SelfImprovementMetrics {
    const experienceStats = this.experienceGatherer.aggregateStatistics();
    const patternStats = this.patternMiner.getStatistics();
    const hypothesisStats = this.hypothesisEngine.getStatistics();

    return {
      totalExperiences: experienceStats.total,
      experiencesByType: experienceStats.byType,
      totalPatterns: patternStats.total,
      validatedPatterns: patternStats.validatedCount,
      activeHypotheses:
        hypothesisStats.total -
        hypothesisStats.byStatus.integrated -
        hypothesisStats.byStatus.rejected,
      testsInProgress: hypothesisStats.byStatus.testing,
      integratedImprovements: hypothesisStats.byStatus.integrated,
      averageSuccessRate: experienceStats.successRate,
      improvementVelocity: this.calculateImprovementVelocity(),
      lastConsolidation: this.lastRun,
    };
  }

  /**
   * Расчет скорости улучшений (в неделю)
   */
  private calculateImprovementVelocity(): number {
    const hypothesisStats = this.hypothesisEngine.getStatistics();

    // Упрощенно - все интегрированные улучшения
    // В реальности нужно фильтровать по времени
    return hypothesisStats.byStatus.integrated;
  }

  /**
   * Экспорт данных для анализа
   */
  exportData(format: "json" | "summary" = "json"): string {
    if (format === "summary") {
      const metrics = this.getMetrics();
      return JSON.stringify(
        {
          summary: metrics,
          timestamp: Date.now(),
          version: "4.0",
        },
        null,
        2
      );
    }

    // Полный экспорт
    return JSON.stringify(
      {
        experiences: JSON.parse(this.experienceGatherer.exportForAnalysis("json")),
        patterns: this.patternMiner.getPatterns(),
        hypotheses: this.hypothesisEngine.getHypotheses(),
        metrics: this.getMetrics(),
        timestamp: Date.now(),
      },
      null,
      2
    );
  }

  /**
   * Очистка старых данных
   */
  async cleanup(daysToRetain?: number): Promise<{
    experiencesRemoved: number;
  }> {
    const experiencesRemoved = await this.experienceGatherer.cleanup(daysToRetain);

    this.logger.info(`Cleanup complete: ${experiencesRemoved} experiences removed`);

    return { experiencesRemoved };
  }

  /**
   * Статус системы
   */
  getStatus(): {
    enabled: boolean;
    isRunning: boolean;
    autoRunActive: boolean;
    lastRun: number;
    totalCycles: number;
    nextScheduledRun?: number;
  } {
    return {
      enabled: this.config.enabled,
      isRunning: this.isRunning,
      autoRunActive: !!this.autoRunTimer,
      lastRun: this.lastRun,
      totalCycles: this.totalCycles,
      nextScheduledRun: this.autoRunTimer ? this.lastRun + this.config.autoRunInterval : undefined,
    };
  }
}
