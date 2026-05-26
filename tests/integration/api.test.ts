/**
 * Integration Tests for API Endpoints
 * 
 * These tests verify the interaction between API endpoints and underlying services
 * using mocked dependencies to ensure isolation and reliability.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Hono } from 'hono';

// Мокируем все тяжелые зависимости перед импортом сервера
vi.mock('../../src/memory/hybrid-memory', () => {
  return {
    HybridMemory: vi.fn().mockImplementation(() => ({
      search: vi.fn().mockResolvedValue({ results: [], tookMs: 1 }),
      addObservation: vi.fn().mockResolvedValue(true),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      getRecentSessions: vi.fn().mockResolvedValue([]),
      compactSession: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

vi.mock('../../src/telegram/client', () => {
  return {
    TelegramClient: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      getMe: vi.fn().mockResolvedValue({ id: 12345, firstName: 'TestUser', username: 'test_user' }),
      sendMessage: vi.fn().mockResolvedValue({ id: 1, text: 'ok' }),
    })),
  };
});

vi.mock('../../src/ton/wallet-service', () => {
  return {
    WalletService: vi.fn().mockImplementation(() => ({
      getBalance: vi.fn().mockResolvedValue(BigInt(1000000000)),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

vi.mock('../../src/config/config-manager', () => {
  return {
    ConfigManager: vi.fn().mockImplementation(() => ({
      getConfig: vi.fn().mockReturnValue({
        agent: { name: 'Teleton', model: 'gpt-4o', autonomyLevel: 'LEVEL_1' },
        telegram: { phone: '+1234567890', policy: 'open' },
        ton: { endpoint: 'https://testnet.toncenter.com', network: 'testnet' },
        llm: { provider: 'openai', apiKey: 'test-key' },
      }),
      updateConfig: vi.fn().mockResolvedValue(true),
      load: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

vi.mock('../../src/autonomous/constitution', () => {
  return {
    Constitution: vi.fn().mockImplementation(() => ({
      directives: [
        { id: 1, text: 'Do no harm', priority: 1 },
        { id: 2, text: 'Follow user instructions', priority: 2 },
      ],
      checkDecision: vi.fn().mockResolvedValue({ approved: true, reason: 'Safe decision' }),
      logDecision: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

vi.mock('../../src/agent/tool-registry', () => {
  return {
    ToolRegistry: vi.fn().mockImplementation(() => ({
      getAllTools: vi.fn().mockReturnValue([
        { name: 'send_message', description: 'Send a Telegram message', scope: 'telegram' },
        { name: 'get_balance', description: 'Get TON wallet balance', scope: 'ton' },
        { name: 'search_memory', description: 'Search in memory', scope: 'memory' },
      ]),
      getToolByName: vi.fn().mockImplementation((name) => {
        const tools = [
          { name: 'send_message', description: 'Send a Telegram message', scope: 'telegram' },
          { name: 'get_balance', description: 'Get TON wallet balance', scope: 'ton' },
          { name: 'search_memory', description: 'Search in memory', scope: 'memory' },
        ];
        return tools.find(t => t.name === name);
      }),
    })),
  };
});

describe('Integration Tests: API Endpoints', () => {
  let app: Hono;
  let server: any;

  beforeAll(async () => {
    // Динамический импорт для применения моков
    const { createApp } = await import('../../src/api/server');
    app = await createApp();
    
    // Обертка для supertest
    server = {
      fetch: (req: Request) => app.fetch(req)
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    vi.resetAllMocks();
  });

  describe('GET /api/health', () => {
    it('должен возвращать статус 200 и ok: true', async () => {
      const res = await request(server as any)
        .get('/api/health')
        .send();
      
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('GET /api/agent/status', () => {
    it('должен возвращать статус агента и информацию о модели', async () => {
      const res = await request(server as any)
        .get('/api/agent/status')
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('model');
      expect(res.body.model).toBe('gpt-4o');
    });
  });

  describe('GET /api/tools/list', () => {
    it('должен возвращать список инструментов', async () => {
      const res = await request(server as any)
        .get('/api/tools/list')
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tools');
      expect(Array.isArray(res.body.tools)).toBe(true);
      expect(res.body.tools.length).toBeGreaterThan(0);
      expect(res.body.tools[0]).toHaveProperty('name');
      expect(res.body.tools[0]).toHaveProperty('description');
    });
  });

  describe('POST /api/memory/search', () => {
    it('должен выполнять поиск в памяти и возвращать результаты', async () => {
      const query = { text: 'тестовый запрос', limit: 5 };
      const res = await request(server as any)
        .post('/api/memory/search')
        .send(query);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
      expect(Array.isArray(res.body.results)).toBe(true);
    });

    it('должен обрабатывать пустой запрос', async () => {
      const query = { text: '' };
      const res = await request(server as any)
        .post('/api/memory/search')
        .send(query);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('results');
    });
  });

  describe('GET /api/autonomous/constitution', () => {
    it('должен возвращать конституцию агента', async () => {
      const res = await request(server as any)
        .get('/api/autonomous/constitution')
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('directives');
      expect(Array.isArray(res.body.directives)).toBe(true);
      expect(res.body.directives.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/config', () => {
    it('должен возвращать текущую конфигурацию', async () => {
      const res = await request(server as any)
        .get('/api/config')
        .send();

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('agent');
      expect(res.body.agent.name).toBe('Teleton');
      expect(res.body.agent.model).toBe('gpt-4o');
    });
  });

  describe('Error Handling', () => {
    it('должен возвращать 404 для несуществующего эндпоинта', async () => {
      const res = await request(server as any)
        .get('/api/nonexistent')
        .send();

      expect(res.status).toBe(404);
    });

    it('должен обрабатывать некорректный JSON в POST запросе', async () => {
      const res = await request(server as any)
        .post('/api/memory/search')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      // Ожидаем либо 400, либо обработку ошибки сервером
      expect([400, 500]).toContain(res.status);
    });
  });
});
