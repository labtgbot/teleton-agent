# 🧠 Phase 2 & 3: Consciousness Stack + Multi-Component Memory

## Обзор

Эта фаза реализует **многоуровневую архитектуру сознания** и **трёхкомпонентную систему памяти** для превращения Teleton Agent в по-настоящему интеллектуального супер-агента.

---

## 📋 Часть 1: Многоуровневая Архитектура Сознания

### Файлы
- `src/autonomous/consciousness-stack.ts` — 4 уровня когнитивной обработки
- `src/autonomous/tree-of-thoughts.ts` — продвинутое многовариантное мышление

### Уровни Сознания

| Уровень | Название | Описание | Use Cases |
|---------|----------|----------|-----------|
| **1** | REACTIVE | Быстрые инстинктивные ответы | Простые запросы, экстренная остановка |
| **2** | TACTICAL | Краткосрочное планирование | Многошаговые задачи, координация инструментов |
| **3** | STRATEGIC | Долгосрочное выравнивание | Сложные проекты, распределение ресурсов |
| **4** | META_COGNITION | Самоанализ и оптимизация | Обучение, анализ паттернов, улучшение процессов |

### Пример Использования

```typescript
import { ConsciousnessStack, ConsciousnessLevel } from './autonomous/consciousness-stack';
import { TreeOfThoughts, SearchStrategy } from './autonomous/tree-of-thoughts';

// Инициализация
const consciousness = new ConsciousnessStack(llmProvider, memoryService);
const tot = new TreeOfThoughts(llmProvider, {
  maxDepth: 5,
  maxBranches: 3,
  searchStrategy: SearchStrategy.BEAM_SEARCH,
});

// Автоматическое определение уровня
const result = await consciousness.process('Как оптимизировать портфель?', {
  complexity: 0.9,
});

console.log(`Processed at ${result.level} level`);

// Для сложных задач использовать Tree of Thoughts
const complexProblem = 'Разработать стратегию диверсификации активов в TON ecosystem';
const solution = await tot.solve(complexProblem);

console.log(`Solution confidence: ${(solution.confidence * 100).toFixed(1)}%`);
console.log(`Reasoning path: ${solution.path.length} steps`);
```

### Tree of Thoughts: Алгоритмы Поиска

- **Beam Search** (по умолчанию) — поддерживает top-k кандидатов на каждом уровне
- **BFS** — исследование всех узлов уровень за уровнем
- **DFS** — глубокое исследование одного пути
- **Greedy** — всегда выбирать лучший вариант

### Интеграция с Агентом

```typescript
// В основном цикле агента
async function processTask(task: string): Promise<void> {
  // Определить уровень сознания
  const thought = await consciousness.process(task);
  
  if (thought.level === ConsciousnessLevel.META_COGNITION) {
    // Запустить самоанализ
    await consciousness.process('reflect on recent performance');
  }
  
  // Для сложных задач использовать ToT
  if (task.complexity > 0.7) {
    const totResult = await treeOfThoughts.solve(task);
    executePlan(totResult.solution);
  } else {
    executePlan(thought.output);
  }
}
```

---

## 📋 Часть 2: Трёхкомпонентная Система Памяти

### Файлы
- `src/memory/types/episodic-memory.ts` — событийная память
- `src/memory/types/semantic-memory.ts` — семантическая память (граф знаний)
- `src/memory/types/procedural-memory.ts` — процедурная память (навыки)

### 1️⃣ Эпизодическая Память

**Что хранит:** Конкретные события с временными метками

```typescript
import { EpisodicMemory, EventType } from './memory/types/episodic-memory';

const episodic = new EpisodicMemory();

// Сохранение события
await episodic.store(
  'Successfully swapped 10 TON to USDT on DeDust',
  EventType.SUCCESS,
  { dex: 'DeDust', amount: 10, from: 'TON', to: 'USDT' },
  0.8, // emotional weight (радость успеха)
  0.9  // importance
);

// Query событий
const recentSuccesses = episodic.query({
  types: [EventType.SUCCESS],
  timeRange: { 
    start: Date.now() - 24 * 60 * 60 * 1000, // last 24h
    end: Date.now() 
  },
  minImportance: 0.7,
  limit: 10,
});

// Консолидация во время "сна"
await episodic.consolidate();
// → { preserved: 45, forgotten: 12 }
```

**Ключевые особенности:**
- ⏰ Временная шкала с хронологическим порядком
- 💝 Эмоциональный вес (-1.0 до 1.0)
- 🏷️ Авто-тегирование
- 🔗 Связывание похожих событий
- 🧹 Забытие по важности + decay

### 2️⃣ Семантическая Память

**Что хранит:** Факты, концепции, граф знаний

```typescript
import { SemanticMemory, EntityType, RelationshipType } from './memory/types/semantic-memory';

const semantic = new SemanticMemory();

// Добавление сущностей
const tonId = await semantic.addEntity('TON', EntityType.OBJECT, {
  symbol: 'TON',
  type: 'cryptocurrency',
  blockchain: 'The Open Network'
});

const deDustId = await semantic.addEntity('DeDust', EntityType.ORGANIZATION, {
  type: 'DEX',
  blockchain: 'TON'
});

// Добавление отношений
await semantic.addRelationship(
  tonId,
  deDustId,
  RelationshipType.USED_FOR,
  0.9,
  'Trading pair on DeDust DEX'
);

// Добавление фактов
await semantic.addFact({
  subject: 'TON',
  predicate: 'has_price',
  object: '$5.42',
  confidence: 0.95,
  timestamp: Date.now()
});

// Query с spreading activation
const results = semantic.query({
  entityType: EntityType.ORGANIZATION,
  relationships: [RelationshipType.USED_FOR],
  maxHops: 2,
  limit: 10,
});

// Поиск пути между сущностями
const path = semantic.findPath(tonId, deDustId, 3);
// → ['ent_ton', 'ent_trading', 'ent_dedust']
```

**Ключевые особенности:**
- 🕸️ Граф знаний с отношениями
- 🔍 Spreading activation для retrieval
- 🛤️ Поиск путей между сущностями
- 📊 Fact triples (subject-predicate-object)
- 🧹 Consolidation с merge/prune

### 3️⃣ Процедурная Память

**Что хранит:** Навыки, паттерны, эвристики

```typescript
import { ProceduralMemory, SkillCategory } from './memory/types/procedural-memory';

const procedural = new ProceduralMemory();

// Запись выполнения навыка
procedural.recordSkillExecution('skill_api_error_recovery', true);

// Query навыков
const bestSkills = procedural.querySkills({
  category: SkillCategory.ERROR_RECOVERY,
  minSuccessRate: 0.8,
  limit: 5,
});

// Поиск паттерна
const pattern = procedural.findMatchingPattern(
  'API timeout error',
  'retry_with_backoff'
);

if (pattern) {
  console.log(`Use pattern: ${pattern.action}`);
  procedural.recordPatternApplication(pattern.id, true);
}

// Получение эвристик
const heuristics = procedural.getHeuristics('decision-making');
// → ['When uncertain, ask clarifying questions before acting']

// Оптимизация навыка
await procedural.optimizeSkill(
  'skill_active_listening',
  'Good but could be faster'
);

// Consolidation
await procedural.consolidate();
// → { optimized: 8, deprecated: 2 }
```

**Ключевые особенности:**
- 🎯 Skills с шагами и success rate
- 🧠 Decision patterns с confidence
- 💡 Heuristics с weight
- 📈 Learning from execution history
- 🔄 Auto-optimization

---

## 🔗 Интеграция Всех Компонентов

### Unified Memory Service Wrapper

```typescript
// src/memory/tri-component-memory.ts
export class TriComponentMemory {
  episodic: EpisodicMemory;
  semantic: SemanticMemory;
  procedural: ProceduralMemory;
  
  constructor() {
    this.episodic = new EpisodicMemory();
    this.semantic = new SemanticMemory();
    this.procedural = new ProceduralMemory();
  }
  
  async storeExperience(
    event: string,
    type: EventType,
    context: any,
    success: boolean
  ): Promise<void> {
    // 1. Эпизодическая память
    await this.episodic.store(event, type, context, success ? 0.5 : -0.5, 0.7);
    
    // 2. Семантическая память (извлечь факты)
    const facts = this.extractFacts(context);
    for (const fact of facts) {
      await this.semantic.addFact(fact);
    }
    
    // 3. Процедурная память (обновить навыки)
    if (context.skillUsed) {
      this.procedural.recordSkillExecution(context.skillUsed, success);
    }
  }
  
  async consolidateAll(): Promise<void> {
    const [epi, sem, proc] = await Promise.all([
      this.episodic.consolidate(),
      this.semantic.consolidate(),
      this.procedural.consolidate(),
    ]);
    
    logger.info('Memory consolidation complete:', {
      episodic: epi,
      semantic: sem,
      procedural: proc,
    });
  }
  
  getFullStats(): any {
    return {
      episodic: this.episodic.getStats(),
      semantic: this.semantic.getStats(),
      procedural: this.procedural.getStats(),
    };
  }
}
```

### Интеграция с Consciousness Stack

```typescript
// В главном цикле агента
class SuperAgent {
  consciousness: ConsciousnessStack;
  memory: TriComponentMemory;
  treeOfThoughts: TreeOfThoughts;
  
  async run(): Promise<void> {
    while (true) {
      const task = await this.getNextTask();
      
      // 1. Проверить процедурную память на паттерны
      const pattern = this.memory.procedural.findMatchingPattern(
        task.description,
        task.type
      );
      
      if (pattern && pattern.confidence > 0.8) {
        // Использовать известный паттерн
        await this.executePattern(pattern);
      } else {
        // 2. Использовать сознание для обработки
        const thought = await this.consciousness.process(task.description, {
          complexity: task.complexity,
        });
        
        // 3. Для сложных задач — Tree of Thoughts
        if (task.complexity > 0.7 || thought.level === ConsciousnessLevel.STRATEGIC) {
          const solution = await this.treeOfThoughts.solve(task.description);
          await this.executePlan(solution.solution);
          
          // Записать в память
          await this.memory.storeExperience(
            `Solved complex task: ${task.description}`,
            EventType.SUCCESS,
            { solution, confidence: solution.confidence },
            true
          );
        } else {
          await this.executePlan(thought.output);
        }
      }
      
      // 4. Периодическая консолидация
      if (this.shouldConsolidate()) {
        await this.memory.consolidateAll();
      }
    }
  }
}
```

---

## 🧪 Тестирование

### Unit Tests

```typescript
describe('ConsciousnessStack', () => {
  it('should determine correct level for input', async () => {
    const result = await consciousness.process('reflect on my performance');
    expect(result.level).toBe(ConsciousnessLevel.META_COGNITION);
  });
  
  it('should update self-model after meta-cognition', async () => {
    await consciousness.process('analyze my recent failures');
    const state = consciousness.getState();
    expect(state.selfModel.efficiencyScore).toBeDefined();
  });
});

describe('TreeOfThoughts', () => {
  it('should find high-confidence solution', async () => {
    const result = await tot.solve('Calculate optimal swap route');
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.path.length).toBeGreaterThan(0);
  });
});

describe('EpisodicMemory', () => {
  it('should store and query events', async () => {
    const id = await episodic.store('Test event', EventType.ACTION, {}, 0.5, 0.8);
    const events = episodic.query({ minImportance: 0.7 });
    expect(events.length).toBeGreaterThan(0);
  });
});
```

---

## 📊 Ожидаемые Результаты

| Метрика | До | После |
|---------|-----|-------|
| **Quality of Decisions** | Базовый | +40% (ToT multi-path reasoning) |
| **Task Success Rate** | ~70% | ~85-90% |
| **Learning Speed** | Нет долгосрочного | Постоянное улучшение |
| **Context Awareness** | Ограниченное | Глубокое (3 типа памяти) |
| **Self-Improvement** | Нет | Да (meta-cognition) |

---

## ⚠️ Предупреждения

1. **Производительность**: Tree of Thoughts может быть медленным (multiple LLM calls)
   - Решение: Использовать кэширование, ограничивать maxDepth
   
2. **Память**: Три компонента требуют больше ресурсов
   - Решение: Регулярная консолидация, лимиты на хранение

3. **Сложность отладки**: Многоуровневая система сложнее для понимания
   - Решение: Подробное логирование, visualization tools

---

## 🚀 Следующие Шаги

**Фаза 4:** Self-Improvement Loop + Agent Swarm
- Experience gathering pipeline
- Pattern mining алгоритмы
- Multi-agent coordination
- Consensus mechanisms
