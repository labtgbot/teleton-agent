/**
 * Super-Agent Dashboard API Routes
 * 
 * Эндпоинты для Dashboard Супер-Агента:
 * - GET /api/super-agent/status — общий статус (автономность, сознание, эмоции)
 * - PUT /api/super-agent/autonomy — изменение уровня автономности
 * - GET /api/super-agent/swarm — статус роя агентов
 * - GET /api/super-agent/swarm/debates — дебаты и консенсус в реальном времени
 * - GET /api/super-agent/memory/stats — статистика памяти
 * - GET /api/super-agent/memory/knowledge-graph — граф знаний
 * - GET /api/super-agent/memory/timeline — таймлайн событий
 * - GET /api/super-agent/memory/skills — выученные навыки
 * - GET /api/super-agent/dao/proposals — предложения DAO
 * - POST /api/super-agent/dao/vote — голосование DAO
 * - GET /api/super-agent/constitution — настройки конституции
 * - PUT /api/super-agent/constitution — обновление конституции
 */

import { Hono } from "hono";
import type { WebUIServerDeps, APIResponse } from "../types.js";
import { getErrorMessage } from "../../utils/errors.js";
import { getAutonomyManager, type AutonomyLevel } from "../../autonomous/autonomy-levels.js";
import { eqModule } from "../../autonomous/emotional-intelligence.js";
import { DaoIntegrationModule } from "../../autonomous/dao-integration.js";

export function createSuperAgentRoutes(deps: WebUIServerDeps) {
  const app = new Hono();
  const autonomyManager = getAutonomyManager();

  // ── Status Endpoint ────────────────────────────────────────────────────
  
  // GET /api/super-agent/status
  app.get("/status", (c) => {
    try {
      const autonomyMetrics = autonomyManager.getMetrics();
      const agentMood = eqModule.getAgentMood();
      
      // Определяем активный уровень сознания на основе текущей задачи
      const consciousnessLevel = deps.autonomousManager?.getCurrentConsciousnessLevel() ?? 'REACTIVE';
      
      const data = {
        autonomy: {
          currentLevel: autonomyManager.getLevel(),
          metrics: autonomyMetrics,
          pendingApprovals: autonomyManager.getPendingApprovals().length,
        },
        consciousness: {
          level: consciousnessLevel,
          description: getConsciousnessDescription(consciousnessLevel),
        },
        emotions: {
          primary: agentMood.primary,
          intensity: agentMood.intensity,
          valence: agentMood.valence,
          arousal: agentMood.arousal,
          timestamp: agentMood.timestamp,
        },
        timestamp: Date.now(),
      };
      
      const response: APIResponse<typeof data> = { success: true, data };
      return c.json(response);
    } catch (err) {
      const response: APIResponse = { success: false, error: getErrorMessage(err) };
      return c.json(response, 500);
    }
  });

  // ── Autonomy Level Management ─────────────────────────────────────────
  
  // PUT /api/super-agent/autonomy
  app.put("/autonomy", async (c) => {
    try {
      const body = await c.req.json<{ level: AutonomyLevel; reason?: string }>();
      
      if (!body.level) {
        return c.json({ success: false, error: "level is required" } as APIResponse, 400);
      }
      
      const previousLevel = autonomyManager.getLevel();
      autonomyManager.setLevel(body.level, body.reason || "User requested via dashboard");
      
      const data = {
        previousLevel,
        newLevel: body.level,
        reason: body.reason,
        timestamp: Date.now(),
      };
      
      const response: APIResponse<typeof data> = { success: true, data };
      return c.json(response);
    } catch (err) {
      const response: APIResponse = { success: false, error: getErrorMessage(err) };
      return c.json(response, 500);
    }
  });

  // GET /api/super-agent/autonomy — текущий уровень
  app.get("/autonomy", (c) => {
    try {
      const currentLevel = autonomyManager.getLevel();
      const metrics = autonomyManager.getMetrics();
      const pendingApprovals = autonomyManager.getPendingApprovals();
      
      const data = {
        currentLevel,
        metrics,
        pendingApprovals,
      };
      
      const response: APIResponse<typeof data> = { success: true, data };
      return c.json(response);
    } catch (err) {
      const response: APIResponse = { success: false, error: getErrorMessage(err) };
      return c.json(response, 500);
    }
  });

  // ── Swarm Status ───────────────────────────────────────────────────────
  
  // GET /api/super-agent/swarm
  app.get("/swarm", (c) => {
    try {
      // Если swarm coordinator доступен через deps
      const swarm = deps.swarmCoordinator;
      
      if (!swarm) {
        // Возвращаем mock данные если swarm не инициализирован
        const mockData = {
          enabled: true,
          agents: [
            { id: 'agent_orchestrator', role: 'orchestrator', status: 'idle', currentTask: null },
            { id: 'agent_researcher', role: 'researcher', status: 'busy', currentTask: 'task_123' },
            { id: 'agent_planner', role: 'planner', status: 'idle', currentTask: null },
            { id: 'agent_executor', role: 'executor', status: 'busy', currentTask: 'task_124' },
            { id: 'agent_critic', role: 'critic', status: 'waiting', currentTask: null },
            { id: 'agent_security', role: 'security', status: 'idle', currentTask: null },
            { id: 'agent_communicator', role: 'communicator', status: 'idle', currentTask: null },
            { id: 'agent_learner', role: 'learner', status: 'busy', currentTask: 'task_125' },
          ],
          activeProposals: 0,
          metrics: {
            totalTasks: 0,
            completedTasks: 0,
            successRate: 0,
            avgConsensusTime: 0,
          },
        };
        const response: APIResponse<typeof mockData> = { success: true, data: mockData };
        return c.json(response);
      }
      
      const metrics = swarm.getMetrics();
      const agents = Array.from((swarm as any).agents?.values() || []).map((a: any) => ({
        id: a.id,
        role: a.role,
        status: a.status,
        currentTask: a.currentTask ? a.currentTask.id : null,
      }));
      
      const data = {
        enabled: true,
        agents,
        activeProposals: Array.from((swarm as any).proposals?.values() || [])
          .filter((p: any) => p.status === 'active').length,
        metrics,
      };
      
      const response: APIResponse<typeof data> = { success: true, data };
      return c.json(response);
    } catch (err) {
      const response: APIResponse = { success: false, error: getErrorMessage(err) };
      return c.json(response, 500);
    }
  });

  // GET /api/super-agent/swarm/debates — активные дебаты и голосования
  app.get("/swarm/debates", (c) => {
    try {
      const swarm = deps.swarmCoordinator;
      
      if (!swarm) {
        const mockData = {
          activeDebates: [],
          recentConsensus: [],
        };
        const response: APIResponse<typeof mockData> = { success: true, data: mockData };
        return c.json(response);
      }
      
      // Получаем активные proposals
      const proposals = Array.from((swarm as any).proposals?.values() || [])
        .filter((p: any) => ['active', 'voting', 'debate'].includes(p.status))
        .map((p: any) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          proposer: p.proposer,
          status: p.status,
          votes: p.votes?.length || 0,
          createdAt: p.createdAt,
          expiresAt: p.expiresAt,
        }));
      
      // Получаем последние завершенные голосования
      const recentConsensus = Array.from((swarm as any).proposals?.values() || [])
        .filter((p: any) => ['accepted', 'rejected'].includes(p.status))
        .slice(-10)
        .map((p: any) => ({
          id: p.id,
          title: p.title,
          result: p.status,
          consensusMethod: p.requiredConsensus,
          timestamp: p.createdAt,
        }));
      
      const data = {
        activeDebates: proposals,
        recentConsensus,
      };
      
      const response: APIResponse<typeof data> = { success: true, data };
      return c.json(response);
    } catch (err) {
      const response: APIResponse = { success: false, error: getErrorMessage(err) };
      return c.json(response, 500);
    }
  });

  // ── Memory Management ──────────────────────────────────────────────────
  
  // GET /api/super-agent/memory/stats
  app.get("/memory/stats", (c) => {
    try {
      const db = deps.memory.db;
      
      // Эпизодическая память
      const episodicCount = (
        db.prepare("SELECT COUNT(*) as count FROM episodic_memories").get() as { count: number }
      )?.count ?? 0;
      
      // Семантическая память (граф знаний)
      const semanticEntities = (
        db.prepare("SELECT COUNT(*) as count FROM semantic_entities").get() as { count: number }
      )?.count ?? 0;
      const semanticRelationships = (
        db.prepare("SELECT COUNT(*) as count FROM semantic_relationships").get() as { count: number }
      )?.count ?? 0;
      
      // Процедурная память (навыки)
      const proceduralSkills = (
        db.prepare("SELECT COUNT(*) as count FROM procedural_skills").get() as { count: number }
      )?.count ?? 0;
      
      const data = {
        episodic: {
          events: episodicCount,
        },
        semantic: {
          entities: semanticEntities,
          relationships: semanticRelationships,
        },
        procedural: {
          skills: proceduralSkills,
        },
      };
      
      const response: APIResponse<typeof data> = { success: true, data };
      return c.json(response);
    } catch (err) {
      const response: APIResponse = { success: false, error: getErrorMessage(err) };
      return c.json(response, 500);
    }
  });

  // GET /api/super-agent/memory/knowledge-graph
  app.get("/memory/knowledge-graph", (c) => {
    try {
      const db = deps.memory.db;
      const limit = parseInt(c.req.query("limit") || "100", 10);
      
      // Получаем сущности и связи для визуализации графа
      const entities = db
        .prepare("SELECT id, name, type, metadata FROM semantic_entities LIMIT ?")
        .all(limit) as Array<{ id: string; name: string; type: string; metadata: string | null }>;
      
      const relationships = db
        .prepare(`
          SELECT sr.id, sr.source_id, sr.target_id, sr.type, sr.weight, se1.name as source_name, se2.name as target_name
          FROM semantic_relationships sr
          JOIN semantic_entities se1 ON sr.source_id = se1.id
          JOIN semantic_entities se2 ON sr.target_id = se2.id
          LIMIT ?
        `)
        .all(limit) as Array<{
          id: string;
          source_id: string;
          target_id: string;
          type: string;
          weight: number;
          source_name: string;
          target_name: string;
        }>;
      
      const data = {
        nodes: entities.map(e => ({
          id: e.id,
          label: e.name,
          type: e.type,
          metadata: e.metadata ? JSON.parse(e.metadata) : null,
        })),
        edges: relationships.map(r => ({
          id: r.id,
          source: r.source_id,
          target: r.target_id,
          label: r.type,
          weight: r.weight,
        })),
      };
      
      const response: APIResponse<typeof data> = { success: true, data };
      return c.json(response);
    } catch (err) {
      const response: APIResponse = { success: false, error: getErrorMessage(err) };
      return c.json(response, 500);
    }
  });

  // GET /api/super-agent/memory/timeline
  app.get("/memory/timeline", (c) => {
    try {
      const db = deps.memory.db;
      const limit = parseInt(c.req.query("limit") || "50", 10);
      const offset = parseInt(c.req.query("offset") || "0", 10);
      
      const events = db
        .prepare(`
          SELECT id, event_type, description, emotional_weight, importance, tags, timestamp
          FROM episodic_memories
          ORDER BY timestamp DESC
          LIMIT ? OFFSET ?
        `)
        .all(limit, offset) as Array<{
          id: string;
          event_type: string;
          description: string;
          emotional_weight: number;
          importance: number;
          tags: string;
          timestamp: number;
        }>;
      
      const data = {
        events: events.map(e => ({
          id: e.id,
          type: e.event_type,
          description: e.description,
          emotionalWeight: e.emotional_weight,
          importance: e.importance,
          tags: e.tags ? JSON.parse(e.tags) : [],
          timestamp: e.timestamp,
        })),
        total: (db.prepare("SELECT COUNT(*) as count FROM episodic_memories").get() as { count: number }).count,
      };
      
      const response: APIResponse<typeof data> = { success: true, data };
      return c.json(response);
    } catch (err) {
      const response: APIResponse = { success: false, error: getErrorMessage(err) };
      return c.json(response, 500);
    }
  });

  // GET /api/super-agent/memory/skills
  app.get("/memory/skills", (c) => {
    try {
      const db = deps.memory.db;
      
      const skills = db
        .prepare(`
          SELECT id, name, category, steps, success_rate, executions_count, last_executed
          FROM procedural_skills
          ORDER BY success_rate DESC, executions_count DESC
          LIMIT 100
        `)
        .all() as Array<{
          id: string;
          name: string;
          category: string;
          steps: string;
          success_rate: number;
          executions_count: number;
          last_executed: number;
        }>;
      
      const data = {
        skills: skills.map(s => ({
          id: s.id,
          name: s.name,
          category: s.category,
          steps: s.steps ? JSON.parse(s.steps) : [],
          successRate: s.success_rate,
          executionsCount: s.executions_count,
          lastExecuted: s.last_executed,
        })),
      };
      
      const response: APIResponse<typeof data> = { success: true, data };
      return c.json(response);
    } catch (err) {
      const response: APIResponse = { success: false, error: getErrorMessage(err) };
      return c.json(response, 500);
    }
  });

  // ── DAO & Governance ───────────────────────────────────────────────────
  
  // GET /api/super-agent/dao/proposals
  app.get("/dao/proposals", async (c) => {
    try {
      // Используем DAO integration module
      const daoModule = new DaoIntegrationModule(
        (deps as any).tonClient,
        (deps as any).walletAddress || "EQC...mock"
      );
      
      // Получаем активные предложения (mock данные для демонстрации)
      const proposals = await daoModule.getActiveProposals([
        "EQC...dao1",
        "EQC...dao2"
      ]);
      
      const data = {
        proposals,
        summary: daoModule.getDaoActivitySummary(),
      };
      
      const response: APIResponse<typeof data> = { success: true, data };
      return c.json(response);
    } catch (err) {
      const response: APIResponse = { success: false, error: getErrorMessage(err) };
      return c.json(response, 500);
    }
  });

  // POST /api/super-agent/dao/vote
  app.post("/dao/vote", async (c) => {
    try {
      const body = await c.req.json<{
        proposalId: string;
        vote: 'for' | 'against' | 'abstain';
        rationale?: string;
      }>();
      
      if (!body.proposalId || !body.vote) {
        return c.json({ success: false, error: "proposalId and vote are required" } as APIResponse, 400);
      }
      
      // В реальной реализации здесь будет отправка транзакции
      const data = {
        success: true,
        proposalId: body.proposalId,
        vote: body.vote,
        rationale: body.rationale,
        txHash: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      };
      
      const response: APIResponse<typeof data> = { success: true, data };
      return c.json(response);
    } catch (err) {
      const response: APIResponse = { success: false, error: getErrorMessage(err) };
      return c.json(response, 500);
    }
  });

  // ── Constitution & Security ────────────────────────────────────────────
  
  // GET /api/super-agent/constitution
  app.get("/constitution", (c) => {
    try {
      const db = deps.memory.db;
      
      // Получаем настройки конституции из конфига или БД
      const configRow = db.prepare("SELECT value FROM config WHERE key = 'constitution'").get() as { value: string } | undefined;
      
      const constitution = configRow 
        ? JSON.parse(configRow.value)
        : {
            enabled: true,
            strictMode: true,
            principles: [
              { id: 'non_maleficence', name: 'Non-Maleficence', priority: 1, enabled: true },
              { id: 'privacy', name: 'Privacy & Confidentiality', priority: 1, enabled: true },
              { id: 'goal_achievement', name: 'Goal Achievement', priority: 2, enabled: true },
              { id: 'self_preservation', name: 'Self-Preservation', priority: 3, enabled: true },
              { id: 'continuous_improvement', name: 'Continuous Improvement', priority: 4, enabled: true },
            ],
            safetyLimits: {
              maxTONTransaction: 10,
              maxDailySpending: 50,
              restrictedTools: ['contract:deploy', 'system:exec'],
            },
          };
      
      const data = {
        constitution,
        autonomyLimits: {
          currentLevel: autonomyManager.getLevel(),
          ...AUTONOMY_LIMITS[autonomyManager.getLevel()],
        },
      };
      
      const response: APIResponse<typeof data> = { success: true, data };
      return c.json(response);
    } catch (err) {
      const response: APIResponse = { success: false, error: getErrorMessage(err) };
      return c.json(response, 500);
    }
  });

  // PUT /api/super-agent/constitution
  app.put("/constitution", async (c) => {
    try {
      const body = await c.req.json<{
        constitution?: any;
        safetyLimits?: {
          maxTONTransaction?: number;
          maxDailySpending?: number;
          restrictedTools?: string[];
        };
      }>();
      
      const db = deps.memory.db;
      
      // Сохраняем обновленную конституцию
      if (body.constitution) {
        db.prepare(`
          INSERT OR REPLACE INTO config (key, value, updated_at)
          VALUES ('constitution', ?, ?)
        `).run(JSON.stringify(body.constitution), Date.now());
      }
      
      // Обновляем лимиты безопасности
      if (body.safetyLimits) {
        db.prepare(`
          INSERT OR REPLACE INTO config (key, value, updated_at)
          VALUES ('safety_limits', ?, ?)
        `).run(JSON.stringify(body.safetyLimits), Date.now());
      }
      
      const data = {
        success: true,
        timestamp: Date.now(),
      };
      
      const response: APIResponse<typeof data> = { success: true, data };
      return c.json(response);
    } catch (err) {
      const response: APIResponse = { success: false, error: getErrorMessage(err) };
      return c.json(response, 500);
    }
  });

  return app;
}

// Helper функции
function getConsciousnessDescription(level: string): string {
  const descriptions: Record<string, string> = {
    REACTIVE: 'Быстрые инстинктивные ответы на простые запросы',
    TACTICAL: 'Краткосрочное планирование многошаговых задач',
    STRATEGIC: 'Долгосрочное стратегическое выравнивание целей',
    META_COGNITION: 'Самоанализ и оптимизация процессов обучения',
  };
  return descriptions[level] || 'Unknown consciousness level';
}

const AUTONOMY_LIMITS: Record<string, { maxTONTransaction: number; maxDailySpending: number }> = {
  LEVEL_0_MANUAL: { maxTONTransaction: 0, maxDailySpending: 0 },
  LEVEL_1_SUPERVISED: { maxTONTransaction: 0.5, maxDailySpending: 2 },
  LEVEL_2_SEMI_AUTONOMOUS: { maxTONTransaction: 2, maxDailySpending: 10 },
  LEVEL_3_FULLY_AUTONOMOUS: { maxTONTransaction: 10, maxDailySpending: 50 },
  LEVEL_4_GOD_MODE: { maxTONTransaction: Infinity, maxDailySpending: Infinity },
};
