/**
 * Emotional Intelligence Module (EQ)
 * 
 * Реализует эмоциональный интеллект агента:
 * - Распознавание эмоций пользователя (Sentiment Analysis)
 * - Эмпатический ответ (Empathetic Response)
 * - Управление внутренним состоянием (Internal State Management)
 * - Адаптация стиля коммуникации (Style Adaptation)
 */

export type EmotionType = 
  | 'joy' | 'sadness' | 'anger' | 'fear' 
  | 'surprise' | 'disgust' | 'neutral' | 'trust' | 'anticipation';

export interface EmotionalState {
  primary: EmotionType;
  intensity: number; // 0.0 - 1.0
  valence: number;   // -1.0 (negative) to 1.0 (positive)
  arousal: number;   // 0.0 (calm) to 1.0 (excited)
  timestamp: number;
}

export interface UserEmotionProfile {
  userId: string;
  dominantEmotion: EmotionType;
  averageValence: number;
  stressLevel: 'low' | 'medium' | 'high';
  preferredTone: 'formal' | 'casual' | 'supportive' | 'concise';
  lastUpdated: number;
}

export interface EmpathyResponse {
  acknowledgedEmotion: string;
  suggestedTone: string;
  responseModifier: string;
  actionRecommendation?: string;
}

export class EmotionalIntelligenceModule {
  private userProfiles: Map<string, UserEmotionProfile> = new Map();
  private currentAgentMood: EmotionalState = {
    primary: 'neutral',
    intensity: 0.5,
    valence: 0.0,
    arousal: 0.5,
    timestamp: Date.now()
  };

  /**
   * Анализирует текст сообщения на наличие эмоций
   * (В реальной реализации здесь будет вызов LLM или специализированной модели)
   */
  async analyzeSentiment(text: string): Promise<EmotionalState> {
    const lowerText = text.toLowerCase();
    
    // Простая эвристика для демонстрации (заменяется на ML модель)
    let primary: EmotionType = 'neutral';
    let valence = 0.0;
    let arousal = 0.3;

    if (lowerText.includes('счастлив') || lowerText.includes('отлично') || lowerText.includes('рад')) {
      primary = 'joy'; valence = 0.8; arousal = 0.7;
    } else if (lowerText.includes('груст') || lowerText.includes('плохо') || lowerText.includes('устал')) {
      primary = 'sadness'; valence = -0.7; arousal = 0.2;
    } else if (lowerText.includes('зл') || lowerText.includes('бесит') || lowerText.includes('ошибка')) {
      primary = 'anger'; valence = -0.9; arousal = 0.9;
    } else if (lowerText.includes('боюсь') || lowerText.includes('тревог') || lowerText.includes('опасн')) {
      primary = 'fear'; valence = -0.6; arousal = 0.8;
    } else if (lowerText.includes('удив') || lowerText.includes('вау') || lowerText.includes('неожидан')) {
      primary = 'surprise'; valence = 0.2; arousal = 0.9;
    }

    const state: EmotionalState = {
      primary,
      intensity: Math.abs(valence),
      valence,
      arousal,
      timestamp: Date.now()
    };

    return state;
  }

  /**
   * Обновляет профиль пользователя на основе истории взаимодействий
   */
  updateUserProfile(userId: string, emotion: EmotionalState): UserEmotionProfile {
    const existing = this.userProfiles.get(userId);
    
    const newProfile: UserEmotionProfile = {
      userId,
      dominantEmotion: existing 
        ? (emotion.intensity > 0.5 ? emotion.primary : existing.dominantEmotion)
        : emotion.primary,
      averageValence: existing 
        ? (existing.averageValence * 0.8 + emotion.valence * 0.2) 
        : emotion.valence,
      stressLevel: emotion.arousal > 0.7 && emotion.valence < 0 ? 'high' : 'low',
      preferredTone: this.determinePreferredTone(emotion, existing),
      lastUpdated: Date.now()
    };

    this.userProfiles.set(userId, newProfile);
    return newProfile;
  }

  private determinePreferredTone(current: EmotionalState, existing?: UserEmotionProfile): 'formal' | 'casual' | 'supportive' | 'concise' {
    if (current.primary === 'sadness' || current.primary === 'fear') return 'supportive';
    if (current.primary === 'anger') return 'concise';
    if (current.valence > 0.5) return 'casual';
    return 'formal';
  }

  /**
   * Генерирует эмпатический ответ на основе эмоции пользователя
   */
  generateEmpathyResponse(userEmotion: EmotionalState, profile?: UserEmotionProfile): EmpathyResponse {
    let acknowledgedEmotion = '';
    let suggestedTone = profile?.preferredTone || 'formal';
    let responseModifier = '';
    let actionRecommendation;

    switch (userEmotion.primary) {
      case 'sadness':
        acknowledgedEmotion = 'Я понимаю, что вы расстроены.';
        responseModifier = 'мягко, поддерживающе';
        actionRecommendation = 'Предложить помощь или перерыв.';
        break;
      case 'anger':
        acknowledgedEmotion = 'Я вижу, что эта ситуация вызывает у вас раздражение.';
        responseModifier = 'спокойно, кратко, по делу';
        actionRecommendation = 'Извиниться за неудобства и сразу предложить решение.';
        break;
      case 'fear':
        acknowledgedEmotion = 'Понимаю ваше беспокойство.';
        responseModifier = 'уверенно, обнадеживающе';
        actionRecommendation = 'Гарантировать безопасность и показать план действий.';
        break;
      case 'joy':
        acknowledgedEmotion = 'Рад видеть ваш позитивный настрой!';
        responseModifier = 'энергично, дружелюбно';
        break;
      default:
        acknowledgedEmotion = 'Понял вас.';
        responseModifier = 'нейтрально, профессионально';
    }

    return {
      acknowledgedEmotion,
      suggestedTone,
      responseModifier,
      actionRecommendation
    };
  }

  /**
   * Адаптирует системный промпт или стиль ответа агента
   */
  adaptCommunicationStyle(profile: UserEmotionProfile, basePrompt: string): string {
    let styleInstruction = '';

    switch (profile.preferredTone) {
      case 'supportive':
        styleInstruction = 'Тон: Поддерживающий, эмпатичный, мягкий. Используй фразы "Я помогу", "Мы справимся". Избегай резкости.';
        break;
      case 'concise':
        styleInstruction = 'Тон: Краткий, деловой, без лишних слов. Только факты и решения. Никаких извинений, кроме одного раза.';
        break;
      case 'casual':
        styleInstruction = 'Тон: Дружеский, неформальный. Можно использовать эмодзи и легкий юмор.';
        break;
      case 'formal':
      default:
        styleInstruction = 'Тон: Профессиональный, вежливый, структурированный.';
    }

    if (profile.stressLevel === 'high') {
      styleInstruction += ' Пользователь в стрессе: упрости объяснения, разбей на мелкие шаги.';
    }

    return `${basePrompt}\n\n[EQ INSTRUCTION]: ${styleInstruction}`;
  }

  /**
   * Внутреннее состояние агента (для симуляции "настроения")
   */
  updateAgentMood(interactionSuccess: boolean, userEmotion: EmotionalState) {
    // Агент немного "заражается" эмоцией пользователя, но стремится к нейтралитету
    const influence = 0.1;
    this.currentAgentMood.valence = this.currentAgentMood.valence * (1 - influence) + (userEmotion.valence * influence);
    
    if (interactionSuccess) {
      this.currentAgentMood.arousal = Math.min(1.0, this.currentAgentMood.arousal + 0.05);
      this.currentAgentMood.primary = 'trust';
    } else {
      this.currentAgentMood.arousal = Math.max(0.3, this.currentAgentMood.arousal - 0.05);
      this.currentAgentMood.primary = 'anticipation'; // Ожидание исправления
    }
    
    this.currentAgentMood.timestamp = Date.now();
  }

  getAgentMood(): EmotionalState {
    return { ...this.currentAgentMood };
  }
}

export const eqModule = new EmotionalIntelligenceModule();
