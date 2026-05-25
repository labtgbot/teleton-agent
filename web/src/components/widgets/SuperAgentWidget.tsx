import { useState, useEffect } from 'react';
import { WidgetWrapper } from './WidgetWrapper';
import { api } from '../../lib/api';

interface AutonomyStatus {
  currentLevel: string;
  metrics: {
    decisionsMade: number;
    humanOverrides: number;
    successRate: number;
  };
  pendingApprovals: number;
}

interface ConsciousnessStatus {
  level: 'REACTIVE' | 'TACTICAL' | 'STRATEGIC' | 'META_COGNITION';
  description: string;
}

interface EmotionStatus {
  primary: string;
  intensity: number;
  valence: number;
  arousal: number;
  timestamp: number;
}

interface SuperAgentStatus {
  autonomy: AutonomyStatus;
  consciousness: ConsciousnessStatus;
  emotions: EmotionStatus;
  timestamp: number;
}

const AUTONOMY_LEVELS: Record<string, { label: string; color: string }> = {
  LEVEL_0_MANUAL: { label: 'Manual', color: '#6b7280' },
  LEVEL_1_SUPERVISED: { label: 'Supervised', color: '#f59e0b' },
  LEVEL_2_SEMI_AUTONOMOUS: { label: 'Semi-Autonomous', color: '#3b82f6' },
  LEVEL_3_FULLY_AUTONOMOUS: { label: 'Fully Autonomous', color: '#10b981' },
  LEVEL_4_GOD_MODE: { label: 'God Mode', color: '#8b5cf6' },
};

const CONSCIOUSNESS_COLORS: Record<string, string> = {
  REACTIVE: '#6b7280',
  TACTICAL: '#3b82f6',
  STRATEGIC: '#10b981',
  META_COGNITION: '#8b5cf6',
};

const EMOTION_COLORS: Record<string, string> = {
  neutral: '#6b7280',
  curious: '#3b82f6',
  confident: '#10b981',
  cautious: '#f59e0b',
  focused: '#8b5cf6',
  creative: '#ec4899',
};

export function SuperAgentWidget() {
  const [status, setStatus] = useState<SuperAgentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/super-agent/status');
      const data = await res.json();
      if (data.success) {
        setStatus(data.data);
      } else {
        setError(data.error || 'Failed to fetch status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLevelChange = async (newLevel: string) => {
    setPendingChange(newLevel);
    setConfirmText('');
  };

  const confirmLevelChange = async () => {
    if (!pendingChange) return;
    
    try {
      const res = await fetch('/api/super-agent/autonomy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: pendingChange,
          reason: 'User requested via dashboard',
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
        setPendingChange(null);
        setConfirmText('');
      } else {
        setError(data.error || 'Failed to change autonomy level');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change autonomy level');
    }
  };

  const cancelLevelChange = () => {
    setPendingChange(null);
    setConfirmText('');
  };

  if (loading) return <div className="loading">Loading Super-Agent status...</div>;
  if (error) return <div className="alert error">{error}</div>;
  if (!status) return null;

  const autonomyInfo = AUTONOMY_LEVELS[status.autonomy.currentLevel] || { 
    label: status.autonomy.currentLevel, 
    color: '#6b7280' 
  };

  return (
    <div className="super-agent-widget" style={{ padding: '12px' }}>
      {/* ── Autonomy Level Widget ── */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>Autonomy Level</h4>
          {!pendingChange && (
            <button 
              className="btn-ghost btn-sm"
              onClick={() => handleLevelChange(status.autonomy.currentLevel)}
              title="Change autonomy level"
            >
              ✏️
            </button>
          )}
        </div>
        
        <div 
          style={{ 
            padding: '12px', 
            borderRadius: '8px', 
            background: `${autonomyInfo.color}20`,
            borderLeft: `4px solid ${autonomyInfo.color}`,
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 700, color: autonomyInfo.color }}>
            {autonomyInfo.label}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
            Success Rate: {status.autonomy.metrics.successRate.toFixed(1)}% | 
            Decisions: {status.autonomy.metrics.decisionsMade} | 
            Overrides: {status.autonomy.metrics.humanOverrides}
          </div>
        </div>

        {pendingChange && (
          <div style={{ marginTop: '8px', padding: '12px', background: '#fef3c7', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', marginBottom: '8px' }}>
              Confirm change to <strong>{AUTONOMY_LEVELS[pendingChange]?.label || pendingChange}</strong>?
            </div>
            <input
              type="text"
              placeholder="Type CONFIRM to confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              style={{ width: '100%', padding: '6px', fontSize: '12px', marginBottom: '8px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn-primary btn-sm" 
                onClick={confirmLevelChange}
                disabled={confirmText !== 'CONFIRM'}
                style={{ opacity: confirmText !== 'CONFIRM' ? 0.5 : 1 }}
              >
                Confirm
              </button>
              <button className="btn-ghost btn-sm" onClick={cancelLevelChange}>Cancel</button>
            </div>
          </div>
        )}

        {status.autonomy.pendingApprovals > 0 && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#f59e0b' }}>
            ⚠️ {status.autonomy.pendingApprovals} pending approval(s)
          </div>
        )}
      </div>

      {/* ── Consciousness Level Widget ── */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600 }}>Consciousness Level</h4>
        <div 
          style={{ 
            padding: '12px', 
            borderRadius: '8px', 
            background: `${CONSCIOUSNESS_COLORS[status.consciousness.level] || '#6b7280'}20`,
            borderLeft: `4px solid ${CONSCIOUSNESS_COLORS[status.consciousness.level] || '#6b7280'}`,
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 600, color: CONSCIOUSNESS_COLORS[status.consciousness.level] || '#6b7280' }}>
            {status.consciousness.level.replace('_', ' ')}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
            {status.consciousness.description}
          </div>
        </div>
      </div>

      {/* ── Emotion Feed Widget ── */}
      <div>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600 }}>Emotional State (EQ)</h4>
        <div 
          style={{ 
            padding: '12px', 
            borderRadius: '8px', 
            background: `${EMOTION_COLORS[status.emotions.primary.toLowerCase()] || '#6b7280'}20`,
            borderLeft: `4px solid ${EMOTION_COLORS[status.emotions.primary.toLowerCase()] || '#6b7280'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '20px' }}>
              {status.emotions.intensity > 0.7 ? '🔥' : status.emotions.intensity > 0.4 ? '💡' : '💭'}
            </span>
            <span style={{ fontSize: '16px', fontWeight: 600, color: EMOTION_COLORS[status.emotions.primary.toLowerCase()] || '#6b7280' }}>
              {status.emotions.primary}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
            <div>
              <span style={{ color: '#6b7280' }}>Intensity:</span>{' '}
              <span style={{ fontWeight: 500 }}>{(status.emotions.intensity * 100).toFixed(0)}%</span>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Valence:</span>{' '}
              <span style={{ fontWeight: 500 }}>{status.emotions.valence > 0 ? '+' : ''}{status.emotions.valence.toFixed(2)}</span>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Arousal:</span>{' '}
              <span style={{ fontWeight: 500 }}>{status.emotions.arousal.toFixed(2)}</span>
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Updated:</span>{' '}
              <span style={{ fontWeight: 500 }}>{new Date(status.emotions.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
