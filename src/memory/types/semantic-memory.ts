/**
 * Semantic Memory: Fact-based knowledge graph system
 *
 * Stores structured knowledge with:
 * - Entities and relationships
 * - Concept hierarchies
 * - Fact triples (subject-predicate-object)
 * - Spreading activation for retrieval
 */

import { logger } from "../../utils/logger.js";

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  properties: Record<string, unknown>;
  connections: Connection[];
  activationLevel: number;
  lastActivated?: number;
  createdAt: number;
}

export interface Connection {
  targetId: string;
  relationship: RelationshipType;
  strength: number; // 0.0 to 1.0
  context?: string;
}

export interface FactTriple {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  source?: string;
  timestamp: number;
}

export enum EntityType {
  CONCEPT = "CONCEPT",
  PERSON = "PERSON",
  ORGANIZATION = "ORGANIZATION",
  LOCATION = "LOCATION",
  EVENT = "EVENT",
  OBJECT = "OBJECT",
  ABSTRACT = "ABSTRACT",
}

export enum RelationshipType {
  IS_A = "IS_A", // Taxonomy
  PART_OF = "PART_OF", // Meronymy
  RELATED_TO = "RELATED_TO", // General association
  CAUSES = "CAUSES", // Causality
  USED_FOR = "USED_FOR", // Function
  LOCATED_IN = "LOCATED_IN", // Spatial
  CREATED_BY = "CREATED_BY", // Origin
  SIMILAR_TO = "SIMILAR_TO", // Similarity
}

export interface SemanticQuery {
  entityName?: string;
  entityType?: EntityType;
  relationships?: RelationshipType[];
  minActivation?: number;
  maxHops?: number;
  limit?: number;
}

export class SemanticMemory {
  private entities: Map<string, Entity>;
  private facts: FactTriple[];
  private readonly MAX_ENTITIES = 5000;
  private readonly ACTIVATION_DECAY = 0.05;
  private readonly ACTIVATION_THRESHOLD = 0.2;

  constructor() {
    this.entities = new Map();
    this.facts = [];
  }

  /**
   * Add or update an entity
   */
  async addEntity(
    name: string,
    type: EntityType,
    properties: Record<string, unknown> = {}
  ): Promise<string> {
    const id = this.normalizeId(name);

    const existing = this.entities.get(id);
    if (existing) {
      // Update existing entity
      existing.properties = { ...existing.properties, ...properties };
      existing.activationLevel = Math.min(1.0, existing.activationLevel + 0.2);
      existing.lastActivated = Date.now();
      logger.debug(`[SemanticMemory] Updated entity: ${name}`);
      return id;
    }

    const entity: Entity = {
      id,
      name,
      type,
      properties,
      connections: [],
      activationLevel: 0.5,
      createdAt: Date.now(),
    };

    this.entities.set(id, entity);

    // Auto-create IS_A connection to type
    const typeId = this.normalizeId(EntityType[type]);
    if (!this.entities.has(typeId)) {
      await this.addEntity(EntityType[type], EntityType.ABSTRACT);
    }
    entity.connections.push({
      targetId: typeId,
      relationship: RelationshipType.IS_A,
      strength: 1.0,
    });

    // Enforce limit
    if (this.entities.size > this.MAX_ENTITIES) {
      this.pruneLowActivationEntities();
    }

    logger.debug(`[SemanticMemory] Added entity: ${name} (${type})`);
    return id;
  }

  /**
   * Add relationship between entities
   */
  async addRelationship(
    sourceId: string,
    targetId: string,
    relationship: RelationshipType,
    strength: number = 0.8,
    context?: string
  ): Promise<void> {
    const source = this.entities.get(sourceId);
    const target = this.entities.get(targetId);

    if (!source || !target) {
      logger.warn(`[SemanticMemory] Cannot add relationship: entity not found`);
      return;
    }

    // Check if relationship already exists
    const existingConn = source.connections.find(
      (c) => c.targetId === targetId && c.relationship === relationship
    );

    if (existingConn) {
      existingConn.strength = Math.max(existingConn.strength, strength);
      existingConn.context = context || existingConn.context;
    } else {
      source.connections.push({
        targetId,
        relationship,
        strength,
        context,
      });
    }

    // Add bidirectional connection for symmetric relationships
    if ([RelationshipType.SIMILAR_TO, RelationshipType.RELATED_TO].includes(relationship)) {
      target.connections.push({
        targetId: sourceId,
        relationship,
        strength,
        context,
      });
    }

    logger.debug(
      `[SemanticMemory] Added relationship: ${source.name} --[${relationship}]--> ${target.name}`
    );
  }

  /**
   * Add a fact triple
   */
  async addFact(triple: FactTriple): Promise<void> {
    this.facts.push(triple);

    // Limit facts storage
    if (this.facts.length > 10000) {
      this.facts = this.facts.slice(-5000);
    }

    logger.debug(
      `[SemanticMemory] Added fact: ${triple.subject} ${triple.predicate} ${triple.object}`
    );
  }

  /**
   * Query entities with filters and spreading activation
   */
  query(filters: SemanticQuery): Entity[] {
    let results = Array.from(this.entities.values());

    // Filter by name
    if (filters.entityName) {
      const searchLower = filters.entityName.toLowerCase();
      results = results.filter((e) => e.name.toLowerCase().includes(searchLower));
    }

    // Filter by type
    if (filters.entityType) {
      results = results.filter((e) => e.type === filters.entityType);
    }

    // Filter by activation
    if (filters.minActivation !== undefined) {
      results = results.filter((e) => e.activationLevel >= (filters.minActivation ?? 0));
    }

    // Apply spreading activation if querying relationships
    if (filters.relationships && filters.relationships.length > 0) {
      results = this.spreadingActivation(results, filters.relationships, filters.maxHops || 2);
    }

    // Sort by activation level
    results.sort((a, b) => b.activationLevel - a.activationLevel);

    // Limit results
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Get entity by ID
   */
  getEntity(id: string): Entity | null {
    return this.entities.get(id) || null;
  }

  /**
   * Find path between two entities
   */
  findPath(sourceId: string, targetId: string, maxHops: number = 5): string[] | null {
    const visited = new Set<string>();
    const queue: Array<{ id: string; path: string[] }> = [{ id: sourceId, path: [sourceId] }];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      if (current.id === targetId) {
        return current.path;
      }

      if (visited.has(current.id) || current.path.length > maxHops) continue;
      visited.add(current.id);

      const entity = this.entities.get(current.id);
      if (!entity) continue;

      for (const conn of entity.connections) {
        if (!visited.has(conn.targetId)) {
          queue.push({
            id: conn.targetId,
            path: [...current.path, conn.targetId],
          });
        }
      }
    }

    return null;
  }

  /**
   * Retrieve facts matching pattern
   */
  retrieveFacts(subject?: string, predicate?: string, object?: string): FactTriple[] {
    return this.facts.filter((fact) => {
      if (subject && !fact.subject.toLowerCase().includes(subject.toLowerCase())) return false;
      if (predicate && !fact.predicate.toLowerCase().includes(predicate.toLowerCase()))
        return false;
      if (object && !fact.object.toLowerCase().includes(object.toLowerCase())) return false;
      return true;
    });
  }

  /**
   * Activate entity (increases activation level)
   */
  activate(entityId: string, amount: number = 0.3): void {
    const entity = this.entities.get(entityId);
    if (!entity) return;

    entity.activationLevel = Math.min(1.0, entity.activationLevel + amount);
    entity.lastActivated = Date.now();

    // Spread activation to connected entities
    for (const conn of entity.connections) {
      const target = this.entities.get(conn.targetId);
      if (target) {
        const spreadAmount = amount * conn.strength * 0.5;
        target.activationLevel = Math.min(1.0, target.activationLevel + spreadAmount);
      }
    }
  }

  /**
   * Consolidate semantic memory (optimize graph)
   */
  async consolidate(): Promise<{ merged: number; pruned: number }> {
    logger.info("[SemanticMemory] Starting consolidation...");

    let merged = 0;
    let pruned = 0;

    // Merge similar entities
    merged = await this.mergeSimilarEntities();

    // Prune low-activation entities
    pruned = this.pruneLowActivationEntities();

    // Decay all activations
    for (const entity of this.entities.values()) {
      entity.activationLevel *= 1 - this.ACTIVATION_DECAY;
    }

    logger.info(`[SemanticMemory] Consolidation complete: ${merged} merged, ${pruned} pruned`);
    return { merged, pruned };
  }

  /**
   * Get knowledge graph statistics
   */
  getStats(): {
    totalEntities: number;
    byType: Record<string, number>;
    totalFacts: number;
    avgConnections: number;
  } {
    const byType: Record<string, number> = {};
    let totalConnections = 0;

    for (const entity of this.entities.values()) {
      byType[entity.type] = (byType[entity.type] || 0) + 1;
      totalConnections += entity.connections.length;
    }

    return {
      totalEntities: this.entities.size,
      byType,
      totalFacts: this.facts.length,
      avgConnections: this.entities.size > 0 ? totalConnections / this.entities.size : 0,
    };
  }

  /**
   * Normalize name to ID
   */
  private normalizeId(name: string): string {
    return `ent_${name
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")}`;
  }

  /**
   * Spreading activation retrieval
   */
  private spreadingActivation(
    seedEntities: Entity[],
    relationships: RelationshipType[],
    maxHops: number
  ): Entity[] {
    const activated = new Map<string, number>();

    // Initialize with seed entities
    for (const entity of seedEntities) {
      activated.set(entity.id, entity.activationLevel);
    }

    // Spread activation through graph
    for (let hop = 0; hop < maxHops; hop++) {
      const newActivations = new Map<string, number>();

      for (const [id, level] of activated.entries()) {
        const entity = this.entities.get(id);
        if (!entity) continue;

        for (const conn of entity.connections) {
          if (relationships.includes(conn.relationship)) {
            const spreadAmount = level * conn.strength * 0.5;
            const current = newActivations.get(conn.targetId) || 0;
            newActivations.set(conn.targetId, Math.max(current, spreadAmount));
          }
        }
      }

      // Merge new activations
      for (const [id, level] of newActivations.entries()) {
        const current = activated.get(id) || 0;
        activated.set(id, Math.max(current, level));
      }
    }

    // Return entities above threshold
    const result: Entity[] = [];
    for (const [id, level] of activated.entries()) {
      if (level >= this.ACTIVATION_THRESHOLD) {
        const entity = this.entities.get(id);
        if (entity) {
          result.push(entity);
        }
      }
    }

    return result;
  }

  /**
   * Merge similar entities (simple heuristic)
   */
  private async mergeSimilarEntities(): Promise<number> {
    let merged = 0;
    const processed = new Set<string>();

    for (const [id1, entity1] of this.entities.entries()) {
      if (processed.has(id1)) continue;

      for (const [id2, entity2] of this.entities.entries()) {
        if (id1 === id2 || processed.has(id2)) continue;

        // Check if same name (case-insensitive)
        if (entity1.name.toLowerCase() === entity2.name.toLowerCase()) {
          // Merge entity2 into entity1
          entity1.properties = { ...entity1.properties, ...entity2.properties };
          entity1.connections.push(...entity2.connections);

          // Remove entity2
          this.entities.delete(id2);
          processed.add(id2);
          merged++;

          logger.debug(`[SemanticMemory] Merged duplicate: ${entity1.name}`);
          break;
        }
      }

      processed.add(id1);
    }

    return merged;
  }

  /**
   * Prune entities with low activation
   */
  private pruneLowActivationEntities(): number {
    let pruned = 0;

    for (const [id, entity] of this.entities.entries()) {
      if (entity.activationLevel < this.ACTIVATION_THRESHOLD) {
        // Check if connected to high-activation entities
        const hasImportantConnection = entity.connections.some((conn) => {
          const target = this.entities.get(conn.targetId);
          return target && target.activationLevel > 0.5 && conn.strength > 0.7;
        });

        if (!hasImportantConnection) {
          this.entities.delete(id);
          pruned++;
        }
      }
    }

    return pruned;
  }
}
