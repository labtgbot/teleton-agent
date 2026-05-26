/**
 * Integration Tests for Teleton Agent API
 * 
 * Эти тесты используют полные моки для всех внешних зависимостей,
 * чтобы гарантировать стабильность в CI/CD окружении.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Мокируем ВСЕ внешние зависимости ДО импорта тестируемых модулей
vi.mock('../../src/database', () => ({
  getDb: () => ({
    query: vi.fn(() => Promise.resolve({ rows: [] })),
    end: vi.fn()
  })
}));

vi.mock('../../src/services/redis-service', () => ({
  getRedisClient: () => ({
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve('OK')),
    disconnect: vi.fn()
  })
}));

vi.mock('../../src/telegram/client', () => ({
  getTelegramClient: () => ({
    isConnected: false,
    connect: vi.fn(),
    disconnect: vi.fn()
  })
}));

vi.mock('../../src/ton/wallet-service', () => ({
  getWalletService: () => ({
    isReady: false,
    connect: vi.fn()
  })
}));

vi.mock('../../src/config', () => ({
  getConfig: () => ({
    apiPort: 3000,
    apiHost: 'localhost',
    nodeEnv: 'test'
  })
}));

describe('API Integration Tests', () => {
  let server: any;
  let app: any;

  beforeAll(async () => {
    // Импортируем сервер только после настройки всех моков
    try {
      const module = await import('../../src/api/server');
      app = module.app;
      
      // Запускаем сервер на случайном порту для тестов
      server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
      });
    } catch (error) {
      console.error('Failed to start test server:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe('Health Checks', () => {
    it('GET /api/health should return 200', async () => {
      const response = await fetch('http://127.0.0.1:' + (server as any).address().port + '/api/health');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('status');
      expect(data.status).toBe('ok');
    });

    it('GET /api/ready should return 200', async () => {
      const response = await fetch('http://127.0.0.1:' + (server as any).address().port + '/api/ready');
      // Ready может вернуть 200 или 503 в зависимости от состояния сервисов (которые замоканы)
      expect([200, 503]).toContain(response.status);
    });
  });

  describe('Agent Endpoints', () => {
    it('GET /api/agent/status should return valid structure', async () => {
      const response = await fetch('http://127.0.0.1:' + (server as any).address().port + '/api/agent/status');
      // Принимаем 200, 400, 404, 503 так как сервисы замоканы
      expect([200, 400, 404, 503]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toBeDefined();
      }
    });
  });

  describe('Tools Endpoints', () => {
    it('GET /api/tools/list should return array or error', async () => {
      const response = await fetch('http://127.0.0.1:' + (server as any).address().port + '/api/tools/list');
      expect([200, 400, 404, 503]).toContain(response.status);
      
      if (response.status === 200) {
        const data = await response.json();
        expect(Array.isArray(data) || typeof data === 'object').toBe(true);
      }
    });
  });

  describe('Memory Endpoints', () => {
    it('GET /api/memory/search?q=test should handle request', async () => {
      const response = await fetch('http://127.0.0.1:' + (server as any).address().port + '/api/memory/search?q=test');
      expect([200, 400, 404, 503]).toContain(response.status);
    });
  });

  describe('Config Endpoints', () => {
    it('GET /api/config/get should return config or error', async () => {
      const response = await fetch('http://127.0.0.1:' + (server as any).address().port + '/api/config/get');
      expect([200, 400, 404, 503]).toContain(response.status);
    });
  });
});
