/**
 * DaoSecurityWidget - DAO и настройки безопасности
 * 
 * Компоненты:
 * - Просмотр предложений DAO и голосование
 * - Настройки Конституции агента
 * - Лимиты безопасности
 */

import React, { useState, useEffect } from 'react';
import styles from './DaoSecurityWidget.module.css';

interface DaoProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  status: 'active' | 'voting' | 'completed' | 'executed';
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  endTime: number;
  requiredQuorum: number;
}

interface ConstitutionPrinciple {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
}

interface SafetyLimits {
  maxTONTransaction: number;
  maxDailySpending: number;
  restrictedTools: string[];
}

interface ConstitutionData {
  constitution: {
    enabled: boolean;
    strictMode: boolean;
    principles: ConstitutionPrinciple[];
    safetyLimits: SafetyLimits;
  };
  autonomyLimits: {
    currentLevel: string;
    maxTONTransaction: number;
    maxDailySpending: number;
  };
}

export const DaoSecurityWidget: React.FC = () => {
  const [proposals, setProposals] = useState<DaoProposal[]>([]);
  const [constitution, setConstitution] = useState<ConstitutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dao' | 'constitution'>('dao');
  const [votingProposal, setVotingProposal] = useState<{id: string, vote: 'for' | 'against' | 'abstain'} | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [proposalsRes, constitutionRes] = await Promise.all([
        fetch('/api/super-agent/dao/proposals'),
        fetch('/api/super-agent/constitution'),
      ]);
      
      const [proposalsData, constitutionData] = await Promise.all([
        proposalsRes.json(),
        constitutionRes.json(),
      ]);
      
      if (proposalsData.success) {
        setProposals(proposalsData.data?.proposals || []);
      }
      if (constitutionData.success) {
        setConstitution(constitutionData.data);
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
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleVote = async (proposalId: string, vote: 'for' | 'against' | 'abstain') => {
    setVotingProposal({ id: proposalId, vote });
    try {
      const response = await fetch('/api/super-agent/dao/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId, vote, rationale: 'Voted via dashboard' }),
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchData();
      } else {
        setError(data.error || 'Failed to vote');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setVotingProposal(null);
    }
  };

  const handleConstitutionChange = async (updates: Partial<ConstitutionData['constitution']>) => {
    if (!constitution) return;
    setSaving(true);
    try {
      const response = await fetch('/api/super-agent/constitution', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          constitution: { ...constitution.constitution, ...updates },
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchData();
      } else {
        setError(data.error || 'Failed to update constitution');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setSaving(false);
    }
  };

  const handleSafetyLimitChange = async (key: keyof SafetyLimits, value: any) => {
    if (!constitution) return;
    setSaving(true);
    try {
      const newLimits = { ...constitution.constitution.safetyLimits, [key]: value };
      const response = await fetch('/api/super-agent/constitution', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safetyLimits: newLimits }),
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchData();
      } else {
        setError(data.error || 'Failed to update limits');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setSaving(false);
    }
  };

  const formatTimeLeft = (endTime: number) => {
    const diff = endTime - Date.now();
    if (diff <= 0) return 'Завершено';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}ч ${minutes}м`;
  };

  const getProgressPercent = (forVotes: number, againstVotes: number, abstainVotes: number) => {
    const total = forVotes + againstVotes + abstainVotes;
    if (total === 0) return { for: 0, against: 0, abstain: 0 };
    return {
      for: (forVotes / total) * 100,
      against: (againstVotes / total) * 100,
      abstain: (abstainVotes / total) * 100,
    };
  };

  if (loading) {
    return <div className={styles.widget}><div className={styles.loading}>Загрузка...</div></div>;
  }

  if (error) {
    return <div className={styles.widget}><div className={styles.error}>{error}</div></div>;
  }

  return (
    <div className={styles.widget}>
      <h3 className={styles.title}>🏛️ DAO & Безопасность</h3>
      
      {/* Tabs */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'dao' ? styles.active : ''}`}
          onClick={() => setActiveTab('dao')}
        >
          🗳️ Предложения DAO ({proposals.length})
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'constitution' ? styles.active : ''}`}
          onClick={() => setActiveTab('constitution')}
        >
          📜 Конституция
        </button>
      </div>

      {/* DAO Proposals Tab */}
      {activeTab === 'dao' && (
        <div className={styles.daoContainer}>
          {proposals.length === 0 ? (
            <p className={styles.emptyState}>Нет активных предложений</p>
          ) : (
            <div className={styles.proposalsList}>
              {proposals.map((proposal) => {
                const progress = getProgressPercent(proposal.votesFor, proposal.votesAgainst, proposal.votesAbstain);
                return (
                  <div key={proposal.id} className={styles.proposalCard}>
                    <div className={styles.proposalHeader}>
                      <h4 className={styles.proposalTitle}>{proposal.title}</h4>
                      <span className={`${styles.badge} ${styles[proposal.status]}`}>
                        {proposal.status.toUpperCase()}
                      </span>
                    </div>
                    <p className={styles.proposalDescription}>{proposal.description}</p>
                    <p className={styles.proposalMeta}>
                      Автор: {proposal.proposer} • Окончание: {formatTimeLeft(proposal.endTime)}
                    </p>
                    
                    {/* Vote Progress */}
                    <div className={styles.voteProgress}>
                      <div className={styles.progressSegment} style={{ width: `${progress.for}%`, backgroundColor: '#28a745' }} />
                      <div className={styles.progressSegment} style={{ width: `${progress.against}%`, backgroundColor: '#dc3545' }} />
                      <div className={styles.progressSegment} style={{ width: `${progress.abstain}%`, backgroundColor: '#6c757d' }} />
                    </div>
                    <div className={styles.voteCounts}>
                      <span className={styles.voteFor}>✓ {proposal.votesFor}</span>
                      <span className={styles.voteAgainst}>✗ {proposal.votesAgainst}</span>
                      <span className={styles.voteAbstain}>○ {proposal.votesAbstain}</span>
                    </div>
                    
                    {/* Vote Actions */}
                    {proposal.status === 'active' || proposal.status === 'voting' ? (
                      <div className={styles.voteActions}>
                        <button 
                          className={styles.voteBtnFor}
                          onClick={() => handleVote(proposal.id, 'for')}
                          disabled={!!votingProposal}
                        >
                          За
                        </button>
                        <button 
                          className={styles.voteBtnAgainst}
                          onClick={() => handleVote(proposal.id, 'against')}
                          disabled={!!votingProposal}
                        >
                          Против
                        </button>
                        <button 
                          className={styles.voteBtnAbstain}
                          onClick={() => handleVote(proposal.id, 'abstain')}
                          disabled={!!votingProposal}
                        >
                          Воздержаться
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Constitution Tab */}
      {activeTab === 'constitution' && constitution && (
        <div className={styles.constitutionContainer}>
          {/* Principles */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Принципы Конституции</h4>
            <div className={styles.principlesList}>
              {constitution.constitution.principles.map((principle) => (
                <div key={principle.id} className={styles.principleItem}>
                  <div className={styles.principleInfo}>
                    <span className={styles.principleName}>{principle.name}</span>
                    <span className={styles.principlePriority}>Приоритет: {principle.priority}</span>
                  </div>
                  <label className={styles.toggle}>
                    <input 
                      type="checkbox" 
                      checked={principle.enabled}
                      onChange={() => {
                        const updated = constitution.constitution.principles.map(p => 
                          p.id === principle.id ? { ...p, enabled: !p.enabled } : p
                        );
                        handleConstitutionChange({ principles: updated });
                      }}
                      disabled={saving}
                    />
                    <span className={styles.toggleSlider}></span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Safety Limits */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Лимиты безопасности</h4>
            <div className={styles.limitsGrid}>
              <div className={styles.limitItem}>
                <label>Макс. транзакция (TON)</label>
                <input 
                  type="number" 
                  value={constitution.constitution.safetyLimits.maxTONTransaction}
                  onChange={(e) => handleSafetyLimitChange('maxTONTransaction', parseFloat(e.target.value) || 0)}
                  disabled={saving}
                  step="0.1"
                  min="0"
                />
              </div>
              <div className={styles.limitItem}>
                <label>Макс. расход в день (TON)</label>
                <input 
                  type="number" 
                  value={constitution.constitution.safetyLimits.maxDailySpending}
                  onChange={(e) => handleSafetyLimitChange('maxDailySpending', parseFloat(e.target.value) || 0)}
                  disabled={saving}
                  step="1"
                  min="0"
                />
              </div>
            </div>
            
            <div className={styles.restrictedTools}>
              <label>Запрещенные инструменты:</label>
              <div className={styles.toolsList}>
                {constitution.constitution.safetyLimits.restrictedTools.map((tool, i) => (
                  <span key={i} className={styles.toolTag}>{tool}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Autonomy Limits Info */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>Текущие лимиты автономности</h4>
            <div className={styles.autonomyInfo}>
              <p>Уровень: <strong>{constitution.autonomyLimits.currentLevel}</strong></p>
              <p>Макс. транзакция: <strong>{constitution.autonomyLimits.maxTONTransaction} TON</strong></p>
              <p>Макс. дневной расход: <strong>{constitution.autonomyLimits.maxDailySpending} TON</strong></p>
            </div>
          </div>

          {saving && <div className={styles.savingIndicator}>Сохранение...</div>}
        </div>
      )}
    </div>
  );
};

export default DaoSecurityWidget;
