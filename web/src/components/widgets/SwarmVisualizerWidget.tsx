import { useState, useEffect } from 'react';
import { WidgetWrapper } from './WidgetWrapper';

interface SwarmAgent {
  id: string;
  role: string;
  status: 'idle' | 'busy' | 'waiting' | 'error';
  currentTask: string | null;
}

interface SwarmMetrics {
  totalTasks: number;
  completedTasks: number;
  successRate: number;
  avgConsensusTime: number;
}

interface Debate {
  id: string;
  title: string;
  description: string;
  proposer: string;
  status: string;
  votes: number;
  createdAt: number;
  expiresAt: number;
}

interface Consensus {
  id: string;
  title: string;
  result: string;
  consensusMethod: string;
  timestamp: number;
}

interface SwarmData {
  enabled: boolean;
  agents: SwarmAgent[];
  activeProposals: number;
  metrics: SwarmMetrics;
}

interface DebatesData {
  activeDebates: Debate[];
  recentConsensus: Consensus[];
}

const AGENT_COLORS: Record<string, string> = {
  orchestrator: '#8b5cf6',
  researcher: '#3b82f6',
  planner: '#10b981',
  executor: '#f59e0b',
  critic: '#ef4444',
  security: '#6b7280',
  communicator: '#ec4899',
  learner: '#14b8a6',
};

const STATUS_COLORS: Record<string, string> = {
  idle: '#10b981',
  busy: '#3b82f6',
  waiting: '#f59e0b',
  error: '#ef4444',
};

export function SwarmVisualizerWidget() {
  const [swarmData, setSwarmData] = useState<SwarmData | null>(null);
  const [debatesData, setDebatesData] = useState<DebatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [swarmRes, debatesRes] = await Promise.all([
        fetch('/api/super-agent/swarm'),
        fetch('/api/super-agent/swarm/debates'),
      ]);
      
      const swarmJson = await swarmRes.json();
      const debatesJson = await debatesRes.json();
      
      if (swarmJson.success) {
        setSwarmData(swarmJson.data);
      }
      if (debatesJson.success) {
        setDebatesData(debatesJson.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch swarm data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="loading">Loading Swarm status...</div>;
  if (error) return <div className="alert error">{error}</div>;
  if (!swarmData) return null;

  const getAgentIcon = (role: string) => {
    const icons: Record<string, string> = {
      orchestrator: '🎯',
      researcher: '🔍',
      planner: '📋',
      executor: '⚡',
      critic: '🧐',
      security: '🛡️',
      communicator: '💬',
      learner: '📚',
    };
    return icons[role.toLowerCase()] || '🤖';
  };

  return (
    <div className="swarm-visualizer-widget" style={{ padding: '12px' }}>
      {/* ── Header with Metrics ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>Swarm Status</h4>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
          <span title="Total Tasks">📊 {swarmData.metrics.totalTasks}</span>
          <span title="Success Rate">✅ {(swarmData.metrics.successRate || 0).toFixed(0)}%</span>
          <span title="Active Proposals">🗳️ {swarmData.activeProposals}</span>
        </div>
      </div>

      {/* ── Interactive Agent Grid ── */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '8px',
        marginBottom: '16px'
      }}>
        {swarmData.agents.map((agent) => {
          const color = AGENT_COLORS[agent.role.toLowerCase()] || '#6b7280';
          const statusColor = STATUS_COLORS[agent.status] || '#6b7280';
          const isSelected = selectedAgent === agent.id;
          
          return (
            <div
              key={agent.id}
              onClick={() => setSelectedAgent(isSelected ? null : agent.id)}
              style={{
                padding: '10px',
                borderRadius: '8px',
                background: isSelected ? `${color}30` : `${color}10`,
                border: `2px solid ${isSelected ? color : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
              }}
              title={`${agent.role}: ${agent.status}`}
            >
              <div style={{ fontSize: '20px', textAlign: 'center' }}>
                {getAgentIcon(agent.role)}
              </div>
              <div style={{ fontSize: '9px', textAlign: 'center', marginTop: '4px', fontWeight: 600 }}>
                {agent.role.slice(0, 8)}
              </div>
              <div 
                style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: statusColor,
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                }}
                title={agent.status}
              />
              {agent.currentTask && (
                <div style={{ fontSize: '8px', textAlign: 'center', marginTop: '2px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {agent.currentTask}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Selected Agent Details ── */}
      {selectedAgent && (
        <div style={{ 
          padding: '10px', 
          background: '#f3f4f6', 
          borderRadius: '8px', 
          marginBottom: '16px',
          fontSize: '11px'
        }}>
          {(() => {
            const agent = swarmData.agents.find(a => a.id === selectedAgent);
            if (!agent) return null;
            return (
              <>
                <strong>{agent.role}</strong> ({agent.id})<br/>
                Status: <span style={{ color: STATUS_COLORS[agent.status] }}>{agent.status}</span><br/>
                {agent.currentTask && <>Current Task: {agent.currentTask}</>}
              </>
            );
          })()}
        </div>
      )}

      {/* ── Active Debates & Consensus Log ── */}
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600 }}>Debates & Consensus</h4>
        
        {debatesData && debatesData.activeDebates.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>
              ACTIVE DEBATES
            </div>
            {debatesData.activeDebates.slice(0, 3).map((debate) => (
              <div 
                key={debate.id}
                style={{ 
                  padding: '8px', 
                  background: '#fef3c7', 
                  borderRadius: '6px', 
                  marginBottom: '4px',
                  fontSize: '11px'
                }}
              >
                <div style={{ fontWeight: 600 }}>{debate.title}</div>
                <div style={{ color: '#6b7280', marginTop: '2px' }}>
                  {debate.description?.slice(0, 80)}{debate.description?.length > 80 ? '...' : ''}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '10px' }}>
                  <span>🗳️ {debate.votes} votes</span>
                  <span>{new Date(debate.expiresAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {debatesData && debatesData.recentConsensus.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>
              RECENT CONSENSUS
            </div>
            {debatesData.recentConsensus.slice(0, 3).map((consensus) => (
              <div 
                key={consensus.id}
                style={{ 
                  padding: '6px', 
                  background: consensus.result === 'accepted' ? '#d1fae5' : '#fee2e2', 
                  borderRadius: '6px', 
                  marginBottom: '4px',
                  fontSize: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontWeight: 500 }}>{consensus.title}</span>
                <span style={{ 
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  background: consensus.result === 'accepted' ? '#10b981' : '#ef4444',
                  color: 'white',
                  fontSize: '9px'
                }}>
                  {consensus.result.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}

        {(!debatesData || (debatesData.activeDebates.length === 0 && debatesData.recentConsensus.length === 0)) && (
          <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
            No active debates or recent consensus
          </div>
        )}
      </div>
    </div>
  );
}
