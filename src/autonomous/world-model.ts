/**
 * World Model Engine
 *
 * Реализует Пункт 7B: Внутренняя модель мира агента
 * - Entities: Объекты и их свойства
 * - Relationships: Связи между объектами
 * - Dynamics: Изменения во времени
 * - Predictions: Прогнозирование состояний
 */

import { Logger } from "../utils/logger.js";

const logger = new Logger("WorldModel");

// Типы сущностей
export enum EntityType {
  USER = "USER",
  WALLET = "WALLET",
  SMART_CONTRACT = "SMART_CONTRACT",
  TRANSACTION = "TRANSACTION",
  MESSAGE = "MESSAGE",
  TASK = "TASK",
  RESOURCE = "RESOURCE",
  SYSTEM = "SYSTEM",
}

// Связи между сущностями
export enum RelationshipType {
  OWNS = "OWNS",
  INTERACTS_WITH = "INTERACTS_WITH",
  DEPENDS_ON = "DEPENDS_ON",
  TRUSTS = "TRUSTS",
  BLOCKS = "BLOCKS",
  MONITORS = "MONITORS",
}

interface Entity {
  id: string;
  type: EntityType;
  properties: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  version: number;
}

interface Relationship {
  id: string;
  from: string; // entity ID
  to: string; // entity ID
  type: RelationshipType;
  strength: number; // 0-1
  metadata?: Record<string, unknown>;
}

interface WorldState {
  timestamp: number;
  entities: Map<string, Entity>;
  relationships: Map<string, Relationship>;
  events: WorldEvent[];
}

interface WorldEvent {
  id: string;
  type: string;
  timestamp: number;
  entitiesInvolved: string[];
  impact: Record<string, unknown>;
}

interface Prediction {
  entity_id: string;
  predictedState: Record<string, unknown>;
  confidence: number;
  timeHorizon: number; // ms
  reasoning: string;
}

export class WorldModel {
  private state: WorldState;
  private history: WorldState[] = [];
  private maxHistoryLength = 100;

  constructor() {
    this.state = {
      timestamp: Date.now(),
      entities: new Map(),
      relationships: new Map(),
      events: [],
    };
  }

  /**
   * Добавить или обновить сущность
   */
  upsertEntity(entity: Entity): void {
    const existing = this.state.entities.get(entity.id);

    if (existing) {
      entity.version = existing.version + 1;
      entity.createdAt = existing.createdAt;
      logger.debug(`Updated entity: ${entity.id} (v${entity.version})`);
    } else {
      logger.debug(`Created entity: ${entity.id}`);
    }

    entity.updatedAt = Date.now();
    this.state.entities.set(entity.id, entity);
    this.snapshotIfChanged();
  }

  /**
   * Получить сущность по ID
   */
  getEntity(id: string): Entity | undefined {
    return this.state.entities.get(id);
  }

  /**
   * Найти сущности по типу
   */
  findByType(type: EntityType): Entity[] {
    return Array.from(this.state.entities.values()).filter((e) => e.type === type);
  }

  /**
   * Создать связь между сущностями
   */
  createRelationship(relationship: Relationship): void {
    // Валидация: сущности должны существовать
    if (!this.state.entities.has(relationship.from)) {
      throw new Error(`Source entity ${relationship.from} not found`);
    }
    if (!this.state.entities.has(relationship.to)) {
      throw new Error(`Target entity ${relationship.to} not found`);
    }

    this.state.relationships.set(relationship.id, relationship);
    logger.debug(
      `Created relationship: ${relationship.from} -[${relationship.type}]-> ${relationship.to}`
    );
  }

  /**
   * Получить связи сущности
   */
  getRelationships(entityId: string, type?: RelationshipType): Relationship[] {
    return Array.from(this.state.relationships.values()).filter(
      (r) => (r.from === entityId || r.to === entityId) && (!type || r.type === type)
    );
  }

  /**
   * Записать событие в мир
   */
  recordEvent(event: WorldEvent): void {
    this.state.events.push(event);

    // Обновление затронутых сущностей
    for (const entityId of event.entitiesInvolved) {
      const entity = this.state.entities.get(entityId);
      if (entity) {
        entity.updatedAt = Date.now();
        entity.properties = { ...entity.properties, ...event.impact };
        this.state.entities.set(entityId, entity);
      }
    }

    logger.info(
      `Recorded event: ${event.type} involving ${event.entitiesInvolved.length} entities`
    );
    this.snapshotIfChanged();
  }

  /**
   * Предсказать будущее состояние сущности
   */
  predict(entityId: string, timeHorizon: number = 3600000): Prediction | null {
    const entity = this.state.entities.get(entityId);
    if (!entity) return null;

    // Анализ истории изменений
    const trajectory = this.getEntityTrajectory(entityId);

    if (trajectory.length < 2) {
      // Недостаточно данных для прогноза
      return {
        entity_id: entityId,
        predictedState: entity.properties,
        confidence: 0.3,
        timeHorizon,
        reasoning: "Insufficient historical data",
      };
    }

    // Простая линейная экстраполяция (в реальности - ML модель)
    const trend = this.calculateTrend(trajectory);
    const predictedProperties = { ...entity.properties };

    // Применение тренда
    for (const [key, value] of Object.entries(trend)) {
      if (typeof value === "number") {
        predictedProperties[key] = value * (timeHorizon / 3600000);
      }
    }

    return {
      entity_id: entityId,
      predictedState: predictedProperties,
      confidence: Math.min(0.9, 0.5 + trajectory.length * 0.05),
      timeHorizon,
      reasoning: `Based on ${trajectory.length} historical states, trend: ${JSON.stringify(trend)}`,
    };
  }

  /**
   * Симуляция воздействия (What-if анализ)
   */
  simulate(action: string, targetEntityId: string, parameters: unknown): SimulationResult {
    const entity = this.state.entities.get(targetEntityId);
    if (!entity) {
      throw new Error(`Entity ${targetEntityId} not found`);
    }

    // Клонирование состояния для симуляции
    const simulatedState = this.cloneState();

    // Применение воздействия
    const impact = this.calculateImpact(action, entity, parameters);

    // Обновление симулированного состояния
    const simulatedEntity = simulatedState.entities.get(targetEntityId);
    if (!simulatedEntity) {
      throw new Error(`Entity ${targetEntityId} not found in simulated state`);
    }
    simulatedEntity.properties = { ...simulatedEntity.properties, ...impact };
    simulatedEntity.updatedAt = Date.now();

    // Проверка на нарушение правил
    const violations = this.checkConstraints(simulatedState);

    return {
      action,
      originalState: entity.properties,
      simulatedState: simulatedEntity.properties,
      impact,
      violations,
      safe: violations.length === 0,
    };
  }

  /**
   * Получить текущее состояние мира
   */
  getState(): WorldState {
    return {
      timestamp: this.state.timestamp,
      entities: new Map(this.state.entities),
      relationships: new Map(this.state.relationships),
      events: [...this.state.events],
    };
  }

  /**
   * Граф связей (для визуализации)
   */
  getGraph(): { nodes: unknown[]; links: unknown[] } {
    const nodes = Array.from(this.state.entities.values()).map((e) => ({
      id: e.id,
      type: e.type,
      label: e.properties.name || e.id,
    }));

    const links = Array.from(this.state.relationships.values()).map((r) => ({
      source: r.from,
      target: r.to,
      type: r.type,
      strength: r.strength,
    }));

    return { nodes, links };
  }

  // --- Приватные методы ---

  private getEntityTrajectory(entityId: string): unknown[] {
    // Возвращает историю изменений сущности
    const trajectory: unknown[] = [];

    for (const snapshot of this.history.slice(-10)) {
      const entity = snapshot.entities.get(entityId);
      if (entity) {
        trajectory.push({
          timestamp: snapshot.timestamp,
          properties: { ...entity.properties },
        });
      }
    }

    return trajectory;
  }

  private calculateTrend(trajectory: unknown[]): Record<string, number> {
    if (trajectory.length < 2) return {};

    const firstItem = trajectory[0] as Record<string, unknown>;
    const lastItem = trajectory[trajectory.length - 1] as Record<string, unknown>;
    const first = firstItem.properties as Record<string, unknown>;
    const last = lastItem.properties as Record<string, unknown>;
    const timeDiff = ((lastItem.timestamp as number) - (firstItem.timestamp as number)) / 3600000;

    const trend: Record<string, number> = {};

    for (const key of Object.keys(last)) {
      if (typeof last[key] === "number" && typeof first[key] === "number") {
        trend[key] = ((last[key] as number) - (first[key] as number)) / (timeDiff || 1);
      }
    }

    return trend;
  }

  private calculateImpact(
    action: string,
    entity: Entity,
    parameters: unknown
  ): Record<string, unknown> {
    // Симуляция воздействия (в реальности - физическая/логическая модель)
    const params = parameters as Record<string, unknown>;
    switch (action) {
      case "TRANSFER_FUNDS":
        return {
          balance: ((entity.properties.balance as number) || 0) - (params.amount as number),
          lastTransaction: Date.now(),
        };

      case "UPDATE_STATUS":
        return {
          status: params.newStatus,
          updatedAt: Date.now(),
        };

      case "CONSUME_RESOURCE":
        return {
          available:
            ((entity.properties.available as number) || 0) - (params.consumption as number),
          utilization:
            (((entity.properties.utilization as number) || 0) + (params.consumption as number)) /
            100,
        };

      default:
        return { modified: true };
    }
  }

  private checkConstraints(state: WorldState): string[] {
    const violations: string[] = [];

    for (const entity of state.entities.values()) {
      // Проверка отрицательного баланса
      if (entity.type === EntityType.WALLET && (entity.properties.balance as number) < 0) {
        violations.push(`Negative balance for ${entity.id}`);
      }

      // Проверка перегрузки ресурсов
      if ((entity.properties.utilization as number) > 100) {
        violations.push(`Resource overutilization for ${entity.id}`);
      }
    }

    return violations;
  }

  private cloneState(): WorldState {
    return {
      timestamp: this.state.timestamp,
      entities: new Map(this.state.entities),
      relationships: new Map(this.state.relationships),
      events: [...this.state.events],
    };
  }

  private snapshotIfChanged(): void {
    // Сохранение снимка состояния каждые N изменений
    if (this.history.length >= this.maxHistoryLength) {
      this.history.shift();
    }

    this.history.push({
      timestamp: Date.now(),
      entities: new Map(this.state.entities),
      relationships: new Map(this.state.relationships),
      events: [...this.state.events],
    });
  }
}

interface SimulationResult {
  action: string;
  originalState: unknown;
  simulatedState: unknown;
  impact: unknown;
  violations: string[];
  safe: boolean;
}
