import React, { useState } from 'react';
import './MemoryManager.css';

interface MemoryManagerProps {
  agentId: string;
}

interface EpisodicEvent {
  id: string;
  timestamp: Date;
  description: string;
  emotionalWeight: number;
  tags: string[];
  relatedEntities: string[];
}

interface SemanticFact {
  id: string;
  concept: string;
  definition: string;
  confidence: number;
  sources: string[];
  relationships: Array<{ type: string; target: string }>;
}

interface ProceduralSkill {
  id: string;
  name: string;
  category: string;
  successRate: number;
  usageCount: number;
  lastUsed: Date;
  pattern: string;
}

const MemoryManager: React.FC<MemoryManagerProps> = ({ agentId }) => {
  const [activeTab, setActiveTab] = useState<'episodic' | 'semantic' | 'procedural'>('episodic');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemory, setSelectedMemory] = useState<string | null>(null);

  // Mock data - in real implementation, fetch from backend
  const episodicMemories: EpisodicEvent[] = [
    {
      id: 'epi-1',
      timestamp: new Date(Date.now() - 3600000),
      description: 'Successfully executed TON transaction for user',
      emotionalWeight: 85,
      tags: ['transaction', 'success', 'ton'],
      relatedEntities: ['user-123', 'wallet-abc'],
    },
    {
      id: 'epi-2',
      timestamp: new Date(Date.now() - 7200000),
      description: 'Failed to connect to external API - timeout',
      emotionalWeight: -45,
      tags: ['error', 'api', 'timeout'],
      relatedEntities: ['api-service-x'],
    },
    {
      id: 'epi-3',
      timestamp: new Date(Date.now() - 86400000),
      description: 'Learned new pattern for DEX arbitrage',
      emotionalWeight: 92,
      tags: ['learning', 'dex', 'arbitrage'],
      relatedEntities: ['dex-raydium', 'pattern-45'],
    },
  ];

  const semanticMemories: SemanticFact[] = [
    {
      id: 'sem-1',
      concept: 'TON Blockchain',
      definition: 'The Open Network is a decentralized layer-1 blockchain',
      confidence: 98,
      sources: ['official-docs', 'user-interaction'],
      relationships: [
        { type: 'uses', target: 'Proof-of-Stake' },
        { type: 'supports', target: 'Smart Contracts' },
      ],
    },
    {
      id: 'sem-2',
      concept: 'Arbitrage',
      definition: 'Simultaneous buying and selling to profit from price differences',
      confidence: 95,
      sources: ['learning-module', 'practice'],
      relationships: [
        { type: 'requires', target: 'Multiple DEXes' },
        { type: 'risk', target: 'Slippage' },
      ],
    },
  ];

  const proceduralMemories: ProceduralSkill[] = [
    {
      id: 'proc-1',
      name: 'DEX Arbitrage Detection',
      category: 'Trading',
      successRate: 78,
      usageCount: 145,
      lastUsed: new Date(Date.now() - 1800000),
      pattern: 'scan-dexes -> compare-prices -> calculate-profit -> execute-if-positive',
    },
    {
      id: 'proc-2',
      name: 'User Intent Classification',
      category: 'Communication',
      successRate: 92,
      usageCount: 523,
      lastUsed: new Date(),
      pattern: 'parse-input -> extract-entities -> match-intent -> confirm',
    },
    {
      id: 'proc-3',
      name: 'Error Recovery Strategy',
      category: 'Resilience',
      successRate: 65,
      usageCount: 34,
      lastUsed: new Date(Date.now() - 7200000),
      pattern: 'detect-error -> analyze-cause -> retry-or-fallback -> log',
    },
  ];

  const getEmotionalColor = (weight: number) => {
    if (weight > 50) return '#27ae60';
    if (weight > 0) return '#f39c12';
    return '#e74c3c';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence > 90) return '#27ae60';
    if (confidence > 70) return '#f39c12';
    return '#e74c3c';
  };

  return (
    <div className="memory-manager">
      <div className="memory-header">
        <h3>💾 Memory Management</h3>
        <div className="memory-stats">
          <span className="stat">Episodic: {episodicMemories.length}</span>
          <span className="stat">Semantic: {semanticMemories.length}</span>
          <span className="stat">Procedural: {proceduralMemories.length}</span>
        </div>
      </div>

      <div className="memory-tabs">
        <button
          className={`tab ${activeTab === 'episodic' ? 'active' : ''}`}
          onClick={() => setActiveTab('episodic')}
        >
          📅 Episodic (Events)
        </button>
        <button
          className={`tab ${activeTab === 'semantic' ? 'active' : ''}`}
          onClick={() => setActiveTab('semantic')}
        >
          🧠 Semantic (Knowledge)
        </button>
        <button
          className={`tab ${activeTab === 'procedural' ? 'active' : ''}`}
          onClick={() => setActiveTab('procedural')}
        >
          ⚙️ Procedural (Skills)
        </button>
      </div>

      <div className="memory-search">
        <input
          type="text"
          placeholder="Search memories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {activeTab === 'episodic' && (
        <div className="episodic-section">
          <h4>📅 Episodic Memory Timeline</h4>
          <div className="timeline">
            {episodicMemories.map((event) => (
              <div
                key={event.id}
                className={`timeline-event ${selectedMemory === event.id ? 'selected' : ''}`}
                onClick={() => setSelectedMemory(event.id)}
              >
                <div className="event-marker" style={{ backgroundColor: getEmotionalColor(event.emotionalWeight) }} />
                <div className="event-content">
                  <div className="event-time">{event.timestamp.toLocaleString()}</div>
                  <div className="event-description">{event.description}</div>
                  <div className="event-meta">
                    <span className="emotional-weight" style={{ color: getEmotionalColor(event.emotionalWeight) }}>
                      Weight: {event.emotionalWeight}
                    </span>
                    <div className="event-tags">
                      {event.tags.map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="event-entities">
                    Related: {event.relatedEntities.join(', ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'semantic' && (
        <div className="semantic-section">
          <h4>🧠 Semantic Knowledge Graph</h4>
          <div className="knowledge-cards">
            {semanticMemories.map((fact) => (
              <div
                key={fact.id}
                className={`knowledge-card ${selectedMemory === fact.id ? 'selected' : ''}`}
                onClick={() => setSelectedMemory(fact.id)}
              >
                <div className="concept-header">
                  <h5>{fact.concept}</h5>
                  <span 
                    className="confidence-badge"
                    style={{ backgroundColor: getConfidenceColor(fact.confidence) }}
                  >
                    {fact.confidence}%
                  </span>
                </div>
                <p className="definition">{fact.definition}</p>
                <div className="sources">
                  Sources: {fact.sources.join(', ')}
                </div>
                <div className="relationships">
                  <strong>Relationships:</strong>
                  <ul>
                    {fact.relationships.map((rel, idx) => (
                      <li key={idx}>{rel.type} → {rel.target}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'procedural' && (
        <div className="procedural-section">
          <h4>⚙️ Procedural Skills & Patterns</h4>
          <div className="skills-grid">
            {proceduralMemories.map((skill) => (
              <div
                key={skill.id}
                className={`skill-card ${selectedMemory === skill.id ? 'selected' : ''}`}
                onClick={() => setSelectedMemory(skill.id)}
              >
                <div className="skill-header">
                  <span className="skill-name">{skill.name}</span>
                  <span className="skill-category">{skill.category}</span>
                </div>
                <div className="skill-stats">
                  <div className="stat-row">
                    <span>Success Rate:</span>
                    <span className={skill.successRate > 80 ? 'good' : skill.successRate > 60 ? 'medium' : 'low'}>
                      {skill.successRate}%
                    </span>
                  </div>
                  <div className="stat-row">
                    <span>Usage Count:</span>
                    <span>{skill.usageCount}</span>
                  </div>
                  <div className="stat-row">
                    <span>Last Used:</span>
                    <span>{skill.lastUsed.toLocaleString()}</span>
                  </div>
                </div>
                <div className="skill-pattern">
                  <strong>Pattern:</strong>
                  <code>{skill.pattern}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedMemory && (
        <div className="memory-detail-panel">
          <h4>Memory Details</h4>
          <button onClick={() => setSelectedMemory(null)}>Close</button>
          {/* Expanded detail view */}
        </div>
      )}
    </div>
  );
};

export default MemoryManager;
