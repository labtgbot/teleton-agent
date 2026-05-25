import React, { useState, useEffect } from 'react';
import { useAutonomyLevel } from '../../hooks/useAutonomyLevel';
import { useConsciousnessState } from '../../hooks/useConsciousnessState';
import { useEmotionalState } from '../../hooks/useEmotionalState';
import AutonomyLevelWidget from './AutonomyLevelWidget';
import ConsciousnessIndicator from './ConsciousnessIndicator';
import EmotionFeed from './EmotionFeed';
import SwarmVisualizer from './SwarmVisualizer';
import MemoryManager from './MemoryManager';
import DAOSecurityPanel from './DAOSecurityPanel';
import './SuperAgentDashboard.css';

interface SuperAgentDashboardProps {
  agentId: string;
}

const SuperAgentDashboard: React.FC<SuperAgentDashboardProps> = ({ agentId }) => {
  const autonomyLevel = useAutonomyLevel(agentId);
  const consciousnessState = useConsciousnessState(agentId);
  const emotionalState = useEmotionalState(agentId);
  const [activeTab, setActiveTab] = useState<'overview' | 'swarm' | 'memory' | 'dao'>('overview');

  return (
    <div className="super-agent-dashboard">
      <header className="dashboard-header">
        <h1>🤖 Super Agent Dashboard</h1>
        <div className="agent-status">
          <span className={`status-indicator ${autonomyLevel.isActive ? 'active' : 'inactive'}`}>
            {autonomyLevel.isActive ? '🟢 Online' : '🔴 Offline'}
          </span>
          <span className="agent-id">ID: {agentId}</span>
        </div>
      </header>

      <nav className="dashboard-tabs">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={`tab ${activeTab === 'swarm' ? 'active' : ''}`}
          onClick={() => setActiveTab('swarm')}
        >
          🐝 Swarm
        </button>
        <button 
          className={`tab ${activeTab === 'memory' ? 'active' : ''}`}
          onClick={() => setActiveTab('memory')}
        >
          💾 Memory
        </button>
        <button 
          className={`tab ${activeTab === 'dao' ? 'active' : ''}`}
          onClick={() => setActiveTab('dao')}
        >
          🏛️ DAO & Security
        </button>
      </nav>

      <main className="dashboard-content">
        {activeTab === 'overview' && (
          <div className="overview-grid">
            <div className="widget-container">
              <AutonomyLevelWidget 
                currentLevel={autonomyLevel.level}
                onLevelChange={autonomyLevel.setLevel}
                isChanging={autonomyLevel.isChanging}
              />
            </div>
            
            <div className="widget-container">
              <ConsciousnessIndicator 
                currentLevel={consciousnessState.currentLevel}
                activityLog={consciousnessState.activityLog}
              />
            </div>
            
            <div className="widget-container full-width">
              <EmotionFeed 
                emotions={emotionalState.currentEmotions}
                history={emotionalState.history}
                internalState={emotionalState.internalState}
              />
            </div>
          </div>
        )}

        {activeTab === 'swarm' && (
          <div className="swarm-section">
            <SwarmVisualizer agentId={agentId} />
          </div>
        )}

        {activeTab === 'memory' && (
          <div className="memory-section">
            <MemoryManager agentId={agentId} />
          </div>
        )}

        {activeTab === 'dao' && (
          <div className="dao-section">
            <DAOSecurityPanel agentId={agentId} />
          </div>
        )}
      </main>
    </div>
  );
};

export default SuperAgentDashboard;
