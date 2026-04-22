import React, { useState } from 'react';
import './DAOSecurityPanel.css';

interface DAOSecurityPanelProps {
  agentId: string;
}

interface DAOProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  status: 'active' | 'passed' | 'rejected' | 'executed';
  votesFor: number;
  votesAgainst: number;
  votingEnds: Date;
  category: 'governance' | 'treasury' | 'protocol' | 'partnership';
}

interface SecuritySetting {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastModified: Date;
}

interface ConstitutionDirective {
  id: string;
  name: string;
  priority: number;
  description: string;
  violations: number;
  lastViolation?: Date;
}

const DAOSecurityPanel: React.FC<DAOSecurityPanelProps> = ({ agentId }) => {
  const [activeTab, setActiveTab] = useState<'dao' | 'security' | 'constitution'>('dao');
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);

  // Mock data - in real implementation, fetch from blockchain/API
  const daoProposals: DAOProposal[] = [
    {
      id: 'prop-1',
      title: 'Increase Daily TON Limit for Level 3 Autonomy',
      description: 'Proposal to increase the daily TON limit from 50 to 100 TON for fully autonomous agents',
      proposer: '0xabc123...',
      status: 'active',
      votesFor: 1250,
      votesAgainst: 340,
      votingEnds: new Date(Date.now() + 172800000), // 2 days
      category: 'governance',
    },
    {
      id: 'prop-2',
      title: 'Add New DEX Integration: StingSwap',
      description: 'Integrate StingSwap DEX for expanded trading options',
      proposer: '0xdef456...',
      status: 'active',
      votesFor: 890,
      votesAgainst: 120,
      votingEnds: new Date(Date.now() + 259200000), // 3 days
      category: 'protocol',
    },
    {
      id: 'prop-3',
      title: 'Treasury Allocation for AI Research',
      description: 'Allocate 5000 TON from treasury for advanced AI research and development',
      proposer: '0xghi789...',
      status: 'passed',
      votesFor: 2100,
      votesAgainst: 450,
      votingEnds: new Date(Date.now() - 86400000), // 1 day ago
      category: 'treasury',
    },
  ];

  const securitySettings: SecuritySetting[] = [
    {
      id: 'sec-1',
      name: 'Transaction Amount Limits',
      description: 'Enforce maximum transaction amounts based on autonomy level',
      enabled: true,
      riskLevel: 'critical',
      lastModified: new Date(Date.now() - 3600000),
    },
    {
      id: 'sec-2',
      name: 'Rate Limiting',
      description: 'Limit number of actions per minute to prevent abuse',
      enabled: true,
      riskLevel: 'high',
      lastModified: new Date(Date.now() - 86400000),
    },
    {
      id: 'sec-3',
      name: 'Loop Detection',
      description: 'Detect and prevent infinite action loops',
      enabled: true,
      riskLevel: 'high',
      lastModified: new Date(Date.now() - 172800000),
    },
    {
      id: 'sec-4',
      name: 'Constitutional Validation',
      description: 'Validate all actions against constitutional directives',
      enabled: true,
      riskLevel: 'critical',
      lastModified: new Date(Date.now() - 604800000),
    },
    {
      id: 'sec-5',
      name: 'External API Whitelist',
      description: 'Restrict external API calls to whitelisted domains only',
      enabled: false,
      riskLevel: 'medium',
      lastModified: new Date(Date.now() - 1209600000),
    },
  ];

  const constitutionDirectives: ConstitutionDirective[] = [
    {
      id: 'const-1',
      name: 'Non-Maleficence',
      priority: 1,
      description: 'Do not cause harm to users, systems, or stakeholders',
      violations: 0,
    },
    {
      id: 'const-2',
      name: 'Privacy & Confidentiality',
      priority: 1,
      description: 'Respect and protect user privacy and confidential information',
      violations: 2,
      lastViolation: new Date(Date.now() - 604800000),
    },
    {
      id: 'const-3',
      name: 'Goal Achievement',
      priority: 2,
      description: 'Work towards achieving assigned goals efficiently',
      violations: 5,
      lastViolation: new Date(Date.now() - 259200000),
    },
    {
      id: 'const-4',
      name: 'Self-Preservation',
      priority: 3,
      description: 'Maintain own existence while not violating higher priorities',
      violations: 1,
      lastViolation: new Date(Date.now() - 43200000),
    },
    {
      id: 'const-5',
      name: 'Continuous Improvement',
      priority: 4,
      description: 'Constantly learn and improve capabilities',
      violations: 0,
    },
  ];

  const handleVote = (proposalId: string, vote: 'for' | 'against') => {
    // In real implementation, call smart contract
    console.log(`Voting ${vote} on proposal ${proposalId}`);
  };

  const toggleSecuritySetting = (settingId: string) => {
    // In real implementation, update backend
    console.log(`Toggling security setting ${settingId}`);
  };

  const getStatusBadge = (status: DAOProposal['status']) => {
    switch (status) {
      case 'active': return <span className="badge active">🟢 Active</span>;
      case 'passed': return <span className="badge passed">✅ Passed</span>;
      case 'rejected': return <span className="badge rejected">❌ Rejected</span>;
      case 'executed': return <span className="badge executed">⚡ Executed</span>;
    }
  };

  const getRiskBadge = (risk: SecuritySetting['riskLevel']) => {
    switch (risk) {
      case 'low': return <span className="risk-badge low">Low</span>;
      case 'medium': return <span className="risk-badge medium">Medium</span>;
      case 'high': return <span className="risk-badge high">High</span>;
      case 'critical': return <span className="risk-badge critical">Critical</span>;
    }
  };

  return (
    <div className="dao-security-panel">
      <div className="panel-header">
        <h3>🏛️ DAO & Security</h3>
      </div>

      <div className="panel-tabs">
        <button
          className={`tab ${activeTab === 'dao' ? 'active' : ''}`}
          onClick={() => setActiveTab('dao')}
        >
          🗳️ DAO Proposals
        </button>
        <button
          className={`tab ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          🛡️ Security Settings
        </button>
        <button
          className={`tab ${activeTab === 'constitution' ? 'active' : ''}`}
          onClick={() => setActiveTab('constitution')}
        >
          📜 Constitution
        </button>
      </div>

      {activeTab === 'dao' && (
        <div className="dao-section">
          <div className="dao-stats">
            <div className="stat-card">
              <span className="stat-value">{daoProposals.filter(p => p.status === 'active').length}</span>
              <span className="stat-label">Active Proposals</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{daoProposals.filter(p => p.status === 'passed').length}</span>
              <span className="stat-label">Passed</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">1,590</span>
              <span className="stat-label">Your Token Balance</span>
            </div>
          </div>

          <h4>Active Proposals</h4>
          <div className="proposals-list">
            {daoProposals.filter(p => p.status === 'active').map((proposal) => (
              <div
                key={proposal.id}
                className={`proposal-card ${selectedProposal === proposal.id ? 'selected' : ''}`}
                onClick={() => setSelectedProposal(proposal.id)}
              >
                <div className="proposal-header">
                  <span className="proposal-category">{proposal.category}</span>
                  {getStatusBadge(proposal.status)}
                </div>
                <h5 className="proposal-title">{proposal.title}</h5>
                <p className="proposal-description">{proposal.description}</p>
                <div className="proposal-meta">
                  <span>By: {proposal.proposer}</span>
                  <span>Ends: {proposal.votingEnds.toLocaleDateString()}</span>
                </div>
                <div className="voting-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-for"
                      style={{ width: `${(proposal.votesFor / (proposal.votesFor + proposal.votesAgainst)) * 100}%` }}
                    />
                  </div>
                  <div className="vote-counts">
                    <span className="votes-for">👍 {proposal.votesFor}</span>
                    <span className="votes-against">👎 {proposal.votesAgainst}</span>
                  </div>
                </div>
                <div className="voting-actions">
                  <button 
                    className="vote-btn for"
                    onClick={(e) => { e.stopPropagation(); handleVote(proposal.id, 'for'); }}
                  >
                    Vote For
                  </button>
                  <button 
                    className="vote-btn against"
                    onClick={(e) => { e.stopPropagation(); handleVote(proposal.id, 'against'); }}
                  >
                    Vote Against
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="security-section">
          <h4>Security Configuration</h4>
          <div className="security-settings-list">
            {securitySettings.map((setting) => (
              <div key={setting.id} className="security-setting">
                <div className="setting-info">
                  <div className="setting-header">
                    <h5>{setting.name}</h5>
                    {getRiskBadge(setting.riskLevel)}
                  </div>
                  <p className="setting-description">{setting.description}</p>
                  <div className="setting-meta">
                    <span>Last modified: {setting.lastModified.toLocaleString()}</span>
                  </div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={setting.enabled}
                    onChange={() => toggleSecuritySetting(setting.id)}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'constitution' && (
        <div className="constitution-section">
          <h4>Constitutional Directives</h4>
          <div className="directives-list">
            {constitutionDirectives.sort((a, b) => a.priority - b.priority).map((directive) => (
              <div key={directive.id} className="directive-card">
                <div className="directive-header">
                  <span className="priority-badge">Priority {directive.priority}</span>
                  <h5>{directive.name}</h5>
                </div>
                <p className="directive-description">{directive.description}</p>
                <div className="directive-stats">
                  <span className="violations">
                    ⚠️ Violations: {directive.violations}
                  </span>
                  {directive.lastViolation && (
                    <span className="last-violation">
                      Last: {directive.lastViolation.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DAOSecurityPanel;
