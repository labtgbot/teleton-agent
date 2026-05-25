import { useState, useEffect } from 'react';
import { WidgetWrapper } from './WidgetWrapper';

interface KnowledgeNode {
  id: string;
  label: string;
  type: string;
  metadata: Record<string, unknown> | null;
}

interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  weight: number;
}

interface KnowledgeGraphData {
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

interface TimelineData {
  events: TimelineEvent[];
  total: number;
}

interface Skill {
  id: string;
  name: string;
  category: string;
  steps: Array<Record<string, unknown>>;
  successRate: number;
  executionsCount: number;
  lastExecuted: number;
}

interface SkillsData {
  skills: Skill[];
}

const NODE_COLORS: Record<string, string> = {
  concept: '#3b82f6',
  entity: '#10b981',
  event: '#f59e0b',
  person: '#8b5cf6',
  location: '#ef4444',
  task: '#14b8a6',
  default: '#6b7280',
};

const EVENT_TYPE_ICONS: Record<string, string> = {
  task_completed: '✅',
  task_failed: '❌',
  decision_made: '🧠',
  learning: '📚',
  interaction: '💬',
  error: '⚠️',
  default: '📝',
};

export function MemoryManagerWidget() {
  const [activeTab, setActiveTab] = useState<'graph' | 'timeline' | 'skills'>('graph');
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [skillsData, setSkillsData] = useState<SkillsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [graphRes, timelineRes, skillsRes] = await Promise.all([
        fetch('/api/super-agent/memory/knowledge-graph?limit=50'),
        fetch('/api/super-agent/memory/timeline?limit=20'),
        fetch('/api/super-agent/memory/skills'),
      ]);
      
      const graphJson = await graphRes.json();
      const timelineJson = await timelineRes.json();
      const skillsJson = await skillsRes.json();
      
      if (graphJson.success) setGraphData(graphJson.data);
      if (timelineJson.success) setTimelineData(timelineJson.data);
      if (skillsJson.success) setSkillsData(skillsJson.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch memory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) return <div className="loading">Loading Memory...</div>;
  if (error) return <div className="alert error">{error}</div>;

  return (
    <div className="memory-manager-widget" style={{ padding: '12px' }}>
      {/* ── Tab Navigation ── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
        <button
          className={`btn-sm ${activeTab === 'graph' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('graph')}
          style={{ fontSize: '11px' }}
        >
          🕸️ Knowledge Graph
        </button>
        <button
          className={`btn-sm ${activeTab === 'timeline' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('timeline')}
          style={{ fontSize: '11px' }}
        >
          📅 Timeline
        </button>
        <button
          className={`btn-sm ${activeTab === 'skills' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('skills')}
          style={{ fontSize: '11px' }}
        >
          🎯 Skills
        </button>
      </div>

      {/* ── Knowledge Graph Tab ── */}
      {activeTab === 'graph' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>
              Semantic Memory ({graphData?.nodes.length || 0} nodes, {graphData?.edges.length || 0} connections)
            </h4>
          </div>
          
          {!graphData || graphData.nodes.length === 0 ? (
            <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
              No knowledge graph data available
            </div>
          ) : (
            <>
              {/* Simple node visualization */}
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '6px', 
                maxHeight: '200px', 
                overflow: 'auto',
                padding: '8px',
                background: '#f9fafb',
                borderRadius: '8px'
              }}>
                {graphData.nodes.slice(0, 30).map((node) => {
                  const color = NODE_COLORS[node.type.toLowerCase()] || NODE_COLORS.default;
                  const isSelected = selectedNode === node.id;
                  
                  return (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNode(isSelected ? null : node.id)}
                      style={{
                        padding: '6px 10px',
                        background: isSelected ? `${color}30` : `${color}15`,
                        border: `1px solid ${isSelected ? color : 'transparent'}`,
                        borderRadius: '12px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontWeight: isSelected ? 600 : 400,
                      }}
                      title={`${node.label} (${node.type})`}
                    >
                      {node.label}
                    </div>
                  );
                })}
              </div>
              
              {selectedNode && (
                <div style={{ 
                  marginTop: '8px', 
                  padding: '8px', 
                  background: '#f3f4f6', 
                  borderRadius: '8px',
                  fontSize: '10px'
                }}>
                  {(() => {
                    const node = graphData.nodes.find(n => n.id === selectedNode);
                    if (!node) return null;
                    return (
                      <>
                        <strong>{node.label}</strong><br/>
                        Type: {node.type}<br/>
                        ID: {node.id}
                        {node.metadata && (
                          <pre style={{ marginTop: '4px', fontSize: '9px', overflow: 'auto', maxHeight: '80px' }}>
                            {JSON.stringify(node.metadata, null, 2)}
                          </pre>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              
              {/* Connections preview */}
              {graphData.edges.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>
                    RECENT CONNECTIONS
                  </div>
                  <div style={{ maxHeight: '100px', overflow: 'auto', fontSize: '10px' }}>
                    {graphData.edges.slice(0, 10).map((edge) => (
                      <div 
                        key={edge.id}
                        style={{ 
                          padding: '4px', 
                          borderBottom: '1px solid #e5e7eb',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span style={{ color: NODE_COLORS.default }}>{edge.source}</span>
                        <span style={{ color: '#6b7280' }}>─[{edge.label}]─▶</span>
                        <span style={{ color: NODE_COLORS.default }}>{edge.target}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Timeline Tab ── */}
      {activeTab === 'timeline' && (
        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600 }}>
            Episodic Memory ({timelineData?.total || 0} events)
          </h4>
          
          {!timelineData || timelineData.events.length === 0 ? (
            <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
              No timeline events available
            </div>
          ) : (
            <div style={{ maxHeight: '250px', overflow: 'auto' }}>
              {timelineData.events.map((event) => {
                const icon = EVENT_TYPE_ICONS[event.type.toLowerCase()] || EVENT_TYPE_ICONS.default;
                const importanceColor = event.importance > 0.7 ? '#ef4444' : event.importance > 0.4 ? '#f59e0b' : '#10b981';
                
                return (
                  <div 
                    key={event.id}
                    style={{ 
                      display: 'flex',
                      gap: '8px',
                      padding: '8px',
                      borderBottom: '1px solid #e5e7eb',
                      alignItems: 'flex-start'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', fontWeight: 500 }}>{event.description}</div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '9px', color: '#6b7280' }}>
                        <span>{new Date(event.timestamp).toLocaleString()}</span>
                        <span>•</span>
                        <span style={{ color: importanceColor }}>Importance: {(event.importance * 100).toFixed(0)}%</span>
                        <span>•</span>
                        <span>Emotional: {event.emotionalWeight.toFixed(2)}</span>
                      </div>
                      {event.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                          {event.tags.slice(0, 5).map((tag, i) => (
                            <span 
                              key={i}
                              style={{ 
                                padding: '2px 6px', 
                                background: '#e5e7eb', 
                                borderRadius: '4px',
                                fontSize: '9px'
                              }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Skills Tab ── */}
      {activeTab === 'skills' && (
        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600 }}>
            Procedural Memory ({skillsData?.skills.length || 0} skills)
          </h4>
          
          {!skillsData || skillsData.skills.length === 0 ? (
            <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
              No learned skills available
            </div>
          ) : (
            <div style={{ maxHeight: '250px', overflow: 'auto' }}>
              {skillsData.skills.map((skill) => (
                <div 
                  key={skill.id}
                  style={{ 
                    padding: '8px',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600 }}>{skill.name}</div>
                      <div style={{ fontSize: '9px', color: '#6b7280' }}>{skill.category}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontSize: '10px', 
                        fontWeight: 600,
                        color: skill.successRate > 0.8 ? '#10b981' : skill.successRate > 0.5 ? '#f59e0b' : '#ef4444'
                      }}>
                        {(skill.successRate * 100).toFixed(0)}% success
                      </div>
                      <div style={{ fontSize: '9px', color: '#6b7280' }}>
                        {skill.executionsCount} executions
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '4px' }}>
                    Last used: {new Date(skill.lastExecuted).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
