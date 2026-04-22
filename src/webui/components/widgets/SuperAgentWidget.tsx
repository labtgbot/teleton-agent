/**
 * SuperAgentWidget - Виджет управления Супер-Агентом
 * 
 * Компоненты:
 * - Переключатель уровня автономности с подтверждением
 * - Индикатор уровня сознания (Reactive/Tactical/Strategic/Meta-cognition)
 * - Лента эмоций агента (EQ status)
 */

import React, { useState, useEffect } from 'react';
import styles from './SuperAgentWidget.module.css';

interface AutonomyData {
  currentLevel: string;
  metrics: {
    totalTasks: number;
    completedTasks: number;
    successRate: number;
    avgResponseTime: number;
  };
  pendingApprovals: Array<{
    id: string;
    task: string;
    requestedAt: number;
  }>;
}

interface ConsciousnessData {
  level: 'REACTIVE' | 'TACTICAL' | 'STRATEGIC' | 'META_COGNITION';
  description: string;
}

interface EmotionData {
  primary: string;
  intensity: number;
  valence: number;
  arousal: number;
  timestamp: number;
}

interface StatusData {
  autonomy: AutonomyData;
  consciousness: ConsciousnessData;
  emotions: EmotionData;
  timestamp: number;
}

const AUTONOMY_LEVELS = [
  { value: 'LEVEL_0_MANUAL', label: 'Manual', color: '#6c757d', description: 'Полный ручной контроль' },
  { value: 'LEVEL_1_SUPERVISED', label: 'Supervised', color: '#17a2b8', description: 'Под наблюдением' },
  { value: 'LEVEL_2_SEMI_AUTONOMOUS', label: 'Semi-Auto', color: '#28a745', description: 'Частичная автономность' },
  { value: 'LEVEL_3_FULLY_AUTONOMOUS', label: 'Full Auto', color: '#ffc107', description: 'Полная автономность' },
  { value: 'LEVEL_4_GOD_MODE', label: 'God Mode', color: '#dc3545', description: 'Полная свобода действий' },
];

const CONSCIOUSNESS_COLORS: Record<string, string> = {
  REACTIVE: '#6f42c1',
  TACTICAL: '#fd7e14',
  STRATEGIC: '#20c997',
  META_COGNITION: '#e83e8c',
};

export const SuperAgentWidget: React.FC = () => {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingLevel, setPendingLevel] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Загрузка статуса
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/super-agent/status');
      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch status');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  // Polling каждые 5 секунд
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Изменение уровня автономности
  const handleLevelChange = async (newLevel: string) => {
    setPendingLevel(newLevel);
    setShowConfirm(true);
  };

  const confirmLevelChange = async () => {
    if (!pendingLevel) return;
    
    try {
      const response = await fetch('/api/super-agent/autonomy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: pendingLevel, reason: 'Changed via dashboard' }),
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error || 'Failed to change level');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setPendingLevel(null);
      setShowConfirm(false);
    }
  };

  const getEmotionColor = (valence: number, arousal: number) => {
    // Простая визуализация эмоции на основе valence и arousal
    if (valence > 0.5 && arousal > 0.5) return '#28a745'; // Excited
    if (valence > 0.5 && arousal <= 0.5) return '#17a2b8'; // Calm
    if (valence <= 0.5 && arousal > 0.5) return '#dc3545'; // Stressed
    return '#6c757d'; // Neutral/Sad
  };

  const getEmotionLabel = (primary: string) => {
    const labels: Record<string, string> = {
      'joy': 'Радость',
      'trust': 'Доверие',
      'fear': 'Страх',
      'surprise': 'Удивление',
      'sadness': 'Грусть',
      'disgust': 'Отвращение',
      'anger': 'Гнев',
      'anticipation': 'Ожидание',
      'neutral': 'Нейтрально',
    };
    return labels[primary?.toLowerCase()] || primary;
  };

  if (loading) {
    return <div className={styles.widget}><div className={styles.loading}>Загрузка...</div></div>;
  }

  if (error) {
    return <div className={styles.widget}><div className={styles.error}>{error}</div></div>;
  }

  const currentLevelIndex = AUTONOMY_LEVELS.findIndex(l => l.value === status?.autonomy.currentLevel);

  return (
    <div className={styles.widget}>
      <h3 className={styles.title}>🤖 Супер-Агент</h3>
      
      {/* Уровень автономности */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Автономность</h4>
        <div className={styles.levelSelector}>
          {AUTONOMY_LEVELS.map((level) => (
            <button
              key={level.value}
              className={`${styles.levelButton} ${status?.autonomy.currentLevel === level.value ? styles.active : ''}`}
              style={{ borderColor: level.color }}
              onClick={() => handleLevelChange(level.value)}
              title={level.description}
            >
              {level.label}
            </button>
          ))}
        </div>
        {status?.autonomy.pendingApprovals && status.autonomy.pendingApprovals.length > 0 && (
          <div className={styles.pendingApprovals}>
            ⏳ Ожидают подтверждения: {status.autonomy.pendingApprovals.length}
          </div>
        )}
      </div>

      {/* Уровень сознания */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Сознание</h4>
        <div 
          className={styles.consciousnessIndicator}
          style={{ backgroundColor: CONSCIOUSNESS_COLORS[status?.consciousness.level || 'REACTIVE'] }}
        >
          <span className={styles.consciousnessLevel}>
            {status?.consciousness.level || 'UNKNOWN'}
          </span>
          <span className={styles.consciousnessDescription}>
            {status?.consciousness.description}
          </span>
        </div>
      </div>

      {/* Эмоции */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Эмоциональный статус (EQ)</h4>
        <div className={styles.emotionPanel}>
          <div 
            className={styles.emotionCircle}
            style={{ backgroundColor: getEmotionColor(status?.emotions.valence || 0, status?.emotions.arousal || 0) }}
          >
            <span className={styles.emotionPrimary}>{getEmotionLabel(status?.emotions.primary || 'neutral')}</span>
          </div>
          <div className={styles.emotionMetrics}>
            <div className={styles.metric}>
              <span>Интенсивность:</span>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${(status?.emotions.intensity || 0) * 100}%` }}
                />
              </div>
              <span>{Math.round((status?.emotions.intensity || 0) * 100)}%</span>
            </div>
            <div className={styles.metric}>
              <span>Валентность:</span>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${((status?.emotions.valence || 0) + 1) / 2 * 100}%` }}
                />
              </div>
              <span>{Math.round(((status?.emotions.valence || 0) + 1) / 2 * 100)}%</span>
            </div>
            <div className={styles.metric}>
              <span>Возбуждение:</span>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${(status?.emotions.arousal || 0) * 100}%` }}
                />
              </div>
              <span>{Math.round((status?.emotions.arousal || 0) * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно подтверждения */}
      {showConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h4>Подтверждение изменения уровня</h4>
            <p>
              Вы уверены, что хотите изменить уровень автономности на{' '}
              <strong>{AUTONOMY_LEVELS.find(l => l.value === pendingLevel)?.label}</strong>?
            </p>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => { setShowConfirm(false); setPendingLevel(null); }}>
                Отмена
              </button>
              <button className={styles.confirmBtn} onClick={confirmLevelChange}>
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAgentWidget;
