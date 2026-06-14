/**
 * Monitoring Service
 *
 * Provides metrics collection, alerting, and tracing for the agent.
 * Stub implementation — replace with full Prometheus/OpenTelemetry integration.
 */

// ── Types ──────────────────────────────────────────────────────────────

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: string;
  threshold: number;
  duration: number;
  severity: "warning" | "critical";
  channels: string[];
  enabled: boolean;
  createdAt: number;
  triggerCount: number;
}

export interface AlertChannel {
  id: string;
  type: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  message: string;
  severity: "warning" | "critical";
  timestamp: number;
  resolved: boolean;
}

export interface MetricRegistry {
  counters: Map<string, number>;
  gauges: Map<string, number>;
  histograms: Map<string, { buckets: Map<number, number>; sum: number; count: number }>;
  summaries: Map<string, { quantiles: Map<number, number>; sum: number; count: number }>;
}

export interface SwarmMetrics {
  agentCount: number;
  activeAgents: number;
  taskCount: number;
  completedTasks: number;
  averageCompletionTime: number;
  consensusRate: number;
}

export interface Trace {
  id: string;
  operation: string;
  startTime: number;
  endTime?: number;
  spans: Array<{
    name: string;
    startTime: number;
    endTime?: number;
    metadata?: Record<string, unknown>;
  }>;
  metadata?: Record<string, unknown>;
}

// ── Service Implementation ─────────────────────────────────────────────

class MonitoringServiceImpl {
  private registry: MetricRegistry = {
    counters: new Map(),
    gauges: new Map(),
    histograms: new Map(),
    summaries: new Map(),
  };

  private alertRules: Map<string, AlertRule> = new Map();
  private alertChannels: Map<string, AlertChannel> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private traces: Map<string, Trace> = new Map();
  private performanceHistory: Array<{
    timestamp: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: number;
  }> = [];

  // ── Prometheus Metrics ──────────────────────────────────────────────

  getPrometheusMetrics(): string {
    const lines: string[] = [];

    for (const [name, value] of this.registry.counters) {
      lines.push(`${name} ${value}`);
    }

    for (const [name, value] of this.registry.gauges) {
      lines.push(`${name} ${value}`);
    }

    return lines.join("\n");
  }

  // ── Metrics Registry ────────────────────────────────────────────────

  getMetrics(): MetricRegistry {
    return {
      counters: new Map(this.registry.counters),
      gauges: new Map(this.registry.gauges),
      histograms: new Map(this.registry.histograms),
      summaries: new Map(this.registry.summaries),
    };
  }

  incrementCounter(name: string, value = 1): void {
    this.registry.counters.set(name, (this.registry.counters.get(name) ?? 0) + value);
  }

  setGauge(name: string, value: number): void {
    this.registry.gauges.set(name, value);
  }

  // ── Performance History ─────────────────────────────────────────────

  getPerformanceHistory(): Array<{
    timestamp: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: number;
  }> {
    return [...this.performanceHistory];
  }

  recordPerformance(): void {
    this.performanceHistory.push({
      timestamp: Date.now(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: 0, // Would need actual CPU measurement
    });

    // Keep last 1000 entries
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory.shift();
    }
  }

  // ── Swarm Metrics ───────────────────────────────────────────────────

  getSwarmMetrics(): SwarmMetrics {
    return {
      agentCount: 0,
      activeAgents: 0,
      taskCount: 0,
      completedTasks: 0,
      averageCompletionTime: 0,
      consensusRate: 0,
    };
  }

  // ── Alert Rules ─────────────────────────────────────────────────────

  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  updateAlertRule(id: string, updates: Partial<AlertRule>): void {
    const existing = this.alertRules.get(id);
    if (existing) {
      this.alertRules.set(id, { ...existing, ...updates });
    }
  }

  removeAlertRule(id: string): void {
    this.alertRules.delete(id);
  }

  // ── Active Alerts ───────────────────────────────────────────────────

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter((a) => !a.resolved);
  }

  // ── Alert Channels ──────────────────────────────────────────────────

  getAlertChannels(): AlertChannel[] {
    return Array.from(this.alertChannels.values());
  }

  addAlertChannel(channel: AlertChannel): void {
    this.alertChannels.set(channel.id, channel);
  }

  removeAlertChannel(id: string): void {
    this.alertChannels.delete(id);
  }

  // ── Tracing ─────────────────────────────────────────────────────────

  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  startTrace(operation: string, metadata?: Record<string, unknown>): Trace {
    const trace: Trace = {
      id: `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      operation,
      startTime: Date.now(),
      spans: [],
      metadata,
    };
    this.traces.set(trace.id, trace);
    return trace;
  }

  endTrace(traceId: string): void {
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.endTime = Date.now();
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let instance: MonitoringServiceImpl | null = null;

export function getMonitoringService(): MonitoringServiceImpl {
  if (!instance) {
    instance = new MonitoringServiceImpl();
  }
  return instance;
}

export default MonitoringServiceImpl;
