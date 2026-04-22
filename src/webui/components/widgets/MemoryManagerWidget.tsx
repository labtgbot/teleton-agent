/**
 * MemoryManagerWidget - Управление памятью Супер-Агента
 * 
 * Компоненты:
 * - Граф знаний (семантическая память)
 * - Таймлайн событий (эпизодическая память)
 * - Список выученных навыков (процедурная память)
 */

import React, { useState, useEffect } from 'react';
import styles from './MemoryManagerWidget.module.css';

interface KnowledgeNode {
  id: string;
  label: string;
  type: string;
  metadata: Record<string, any> | null;
}

interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  weight: number;
}

interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

interface TimelineEvent {
  id: string;
  type: string;
  description: string;
  emotionalWeight: number;
  importance: number;
  tags: string[];
  timestamp: number;
}

interface Skill {
  id: string;
  name: string;
  category: string;
  steps: string[];
  successRate: number;
  executionsCount: number;
  lastExecuted: number;
}

interface MemoryStats {
  episodic: { events: number };
  semantic: { entities: number; relationships: number };
  procedural: { skills: number };
}

interface MemoryData {
  stats: MemoryStats;
  knowledgeGraph: KnowledgeGraph;
  timeline: TimelineEvent[];
  skills: Skill[];
}

const NODE_COLORS: Record<string, string> = {
  concept: '#6f42c1',
  entity: '#20c997',
  event: '#fd7e14',
  person: '#e83e8c',
  place: '#17a2b8',
  object: '#ffc107',
  default: '#6c757d',
};

const CATEGORY_ICONS: Record<string, string> = {
  communication: '💬',
  analysis: '📊',
  automation: '⚙️',
  research: '🔍',
  planning: '📋',
  execution: '⚡',
  default: '📚',
};

export const MemoryManagerWidget: React.FC = () => {
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'timeline' | 'skills'>('graph');
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);

  const fetchData = async () => {
    try {
      const [statsRes, graphRes, timelineRes, skillsRes] = await Promise.all([
        fetch('/api/super-agent/memory/stats'),
        fetch('/api/super-agent/memory/knowledge-graph?limit=50'),
        fetch('/api/super-agent/memory/timeline?limit=20'),
        fetch('/api/super-agent/memory/skills'),
      ]);
      
      const [statsData, graphData, timelineData, skillsData] = await Promise.all([
        statsRes.json(),
        graphRes.json(),
        timelineRes.json(),
        skillsRes.json(),
      ]);
      
      if (statsData.success && graphData.success && timelineData.success && skillsData.success) {
        setMemoryData({
          stats: statsData.data,
          knowledgeGraph: graphData.data,
          timeline: timelineData.data.events || [],
          skills: skillsData.data.skills || [],
        });
        setError(null);
      } else {
        setError('Failed to load memory data');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'только что';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} мин назад`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    return `${days} дн назад`;
  };

  const getImportanceColor = (importance: number) => {
    if (importance > 0.7) return '#dc3545';
    if (importance > 0.4) return '#ffc107';
    return '#28a745';
  };

  if (loading) {
    return <div className={styles.widget}><div className={styles.loading}>Загрузка памяти...</div></div>;
  }

  if (error) {
    return <div className={styles.widget}><div className={styles.error}>{error}</div></div>;
  }

  return (
    <div className={styles.widget}>
      <h3 className={styles.title}>🧠 Память Агента</h3>
      
      {/* Stats Overview */}
      <div className={styles.statsOverview}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{memoryData?.stats.episodic.events || 0}</span>
          <span className={styles.statLabel}>События</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{memoryData?.stats.semantic.entities || 0}</span>
          <span className={styles.statLabel}>Сущности</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{memoryData?.stats.semantic.relationships || 0}</span>
          <span className={styles.statLabel}>Связи</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{memoryData?.stats.procedural.skills || 0}</span>
          <span className={styles.statLabel}>Навыки</span>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'graph' ? styles.active : ''}`}
          onClick={() => setActiveTab('graph')}
        >
          🕸️ Граф знаний
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'timeline' ? styles.active : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          📅 Таймлайн
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'skills' ? styles.active : ''}`}
          onClick={() => setActiveTab('skills')}
        >
          🎯 Навыки
        </button>
      </div>

      {/* Graph View */}
      {activeTab === 'graph' && (
        <div className={styles.graphContainer}>
          <div className={styles.graphLegend}>
            <span>Типы узлов:</span>
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <span key={type} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: color }} />
                {type}
              </span>
            ))}
          </div>
          <div className={styles.graphVisualization}>
            {memoryData?.knowledgeGraph.nodes.length === 0 ? (
              <p className={styles.emptyState}>Граф знаний пуст</p>
            ) : (
              <div className={styles.nodeGrid}>
                {memoryData?.knowledgeGraph.nodes.slice(0, 20).map((node) => (
                  <div 
                    key={node.id}
                    className={`${styles.nodeCard} ${selectedNode?.id === node.id ? styles.selected : ''}`}
                    style={{ borderLeftColor: NODE_COLORS[node.type] || NODE_COLORS.default }}
                    onClick={() => setSelectedNode(node)}
                  >
                    <span className={styles.nodeName}>{node.label}</span>
                    <span className={styles.nodeType}>{node.type}</span>
                  </div>
                ))}
              </div>
            )}
            {selectedNode && (
              <div className={styles.nodeDetails}>
                <h4>Детали узла</h4>
                <p><strong>ID:</strong> {selectedNode.id}</p>
                <p><strong>Имя:</strong> {selectedNode.label}</p>
                <p><strong>Тип:</strong> {selectedNode.type}</p>
                {selectedNode.metadata && (
                  <pre>{JSON.stringify(selectedNode.metadata, null, 2)}</pre>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline View */}
      {activeTab === 'timeline' && (
        <div className={styles.timelineContainer}>
          {memoryData?.timeline.length === 0 ? (
            <p className={styles.emptyState}>Событий пока нет</p>
          ) : (
            <div className={styles.timeline}>
              {memoryData?.timeline.map((event) => (
                <div 
                  key={event.id} 
                  className={styles.timelineEvent}
                  style={{ borderLeftColor: getImportanceColor(event.importance) }}
                >
                  <div className={styles.eventHeader}>
                    <span className={styles.eventType}>{event.type}</span>
                    <span className={styles.eventTime}>{formatTimeAgo(event.timestamp)}</span>
                  </div>
                  <p className={styles.eventDescription}>{event.description}</p>
                  <div className={styles.eventFooter}>
                    <div className={styles.eventMetrics}>
                      <span>Важность: {(event.importance * 100).toFixed(0)}%</span>
                      <span>Эмоции: {(event.emotionalWeight * 100).toFixed(0)}%</span>
                    </div>
                    {event.tags.length > 0 && (
                      <div className={styles.eventTags}>
                        {event.tags.slice(0, 5).map((tag, i) => (
                          <span key={i} className={styles.tag}>#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Skills View */}
      {activeTab === 'skills' && (
        <div className={styles.skillsContainer}>
          {memoryData?.skills.length === 0 ? (
            <p className={styles.emptyState}>Навыков пока нет</p>
          ) : (
            <div className={styles.skillsGrid}>
              {memoryData?.skills.map((skill) => (
                <div key={skill.id} className={styles.skillCard}>
                  <div className={styles.skillHeader}>
                    <span className={styles.skillIcon}>
                      {CATEGORY_ICONS[skill.category.toLowerCase()] || CATEGORY_ICONS.default}
                    </span>
                    <div>
                      <h4 className={styles.skillName}>{skill.name}</h4>
                      <span className={styles.skillCategory}>{skill.category}</span>
                    </div>
                  </div>
                  <div className={styles.skillMetrics}>
                    <div className={styles.skillMetric}>
                      <span className={styles.metricLabel}>Успешность</span>
                      <div className={styles.progressBar}>
                        <div 
                          className={styles.progressFill}
                          style={{ width: `${skill.successRate * 100}%`, backgroundColor: skill.successRate > 0.8 ? '#28a745' : skill.successRate > 0.5 ? '#ffc107' : '#dc3545' }}
                        />
                      </div>
                      <span>{(skill.successRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className={styles.skillMetric}>
                      <span className={styles.metricLabel}>Выполнений</span>
                      <span className={styles.metricValue}>{skill.executionsCount}</span>
                    </div>
                  </div>
                  <p className={styles.lastExecuted}>
                    Последнее: {formatTimeAgo(skill.lastExecuted)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MemoryManagerWidget;
