import React from 'react';
import { ConsciousnessLevel } from '../../../types/consciousness';
import './ConsciousnessIndicator.css';

interface ConsciousnessIndicatorProps {
  currentLevel: ConsciousnessLevel;
  activityLog: Array<{
    timestamp: Date;
    level: ConsciousnessLevel;
    thought: string;
    duration: number;
  }>;
}

const ConsciousnessIndicator: React.FC<ConsciousnessIndicatorProps> = ({
  currentLevel,
  activityLog,
}) => {
  const getLevelInfo = (level: ConsciousnessLevel) => {
    switch (level) {
      case 'REACTIVE':
        return { icon: '⚡', color: '#ff6b6b', description: 'Instant reactions to stimuli' };
      case 'TACTICAL':
        return { icon: '🎯', color: '#4ecdc4', description: 'Short-term planning & execution' };
      case 'STRATEGIC':
        return { icon: '📋', color: '#45b7d1', description: 'Long-term strategy & goals' };
      case 'META_COGNITION':
        return { icon: '🧠', color: '#96ceb4', description: 'Self-reflection & learning' };
      default:
        return { icon: '❓', color: '#95a5a6', description: 'Unknown state' };
    }
  };

  const currentInfo = getLevelInfo(currentLevel);

  return (
    <div className="consciousness-indicator">
      <h3>🧠 Consciousness State</h3>
      
      <div className="current-state-display">
        <div 
          className="state-circle"
          style={{ borderColor: currentInfo.color }}
        >
          <span className="state-icon">{currentInfo.icon}</span>
          <span className="state-name">{currentLevel}</span>
        </div>
        <p className="state-description">{currentInfo.description}</p>
      </div>

      <div className="activity-timeline">
        <h4>Recent Activity</h4>
        <div className="timeline-track">
          {activityLog.slice(-10).reverse().map((entry, index) => (
            <div 
              key={index}
              className="timeline-event"
              style={{ borderLeftColor: getLevelInfo(entry.level).color }}
            >
              <span className="event-time">
                {entry.timestamp.toLocaleTimeString()}
              </span>
              <span className="event-level">{entry.level}</span>
              <span className="event-thought" title={entry.thought}>
                {entry.thought.substring(0, 50)}...
              </span>
              <span className="event-duration">{entry.duration}ms</span>
            </div>
          ))}
        </div>
      </div>

      <div className="level-distribution">
        <h4>Time Distribution (Last Hour)</h4>
        <div className="distribution-bars">
          {(['REACTIVE', 'TACTICAL', 'STRATEGIC', 'META_COGNITION'] as ConsciousnessLevel[]).map((level) => {
            const count = activityLog.filter(e => e.level === level).length;
            const percentage = activityLog.length > 0 ? (count / activityLog.length) * 100 : 0;
            const info = getLevelInfo(level);
            
            return (
              <div key={level} className="distribution-item">
                <span className="dist-label">{info.icon} {level}</span>
                <div className="dist-bar-container">
                  <div 
                    className="dist-bar"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: info.color 
                    }}
                  />
                </div>
                <span className="dist-value">{percentage.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ConsciousnessIndicator;
