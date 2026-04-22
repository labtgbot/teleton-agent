/**
 * Theory of Mind Engine
 * 
 * Реализует Пункт 7D: Моделирование ментального состояния других
 * - Beliefs: Во что верит пользователь (истинно/ложно)
 * - Desires: Чего хочет пользователь
 * - Intentions: Намерения пользователя
 * - Knowledge: Что известно пользователю
 */

import { z } from 'zod';
import { Logger } from '../utils/logger';

const logger = new Logger('TheoryOfMind');

// Ментальные состояния
interface MentalState {
  userId: string;
  timestamp: number;
  
  // BDI модель (Belief-Desire-Intention)
  beliefs: Belief[];
  desires: Desire[];
  intentions: Intention[];
  
  // Знания
  knowledge: KnowledgeItem[];
  
  // Эмоциональное состояние
  emotionalState: EmotionalState;
  
  // Уровень доверия к агенту
  trustLevel: number; // 0-1
  
  // Когнитивная нагрузка
  cognitiveLoad: 'LOW' | 'MEDIUM' | 'HIGH' | 'OVERWHELMED';
}

interface Belief {
  id: string;
  proposition: string;
  confidence: number; // 0-1
  source: 'OBSERVATION' | 'INFERENCE' | 'COMMUNICATION';
  updatedAt: number;
  isTrue?: boolean; // Для валидации
}

interface Desire {
  id: string;
  description: string;
  intensity: number; // 0-1
  priority: number; // 1-10
  category: 'TASK' | 'INFORMATION' | 'SOCIAL' | 'SECURITY';
}

interface Intention {
  id: string;
  goal: string;
  plan: string[];
  commitment: number; // 0-1
  estimatedCompletion?: number;
}

interface KnowledgeItem {
  id: string;
  concept: string;
  understandingLevel: 'NONE' | 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  lastAccessed?: number;
}

interface EmotionalState {
  valence: number; // -1 до +1 (негатив - позитив)
  arousal: number; // 0 до 1 (спокойствие - возбуждение)
  dominantEmotion?: 'JOY' | 'SADNESS' | 'ANGER' | 'FEAR' | 'SURPRISE' | 'DISGUST' | 'NEUTRAL';
  stressLevel: number; // 0-1
}

// Обновление ментальной модели
interface MentalUpdate {
  type: 'BELIEF_UPDATE' | 'DESIRE_CHANGE' | 'INTENTION_FORMED' | 'KNOWLEDGE_GAINED' | 'EMOTION_SHIFT';
  content: any;
  confidence: number;
  evidence?: string;
}

export class TheoryOfMind {
  private mentalModels: Map<string, MentalState> = new Map();
  private updateHistory: Map<string, MentalUpdate[]> = new Map();

  constructor() {}

  /**
   * Инициализация или получение ментальной модели пользователя
   */
  getOrCreateModel(userId: string): MentalState {
    if (!this.mentalModels.has(userId)) {
      const initialModel: MentalState = {
        userId,
        timestamp: Date.now(),
        beliefs: [],
        desires: [],
        intentions: [],
        knowledge: [],
        emotionalState: {
          valence: 0,
          arousal: 0.3,
          dominantEmotion: 'NEUTRAL',
          stressLevel: 0.2
        },
        trustLevel: 0.5,
        cognitiveLoad: 'MEDIUM'
      };
      
      this.mentalModels.set(userId, initialModel);
      this.updateHistory.set(userId, []);
      logger.info(`Created initial mental model for user ${userId}`);
    }

    return this.mentalModels.get(userId)!;
  }

  /**
   * Обновление убеждений пользователя на основе наблюдений
   */
  updateBeliefs(userId: string, newBeliefs: Partial<Belief>[]): void {
    const model = this.getOrCreateModel(userId);
    
    for (const beliefData of newBeliefs) {
      const existingIdx = model.beliefs.findIndex(b => b.proposition === beliefData.proposition);
      
      const belief: Belief = {
        id: beliefData.id || `belief-${Date.now()}-${Math.random()}`,
        proposition: beliefData.proposition!,
        confidence: beliefData.confidence || 0.5,
        source: beliefData.source || 'INFERENCE',
        updatedAt: Date.now(),
        isTrue: beliefData.isTrue
      };

      if (existingIdx >= 0) {
        // Обновление существующего убеждения
        model.beliefs[existingIdx] = {
          ...model.beliefs[existingIdx],
          ...belief,
          confidence: Math.max(model.beliefs[existingIdx].confidence, belief.confidence)
        };
        logger.debug(`Updated belief for ${userId}: ${belief.proposition}`);
      } else {
        // Добавление нового убеждения
        model.beliefs.push(belief);
        logger.debug(`Added new belief for ${userId}: ${belief.proposition}`);
      }

      this.recordUpdate(userId, {
        type: 'BELIEF_UPDATE',
        content: belief,
        confidence: belief.confidence
      });
    }

    model.timestamp = Date.now();
  }

  /**
   * Выявление желаний и целей пользователя
   */
  inferDesires(userId: string, context: {
    recentActions: string[];
    expressedNeeds?: string[];
    implicitSignals?: Record<string, any>;
  }): Desire[] {
    const model = this.getOrCreateModel(userId);
    const inferredDesires: Desire[] = [];

    // Анализ явных потребностей
    if (context.expressedNeeds) {
      for (const need of context.expressedNeeds) {
        inferredDesires.push({
          id: `desire-${Date.now()}-${inferredDesires.length}`,
          description: need,
          intensity: 0.9,
          priority: 8,
          category: 'TASK'
        });
      }
    }

    // Вывод из действий
    if (context.recentActions.includes('CHECK_BALANCE')) {
      inferredDesires.push({
        id: `desire-${Date.now()}-balance`,
        description: 'Know current financial status',
        intensity: 0.7,
        priority: 6,
        category: 'INFORMATION'
      });
    }

    if (context.recentActions.includes('SEARCH_TOKENS')) {
      inferredDesires.push({
        id: `desire-${Date.now()}-invest`,
        description: 'Find investment opportunities',
        intensity: 0.8,
        priority: 7,
        category: 'TASK'
      });
    }

    // Обновление модели
    model.desires = [...model.desires.filter(d => d.intensity > 0.3), ...inferredDesires];
    model.timestamp = Date.now();

    logger.info(`Inferred ${inferredDesires.length} desires for user ${userId}`);
    return inferredDesires;
  }

  /**
   * Определение намерений пользователя
   */
  recognizeIntention(userId: string, observedBehavior: {
    actions: string[];
    pattern: string;
    urgency?: number;
  }): Intention | null {
    const model = this.getOrCreateModel(userId);

    // Простая эвристика распознавания намерений
    let recognizedGoal: string | null = null;
    let plan: string[] = [];

    if (observedBehavior.pattern.includes('RESEARCH') && observedBehavior.actions.includes('COMPARE')) {
      recognizedGoal = 'Make informed decision';
      plan = ['Gather information', 'Compare options', 'Evaluate risks', 'Execute decision'];
    }

    if (observedBehavior.actions.includes('SEND_TRANSACTION')) {
      recognizedGoal = 'Transfer assets';
      plan = ['Verify recipient', 'Check balance', 'Set gas fee', 'Confirm transaction'];
    }

    if (!recognizedGoal) {
      return null;
    }

    const intention: Intention = {
      id: `intention-${Date.now()}`,
      goal: recognizedGoal,
      plan,
      commitment: observedBehavior.urgency || 0.7,
      estimatedCompletion: Date.now() + 300000 // 5 минут
    };

    model.intentions.push(intention);
    model.timestamp = Date.now();

    this.recordUpdate(userId, {
      type: 'INTENTION_FORMED',
      content: intention,
      confidence: intention.commitment
    });

    logger.info(`Recognized intention for ${userId}: ${recognizedGoal}`);
    return intention;
  }

  /**
   * Обновление эмоционального состояния
   */
  updateEmotionalState(userId: string, signals: {
    sentimentScore?: number; // -1 до +1
    activityLevel?: number; // 0-1
    errorEncounters?: number;
    successStreak?: number;
  }): EmotionalState {
    const model = this.getOrCreateModel(userId);
    const current = model.emotionalState;

    // Обновление валентности (позитив/негатив)
    if (signals.sentimentScore !== undefined) {
      current.valence = current.valence * 0.7 + signals.sentimentScore * 0.3;
    }

    // Обновление возбуждения (активность)
    if (signals.activityLevel !== undefined) {
      current.arousal = current.arousal * 0.8 + signals.activityLevel * 0.2;
    }

    // Стресс от ошибок
    if (signals.errorEncounters && signals.errorEncounters > 0) {
      current.stressLevel = Math.min(1, current.stressLevel + signals.errorEncounters * 0.15);
      if (current.stressLevel > 0.7) {
        current.dominantEmotion = 'FEAR';
      }
    }

    // Улучшение от успехов
    if (signals.successStreak && signals.successStreak > 2) {
      current.stressLevel = Math.max(0, current.stressLevel - 0.1);
      if (current.valence > 0.5) {
        current.dominantEmotion = 'JOY';
      }
    }

    // Определение доминирующей эмоции
    if (!current.dominantEmotion) {
      if (current.valence > 0.5) current.dominantEmotion = 'JOY';
      else if (current.valence < -0.5) current.dominantEmotion = 'SADNESS';
      else if (current.arousal > 0.7) current.dominantEmotion = 'SURPRISE';
      else current.dominantEmotion = 'NEUTRAL';
    }

    model.timestamp = Date.now();
    logger.debug(`Updated emotional state for ${userId}: ${current.dominantEmotion}`);
    
    return current;
  }

  /**
   * Адаптация стиля коммуникации на основе ментальной модели
   */
  adaptCommunicationStyle(userId: string): CommunicationStyle {
    const model = this.getOrCreateModel(userId);
    
    // Оценка когнитивной нагрузки
    if (model.emotionalState.stressLevel > 0.7 || model.emotionalState.arousal > 0.8) {
      model.cognitiveLoad = 'HIGH';
    } else if (model.emotionalState.stressLevel < 0.3 && model.emotionalState.valence > 0) {
      model.cognitiveLoad = 'LOW';
    }

    // Формирование стиля
    const style: CommunicationStyle = {
      detailLevel: model.cognitiveLoad === 'HIGH' ? 'MINIMAL' : 'COMPREHENSIVE',
      tone: model.emotionalState.valence < 0 ? 'SUPPORTIVE' : 'NEUTRAL',
      urgency: model.intentions.some(i => i.commitment > 0.8) ? 'HIGH' : 'NORMAL',
      technicalDepth: this.assessTechnicalDepth(model),
      empathyLevel: model.emotionalState.stressLevel > 0.5 ? 'HIGH' : 'NORMAL'
    };

    logger.info(`Adapted communication style for ${userId}: ${JSON.stringify(style)}`);
    return style;
  }

  /**
   * Проверка ложных убеждений (False Belief Test)
   */
  detectFalseBeliefs(userId: string): Belief[] {
    const model = this.getOrCreateModel(userId);
    return model.beliefs.filter(b => b.isTrue === false);
  }

  /**
   * Получить полную ментальную модель
   */
  getFullModel(userId: string): MentalState {
    return this.getOrCreateModel(userId);
  }

  // --- Приватные методы ---

  private recordUpdate(userId: string, update: MentalUpdate): void {
    const history = this.updateHistory.get(userId) || [];
    history.push(update);
    
    // Хранить последние 50 обновлений
    if (history.length > 50) {
      history.shift();
    }
    
    this.updateHistory.set(userId, history);
  }

  private assessTechnicalDepth(model: MentalState): 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' {
    const technicalKnowledge = model.knowledge.filter(k => 
      ['BLOCKCHAIN', 'SMART_CONTRACT', 'CRYPTOGRAPHY'].includes(k.concept)
    );

    if (technicalKnowledge.some(k => k.understandingLevel === 'EXPERT' || k.understandingLevel === 'ADVANCED')) {
      return 'ADVANCED';
    }
    
    if (technicalKnowledge.length > 3) {
      return 'INTERMEDIATE';
    }
    
    return 'BASIC';
  }
}

export interface CommunicationStyle {
  detailLevel: 'MINIMAL' | 'STANDARD' | 'COMPREHENSIVE';
  tone: 'SUPPORTIVE' | 'NEUTRAL' | 'FORMAL' | 'CASUAL';
  urgency: 'LOW' | 'NORMAL' | 'HIGH';
  technicalDepth: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
  empathyLevel: 'LOW' | 'NORMAL' | 'HIGH';
}
