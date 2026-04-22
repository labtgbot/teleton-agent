import React from 'react';
import { EmotionType, EmotionalState } from '../../../types/emotional-intelligence';
import './EmotionFeed.css';

interface EmotionFeedProps {
  emotions: Array<{
    type: EmotionType;
    intensity: number;
    trigger: string;
    timestamp: Date;
  }>;
  history: Array<{
    timestamp: Date;
    dominantEmotion: EmotionType;
    averageIntensity: number;
  }>;
  internalState: {
    stressLevel: number;
    confidenceLevel: number;
    energyLevel: number;
    moodStability: number;
  };
}

const EmotionFeed: React.FC<EmotionFeedProps> = ({
  emotions,
  history,
  internalState,
}) => {
  const getEmotionIcon = (type: EmotionType) => {
    switch (type) {
      case 'JOY': return '😊';
      case 'SADNESS': return '😢';
      case 'ANGER': return '😠';
      case 'FEAR': return '😨';
      case 'SURPRISE': return '😲';
      case 'DISGUST': return '🤢';
      case 'TRUST': return '🤝';
      case 'ANTICIPATION': return '👀';
      case 'NEUTRAL': return '😐';
      default: return '❓';
    }
  };

  const getEmotionColor = (type: EmotionType) => {
    switch (type) {
      case 'JOY': return '#f1c40f';
      case 'SADNESS': return '#3498db';
      case 'ANGER': return '#e74c3c';
      case 'FEAR': return '#9b59b6';
      case 'SURPRISE': return '#e67e22';
      case 'DISGUST': return '#27ae60';
      case 'TRUST': return '#1abc9c';
      case 'ANTICIPATION': return '#f39c12';
      case 'NEUTRAL': return '#95a5a6';
      default: return '#7f8c8d';
    }
  };

  const getInternalStateColor = (value: number) => {
    if (value < 30) return '#e74c3c';
    if (value < 60) return '#f39c12';
    return '#27ae60';
  };

  return (
    <div className="emotion-feed">
      <h3>💬 Emotional Intelligence</h3>

      <div className="internal-state-grid">
        <div className="state-card">
          <span className="state-label">Stress Level</span>
          <div className="state-bar-container">
            <div 
              className="state-bar"
              style={{ 
                width: `${internalState.stressLevel}%`,
                backgroundColor: getInternalStateColor(internalState.stressLevel)
              }}
            />
          </div>
          <span className="state-value">{internalState.stressLevel}%</span>
        </div>

        <div className="state-card">
          <span className="state-label">Confidence</span>
          <div className="state-bar-container">
            <div 
              className="state-bar"
              style={{ 
                width: `${internalState.confidenceLevel}%`,
                backgroundColor: getInternalStateColor(internalState.confidenceLevel)
              }}
            />
          </div>
          <span className="state-value">{internalState.confidenceLevel}%</span>
        </div>

        <div className="state-card">
          <span className="state-label">Energy</span>
          <div className="state-bar-container">
            <div 
              className="state-bar"
              style={{ 
                width: `${internalState.energyLevel}%`,
                backgroundColor: getInternalStateColor(internalState.energyLevel)
              }}
            />
          </div>
          <span className="state-value">{internalState.energyLevel}%</span>
        </div>

        <div className="state-card">
          <span className="state-label">Mood Stability</span>
          <div className="state-bar-container">
            <div 
              className="state-bar"
              style={{ 
                width: `${internalState.moodStability}%`,
                backgroundColor: getInternalStateColor(internalState.moodStability)
              }}
            />
          </div>
          <span className="state-value">{internalState.moodStability}%</span>
        </div>
      </div>

      <div className="current-emotions">
        <h4>Current Emotions</h4>
        <div className="emotions-cloud">
          {emotions.map((emotion, index) => (
            <div 
              key={index}
              className="emotion-bubble"
              style={{
                backgroundColor: getEmotionColor(emotion.type),
                opacity: emotion.intensity / 100,
                transform: `scale(${0.8 + emotion.intensity / 200})`,
              }}
            >
              <span className="emotion-icon">{getEmotionIcon(emotion.type)}</span>
              <span className="emotion-name">{emotion.type}</span>
              <span className="emotion-intensity">{emotion.intensity}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="emotion-history">
        <h4>Emotion Timeline (Last 24h)</h4>
        <div className="timeline-chart">
          {history.slice(-24).map((entry, index) => (
            <div 
              key={index}
              className="timeline-point"
              title={`${entry.dominantEmotion}: ${entry.averageIntensity}%`}
            >
              <span 
                className="point-dot"
                style={{ backgroundColor: getEmotionColor(entry.dominantEmotion) }}
              />
              <span className="point-time">
                {entry.timestamp.getHours()}:00
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="empathy-suggestions">
        <h4>💡 Communication Adaptations</h4>
        <div className="suggestions-list">
          {internalState.stressLevel > 70 && (
            <div className="suggestion warning">
              ⚠️ High stress detected - Consider simplifying responses and reducing task load
            </div>
          )}
          {internalState.confidenceLevel < 40 && (
            <div className="suggestion info">
              ℹ️ Low confidence - Agent may need additional validation or user reassurance
            </div>
          )}
          {internalState.energyLevel < 30 && (
            <div className="suggestion caution">
              ⚡ Low energy - Consider scheduling rest period or reducing active tasks
            </div>
          )}
          {emotions.some(e => e.type === 'ANGER' && e.intensity > 60) && (
            <div className="suggestion critical">
              🚨 High anger detected - Review recent triggers and consider intervention
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmotionFeed;
