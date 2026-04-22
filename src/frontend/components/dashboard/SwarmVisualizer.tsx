import React, { useState, useEffect } from 'react';
import { AgentRole, ConsensusMechanism } from '../../../types/swarm';
import './SwarmVisualizer.css';

interface SwarmVisualizerProps {
  agentId: string;
}

interface SubAgent {
  id: string;
  role: AgentRole;
  status: 'idle' | 'active' | 'busy' | 'error';
  currentTask?: string;
  load: number;
  lastActive: Date;
}

interface DebateRound {
  timestamp: Date;
  topic: string;
  participants: string[];
  votes: Record<string, string>;
  result: string;
  mechanism: ConsensusMechanism;
}

const SwarmVisualizer: React.FC<SwarmVisualizerProps> = ({ agentId }) => {
  const [subAgents, setSubAgents] = useState<SubAgent[]>([]);
  const [debateLog, setDebateLog] = useState<DebateRound[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [isRealTime, setIsRealTime] = useState(true);

  // Mock data - in real implementation, this would come from WebSocket/API
  useEffect(() => {
    const mockSubAgents: SubAgent[] = [
      { id: 'orch-1', role: 'ORCHESTRATOR', status: 'active', currentTask: 'Coordinating task #4521', load: 75, lastActive: new Date() },
      { id: 'res-1', role: 'RESEARCHER', status: 'busy', currentTask: 'Searching web for "TON blockchain"', load: 90, lastActive: new Date() },
      { id: 'plan-1', role: 'PLANNER', status: 'active', currentTask: 'Creating execution plan', load: 60, lastActive: new Date() },
      { id: 'exec-1', role: 'EXECUTOR', status: 'active', currentTask: 'Executing action #3', load: 85, lastActive: new Date() },
      { id: 'crit-1', role: 'CRITIC', status: 'idle', currentTask: undefined, load: 20, lastActive: new Date(Date.now() - 60000) },
      { id: 'sec-1', role: 'SECURITY', status: 'active', currentTask: 'Validating action safety', load: 45, lastActive: new Date() },
      { id: 'comm-1', role: 'COMMUNICATOR', status: 'busy', currentTask: 'Generating user response', load: 70, lastActive: new Date() },
      { id: 'learn-1', role: 'LEARNER', status: 'idle', currentTask: undefined, load: 15, lastActive: new Date(Date.now() - 300000) },
    ];

    const mockDebates: DebateRound[] = [
      {
        timestamp: new Date(Date.now() - 120000),
        topic: 'Should execute high-risk TON transaction?',
        participants: ['orch-1', 'sec-1', 'crit-1', 'exec-1'],
        votes: { 'orch-1': 'YES', 'sec-1': 'NO', 'crit-1': 'NO', 'exec-1': 'YES' },
        result: 'DENIED (2 vs 2, Security veto)',
        mechanism: 'WEIGHTED_VOTE',
      },
      {
        timestamp: new Date(Date.now() - 300000),
        topic: 'Best approach for data extraction?',
        participants: ['res-1', 'plan-1', 'orch-1'],
        votes: { 'res-1': 'API', 'plan-1': 'Web Scraping', 'orch-1': 'API' },
        result: 'API (Majority 2/3)',
        mechanism: 'MAJORITY_VOTE',
      },
    ];

    setSubAgents(mockSubAgents);
    setDebateLog(mockDebates);

    if (isRealTime) {
      const interval = setInterval(() => {
        setSubAgents(prev => prev.map(agent => ({
          ...agent,
          load: Math.max(0, Math.min(100, agent.load + (Math.random() - 0.5) * 20)),
          status: agent.load > 80 ? 'busy' : agent.load > 30 ? 'active' : 'idle',
        })));
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [agentId, isRealTime]);

  const getRoleIcon = (role: AgentRole) => {
    switch (role) {
      case 'ORCHESTRATOR': return '🤖';
      case 'RESEARCHER': return '🔍';
      case 'PLANNER': return '📋';
      case 'EXECUTOR': return '⚡';
      case 'CRITIC': return '🎯';
      case 'SECURITY': return '🛡️';
      case 'COMMUNICATOR': return '💬';
      case 'LEARNER': return '📚';
      default: return '❓';
    }
  };

  const getStatusColor = (status: SubAgent['status']) => {
    switch (status) {
      case 'active': return '#27ae60';
      case 'busy': return '#f39c12';
      case 'idle': return '#95a5a6';
      case 'error': return '#e74c3c';
      default: return '#7f8c8d';
    }
  };

  const getMechanismBadge = (mechanism: ConsensusMechanism) => {
    switch (mechanism) {
      case 'MAJORITY_VOTE': return '🗳️ Majority';
      case 'WEIGHTED_VOTE': return '⚖️ Weighted';
      case 'UNANIMOUS': return '✅ Unanimous';
      case 'DEBATE': return '💬 Debate';
      case 'TIMEOUT': return '⏱️ Timeout';
      default: return '❓';
    }
  };

  return (
    <div className="swarm-visualizer">
      <div className="swarm-header">
        <h3>🐝 Agent Swarm</h3>
        <label className="realtime-toggle">
          <input
            type="checkbox"
            checked={isRealTime}
            onChange={(e) => setIsRealTime(e.target.checked)}
          />
          Real-time updates
        </label>
      </div>

      <div className="swarm-grid">
        {subAgents.map((agent) => (
          <div
            key={agent.id}
            className={`agent-card ${selectedAgent === agent.id ? 'selected' : ''}`}
            onClick={() => setSelectedAgent(agent.id)}
          >
            <div className="agent-header">
              <span className="agent-icon">{getRoleIcon(agent.role)}</span>
              <span className="agent-role">{agent.role}</span>
              <span 
                className="agent-status"
                style={{ backgroundColor: getStatusColor(agent.status) }}
              />
            </div>
            
            <div className="agent-details">
              <div className="agent-id">{agent.id}</div>
              {agent.currentTask && (
                <div className="agent-task" title={agent.currentTask}>
                  {agent.currentTask}
                </div>
              )}
              
              <div className="agent-load">
                <span>Load:</span>
                <div className="load-bar-container">
                  <div 
                    className="load-bar"
                    style={{ 
                      width: `${agent.load}%`,
                      backgroundColor: agent.load > 80 ? '#e74c3c' : agent.load > 50 ? '#f39c12' : '#27ae60'
                    }}
                  />
                </div>
                <span>{agent.load.toFixed(0)}%</span>
              </div>
              
              <div className="agent-last-active">
                Last active: {agent.lastActive.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedAgent && (
        <div className="agent-detail-panel">
          <h4>Agent Details: {selectedAgent}</h4>
          {/* Additional detail view can be expanded here */}
        </div>
      )}

      <div className="debate-section">
        <h4>🗳️ Consensus & Debate Log</h4>
        <div className="debate-log">
          {debateLog.map((debate, index) => (
            <div key={index} className="debate-entry">
              <div className="debate-header">
                <span className="debate-time">{debate.timestamp.toLocaleTimeString()}</span>
                <span className="debate-mechanism">{getMechanismBadge(debate.mechanism)}</span>
              </div>
              <div className="debate-topic">{debate.topic}</div>
              <div className="debate-votes">
                {Object.entries(debate.votes).map(([agentId, vote]) => (
                  <span 
                    key={agentId}
                    className={`vote-badge ${vote === 'YES' ? 'yes' : 'no'}`}
                  >
                    {agentId}: {vote}
                  </span>
                ))}
              </div>
              <div className="debate-result">{debate.result}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SwarmVisualizer;
