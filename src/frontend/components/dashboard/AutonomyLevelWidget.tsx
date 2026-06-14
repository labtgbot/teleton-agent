import React, { useState } from 'react';
import { AutonomyLevel, AUTONOMY_LEVELS } from '../../../types/autonomy.js';
import './AutonomyLevelWidget.css';

interface AutonomyLevelWidgetProps {
  currentLevel: AutonomyLevel;
  onLevelChange: (level: AutonomyLevel, reason?: string) => Promise<void>;
  isChanging: boolean;
}

const AutonomyLevelWidget: React.FC<AutonomyLevelWidgetProps> = ({
  currentLevel,
  onLevelChange,
  isChanging,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<AutonomyLevel>(currentLevel);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');

  const handleLevelSelect = (level: AutonomyLevel) => {
    setSelectedLevel(level);
    if (level !== currentLevel) {
      setShowConfirmModal(true);
    }
  };

  const confirmLevelChange = async () => {
    if (confirmationText === 'I understand the risks') {
      await onLevelChange(selectedLevel, 'User initiated level change via dashboard');
      setShowConfirmModal(false);
      setConfirmationText('');
    }
  };

  const getLevelIcon = (level: AutonomyLevel) => {
    switch (level) {
      case 'LEVEL_0': return '🔒';
      case 'LEVEL_1': return '👁️';
      case 'LEVEL_2': return '⚡';
      case 'LEVEL_3': return '🚀';
      case 'LEVEL_4': return '⚠️';
      default: return '❓';
    }
  };

  const getLevelColor = (level: AutonomyLevel) => {
    switch (level) {
      case 'LEVEL_0': return 'level-0';
      case 'LEVEL_1': return 'level-1';
      case 'LEVEL_2': return 'level-2';
      case 'LEVEL_3': return 'level-3';
      case 'LEVEL_4': return 'level-4';
      default: return '';
    }
  };

  return (
    <div className="autonomy-level-widget">
      <h3>🎯 Autonomy Level</h3>
      
      <div className="current-level-display">
        <span className="level-icon">{getLevelIcon(currentLevel)}</span>
        <span className="level-name">{AUTONOMY_LEVELS[currentLevel].name}</span>
        <span className="level-description">{AUTONOMY_LEVELS[currentLevel].description}</span>
      </div>

      <div className="level-selector">
        {Object.entries(AUTONOMY_LEVELS).map(([key, config]) => (
          <button
            key={key}
            className={`level-option ${getLevelColor(key as AutonomyLevel)} ${
              selectedLevel === key ? 'selected' : ''
            }`}
            onClick={() => handleLevelSelect(key as AutonomyLevel)}
            disabled={isChanging}
          >
            <span className="option-icon">{getLevelIcon(key as AutonomyLevel)}</span>
            <span className="option-name">{config.name}</span>
            <span className="option-limits">
              {config.limits.tonPerAction !== Infinity 
                ? `${config.limits.tonPerAction} TON/action` 
                : '∞ TON'}
            </span>
          </button>
        ))}
      </div>

      {showConfirmModal && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal">
            <h4>⚠️ Confirm Autonomy Level Change</h4>
            <p>
              You are about to change to <strong>{AUTONOMY_LEVELS[selectedLevel].name}</strong>.
            </p>
            <p className="warning-text">
              {selectedLevel === 'LEVEL_4' 
                ? '⚠️ GOD MODE: This enables unlimited autonomous actions. Use with extreme caution!'
                : selectedLevel === 'LEVEL_3'
                ? '🚀 Full Autonomous: Agent will act without confirmation for high-risk actions.'
                : 'Agent autonomy will be adjusted accordingly.'}
            </p>
            
            <div className="confirmation-input">
              <label>Type "I understand the risks" to confirm:</label>
              <input
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="I understand the risks"
              />
            </div>

            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmationText('');
                  setSelectedLevel(currentLevel);
                }}
              >
                Cancel
              </button>
              <button 
                className="confirm-btn"
                onClick={confirmLevelChange}
                disabled={confirmationText !== 'I understand the risks' || isChanging}
              >
                {isChanging ? 'Changing...' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="level-stats">
        <div className="stat">
          <span className="stat-label">Daily Limit:</span>
          <span className="stat-value">
            {AUTONOMY_LEVELS[currentLevel].limits.dailyTonLimit !== Infinity
              ? `${AUTONOMY_LEVELS[currentLevel].limits.dailyTonLimit} TON`
              : '∞ TON'}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Auto-approve Risk:</span>
          <span className="stat-value">{AUTONOMY_LEVELS[currentLevel].autoApproveRiskLevel}</span>
        </div>
      </div>
    </div>
  );
};

export default AutonomyLevelWidget;
