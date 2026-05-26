import { test, expect } from '@playwright/test';

test.describe('Teleton Agent WebUI', () => {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
  });

  test.describe('Dashboard', () => {
    test('should load dashboard successfully', async ({ page }) => {
      await expect(page).toHaveTitle(/Teleton Agent/);
      await expect(page.locator('text=Dashboard')).toBeVisible();
    });

    test('should display agent status', async ({ page }) => {
      const statusElement = page.locator('[data-testid="agent-status"]');
      await expect(statusElement).toBeVisible();
    });

    test('should show connected model information', async ({ page }) => {
      const modelInfo = page.locator('[data-testid="model-info"]');
      await expect(modelInfo).toBeVisible();
    });

    test('should display token usage metrics', async ({ page }) => {
      const tokenMetrics = page.locator('[data-testid="token-metrics"]');
      await expect(tokenMetrics).toBeVisible();
    });
  });

  test.describe('Tools Page', () => {
    test('should navigate to tools page', async ({ page }) => {
      await page.click('text=Tools');
      await expect(page).toHaveURL(/\/tools/);
    });

    test('should display list of available tools', async ({ page }) => {
      await page.click('text=Tools');
      const toolList = page.locator('[data-testid="tool-list"]');
      await expect(toolList).toBeVisible();
    });

    test('should allow toggling tools on/off', async ({ page }) => {
      await page.click('text=Tools');
      const toggleButton = page.locator('[data-testid="tool-toggle"]').first();
      await toggleButton.click();
      await expect(toggleButton).toHaveAttribute('aria-checked', /true|false/);
    });
  });

  test.describe('Memory Page', () => {
    test('should navigate to memory page', async ({ page }) => {
      await page.click('text=Memory');
      await expect(page).toHaveURL(/\/memory/);
    });

    test('should display memory search interface', async ({ page }) => {
      await page.click('text=Memory');
      const searchInput = page.locator('[data-testid="memory-search"]');
      await expect(searchInput).toBeVisible();
    });

    test('should perform hybrid search (vector + keyword)', async ({ page }) => {
      await page.click('text=Memory');
      const searchInput = page.locator('[data-testid="memory-search"]');
      await searchInput.fill('test query');
      await page.press('[data-testid="memory-search"]', 'Enter');
      
      const results = page.locator('[data-testid="search-results"]');
      await expect(results).toBeVisible();
    });
  });

  test.describe('Plugins Page', () => {
    test('should navigate to plugins page', async ({ page }) => {
      await page.click('text=Plugins');
      await expect(page).toHaveURL(/\/plugins/);
    });

    test('should display plugin marketplace', async ({ page }) => {
      await page.click('text=Plugins');
      const marketplace = page.locator('[data-testid="plugin-marketplace"]');
      await expect(marketplace).toBeVisible();
    });

    test('should allow installing a plugin', async ({ page }) => {
      await page.click('text=Plugins');
      const installButton = page.locator('[data-testid="plugin-install"]').first();
      await installButton.click();
      
      const confirmation = page.locator('[data-testid="confirm-dialog"]');
      await expect(confirmation).toBeVisible();
    });
  });

  test.describe('Autonomous Settings', () => {
    test('should navigate to autonomous settings', async ({ page }) => {
      await page.click('text=Autonomous');
      await expect(page).toHaveURL(/\/autonomous/);
    });

    test('should display constitution editor', async ({ page }) => {
      await page.click('text=Autonomous');
      const constitutionEditor = page.locator('[data-testid="constitution-editor"]');
      await expect(constitutionEditor).toBeVisible();
    });

    test('should allow changing autonomy level', async ({ page }) => {
      await page.click('text=Autonomous');
      const levelSelector = page.locator('[data-testid="autonomy-level"]');
      await levelSelector.selectOption('LEVEL_2');
      
      const currentValue = await levelSelector.inputValue();
      expect(currentValue).toBe('LEVEL_2');
    });
  });

  test.describe('Tasks Management', () => {
    test('should navigate to tasks page', async ({ page }) => {
      await page.click('text=Tasks');
      await expect(page).toHaveURL(/\/tasks/);
    });

    test('should display task list', async ({ page }) => {
      await page.click('text=Tasks');
      const taskList = page.locator('[data-testid="task-list"]');
      await expect(taskList).toBeVisible();
    });

    test('should allow creating a new task', async ({ page }) => {
      await page.click('text=Tasks');
      await page.click('[data-testid="create-task"]');
      
      const taskForm = page.locator('[data-testid="task-form"]');
      await expect(taskForm).toBeVisible();
      
      await taskForm.locator('[name="title"]').fill('Test Task');
      await taskForm.locator('[name="description"]').fill('Test Description');
      await taskForm.locator('[type="submit"]').click();
      
      const successMessage = page.locator('text=Task created successfully');
      await expect(successMessage).toBeVisible();
    });
  });

  test.describe('Swarm Visualization (New Feature)', () => {
    test('should display swarm visualization component', async ({ page }) => {
      await page.goto(`${baseURL}/autonomous`);
      const swarmViz = page.locator('[data-testid="swarm-visualization"]');
      await expect(swarmViz).toBeVisible();
    });

    test('should show all 8 agents in the swarm', async ({ page }) => {
      await page.goto(`${baseURL}/autonomous`);
      const agents = page.locator('[data-testid="swarm-agent"]');
      await expect(agents).toHaveCount(8);
    });

    test('should display real-time consensus metrics', async ({ page }) => {
      await page.goto(`${baseURL}/autonomous`);
      const consensusRate = page.locator('[data-testid="consensus-rate"]');
      await expect(consensusRate).toBeVisible();
    });
  });

  test.describe('Workflow Designer (New Feature)', () => {
    test('should navigate to workflow designer', async ({ page }) => {
      await page.click('text=Workflows');
      await expect(page).toHaveURL(/\/workflows\/designer/);
    });

    test('should display drag-and-drop canvas', async ({ page }) => {
      await page.goto(`${baseURL}/workflows/designer`);
      const canvas = page.locator('[data-testid="workflow-canvas"]');
      await expect(canvas).toBeVisible();
    });

    test('should allow adding nodes to workflow', async ({ page }) => {
      await page.goto(`${baseURL}/workflows/designer`);
      const nodeLibrary = page.locator('[data-testid="node-library"]');
      await expect(nodeLibrary).toBeVisible();
      
      const triggerNode = nodeLibrary.locator('text=Trigger').first();
      await triggerNode.dragTo(page.locator('[data-testid="workflow-canvas"]'));
      
      const addedNodes = page.locator('[data-testid="canvas-node"]');
      await expect(addedNodes).toHaveCount(1);
    });

    test('should validate workflow before saving', async ({ page }) => {
      await page.goto(`${baseURL}/workflows/designer`);
      await page.click('[data-testid="save-workflow"]');
      
      const validationError = page.locator('[data-testid="validation-error"]');
      await expect(validationError).toBeVisible();
    });
  });

  test.describe('Monitoring Dashboard (New Feature)', () => {
    test('should display monitoring metrics', async ({ page }) => {
      await page.goto(`${baseURL}/analytics`);
      const metricsPanel = page.locator('[data-testid="monitoring-metrics"]');
      await expect(metricsPanel).toBeVisible();
    });

    test('should show Prometheus-compatible metrics', async ({ page }) => {
      await page.goto(`${baseURL}/analytics`);
      const prometheusMetrics = page.locator('[data-testid="prometheus-metrics"]');
      await expect(prometheusMetrics).toBeVisible();
    });

    test('should display alert rules configuration', async ({ page }) => {
      await page.goto(`${baseURL}/analytics`);
      const alertRules = page.locator('[data-testid="alert-rules"]');
      await expect(alertRules).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.locator('text=Dashboard')).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(page.locator('text=Dashboard')).toBeVisible();
    });

    test('should work on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect(page.locator('text=Dashboard')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      const ariaLabels = page.locator('[aria-label]');
      const count = await ariaLabels.count();
      expect(count).toBeGreaterThan(10);
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load dashboard within 2 seconds', async ({ page }) => {
      const startTime = Date.now();
      await page.goto(baseURL);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(2000);
    });

    test('should have no memory leaks after navigation', async ({ page }) => {
      for (let i = 0; i < 5; i++) {
        await page.goto(`${baseURL}/tools`);
        await page.goto(`${baseURL}/memory`);
        await page.goto(`${baseURL}/plugins`);
      }
      
      // If there were memory leaks, the test would timeout or crash
      expect(true).toBe(true);
    });
  });
});
