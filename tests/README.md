# Testing Guide

## 🧪 Overview

Teleton Agent uses a comprehensive testing strategy with three levels:

1. **Unit Tests** - Test individual components and functions
2. **Integration Tests** - Test interactions between modules
3. **E2E Tests** - Test complete user workflows in the browser

## 📋 Prerequisites

```bash
# Install dependencies
pnpm install

# Install Playwright browsers (for E2E tests)
pnpm exec playwright install
```

## 🚀 Running Tests

### Unit Tests

```bash
# Run all unit tests
pnpm test:unit

# Run with coverage
pnpm test:unit --coverage

# Run specific test file
pnpm test:unit tests/unit/constitution.test.ts

# Run in watch mode
pnpm test:unit --watch
```

### Integration Tests

```bash
# Run all integration tests
pnpm test:integration

# Run with verbose output
pnpm test:integration --verbose

# Run specific test suite
pnpm test:integration tests/integration/api.test.ts
```

### E2E Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run in UI mode (interactive)
pnpm test:e2e --ui

# Run specific browser
pnpm test:e2e --project=chromium

# Run with headed mode (visible browser)
pnpm test:e2e --headed

# Run specific test file
pnpm test:e2e tests/e2e/webui.spec.ts

# Run with codegen (record new tests)
pnpm exec playwright codegen http://localhost:3000
```

### All Tests

```bash
# Run all tests (unit + integration + e2e)
pnpm test

# Run CI pipeline locally
pnpm test:ci
```

## 📊 Coverage Reports

```bash
# Generate coverage report
pnpm test:unit --coverage

# Open coverage report in browser
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

### Coverage Goals

| Metric | Goal | Current |
|--------|------|---------|
| Statements | >80% | TBD |
| Branches | >75% | TBD |
| Functions | >85% | TBD |
| Lines | >80% | TBD |

## 🔧 Test Configuration

### Vitest (Unit/Integration)

Configuration in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*'
      ]
    }
  }
})
```

### Playwright (E2E)

Configuration in `playwright.config.ts`:

```typescript
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 2,
  workers: 4,
  reporter: [['html'], ['list']],
  use: {
    headless: true,
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ]
})
```

## 📁 Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── constitution.test.ts
│   ├── autonomy-levels.test.ts
│   ├── memory.test.ts
│   └── tools.test.ts
├── integration/             # Integration tests
│   ├── api.test.ts
│   ├── telegram.test.ts
│   ├── ton.test.ts
│   └── database.test.ts
├── e2e/                     # E2E tests
│   ├── webui.spec.ts
│   ├── auth.spec.ts
│   └── workflows.spec.ts
├── fixtures/                # Test fixtures and mocks
│   ├── telegram-mock.ts
│   ├── ton-mock.ts
│   └── test-data.json
└── setup.ts                 # Global test setup
```

## 🎯 Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { Constitution } from '../src/autonomous/constitution';

describe('Constitution', () => {
  it('should validate actions correctly', () => {
    const constitution = new Constitution();
    const action = { type: 'send_message', content: 'Hello' };
    
    const result = constitution.validateAction(action);
    expect(result.approved).toBe(true);
  });
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test('should create a new task', async ({ page }) => {
  await page.goto('http://localhost:3000/tasks');
  
  await page.click('[data-testid="create-task"]');
  await page.fill('[name="title"]', 'Test Task');
  await page.click('[type="submit"]');
  
  await expect(page.locator('text=Task created')).toBeVisible();
});
```

## 🔍 Debugging Tests

### Unit Tests

```bash
# Run with debug output
pnpm test:unit --reporter=verbose

# Run with node inspector
node --inspect-brk node_modules/.bin/vitest run
```

### E2E Tests

```bash
# Run in UI mode (Playwright Inspector)
pnpm test:e2e --ui

# Run with headed browser
pnpm test:e2e --headed

# Run with slowmo (slow motion)
pnpm test:e2e --debug
```

## 🌐 CI/CD Integration

Tests automatically run on GitHub Actions:

- **On Push**: Lint, Type Check, Unit Tests
- **On PR**: All tests including E2E
- **On Main**: Full pipeline + Docker build

See `.github/workflows/ci-cd.yml` for configuration.

## 📈 Best Practices

1. **Test Isolation**: Each test should be independent
2. **Descriptive Names**: Use clear test and describe names
3. **AAA Pattern**: Arrange, Act, Assert
4. **Mock External Services**: Don't call real APIs in unit tests
5. **Use Data Attributes**: For E2E tests, use `data-testid` attributes
6. **Cleanup**: Always clean up after tests (database, files, etc.)
7. **Parallel Execution**: Design tests to run in parallel when possible

## 🆘 Troubleshooting

### Common Issues

**Tests failing due to database connection:**
```bash
# Ensure test database is running
docker-compose up -d postgres-test
```

**Playwright browsers not found:**
```bash
pnpm exec playwright install
```

**Tests timing out:**
```bash
# Increase timeout
pnpm test:e2e --timeout=60000
```

**Flaky tests:**
```bash
# Run multiple times to identify flakiness
pnpm test:e2e --repeat-each=10
```

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Martin Fowler - Test Pyramid](https://martinfowler.com/bliki/TestPyramid.html)
