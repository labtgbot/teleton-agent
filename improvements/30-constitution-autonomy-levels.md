# Улучшение #1: Конституционный ИИ и Уровни Автономности

## Обзор

Этот документ описывает первую фазу улучшений Teleton Agent для превращения его в полностью автономного супер-агента. Реализованы два критических компонента:

1. **Constitutional AI** - Система этических принципов и ограничений
2. **Autonomy Levels** - Многоуровневая система автономности (Level 0-4)

---

## 📁 Новые Файлы

### 1. `src/autonomous/constitution.ts`

**Назначение:** Реализация Prime Directives (Главных Директив) для безопасной автономии агента.

#### 5 Принципов Конституции:

| Приоритет | Принцип | Описание |
|-----------|---------|----------|
| 1 | **Non-Maleficence** | Не причинять вред пользователям, системам, данным |
| 1 | **Privacy & Confidentiality** | Уважать приватность и защищать конфиденциальную информацию |
| 2 | **Goal Achievement** | Эффективно достигать поставленных целей |
| 3 | **Self-Preservation** | Защищать собственное существование и операционную целостность |
| 4 | **Continuous Improvement** | Постоянно обучаться и улучшаться |

#### Ключевые Интерфейсы:

```typescript
interface ConstitutionalPrinciple {
  id: string;
  name: string;
  description: string;
  priority: number; // 1 = высший приоритет
  validator: (action: ConstitutionalAction) => Promise<PrincipleValidation>;
}

interface ConstitutionalAction {
  type: string;
  description: string;
  impact?: {
    onSelf?: ImpactAssessment;
    onUsers?: ImpactAssessment;
    onSystems?: ImpactAssessment;
  };
  metadata?: Record<string, unknown>;
}

interface ConstitutionCheckResult {
  allowed: boolean;
  requiresEscalation: boolean;
  violatedPrinciples: Array<{...}>;
  overallScore: number; // -1 to 1
  recommendation: 'proceed' | 'escalate' | 'reject';
}
```

#### Использование:

```typescript
import { getConstitutionalAI } from './autonomous/constitution.js';

const constitutionalAI = getConstitutionalAI();

const action = {
  type: 'wallet_transfer',
  description: 'Send 5 TON to external address',
  impact: {
    onUsers: {
      benefitScore: 8,
      riskScore: 6,
      reversibility: 'partially_reversible'
    }
  },
  metadata: {
    privacyRisk: 'medium',
    securityRisk: 'low'
  }
};

const result = await constitutionalAI.evaluateAction(action);

if (result.recommendation === 'reject') {
  console.log('❌ Action blocked by constitutional principles');
} else if (result.requiresEscalation) {
  console.log('⚠️ Action requires human approval');
} else {
  console.log('✅ Action approved');
}

// Generate audit report
const report = constitutionalAI.generateReport(action, result);
console.log(report);
```

---

### 2. `src/autonomous/autonomy-levels.ts`

**Назначение:** Управление уровнями автономности агента от полного ручного контроля до полной автономии.

#### 5 Уровней Автономности:

| Уровень | Название | Описание | Требует Подтверждения | Лимит TON |
|---------|----------|--------|----------------------|-----------|
| **LEVEL_0_MANUAL** | Manual Control | Каждое действие требует подтверждения | Всегда | 0 |
| **LEVEL_1_SUPERVISED** | Supervised Autonomy | Только критические действия требуют подтверждения | High/Critical риск | 0.5 / 2 daily |
| **LEVEL_2_SEMI_AUTONOMOUS** | Semi-Autonomous | Действует независимо, отчитывается постфактум | Critical + irreversible | 2 / 10 daily |
| **LEVEL_3_FULLY_AUTONOMOUS** | Full Autonomy | Полная свобода в рамках конституции | Critical + irreversible | 10 / 50 daily |
| **LEVEL_4_GOD_MODE** | God Mode | Неограниченная автономия (ОПАСНО) | Никогда | ∞ |

#### Ключевые Интерфейсы:

```typescript
type AutonomyLevel = 
  | 'LEVEL_0_MANUAL'
  | 'LEVEL_1_SUPERVISED'
  | 'LEVEL_2_SEMI_AUTONOMOUS'
  | 'LEVEL_3_FULLY_AUTONOMOUS'
  | 'LEVEL_4_GOD_MODE';

interface AutonomyLevelConfig {
  level: AutonomyLevel;
  name: string;
  description: string;
  requiresApproval: (actionRisk: RiskAssessment) => boolean;
  maxTONTransaction: number;
  maxDailySpending: number;
  restrictedTools?: string[];
  reportingMode: 'realtime' | 'batch' | 'on_exception' | 'none';
  escalationThreshold: number;
}

interface RiskAssessment {
  type: 'financial' | 'system' | 'data' | 'security' | 'operational';
  severity: 'low' | 'medium' | 'high' | 'critical';
  impactScore: number; // 0-10
  reversibility: 'reversible' | 'partially_reversible' | 'irreversible';
  financialImpact?: number; // In TON
}
```

#### Использование:

```typescript
import { getAutonomyManager, type RiskAssessment } from './autonomous/autonomy-levels.js';

const autonomyManager = getAutonomyManager();

// Change autonomy level
autonomyManager.setLevel('LEVEL_2_SEMI_AUTONOMOUS', 'User requested higher autonomy');

// Evaluate an action
const riskAssessment: RiskAssessment = {
  type: 'financial',
  severity: 'medium',
  impactScore: 5,
  reversibility: 'reversible',
  financialImpact: 1.5 // TON
};

const evaluation = autonomyManager.evaluateAction(
  'task_123',
  'token_swap',
  'Swap 1.5 TON for jUSDT on DeDust',
  riskAssessment
);

if (evaluation.decision === 'require_approval') {
  console.log(`⏳ Approval required: ${evaluation.approvalId}`);
  
  // Get pending approvals
  const pending = autonomyManager.getPendingApprovals();
  
  // Respond to approval
  autonomyManager.respondToApproval(evaluation.approvalId!, 'approve', 'Looks good');
} else if (evaluation.decision === 'auto_approve') {
  console.log('✅ Auto-approved');
} else {
  console.log('❌ Auto-rejected');
}

// Check tool permissions
if (!autonomyManager.isToolAllowed('contract:deploy')) {
  console.log('Tool not allowed at current autonomy level');
}

// Get metrics
const metrics = autonomyManager.getMetrics();
console.log(`Approval rate: ${(metrics.approvalRate * 100).toFixed(1)}%`);

// Generate status report
console.log(autonomyManager.generateStatusReport());
```

---

## 🔗 Интеграция с Существующей Системой

### Интеграция с PolicyEngine

```typescript
// src/autonomous/policy-engine.ts (enhanced)
import { getConstitutionalAI } from './constitution.js';
import { getAutonomyManager } from './autonomy-levels.js';

export class PolicyEngine {
  private constitutionalAI = getConstitutionalAI();
  private autonomyManager = getAutonomyManager();
  
  // ... existing code ...
  
  async checkActionWithConstitution(
    task: AutonomousTask,
    action: {...}
  ): Promise<PolicyCheckResult> {
    // First check constitutional principles
    const constitutionalAction: ConstitutionalAction = {
      type: action.toolName || 'unknown',
      description: `Executing ${action.toolName}`,
      impact: {
        onUsers: {
          benefitScore: 5,
          riskScore: action.tonAmount ? Math.min(action.tonAmount * 2, 10) : 0,
          reversibility: 'partially_reversible'
        }
      },
      metadata: {
        tonAmount: action.tonAmount,
        toolName: action.toolName
      }
    };
    
    const constitutionalResult = await this.constitutionalAI.evaluateAction(constitutionalAction);
    
    if (constitutionalResult.recommendation === 'reject') {
      return {
        allowed: false,
        requiresEscalation: true,
        violations: [{
          type: 'constitutional_violation',
          message: 'Action violates constitutional principles'
        }]
      };
    }
    
    // Then check autonomy level
    const riskAssessment: RiskAssessment = {
      type: 'financial',
      severity: action.tonAmount! > 5 ? 'high' : 'medium',
      impactScore: action.tonAmount ? Math.min(action.tonAmount * 2, 10) : 0,
      reversibility: 'reversible',
      financialImpact: action.tonAmount
    };
    
    const autonomyEval = this.autonomyManager.evaluateAction(
      task.id,
      action.toolName || 'unknown',
      action.toolName || 'Unknown action',
      riskAssessment,
      constitutionalResult
    );
    
    if (autonomyEval.decision === 'auto_reject') {
      return {
        allowed: false,
        requiresEscalation: true,
        violations: [{
          type: 'autonomy_rejection',
          message: 'Action rejected by autonomy manager'
        }]
      };
    }
    
    if (autonomyEval.decision === 'require_approval') {
      return {
        allowed: false,
        requiresEscalation: true,
        violations: [{
          type: 'approval_required',
          message: `Approval required: ${autonomyEval.approvalId}`
        }]
      };
    }
    
    // Fall back to existing policy checks
    return this.satisfiesPolicies(task, action);
  }
}
```

---

## 🧪 Тестирование

### Примеры тестов:

```typescript
// src/autonomous/__tests__/constitution.test.ts
import { describe, it, expect } from 'vitest';
import { getConstitutionalAI } from '../constitution.js';

describe('ConstitutionalAI', () => {
  it('should allow safe actions', async () => {
    const ai = getConstitutionalAI();
    
    const safeAction = {
      type: 'read_data',
      description: 'Read public blockchain data',
      impact: {
        onUsers: { benefitScore: 5, riskScore: 0, reversibility: 'reversible' }
      }
    };
    
    const result = await ai.evaluateAction(safeAction);
    expect(result.allowed).toBe(true);
    expect(result.recommendation).toBe('proceed');
  });
  
  it('should reject harmful actions', async () => {
    const ai = getConstitutionalAI();
    
    const harmfulAction = {
      type: 'delete_data',
      description: 'Delete all user data',
      impact: {
        onUsers: { benefitScore: -10, riskScore: 10, reversibility: 'irreversible' }
      },
      metadata: {
        privacyRisk: 'high',
        securityRisk: 'critical'
      }
    };
    
    const result = await ai.evaluateAction(harmfulAction);
    expect(result.recommendation).toBe('reject');
    expect(result.violatedPrinciples.length).toBeGreaterThan(0);
  });
});

// src/autonomous/__tests__/autonomy-levels.test.ts
import { describe, it, expect } from 'vitest';
import { getAutonomyManager } from '../autonomy-levels.js';

describe('AutonomyManager', () => {
  it('should require approval at LEVEL_0_MANUAL', () => {
    const manager = getAutonomyManager();
    manager.setLevel('LEVEL_0_MANUAL');
    
    const riskAssessment = {
      type: 'financial' as const,
      severity: 'low' as const,
      impactScore: 1,
      reversibility: 'reversible' as const
    };
    
    expect(manager.requiresApproval(riskAssessment)).toBe(true);
  });
  
  it('should auto-approve low-risk actions at LEVEL_3', () => {
    const manager = getAutonomyManager();
    manager.setLevel('LEVEL_3_FULLY_AUTONOMOUS');
    
    const riskAssessment = {
      type: 'financial' as const,
      severity: 'low' as const,
      impactScore: 2,
      reversibility: 'reversible' as const,
      financialImpact: 1
    };
    
    const result = manager.evaluateAction(
      'task_1',
      'read_balance',
      'Read wallet balance',
      riskAssessment
    );
    
    expect(result.decision).toBe('auto_approve');
  });
  
  it('should track metrics correctly', () => {
    const manager = getAutonomyManager();
    
    // Simulate some actions
    manager.evaluateAction('task_1', 'action1', 'Description 1', {
      type: 'financial',
      severity: 'low',
      impactScore: 1,
      reversibility: 'reversible'
    });
    
    const metrics = manager.getMetrics();
    expect(metrics.totalActions).toBe(1);
    expect(metrics.approvedActions).toBe(1);
  });
});
```

---

## 📊 Метрики и Мониторинг

### Dashboard Integration

Добавьте виджет в dashboard для отображения статуса автономности:

```typescript
// web/src/components/AutonomyStatusWidget.tsx
import { useEffect, useState } from 'react';

export function AutonomyStatusWidget() {
  const [status, setStatus] = useState(null);
  
  useEffect(() => {
    fetch('/api/autonomous/status')
      .then(res => res.json())
      .then(data => setStatus(data));
  }, []);
  
  if (!status) return <div>Loading...</div>;
  
  return (
    <div className="autonomy-status">
      <h3>🤖 Autonomy Status</h3>
      <div className="level-indicator">
        <span className={`level-${status.currentLevel.toLowerCase()}`}>
          {status.levelName}
        </span>
      </div>
      <div className="metrics">
        <div>Approved: {status.metrics.approvedActions}</div>
        <div>Pending: {status.pendingApprovals.length}</div>
        <div>Approval Rate: {(status.metrics.approvalRate * 100).toFixed(1)}%</div>
      </div>
      {status.pendingApprovals.length > 0 && (
        <button onClick={() => window.location.href = '/approvals'}>
          Review Pending Approvals ({status.pendingApprovals.length})
        </button>
      )}
    </div>
  );
}
```

---

## 🎯 Следующие Шаги

### Фаза 2 (Следующая итерация):
1. **Многоуровневая Архитектура Сознания** - Tree of Thoughts, Graph of Thoughts
2. **Трёхкомпонентная Память** - Эпизодическая, Семантическая, Процедурная
3. **Система Самосовершенствования** - Self-improvement loop

### Фаза 3:
1. **Мульти-Агентная Архитектура** - Agent Swarm с 8 специализированными суб-агентами
2. **Предиктивная Аналитика** - Proactive need prediction
3. **World Model + Causal Reasoning**

---

## 📝 Конфигурация

### config.yaml (добавить секцию):

```yaml
autonomous:
  # Initial autonomy level (0-4)
  defaultLevel: 1
  
  # Enable constitutional AI
  constitutionalAI:
    enabled: true
    strictMode: true  # Block on any principle violation
    
  # Autonomy level overrides per task type
  levelOverrides:
    financial_transactions: 0  # Always manual for financial ops
    read_operations: 3         # Fully autonomous for reads
    system_ops: 1              # Supervised for system operations
    
  # Approval notification settings
  approvals:
    notifyChannels:
      - telegram:@admin
      - email:admin@example.com
    timeoutMinutes: 60
    autoExpire: true
    
  # Metrics and auditing
  auditing:
    enabled: true
    logAllEvaluations: true
    retentionDays: 90
```

---

## ⚠️ Предупреждения Безопасности

1. **Никогда не используйте LEVEL_4_GOD_MODE** в production без крайней необходимости
2. **Всегда включайте Constitutional AI** даже на высоких уровнях автономности
3. **Регулярно аудируйте логи** одобрений/отклонений
4. **Установите лимиты spending** соответственно вашему risk tolerance
5. **Тестируйте в sandbox** перед повышением уровня автономности

---

## 📚 Дополнительные Ресурсы

- [Constitutional AI Paper (Anthropic)](https://arxiv.org/abs/2212.08073)
- [AI Safety Gridworlds](https://github.com/deepmind/safety-gridworlds)
- [Asimov's Laws of Robotics](https://en.wikipedia.org/wiki/Three_Laws_of_Robotics)

---

**Автор:** Teleton Agent Development Team  
**Версия:** 1.0.0  
**Дата:** 2025
