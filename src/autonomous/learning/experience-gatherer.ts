/**
 * Experience Gathering Pipeline
 * Сбор и обработка опыта для системы самосовершенствования
 * Фаза 4: Self-Improvement Loop
 */

import { randomUUID } from "crypto";
import { ExperienceType } from "../../types/swarm/self-improvement.js";
import type { ExperienceEvent, SelfImprovementConfig } from "../../types/swarm/self-improvement.js";
import { Logger } from "../../utils/logger.js";

interface ExperienceGatheringConfig extends SelfImprovementConfig {
  storagePath: string;
  autoCompress: boolean;
  compressionThreshold: number;
}

export class ExperienceGatherer {
  private experiences: ExperienceEvent[] = [];
  private config: ExperienceGatheringConfig;
  private logger: Logger;
  private eventListeners: Map<string, Set<(event: ExperienceEvent) => void>> = new Map();

  constructor(config: Partial<ExperienceGatheringConfig> = {}) {
    this.config = {
      storagePath: "./data/experiences",
      autoCompress: true,
      compressionThreshold: 10000,
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

    this.logger = new Logger("ExperienceGatherer");
    void this.loadExperiences();
  }

  /**
   * Запись нового события опыта
   */
  async recordExperience(
    action: string,
    outcome: Record<string, unknown>,
    context: Record<string, unknown>,
    type: ExperienceType,
    metrics?: ExperienceEvent["metrics"]
  ): Promise<ExperienceEvent> {
    if (!this.config.enabled) {
      throw new Error("Experience gathering is disabled");
    }

    const emotionalWeight = this.calculateEmotionalWeight(type, outcome, metrics);
    const lessonsLearned = this.extractLessons(type, outcome, context);

    const experience: ExperienceEvent = {
      id: randomUUID(),
      timestamp: Date.now(),
      type,
      action,
      context,
      outcome,
      metrics,
      emotionalWeight,
      lessonsLearned,
      tags: this.generateTags(action, type, context),
    };

    this.experiences.push(experience);
    await this.persistExperience(experience);
    this.notifyListeners(experience);

    this.logger.info(`Recorded ${type} experience: ${action}`, {
      experienceId: experience.id,
      emotionalWeight,
      lessonsCount: lessonsLearned.length,
    });

    return experience;
  }

  /**
   * Расчет эмоционального веса события
   */
  private calculateEmotionalWeight(
    type: ExperienceType,
    outcome: Record<string, unknown>,
    metrics?: ExperienceEvent["metrics"]
  ): number {
    let weight = 0;

    // Базовый вес по типу
    switch (type) {
      case ExperienceType.BREAKTHROUGH:
        weight = 1.0;
        break;
      case ExperienceType.SUCCESS:
        weight = 0.5;
        break;
      case ExperienceType.PARTIAL_SUCCESS:
        weight = 0.2;
        break;
      case ExperienceType.NEAR_MISS:
        weight = -0.3;
        break;
      case ExperienceType.FAILURE:
        weight = -0.7;
        break;
    }

    // Корректировка по метрикам
    if (metrics) {
      if (metrics.userSatisfaction !== undefined) {
        weight += (metrics.userSatisfaction / 10) * 0.3;
      }
      if (metrics.successRate !== undefined) {
        weight += (metrics.successRate - 0.5) * 0.2;
      }
    }

    // Ограничение диапазона
    return Math.max(-1, Math.min(1, weight));
  }

  /**
   * Извлечение уроков из события
   */
  private extractLessons(
    type: ExperienceType,
    outcome: Record<string, unknown>,
    context: Record<string, unknown>
  ): string[] {
    const lessons: string[] = [];

    if (type === ExperienceType.FAILURE || type === ExperienceType.NEAR_MISS) {
      lessons.push(`Избежать: ${this.summarizeFailure(outcome)}`);
    }

    if (type === ExperienceType.SUCCESS || type === ExperienceType.BREAKTHROUGH) {
      lessons.push(`Повторить: ${this.summarizeSuccess(outcome)}`);
    }

    if (context.alternativesConsidered) {
      lessons.push("Рассмотреть альтернативы в будущем");
    }

    return lessons;
  }

  private summarizeFailure(outcome: Record<string, unknown>): string {
    const error = (outcome.error as string) || "неизвестная ошибка";
    return error.substring(0, 100);
  }

  private summarizeSuccess(outcome: Record<string, unknown>): string {
    const result = (outcome.result as string) || "успешный результат";
    return result.substring(0, 100);
  }

  /**
   * Генерация тегов для категоризации
   */
  private generateTags(
    action: string,
    type: ExperienceType,
    context: Record<string, unknown>
  ): string[] {
    const tags: string[] = [type];

    // Тег по категории действия
    if (action.includes("tool")) tags.push("tool_usage");
    if (action.includes("decision")) tags.push("decision_making");
    if (action.includes("communicat")) tags.push("communication");
    if (action.includes("plan")) tags.push("planning");

    // Тег по контексту
    if (context.highStakes) tags.push("high_stakes");
    if (context.timeSensitive) tags.push("time_sensitive");
    if (context.recurring) tags.push("recurring");

    return tags;
  }

  /**
   * Получение событий по фильтру
   */
  getExperiences(filter?: {
    type?: ExperienceType;
    tags?: string[];
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): ExperienceEvent[] {
    let filtered = [...this.experiences];

    if (filter?.type) {
      filtered = filtered.filter((e) => e.type === filter.type);
    }

    if (filter?.tags && filter.tags.length > 0) {
      const tags = filter.tags;
      filtered = filtered.filter((e) => e.tags?.some((tag) => tags.includes(tag)));
    }

    if (filter?.startTime) {
      const startTime = filter.startTime;
      filtered = filtered.filter((e) => e.timestamp >= startTime);
    }

    if (filter?.endTime) {
      const endTime = filter.endTime;
      filtered = filtered.filter((e) => e.timestamp <= endTime);
    }

    // Сортировка по времени (новые сначала)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    if (filter?.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  /**
   * Получение недавних событий для анализа
   */
  getRecentExperiences(limit: number = 100): ExperienceEvent[] {
    return this.getExperiences({ limit });
  }

  /**
   * Подписка на новые события
   */
  subscribe(
    eventType: ExperienceType | "all",
    callback: (event: ExperienceEvent) => void
  ): () => void {
    const key = eventType === "all" ? "all" : eventType;

    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, new Set());
    }

    this.eventListeners.get(key)?.add(callback);

    return () => {
      this.eventListeners.get(key)?.delete(callback);
    };
  }

  /**
   * Уведомление слушателей о новом событии
   */
  private notifyListeners(event: ExperienceEvent): void {
    // Слушатели всех событий
    this.eventListeners.get("all")?.forEach((cb) => cb(event));

    // Слушатели конкретного типа
    this.eventListeners.get(event.type)?.forEach((cb) => cb(event));
  }

  /**
   * Агрегация статистики по опыту
   */
  aggregateStatistics(timeRange?: { start: number; end: number }): {
    total: number;
    byType: Record<ExperienceType, number>;
    averageEmotionalWeight: number;
    successRate: number;
    topTags: Array<{ tag: string; count: number }>;
  } {
    let experiences = this.experiences;

    if (timeRange) {
      experiences = experiences.filter(
        (e) => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
      );
    }

    const byType: Record<ExperienceType, number> = {
      [ExperienceType.SUCCESS]: 0,
      [ExperienceType.FAILURE]: 0,
      [ExperienceType.PARTIAL_SUCCESS]: 0,
      [ExperienceType.NEAR_MISS]: 0,
      [ExperienceType.BREAKTHROUGH]: 0,
    };

    let totalEmotionalWeight = 0;
    const tagCounts: Map<string, number> = new Map();

    experiences.forEach((exp) => {
      byType[exp.type]++;
      totalEmotionalWeight += exp.emotionalWeight || 0;

      exp.tags?.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const successCount =
      byType[ExperienceType.SUCCESS] +
      byType[ExperienceType.BREAKTHROUGH] +
      byType[ExperienceType.PARTIAL_SUCCESS] * 0.5;

    return {
      total: experiences.length,
      byType,
      averageEmotionalWeight:
        experiences.length > 0 ? totalEmotionalWeight / experiences.length : 0,
      successRate: experiences.length > 0 ? successCount / experiences.length : 0,
      topTags: Array.from(tagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count })),
    };
  }

  /**
   * Сохранение события в хранилище
   */
  private async persistExperience(_experience: ExperienceEvent): Promise<void> {
    // TODO: Реализовать сохранение в SQLite/файл
    // Для现在 просто держим в памяти
    if (this.config.autoCompress && this.experiences.length >= this.config.compressionThreshold) {
      await this.compressOldExperiences();
    }
  }

  /**
   * Загрузка событий из хранилища
   */
  private async loadExperiences(): Promise<void> {
    // TODO: Реализовать загрузку из SQLite/файла
    this.logger.info("Experience gatherer initialized");
  }

  /**
   * Сжатие старых событий (архивация)
   */
  private async compressOldExperiences(): Promise<void> {
    const cutoffDate = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
    const oldExperiences = this.experiences.filter((e) => e.timestamp < cutoffDate);

    if (oldExperiences.length > 0) {
      // TODO: Архивировать старые события
      this.experiences = this.experiences.filter((e) => e.timestamp >= cutoffDate);
      this.logger.info(`Compressed ${oldExperiences.length} old experiences`);
    }
  }

  /**
   * Очистка старых событий
   */
  async cleanup(retentionDays?: number): Promise<number> {
    const days = retentionDays || this.config.retentionDays;
    const cutoffDate = Date.now() - days * 24 * 60 * 60 * 1000;

    const initialCount = this.experiences.length;
    this.experiences = this.experiences.filter((e) => e.timestamp >= cutoffDate);

    const removed = initialCount - this.experiences.length;
    if (removed > 0) {
      this.logger.info(`Cleaned up ${removed} experiences older than ${days} days`);
    }

    return removed;
  }

  /**
   * Экспорт опыта для анализа
   */
  exportForAnalysis(format: "json" | "csv" = "json"): string {
    if (format === "json") {
      return JSON.stringify(this.experiences, null, 2);
    }

    // CSV экспорт
    const headers = ["id", "timestamp", "type", "action", "emotionalWeight", "tags"];
    const rows = this.experiences.map((e) =>
      [e.id, e.timestamp, e.type, e.action, e.emotionalWeight, (e.tags || []).join(";")].join(",")
    );

    return [headers.join(","), ...rows].join("\n");
  }
}
