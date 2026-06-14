/**
 * Pattern Mining Engine
 * Выявление паттернов из накопленного опыта
 * Фаза 4: Self-Improvement Loop
 */

import { randomUUID } from "crypto";
import { ExperienceType, PatternCategory } from "../../types/swarm/self-improvement.js";
import type {
  ExperienceEvent,
  Pattern,
  SelfImprovementConfig,
} from "../../types/swarm/self-improvement.js";
import { Logger } from "../../utils/logger.js";
import type { ExperienceGatherer } from "./experience-gatherer.js";

interface PatternMiningConfig extends SelfImprovementConfig {
  minPatternFrequency: number;
  minConfidence: number;
  clusteringThreshold: number;
}

export class PatternMiner {
  private patterns: Pattern[] = [];
  private config: PatternMiningConfig;
  private logger: Logger;
  private experienceGatherer: ExperienceGatherer;

  constructor(experienceGatherer: ExperienceGatherer, config: Partial<PatternMiningConfig> = {}) {
    this.experienceGatherer = experienceGatherer;
    this.config = {
      minPatternFrequency: 5,
      minConfidence: 0.6,
      clusteringThreshold: 0.7,
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

    this.logger = new Logger("PatternMiner");
  }

  /**
   * Запуск процесса майнинга паттернов
   */
  async minePatterns(): Promise<Pattern[]> {
    if (!this.config.enabled) {
      this.logger.warn("Pattern mining is disabled");
      return [];
    }

    this.logger.info("Starting pattern mining process...");

    const experiences = this.experienceGatherer.getRecentExperiences(1000);

    if (experiences.length < this.config.minExperiencesForPattern) {
      this.logger.warn(`Not enough experiences for pattern mining: ${experiences.length}`);
      return [];
    }

    // Группировка по категориям
    const grouped = this.groupExperiencesByCategory(experiences);

    // Выявление паттернов в каждой группе
    const newPatterns: Pattern[] = [];

    for (const [category, categoryExperiences] of Object.entries(grouped)) {
      const patterns = this.extractPatternsFromGroup(
        categoryExperiences,
        category as PatternCategory
      );
      newPatterns.push(...patterns);
    }

    // Объединение с существующими паттернами
    await this.mergePatterns(newPatterns);

    this.logger.info(`Pattern mining complete. Found ${newPatterns.length} new patterns.`);

    return newPatterns;
  }

  /**
   * Группировка опытов по категориям
   */
  private groupExperiencesByCategory(
    experiences: ExperienceEvent[]
  ): Record<string, ExperienceEvent[]> {
    const grouped: Record<string, ExperienceEvent[]> = {};

    experiences.forEach((exp) => {
      // Определение категории по тегам и действию
      const category = this.inferCategory(exp);

      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(exp);
    });

    return grouped;
  }

  /**
   * Вывод категории паттерна из события
   */
  private inferCategory(exp: ExperienceEvent): string {
    if (exp.tags?.includes("tool_usage")) {
      return PatternCategory.TOOL_USAGE;
    }
    if (exp.tags?.includes("decision_making")) {
      return PatternCategory.DECISION_MAKING;
    }
    if (exp.tags?.includes("communication")) {
      return PatternCategory.COMMUNICATION;
    }
    if (exp.action.includes("solve") || exp.action.includes("fix")) {
      return PatternCategory.PROBLEM_SOLVING;
    }
    if (exp.action.includes("optimize") || exp.action.includes("improve")) {
      return PatternCategory.OPTIMIZATION;
    }
    if (exp.type === ExperienceType.FAILURE || exp.type === ExperienceType.NEAR_MISS) {
      return PatternCategory.ERROR_HANDLING;
    }

    return PatternCategory.RESOURCE_MANAGEMENT;
  }

  /**
   * Извлечение паттернов из группы событий
   */
  private extractPatternsFromGroup(
    experiences: ExperienceEvent[],
    category: PatternCategory
  ): Pattern[] {
    const patterns: Pattern[] = [];

    // Кластеризация похожих событий
    const clusters = this.clusterExperiences(experiences);

    clusters.forEach((cluster) => {
      if (cluster.length >= this.config.minPatternFrequency) {
        const pattern = this.createPatternFromCluster(cluster, category);
        if (pattern && pattern.confidence >= this.config.minConfidence) {
          patterns.push(pattern);
        }
      }
    });

    return patterns;
  }

  /**
   * Кластеризация похожих событий
   */
  private clusterExperiences(experiences: ExperienceEvent[]): ExperienceEvent[][] {
    const clusters: ExperienceEvent[][] = [];
    const assigned = new Set<string>();

    experiences.forEach((exp) => {
      if (assigned.has(exp.id)) return;

      // Поиск похожих событий
      const similar = experiences.filter((other) => {
        if (other.id === exp.id || assigned.has(other.id)) return false;
        return this.areExperiencesSimilar(exp, other);
      });

      if (similar.length > 0) {
        const cluster = [exp, ...similar];
        cluster.forEach((e) => assigned.add(e.id));
        clusters.push(cluster);
      } else {
        // Одиночное событие - свой кластер
        clusters.push([exp]);
      }
    });

    return clusters;
  }

  /**
   * Проверка схожести двух событий
   */
  private areExperiencesSimilar(
    exp1: ExperienceEvent,
    exp2: ExperienceEvent,
    threshold: number = 0.7
  ): boolean {
    // Схожесть по действию
    const actionSimilarity = this.stringSimilarity(exp1.action, exp2.action);

    // Схожесть по тегам
    const tagSimilarity = this.jaccardSimilarity(exp1.tags || [], exp2.tags || []);

    // Схожесть по типу
    const typeSimilarity = exp1.type === exp2.type ? 1 : 0;

    // Взвешенная средняя
    const totalSimilarity = actionSimilarity * 0.5 + tagSimilarity * 0.3 + typeSimilarity * 0.2;

    return totalSimilarity >= threshold;
  }

  /**
   * Вычисление схожести строк (Levenshtein-based)
   */
  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Расстояние Левенштейна
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Коэффициент Жаккара для множеств
   */
  private jaccardSimilarity(set1: string[], set2: string[]): number {
    const intersection = set1.filter((x) => set2.includes(x));
    const union = new Set([...set1, ...set2]);
    return intersection.length / union.size;
  }

  /**
   * Создание паттерна из кластера событий
   */
  private createPatternFromCluster(
    cluster: ExperienceEvent[],
    category: PatternCategory
  ): Pattern | null {
    if (cluster.length === 0) return null;

    const successCount = cluster.filter(
      (e) => e.type === ExperienceType.SUCCESS || e.type === ExperienceType.BREAKTHROUGH
    ).length;

    const successRate = successCount / cluster.length;
    const confidence = this.calculatePatternConfidence(cluster, successRate);

    // Извлечение общих условий и действий
    const conditions = this.extractCommonConditions(cluster);
    const actions = this.extractCommonActions(cluster);
    const outcomes = this.extractCommonOutcomes(cluster);

    if (conditions.length === 0 || actions.length === 0) {
      return null;
    }

    return {
      id: randomUUID(),
      category,
      name: this.generatePatternName(category, actions[0]),
      description: this.generatePatternDescription(cluster, category),
      frequency: cluster.length,
      successRate,
      confidence,
      conditions,
      actions,
      outcomes,
      examples: cluster.map((e) => e.id),
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      isValidated: false,
      riskLevel: this.assessPatternRisk(successRate, category),
    };
  }

  /**
   * Расчет уверенности в паттерне
   */
  private calculatePatternConfidence(cluster: ExperienceEvent[], successRate: number): number {
    const frequencyFactor = Math.min(cluster.length / 10, 1); // до 10 событий
    const consistencyFactor =
      1 - this.standardDeviation(cluster.map((e) => e.emotionalWeight || 0));
    const recencyFactor = this.calculateRecencyFactor(cluster);

    return (
      successRate * 0.4 + frequencyFactor * 0.3 + consistencyFactor * 0.2 + recencyFactor * 0.1
    );
  }

  /**
   * Расчет фактора давности
   */
  private calculateRecencyFactor(cluster: ExperienceEvent[]): number {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;

    const recentCount = cluster.filter((e) => now - e.timestamp < oneWeek).length;

    return recentCount / cluster.length;
  }

  /**
   * Стандартное отклонение
   */
  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;

    return Math.sqrt(variance);
  }

  /**
   * Извлечение общих условий
   */
  private extractCommonConditions(experiences: ExperienceEvent[]): string[] {
    const conditionMaps: Map<string, number> = new Map();

    experiences.forEach((exp) => {
      Object.keys(exp.context).forEach((key) => {
        const value = exp.context[key];
        const condition = `${key}=${value}`;
        conditionMaps.set(condition, (conditionMaps.get(condition) || 0) + 1);
      });
    });

    const threshold = experiences.length * 0.6; // 60% совпадений

    return Array.from(conditionMaps.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([condition, _]) => condition)
      .slice(0, 5);
  }

  /**
   * Извлечение общих действий
   */
  private extractCommonActions(experiences: ExperienceEvent[]): string[] {
    const actionCounts: Map<string, number> = new Map();

    experiences.forEach((exp) => {
      const normalized = this.normalizeAction(exp.action);
      actionCounts.set(normalized, (actionCounts.get(normalized) || 0) + 1);
    });

    const threshold = experiences.length * 0.5; // 50% совпадений

    return Array.from(actionCounts.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([action, _]) => action)
      .slice(0, 3);
  }

  /**
   * Извлечение общих результатов
   */
  private extractCommonOutcomes(experiences: ExperienceEvent[]): string[] {
    const outcomePatterns: Map<string, number> = new Map();

    experiences.forEach((exp) => {
      const outcomeSummary = JSON.stringify(exp.outcome).substring(0, 50);
      outcomePatterns.set(outcomeSummary, (outcomePatterns.get(outcomeSummary) || 0) + 1);
    });

    const threshold = experiences.length * 0.4;

    return Array.from(outcomePatterns.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([outcome, _]) => outcome)
      .slice(0, 3);
  }

  /**
   * Нормализация действия
   */
  private normalizeAction(action: string): string {
    return action.toLowerCase().trim();
  }

  /**
   * Генерация имени паттерна
   */
  private generatePatternName(category: PatternCategory, primaryAction: string): string {
    const prefixes: Record<PatternCategory, string> = {
      [PatternCategory.DECISION_MAKING]: "Decision",
      [PatternCategory.TOOL_USAGE]: "Tool",
      [PatternCategory.COMMUNICATION]: "Communication",
      [PatternCategory.PROBLEM_SOLVING]: "Solution",
      [PatternCategory.RESOURCE_MANAGEMENT]: "Resource",
      [PatternCategory.ERROR_HANDLING]: "Error",
      [PatternCategory.OPTIMIZATION]: "Optimization",
    };

    const actionWord = primaryAction.split(" ").slice(0, 2).join(" ");
    return `${prefixes[category]}: ${actionWord}`;
  }

  /**
   * Генерация описания паттерна
   */
  private generatePatternDescription(
    cluster: ExperienceEvent[],
    category: PatternCategory
  ): string {
    const avgSuccessRate =
      cluster.reduce((acc, e) => {
        const isSuccessful =
          e.type === ExperienceType.SUCCESS || e.type === ExperienceType.BREAKTHROUGH;
        return acc + (isSuccessful ? 1 : 0);
      }, 0) / cluster.length;

    return (
      `Паттерн выявлен из ${cluster.length} событий. ` +
      `Успешность: ${(avgSuccessRate * 100).toFixed(1)}%. ` +
      `Категория: ${category}.`
    );
  }

  /**
   * Оценка риска паттерна
   */
  private assessPatternRisk(
    successRate: number,
    _category: PatternCategory
  ): "low" | "medium" | "high" {
    if (successRate >= 0.9) return "low";
    if (successRate >= 0.7) return "medium";
    return "high";
  }

  /**
   * Слияние новых паттернов с существующими
   */
  private async mergePatterns(newPatterns: Pattern[]): Promise<void> {
    newPatterns.forEach((newPattern) => {
      const existingIndex = this.patterns.findIndex(
        (p) => p.category === newPattern.category && p.name === newPattern.name
      );

      if (existingIndex !== -1) {
        // Обновление существующего паттерна
        const existing = this.patterns[existingIndex];
        existing.frequency += newPattern.frequency;
        existing.examples = [...new Set([...existing.examples, ...newPattern.examples])];
        existing.lastUpdated = Date.now();
        existing.successRate = this.recalculateSuccessRate(existing);
        existing.confidence = this.calculatePatternConfidence(
          existing.examples.map((id) => ({ id }) as ExperienceEvent),
          existing.successRate
        );
      } else {
        // Добавление нового паттерна
        this.patterns.push(newPattern);
      }
    });

    this.logger.info(`Total patterns: ${this.patterns.length}`);
  }

  /**
   * Пересчет успешности паттерна
   */
  private recalculateSuccessRate(pattern: Pattern): number {
    // Упрощенная логика - в реальности нужно загружать примеры
    return pattern.successRate;
  }

  /**
   * Получение всех паттернов
   */
  getPatterns(filter?: {
    category?: PatternCategory;
    minConfidence?: number;
    minFrequency?: number;
    validatedOnly?: boolean;
  }): Pattern[] {
    let filtered = [...this.patterns];

    if (filter?.category) {
      filtered = filtered.filter((p) => p.category === filter.category);
    }

    if (filter?.minConfidence !== undefined) {
      const minConf = filter.minConfidence;
      filtered = filtered.filter((p) => p.confidence >= minConf);
    }

    if (filter?.minFrequency !== undefined) {
      const minFreq = filter.minFrequency;
      filtered = filtered.filter((p) => p.frequency >= minFreq);
    }

    if (filter?.validatedOnly) {
      filtered = filtered.filter((p) => p.isValidated);
    }

    // Сортировка по уверенности
    filtered.sort((a, b) => b.confidence - a.confidence);

    return filtered;
  }

  /**
   * Валидация паттерна
   */
  validatePattern(patternId: string, isValid: boolean): void {
    const pattern = this.patterns.find((p) => p.id === patternId);
    if (pattern) {
      pattern.isValidated = isValid;
      pattern.lastUpdated = Date.now();
      this.logger.info(`Pattern ${pattern.name} validation: ${isValid}`);
    }
  }

  /**
   * Статистика по паттернам
   */
  getStatistics(): {
    total: number;
    byCategory: Record<PatternCategory, number>;
    averageConfidence: number;
    validatedCount: number;
    highRiskCount: number;
  } {
    const byCategory: Record<PatternCategory, number> = {
      [PatternCategory.DECISION_MAKING]: 0,
      [PatternCategory.TOOL_USAGE]: 0,
      [PatternCategory.COMMUNICATION]: 0,
      [PatternCategory.PROBLEM_SOLVING]: 0,
      [PatternCategory.RESOURCE_MANAGEMENT]: 0,
      [PatternCategory.ERROR_HANDLING]: 0,
      [PatternCategory.OPTIMIZATION]: 0,
    };

    let totalConfidence = 0;
    let validatedCount = 0;
    let highRiskCount = 0;

    this.patterns.forEach((p) => {
      byCategory[p.category]++;
      totalConfidence += p.confidence;
      if (p.isValidated) validatedCount++;
      if (p.riskLevel === "high") highRiskCount++;
    });

    return {
      total: this.patterns.length,
      byCategory,
      averageConfidence: this.patterns.length > 0 ? totalConfidence / this.patterns.length : 0,
      validatedCount,
      highRiskCount,
    };
  }
}
