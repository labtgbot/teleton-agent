import { useState, useEffect } from 'react';
import { WidgetWrapper } from './WidgetWrapper';

interface DaoProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  status: 'active' | 'voting' | 'accepted' | 'rejected';
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  endTime: number;
  category: string;
}

interface Constitution {
  enabled: boolean;
  strictMode: boolean;
  principles: Array<{
    id: string;
    name: string;
    priority: number;
    enabled: boolean;
  }>;
  safetyLimits: {
    maxTONTransaction: number;
    maxDailySpending: number;
    restrictedTools: string[];
  };
}

interface DaoData {
  proposals: DaoProposal[];
  summary: {
    totalProposals: number;
    activeProposals: number;
    passedProposals: number;
  };
}

interface SecuritySettings {
  constitution: Constitution;
  autonomyLimits: {
    currentLevel: string;
    maxTONTransaction: number;
    maxDailySpending: number;
  };
}

export function DaoSecurityWidget() {
  const [activeTab, setActiveTab] = useState<'proposals' | 'constitution'>('proposals');
  const [daoData, setDaoData] = useState<DaoData | null>(null);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votingProposal, setVotingProposal] = useState<string | null>(null);
  const [selectedVote, setSelectedVote] = useState<'for' | 'against' | 'abstain'>('for');
  const [rationale, setRationale] = useState('');

  const fetchData = async () => {
    try {
      const [daoRes, securityRes] = await Promise.all([
        fetch('/api/super-agent/dao/proposals'),
        fetch('/api/super-agent/constitution'),
      ]);
      
      const daoJson = await daoRes.json();
      const securityJson = await securityRes.json();
      
      if (daoJson.success) setDaoData(daoJson.data);
      if (securityJson.success) setSecuritySettings(securityJson.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch DAO/Security data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleVote = async (proposalId: string) => {
    try {
      const res = await fetch('/api/super-agent/dao/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId,
          vote: selectedVote,
          rationale: rationale || undefined,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        await fetchData();
        setVotingProposal(null);
        setRationale('');
      } else {
        setError(data.error || 'Failed to submit vote');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
    }
  };

  if (loading) return <div className="loading">Loading DAO & Security...</div>;
  if (error) return <div className="alert error">{error}</div>;

  return (
    <div className="dao-security-widget" style={{ padding: '12px' }}>
      {/* ── Tab Navigation ── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>
        <button
          className={`btn-sm ${activeTab === 'proposals' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('proposals')}
          style={{ fontSize: '11px' }}
        >
          🗳️ DAO Proposals
        </button>
        <button
          className={`btn-sm ${activeTab === 'constitution' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('constitution')}
          style={{ fontSize: '11px' }}
        >
          📜 Constitution
        </button>
      </div>

      {/* ── DAO Proposals Tab ── */}
      {activeTab === 'proposals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>
              Active Proposals ({daoData?.summary.activeProposals || 0})
            </h4>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>
              Total: {daoData?.summary.totalProposals || 0} | Passed: {daoData?.summary.passedProposals || 0}
            </div>
          </div>
          
          {!daoData || daoData.proposals.length === 0 ? (
            <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
              No active proposals
            </div>
          ) : (
            <div style={{ maxHeight: '280px', overflow: 'auto' }}>
              {daoData.proposals.map((proposal) => {
                const isVoting = votingProposal === proposal.id;
                const totalVotes = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
                const timeLeft = new Date(proposal.endTime).getTime() - Date.now();
                const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));
                
                return (
                  <div 
                    key={proposal.id}
                    style={{ 
                      padding: '10px',
                      borderBottom: '1px solid #e5e7eb',
                      background: isVoting ? '#f3f4f6' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', fontWeight: 600 }}>{proposal.title}</div>
                        <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '2px' }}>
                          {proposal.description?.slice(0, 100)}{proposal.description?.length > 100 ? '...' : ''}
                        </div>
                        <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '4px' }}>
                          <span>📁 {proposal.category}</span> • 
                          <span> ⏰ {hoursLeft}h left</span> • 
                          <span> 🗳️ {totalVotes} votes</span>
                        </div>
                      </div>
                      <span style={{ 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        fontSize: '9px',
                        background: proposal.status === 'active' ? '#d1fae5' : '#fef3c7',
                        color: proposal.status === 'active' ? '#065f46' : '#92400e',
                      }}>
                        {proposal.status.toUpperCase()}
                      </span>
                    </div>
                    
                    {/* Vote Progress Bar */}
                    {totalVotes > 0 && (
                      <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', marginTop: '8px' }}>
                        <div style={{ 
                          width: `${(proposal.votesFor / totalVotes) * 100}%`, 
                          background: '#10b981' 
                        }} title={`For: ${proposal.votesFor}`} />
                        <div style={{ 
                          width: `${(proposal.votesAbstain / totalVotes) * 100}%`, 
                          background: '#6b7280' 
                        }} title={`Abstain: ${proposal.votesAbstain}`} />
                        <div style={{ 
                          width: `${(proposal.votesAgainst / totalVotes) * 100}%`, 
                          background: '#ef4444' 
                        }} title={`Against: ${proposal.votesAgainst}`} />
                      </div>
                    )}
                    
                    {/* Voting Interface */}
                    {isVoting && proposal.status === 'active' && (
                      <div style={{ marginTop: '10px', padding: '10px', background: 'white', borderRadius: '6px' }}>
                        <div style={{ fontSize: '11px', marginBottom: '8px' }}>Cast your vote:</div>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                          <button
                            className={`btn-sm ${selectedVote === 'for' ? 'btn-success' : 'btn-ghost'}`}
                            onClick={() => setSelectedVote('for')}
                            style={{ fontSize: '10px', flex: 1 }}
                          >
                            👍 For
                          </button>
                          <button
                            className={`btn-sm ${selectedVote === 'against' ? 'btn-danger' : 'btn-ghost'}`}
                            onClick={() => setSelectedVote('against')}
                            style={{ fontSize: '10px', flex: 1 }}
                          >
                            👎 Against
                          </button>
                          <button
                            className={`btn-sm ${selectedVote === 'abstain' ? 'btn-ghost active' : 'btn-ghost'}`}
                            onClick={() => setSelectedVote('abstain')}
                            style={{ fontSize: '10px', flex: 1 }}
                          >
                            ➖ Abstain
                          </button>
                        </div>
                        <textarea
                          placeholder="Rationale (optional)"
                          value={rationale}
                          onChange={(e) => setRationale(e.target.value)}
                          style={{ width: '100%', fontSize: '10px', padding: '6px', minHeight: '50px', boxSizing: 'border-box', resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <button 
                            className="btn-primary btn-sm" 
                            onClick={() => handleVote(proposal.id)}
                            style={{ fontSize: '10px', flex: 1 }}
                          >
                            Submit Vote
                          </button>
                          <button 
                            className="btn-ghost btn-sm" 
                            onClick={() => setVotingProposal(null)}
                            style={{ fontSize: '10px' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {!isVoting && proposal.status === 'active' && (
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => setVotingProposal(proposal.id)}
                        style={{ fontSize: '10px', marginTop: '8px' }}
                      >
                        🗳️ Vote
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Constitution Tab ── */}
      {activeTab === 'constitution' && (
        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600 }}>Constitution & Safety</h4>
          
          {!securitySettings ? (
            <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic', padding: '20px', textAlign: 'center' }}>
              Loading constitution...
            </div>
          ) : (
            <>
              {/* Status Indicators */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <div style={{ 
                  padding: '8px', 
                  background: securitySettings.constitution.enabled ? '#d1fae5' : '#fee2e2',
                  borderRadius: '6px',
                  flex: 1,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>Status</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: securitySettings.constitution.enabled ? '#065f46' : '#991b1b' }}>
                    {securitySettings.constitution.enabled ? '✅ Active' : '❌ Disabled'}
                  </div>
                </div>
                <div style={{ 
                  padding: '8px', 
                  background: securitySettings.constitution.strictMode ? '#dbeafe' : '#fef3c7',
                  borderRadius: '6px',
                  flex: 1,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '9px', color: '#6b7280' }}>Mode</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: securitySettings.constitution.strictMode ? '#1e40af' : '#92400e' }}>
                    {securitySettings.constitution.strictMode ? '🔒 Strict' : '⚡ Flexible'}
                  </div>
                </div>
              </div>

              {/* Principles */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>PRINCIPLES</div>
                {securitySettings.constitution.principles.map((principle) => (
                  <div 
                    key={principle.id}
                    style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px',
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: '10px'
                    }}
                  >
                    <span>
                      {principle.enabled ? '✅' : '⭕'} {principle.name}
                      <span style={{ color: '#6b7280', marginLeft: '4px' }}>(Priority {principle.priority})</span>
                    </span>
                  </div>
                ))}
              </div>

              {/* Safety Limits */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }}>SAFETY LIMITS</div>
                <div style={{ 
                  padding: '8px', 
                  background: '#f9fafb', 
                  borderRadius: '6px',
                  fontSize: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Max TON Transaction:</span>
                    <span style={{ fontWeight: 600 }}>{securitySettings.autonomyLimits.maxTONTransaction} TON</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Max Daily Spending:</span>
                    <span style={{ fontWeight: 600 }}>{securitySettings.autonomyLimits.maxDailySpending} TON</span>
                  </div>
                  <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '9px', color: '#6b7280', marginBottom: '2px' }}>Restricted Tools:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {securitySettings.constitution.safetyLimits.restrictedTools.map((tool, i) => (
                        <span 
                          key={i}
                          style={{ 
                            padding: '2px 6px', 
                            background: '#fee2e2', 
                            color: '#991b1b',
                            borderRadius: '4px',
                            fontSize: '9px'
                          }}
                        >
                          🚫 {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
