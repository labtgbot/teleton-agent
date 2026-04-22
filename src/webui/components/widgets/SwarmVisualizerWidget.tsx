/**
 * SwarmVisualizerWidget - Визуализация роя суб-агентов
 * 
 * Компоненты:
 * - Интерактивная схема 8 суб-агентов (Orchestrator, Researcher, Planner, Executor, Critic, Security, Communicator, Learner)
 * - Статус каждого агента в реальном времени
 * - Лог дебатов и консенсуса
 */

import React, { useState, useEffect } from 'react';
import styles from './SwarmVisualizerWidget.module.css';

interface SwarmAgent {
  id: string;
  role: string;
  status: 'idle' | 'busy' | 'waiting' | 'error';
  currentTask: string | null;
}

interface Debate {
  id: string;
  title: string;
  description: string;
  proposer: string;
  status: 'active' | 'voting' | 'debate' | 'accepted' | 'rejected';
  votes: number;
  createdAt: number;
  expiresAt?: number;
}

interface Consensus {
  id: string;
  title: string;
  result: 'accepted' | 'rejected';
  consensusMethod: string;
  timestamp: number;
}

interface SwarmData {
  enabled: boolean;
  agents: SwarmAgent[];
  activeProposals: number;
  metrics: {
    totalTasks: number;
    completedTasks: number;
    successRate: number;
    avgConsensusTime: number;
  };
}

interface DebatesData {
  activeDebates: Debate[];
  recentConsensus: Consensus[];
}

const AGENT_ICONS: Record<string, string> = {
  orchestrator: '🎯',
  researcher: '🔍',
  planner: '📋',
  executor: '⚡',
  critic: '🧐',
  security: '🛡️',
  communicator: '💬',
  learner: '📚',
};

const AGENT_COLORS: Record<string, string> = {
  orchestrator: '#e83e8c',
  researcher: '#6f42c1',
  planner: '#fd7e14',
  executor: '#28a745',
  critic: '#dc3545',
  security: '#ffc107',
  communicator: '#17a2b8',
  learner: '#20c997',
};

const STATUS_COLORS: Record<string, string> = {
  idle: '#6c757d',
  busy: '#28a745',
  waiting: '#ffc107',
  error: '#dc3545',
};

export const SwarmVisualizerWidget: React.FC = () => {
  const [swarm, setSwarm] = useState<SwarmData | null>(null);
  const [debatesData, setDebatesData] = useState<DebatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'agents' | 'debates'>('agents');

  const fetchData = async () => {
    try {
      const [swarmRes, debatesRes] = await Promise.all([
        fetch('/api/super-agent/swarm'),
        fetch('/api/super-agent/swarm/debates'),
      ]);
      
      const swarmData = await swarmRes.json();
      const debatesData = await debatesRes.json();
      
      if (swarmData.success) {
        setSwarm(swarmData.data);
      }
      if (debatesData.success) {
        setDebatesData(debatesData.data);
      }
      setError(null);
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      idle: 'Ожидание',
      busy: 'Работает',
      waiting: 'Ожидает',
      error: 'Ошибка',
    };
    return labels[status] || status;
  };

  if (loading) {
    return <div className={styles.widget}><div className={styles.loading}>Загрузка...</div></div>;
  }

  if (error) {
    return <div className={styles.widget}><div className={styles.error}>{error}</div></div>;
  }

  return (
    <div className={styles.widget}>
      <h3 className={styles.title}>🐝 Рой Агентов</h3>
      
      {/* Tabs */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'agents' ? styles.active : ''}`}
          onClick={() => setActiveTab('agents')}
        >
          Агенты ({swarm?.agents.length || 0})
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'debates' ? styles.active : ''}`}
          onClick={() => setActiveTab('debates')}
        >
          Дебаты ({debatesData?.activeDebates.length || 0})
        </button>
      </div>

      {activeTab === 'agents' && (
        <>
          {/* Metrics */}
          <div className={styles.metricsPanel}>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{swarm?.metrics.totalTasks || 0}</span>
              <span className={styles.metricLabel}>Всего задач</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{swarm?.metrics.completedTasks || 0}</span>
              <span className={styles.metricLabel}>Выполнено</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{(swarm?.metrics.successRate || 0).toFixed(1)}%</span>
              <span className={styles.metricLabel}>Успешность</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{(swarm?.metrics.avgConsensusTime || 0).toFixed(1)}s</span>
              <span className={styles.metricLabel}>Ср. время консенсуса</span>
            </div>
          </div>

          {/* Agents Grid */}
          <div className={styles.agentsGrid}>
            {swarm?.agents.map((agent) => {
              const roleKey = agent.role.toLowerCase();
              return (
                <div 
                  key={agent.id} 
                  className={`${styles.agentCard} ${styles[agent.status]}`}
                  style={{ borderColor: AGENT_COLORS[roleKey] || '#666' }}
                >
                  <div className={styles.agentHeader}>
                    <span className={styles.agentIcon}>{AGENT_ICONS[roleKey] || '🤖'}</span>
                    <span 
                      className={styles.statusDot} 
                      style={{ backgroundColor: STATUS_COLORS[agent.status] }}
                    />
                  </div>
                  <h4 className={styles.agentRole}>{agent.role.toUpperCase()}</h4>
                  <p className={styles.agentStatus}>{getStatusLabel(agent.status)}</p>
                  {agent.currentTask && (
                    <p className={styles.agentTask}>Задача: {agent.currentTask}</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'debates' && (
        <div className={styles.debatesContainer}>
          {/* Active Debates */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>🔴 Активные дебаты</h4>
            {debatesData?.activeDebates.length === 0 ? (
              <p className={styles.emptyState}>Нет активных дебатов</p>
            ) : (
              <div className={styles.debateList}>
                {debatesData?.activeDebates.map((debate) => (
                  <div key={debate.id} className={styles.debateCard}>
                    <div className={styles.debateHeader}>
                      <span className={styles.debateTitle}>{debate.title}</span>
                      <span className={`${styles.badge} ${styles[debate.status]}`}>
                        {debate.status.toUpperCase()}
                      </span>
                    </div>
                    <p className={styles.debateDescription}>{debate.description}</p>
                    <div className={styles.debateFooter}>
                      <span>Предложил: {debate.proposer}</span>
                      <span>Голосов: {debate.votes}</span>
                      <span>{new Date(debate.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Consensus */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>✅ Завершенные голосования</h4>
            {debatesData?.recentConsensus.length === 0 ? (
              <p className={styles.emptyState}>Нет завершенных голосований</p>
            ) : (
              <div className={styles.consensusList}>
                {debatesData?.recentConsensus.slice(-5).map((consensus) => (
                  <div 
                    key={consensus.id} 
                    className={`${styles.consensusCard} ${styles[consensus.result]}`}
                  >
                    <div className={styles.consensusHeader}>
                      <span className={styles.consensusTitle}>{consensus.title}</span>
                      <span className={`${styles.badge} ${styles[consensus.result]}`}>
                        {consensus.result === 'accepted' ? '✓ ПРИНЯТО' : '✗ ОТКЛОНЕНО'}
                      </span>
                    </div>
                    <p className={styles.consensusMethod}>Метод: {consensus.consensusMethod}</p>
                    <span className={styles.consensusTime}>
                      {new Date(consensus.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SwarmVisualizerWidget;
