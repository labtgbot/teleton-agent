/**
 * Swarm Visualization Component
 * 
 * Real-time visualization of agent swarm activity, showing:
 * - Agent statuses and roles
 * - Inter-agent communication
 * - Consensus decision process
 * - Task distribution
 */

import { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

// ── Types ─────────────────────────────────────────────────────────────

interface SwarmAgent {
  id: string;
  role: string;
  status: "idle" | "working" | "error";
  currentTask?: string;
  lastActive: number;
  messagesSent: number;
  messagesReceived: number;
}

interface SwarmMessage {
  id: string;
  from: string;
  to: string;
  type: "request" | "response" | "vote" | "decision";
  content: string;
  timestamp: number;
}

interface ConsensusDecision {
  id: string;
  topic: string;
  initiator: string;
  votes: Record<string, "agree" | "disagree" | "abstain">;
  result: "approved" | "rejected" | "pending";
  consensusReached: boolean;
  startTime: number;
  endTime?: number;
  duration?: number;
}

interface SwarmMetrics {
  activeAgents: number;
  totalDecisions: number;
  consensusRate: number;
  averageDecisionTime: number;
  messagesExchanged: number;
  agentStatuses: Record<string, "idle" | "working" | "error">;
}

// ── Agent Card Component ──────────────────────────────────────────────

function AgentCard({ agent }: { agent: SwarmAgent }) {
  const statusColors = {
    idle: "#6b7280",
    working: "#10b981",
    error: "#ef4444",
  };

  const roleIcons: Record<string, string> = {
    orchestrator: "🤖",
    researcher: "🔍",
    planner: "📋",
    executor: "⚡",
    critic: "🎯",
    security: "🛡️",
    communicator: "💬",
    learner: "📚",
  };

  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "12px",
        background: "var(--card-bg)",
        border: `2px solid ${statusColors[agent.status]}`,
        transition: "all 0.3s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
        <span style={{ fontSize: "32px" }}>{roleIcons[agent.role.toLowerCase()] || "🤖"}</span>
        <div>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>{agent.role}</h3>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "2px 8px",
              borderRadius: "12px",
              background: statusColors[agent.status],
              color: "white",
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "white",
                animation: agent.status === "working" ? "pulse 1s infinite" : "none",
              }}
            />
            {agent.status}
          </div>
        </div>
      </div>

      {agent.currentTask && (
        <div
          style={{
            padding: "8px",
            borderRadius: "6px",
            background: "var(--bg-tertiary)",
            fontSize: "12px",
            marginBottom: "12px",
          }}
        >
          <strong>Task:</strong> {agent.currentTask}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "11px",
          color: "var(--text-secondary)",
        }}
      >
        <span>↑ {agent.messagesSent}</span>
        <span>↓ {agent.messagesReceived}</span>
      </div>
    </div>
  );
}

// ── Message Flow Component ────────────────────────────────────────────

function MessageFlow({ messages }: { messages: SwarmMessage[] }) {
  const typeColors = {
    request: "#3b82f6",
    response: "#10b981",
    vote: "#f59e0b",
    decision: "#8b5cf6",
  };

  return (
    <div style={{ maxHeight: "400px", overflowY: "auto" }}>
      {messages.slice(-20).reverse().map((msg) => (
        <div
          key={msg.id}
          style={{
            padding: "8px 12px",
            marginBottom: "8px",
            borderRadius: "8px",
            background: "var(--bg-tertiary)",
            borderLeft: `3px solid ${typeColors[msg.type]}`,
            fontSize: "12px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ fontWeight: 600 }}>
              {msg.from} → {msg.to}
            </span>
            <span
              style={{
                padding: "2px 6px",
                borderRadius: "4px",
                background: typeColors[msg.type],
                color: "white",
                fontSize: "10px",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              {msg.type}
            </span>
          </div>
          <div style={{ color: "var(--text-secondary)" }}>{msg.content}</div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
            {new Date(msg.timestamp).toLocaleTimeString()}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Consensus Tracker Component ───────────────────────────────────────

function ConsensusTracker({ decisions }: { decisions: ConsensusDecision[] }) {
  return (
    <div>
      {decisions.slice(-10).reverse().map((decision) => (
        <div
          key={decision.id}
          style={{
            padding: "12px",
            marginBottom: "12px",
            borderRadius: "8px",
            background: "var(--card-bg)",
            border: `1px solid ${decision.consensusReached ? "#10b981" : "#f59e0b"}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <h4 style={{ margin: 0, fontSize: "14px" }}>{decision.topic}</h4>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "12px",
                background: decision.result === "approved" ? "#10b981" : decision.result === "rejected" ? "#ef4444" : "#f59e0b",
                color: "white",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              {decision.result}
            </span>
          </div>

          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>
            Initiator: {decision.initiator}
            {decision.duration && ` • Duration: ${(decision.duration / 1000).toFixed(2)}s`}
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {Object.entries(decision.votes).map(([agent, vote]) => (
              <span
                key={agent}
                style={{
                  padding: "2px 8px",
                  borderRadius: "4px",
                  background: vote === "agree" ? "#10b981" : vote === "disagree" ? "#ef4444" : "#6b7280",
                  color: "white",
                  fontSize: "10px",
                  fontWeight: 600,
                }}
              >
                {agent}: {vote}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Metrics Summary Component ─────────────────────────────────────────

function MetricsSummary({ metrics }: { metrics: SwarmMetrics }) {
  const statCards = [
    { label: "Active Agents", value: metrics.activeAgents, color: "#3b82f6" },
    { label: "Total Decisions", value: metrics.totalDecisions, color: "#8b5cf6" },
    { label: "Consensus Rate", value: `${metrics.consensusRate.toFixed(1)}%`, color: "#10b981" },
    { label: "Avg Decision Time", value: `${(metrics.averageDecisionTime / 1000).toFixed(2)}s`, color: "#f59e0b" },
    { label: "Messages Exchanged", value: metrics.messagesExchanged, color: "#06b6d4" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "16px", marginBottom: "24px" }}>
      {statCards.map((stat) => (
        <div
          key={stat.label}
          style={{
            padding: "16px",
            borderRadius: "12px",
            background: "var(--card-bg)",
            borderLeft: `4px solid ${stat.color}`,
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>
            {stat.label}
          </div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: stat.color }}>{stat.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main Swarm Visualization Component ────────────────────────────────

export function SwarmVisualization() {
  const [agents, setAgents] = useState<SwarmAgent[]>([]);
  const [messages, setMessages] = useState<SwarmMessage[]>([]);
  const [decisions, setDecisions] = useState<ConsensusDecision[]>([]);
  const [metrics, setMetrics] = useState<SwarmMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval] = useState(3000); // 3 seconds

  const fetchData = useCallback(async () => {
    try {
      const [swarmData, metricsData] = await Promise.all([
        api.get("/api/swarm").catch(() => ({ data: { agents: [], decisions: [] } })),
        api.get("/api/performance").catch(() => ({ data: { current: { swarm: null } } })),
      ]);

      if (swarmData.data.agents) {
        setAgents(swarmData.data.agents);
      }
      if (swarmData.data.decisions) {
        setDecisions(swarmData.data.decisions);
      }
      if (swarmData.data.messages) {
        setMessages(swarmData.data.messages);
      }
      if (metricsData.data.current?.swarm) {
        setMetrics(metricsData.data.current.swarm);
      }

      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch swarm data:", error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh, refreshInterval]);

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text-secondary)" }}>
        <div className="spinner" style={{ margin: "0 auto 16px" }} />
        Loading swarm data...
      </div>
    );
  }

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>🐝 Swarm Visualization</h2>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (3s)
          </label>
          <button onClick={fetchData} className="btn-primary" style={{ padding: "6px 16px", fontSize: "13px" }}>
            Refresh Now
          </button>
        </div>
      </div>

      {metrics && <MetricsSummary metrics={metrics} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
        {/* Agents Grid */}
        <div>
          <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>Active Agents</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
            {agents.length > 0 ? (
              agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)
            ) : (
              <div style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>No active agents</div>
            )}
          </div>
        </div>

        {/* Message Flow */}
        <div>
          <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>Message Flow</h3>
          {messages.length > 0 ? (
            <MessageFlow messages={messages} />
          ) : (
            <div style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>No recent messages</div>
          )}
        </div>
      </div>

      {/* Consensus Decisions */}
      <div style={{ marginTop: "24px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>Recent Consensus Decisions</h3>
        {decisions.length > 0 ? (
          <ConsensusTracker decisions={decisions} />
        ) : (
          <div style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>No recent decisions</div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default SwarmVisualization;
