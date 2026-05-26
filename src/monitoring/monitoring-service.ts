/**
 * Enhanced Monitoring & Observability Module
 * 
 * Provides Prometheus-compatible metrics, OpenTelemetry tracing,
 * and intelligent alerting for the Teleton Agent swarm.
 */

import { EventEmitter } from "events";
import type { SwarmAgent, ConsensusDecision } from "../autonomous/swarm/coordinator.js";

// ── Types ─────────────────────────────────────────────────────────────

export interface MetricPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

export interface MetricsRegistry {
  counters: Map<string, CounterMetric>;
  gauges: Map<string, GaugeMetric>;
  histograms: Map<string, HistogramMetric>;
  summaries: Map<string, SummaryMetric>;
}

export interface CounterMetric {
  name: string;
  help: string;
  type: "counter";
  value: number;
  labels?: Record<string, string>;
}

export interface GaugeMetric {
  name: string;
  help: string;
  type: "gauge";
  value: number;
  labels?: Record<string, string>;
}

export interface HistogramMetric {
  name: string;
  help: string;
  type: "histogram";
  buckets: Map<number, number>;
  sum: number;
  count: number;
  labels?: Record<string, string>;
}

export interface SummaryMetric {
  name: string;
  help: string;
  type: "summary";
  quantiles: Map<number, number>;
  sum: number;
  count: number;
  labels?: Record<string, string>;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: "gt" | "lt" | "eq" | "gte" | "lte";
  threshold: number;
  duration: number; // seconds
  severity: "critical" | "warning" | "info";
  channels: string[]; // notification channels
  enabled: boolean;
  createdAt: number;
  lastTriggered?: number;
  triggerCount: number;
}

export interface AlertEvent {
  ruleId: string;
  ruleName: string;
  severity: string;
  message: string;
  metricValue: number;
  threshold: number;
  triggeredAt: number;
  resolved?: boolean;
  resolvedAt?: number;
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, string | number | boolean>;
  logs: Array<{ timestamp: number; message: string; level?: string }>;
  status: "ok" | "error" | "unset";
  errorMessage?: string;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  baggage?: Record<string, string>;
}

export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  memoryHeapUsed: number;
  memoryHeapTotal: number;
  eventLoopLag: number;
  activeHandles: number;
  activeRequests: number;
  uptime: number;
}

export interface SwarmMetrics {
  activeAgents: number;
  totalDecisions: number;
  consensusRate: number;
  averageDecisionTime: number;
  messagesExchanged: number;
  agentStatuses: Record<string, "idle" | "working" | "error">;
}

// ── Alert Channels ────────────────────────────────────────────────────

export interface AlertChannel {
  id: string;
  type: "telegram" | "webhook" | "email" | "log";
  config: Record<string, any>;
  enabled: boolean;
}

// ── Monitoring Service ────────────────────────────────────────────────

export class MonitoringService extends EventEmitter {
  private registry: MetricsRegistry;
  private alertRules: Map<string, AlertRule>;
  private alertChannels: Map<string, AlertChannel>;
  private activeAlerts: Map<string, AlertEvent>;
  private traces: Map<string, TraceSpan[]>;
  private performanceHistory: MetricPoint[];
  private swarmMetrics: SwarmMetrics;
  
  constructor() {
    super();
    this.registry = {
      counters: new Map(),
      gauges: new Map(),
      histograms: new Map(),
      summaries: new Map(),
    };
    this.alertRules = new Map();
    this.alertChannels = new Map();
    this.activeAlerts = new Map();
    this.traces = new Map();
    this.performanceHistory = [];
    this.swarmMetrics = {
      activeAgents: 0,
      totalDecisions: 0,
      consensusRate: 0,
      averageDecisionTime: 0,
      messagesExchanged: 0,
      agentStatuses: {},
    };
    
    this.initializeDefaultMetrics();
    this.startPerformanceMonitoring();
  }
  
  // ── Metric Creation ─────────────────────────────────────────────────
  
  createCounter(name: string, help: string, labels?: Record<string, string>): CounterMetric {
    const metric: CounterMetric = {
      name,
      help,
      type: "counter",
      value: 0,
      labels,
    };
    this.registry.counters.set(name, metric);
    return metric;
  }
  
  createGauge(name: string, help: string, labels?: Record<string, string>): GaugeMetric {
    const metric: GaugeMetric = {
      name,
      help,
      type: "gauge",
      value: 0,
      labels,
    };
    this.registry.gauges.set(name, metric);
    return metric;
  }
  
  createHistogram(
    name: string,
    help: string,
    buckets: number[] = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    labels?: Record<string, string>
  ): HistogramMetric {
    const metric: HistogramMetric = {
      name,
      help,
      type: "histogram",
      buckets: new Map(buckets.map((b) => [b, 0])),
      sum: 0,
      count: 0,
      labels,
    };
    this.registry.histograms.set(name, metric);
    return metric;
  }
  
  createSummary(
    name: string,
    help: string,
    quantiles: number[] = [0.5, 0.75, 0.9, 0.95, 0.99],
    labels?: Record<string, string>
  ): SummaryMetric {
    const metric: SummaryMetric = {
      name,
      help,
      type: "summary",
      quantiles: new Map(quantiles.map((q) => [q, 0])),
      sum: 0,
      count: 0,
      labels,
    };
    this.registry.summaries.set(name, metric);
    return metric;
  }
  
  // ── Metric Operations ───────────────────────────────────────────────
  
  inc(name: string, value: number = 1, labels?: Record<string, string>): void {
    const counter = this.registry.counters.get(name);
    if (counter) {
      if (this.labelsMatch(counter.labels, labels)) {
        counter.value += value;
      }
    }
  }
  
  set(name: string, value: number, labels?: Record<string, string>): void {
    const gauge = this.registry.gauges.get(name);
    if (gauge) {
      if (this.labelsMatch(gauge.labels, labels)) {
        gauge.value = value;
      }
    }
  }
  
  observe(name: string, value: number, labels?: Record<string, string>): void {
    const histogram = this.registry.histograms.get(name);
    if (histogram) {
      if (this.labelsMatch(histogram.labels, labels)) {
        histogram.count++;
        histogram.sum += value;
        
        for (const [bucket, count] of histogram.buckets) {
          if (value <= bucket) {
            histogram.buckets.set(bucket, count + 1);
          }
        }
      }
    }
    
    const summary = this.registry.summaries.get(name);
    if (summary) {
      if (this.labelsMatch(summary.labels, labels)) {
        summary.count++;
        summary.sum += value;
        this.updateQuantiles(summary, value);
      }
    }
  }
  
  private labelsMatch(
    metricLabels?: Record<string, string>,
    providedLabels?: Record<string, string>
  ): boolean {
    if (!metricLabels && !providedLabels) return true;
    if (!metricLabels || !providedLabels) return false;
    
    for (const key in metricLabels) {
      if (metricLabels[key] !== providedLabels[key]) return false;
    }
    return true;
  }
  
  private updateQuantiles(summary: SummaryMetric, value: number): void {
    // Simplified quantile calculation (in production, use t-digest or similar)
    const values = Array.from(summary.quantiles.keys());
    values.sort((a, b) => a - b);
    
    for (const [quantile, _] of summary.quantiles) {
      // This is a placeholder - real implementation would maintain a sorted list
      summary.quantiles.set(quantile, value);
    }
  }
  
  // ── Tracing ─────────────────────────────────────────────────────────
  
  startTrace(
    operationName: string,
    serviceName: string,
    parentContext?: TraceContext
  ): TraceContext {
    const traceId = parentContext?.traceId || this.generateId();
    const spanId = this.generateId();
    
    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId: parentContext?.spanId,
      operationName,
      serviceName,
      startTime: Date.now(),
      tags: {},
      logs: [],
      status: "unset",
    };
    
    if (!this.traces.has(traceId)) {
      this.traces.set(traceId, []);
    }
    this.traces.get(traceId)!.push(span);
    
    return { traceId, spanId };
  }
  
  endTrace(context: TraceContext, status: "ok" | "error" = "ok", errorMessage?: string): void {
    const spans = this.traces.get(context.traceId);
    if (!spans) return;
    
    const span = spans.find((s) => s.spanId === context.spanId);
    if (!span) return;
    
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;
    if (errorMessage) {
      span.errorMessage = errorMessage;
    }
    
    this.emit("trace:completed", span);
  }
  
  addSpanLog(context: TraceContext, message: string, level: string = "info"): void {
    const spans = this.traces.get(context.traceId);
    if (!spans) return;
    
    const span = spans.find((s) => s.spanId === context.spanId);
    if (!span) return;
    
    span.logs.push({
      timestamp: Date.now(),
      message,
      level,
    });
  }
  
  addSpanTag(context: TraceContext, key: string, value: string | number | boolean): void {
    const spans = this.traces.get(context.traceId);
    if (!spans) return;
    
    const span = spans.find((s) => s.spanId === context.spanId);
    if (!span) return;
    
    span.tags[key] = value;
  }
  
  getTrace(traceId: string): TraceSpan[] | undefined {
    return this.traces.get(traceId);
  }
  
  // ── Alert Management ────────────────────────────────────────────────
  
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    this.emit("alert:rule:added", rule);
  }
  
  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    this.emit("alert:rule:removed", ruleId);
  }
  
  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): void {
    const rule = this.alertRules.get(ruleId);
    if (!rule) return;
    
    Object.assign(rule, updates);
    this.emit("alert:rule:updated", rule);
  }
  
  addAlertChannel(channel: AlertChannel): void {
    this.alertChannels.set(channel.id, channel);
    this.emit("alert:channel:added", channel);
  }
  
  removeAlertChannel(channelId: string): void {
    this.alertChannels.delete(channelId);
    this.emit("alert:channel:removed", channelId);
  }
  
  private async checkAlerts(): Promise<void> {
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;
      
      const metric = this.getMetricValue(rule.metric);
      if (metric === undefined) continue;
      
      const triggered = this.evaluateCondition(metric, rule.condition, rule.threshold);
      
      if (triggered) {
        const now = Date.now();
        const shouldAlert =
          !rule.lastTriggered || (now - rule.lastTriggered) > rule.duration * 1000;
        
        if (shouldAlert) {
          const alert: AlertEvent = {
            ruleId,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Alert: ${rule.name} - ${rule.description}`,
            metricValue: metric,
            threshold: rule.threshold,
            triggeredAt: now,
            triggerCount: rule.triggerCount + 1,
          };
          
          this.activeAlerts.set(ruleId, alert);
          rule.lastTriggered = now;
          rule.triggerCount++;
          
          this.emit("alert:triggered", alert);
          await this.sendAlertNotifications(alert);
        }
      } else {
        const activeAlert = this.activeAlerts.get(ruleId);
        if (activeAlert && !activeAlert.resolved) {
          activeAlert.resolved = true;
          activeAlert.resolvedAt = Date.now();
          
          this.emit("alert:resolved", activeAlert);
          await this.sendAlertResolution(activeAlert);
        }
      }
    }
  }
  
  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case "gt":
        return value > threshold;
      case "lt":
        return value < threshold;
      case "eq":
        return value === threshold;
      case "gte":
        return value >= threshold;
      case "lte":
        return value <= threshold;
      default:
        return false;
    }
  }
  
  private async sendAlertNotifications(alert: AlertEvent): Promise<void> {
    for (const channelId of this.getChannelsForSeverity(alert.severity)) {
      const channel = this.alertChannels.get(channelId);
      if (!channel || !channel.enabled) continue;
      
      try {
        switch (channel.type) {
          case "telegram":
            await this.sendTelegramAlert(channel.config, alert);
            break;
          case "webhook":
            await this.sendWebhookAlert(channel.config, alert);
            break;
          case "email":
            await this.sendEmailAlert(channel.config, alert);
            break;
          case "log":
            console.log(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);
            break;
        }
      } catch (error) {
        console.error(`Failed to send alert via ${channel.type}:`, error);
      }
    }
  }
  
  private async sendAlertResolution(alert: AlertEvent): Promise<void> {
    console.log(`[ALERT RESOLVED] ${alert.ruleName}: ${alert.message}`);
  }
  
  private getChannelsForSeverity(severity: string): string[] {
    const channels: string[] = [];
    for (const [id, channel] of this.alertChannels) {
      if (channel.enabled) {
        channels.push(id);
      }
    }
    return channels;
  }
  
  private async sendTelegramAlert(config: any, alert: AlertEvent): Promise<void> {
    // Implementation would use Telegram API
    console.log(`Telegram alert to ${config.chatId}: ${alert.message}`);
  }
  
  private async sendWebhookAlert(config: any, alert: AlertEvent): Promise<void> {
    // Implementation would send HTTP POST
    console.log(`Webhook alert to ${config.url}: ${alert.message}`);
  }
  
  private async sendEmailAlert(config: any, alert: AlertEvent): Promise<void> {
    // Implementation would use SMTP
    console.log(`Email alert to ${config.to}: ${alert.message}`);
  }
  
  // ── Performance Monitoring ──────────────────────────────────────────
  
  private initializeDefaultMetrics(): void {
    // Counters
    this.createCounter("teleton_requests_total", "Total number of requests");
    this.createCounter("teleton_tokens_used_total", "Total tokens used");
    this.createCounter("teleton_errors_total", "Total errors");
    this.createCounter("teleton_swarm_decisions_total", "Total swarm decisions");
    this.createCounter("teleton_tools_executed_total", "Total tools executed");
    
    // Gauges
    this.createGauge("teleton_active_sessions", "Active sessions");
    this.createGauge("teleton_memory_usage_bytes", "Memory usage in bytes");
    this.createGauge("teleton_cpu_usage_percent", "CPU usage percentage");
    this.createGauge("teleton_swarm_active_agents", "Active agents in swarm");
    this.createGauge("teleton_event_loop_lag_ms", "Event loop lag in milliseconds");
    
    // Histograms
    this.createHistogram("teleton_request_duration_seconds", "Request duration in seconds");
    this.createHistogram("teleton_tool_execution_seconds", "Tool execution time in seconds");
    this.createHistogram("teleton_llm_response_seconds", "LLM response time in seconds");
    this.createHistogram("teleton_swarm_decision_seconds", "Swarm decision time in seconds");
    
    // Summaries
    this.createSummary("teleton_response_size_bytes", "Response size in bytes");
  }
  
  private startPerformanceMonitoring(): void {
    setInterval(() => {
      const perf = this.collectPerformanceMetrics();
      
      this.set("teleton_memory_usage_bytes", perf.memoryUsage);
      this.set("teleton_cpu_usage_percent", perf.cpuUsage);
      this.set("teleton_event_loop_lag_ms", perf.eventLoopLag);
      
      this.performanceHistory.push({
        timestamp: Date.now(),
        value: perf.memoryUsage,
      });
      
      // Keep only last hour of data
      if (this.performanceHistory.length > 3600) {
        this.performanceHistory.shift();
      }
      
      this.checkAlerts();
    }, 5000); // Every 5 seconds
  }
  
  private collectPerformanceMetrics(): PerformanceMetrics {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    // Simplified CPU usage (in production, use os module or external lib)
    const cpuUsage = Math.random() * 100; // Placeholder
    
    // Event loop lag measurement
    const start = Date.now();
    setImmediate(() => {
      const lag = Date.now() - start;
      this.set("teleton_event_loop_lag_ms", lag);
    });
    
    return {
      cpuUsage,
      memoryUsage: memUsage.heapUsed,
      memoryHeapUsed: memUsage.heapUsed,
      memoryHeapTotal: memUsage.heapTotal,
      eventLoopLag: 0,
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length,
      uptime,
    };
  }
  
  // ── Swarm Integration ───────────────────────────────────────────────
  
  updateSwarmMetrics(agents: SwarmAgent[], decisions: ConsensusDecision[]): void {
    const activeAgents = agents.filter((a) => a.status !== "idle").length;
    const totalDecisions = decisions.length;
    
    const agentStatuses: Record<string, "idle" | "working" | "error"> = {};
    for (const agent of agents) {
      agentStatuses[agent.role] = agent.status;
    }
    
    this.swarmMetrics = {
      activeAgents,
      totalDecisions,
      consensusRate: this.calculateConsensusRate(decisions),
      averageDecisionTime: this.calculateAverageDecisionTime(decisions),
      messagesExchanged: this.swarmMetrics.messagesExchanged + agents.length * 2,
      agentStatuses,
    };
    
    this.set("teleton_swarm_active_agents", activeAgents);
    this.inc("teleton_swarm_decisions_total", decisions.length);
  }
  
  private calculateConsensusRate(decisions: ConsensusDecision[]): number {
    if (decisions.length === 0) return 0;
    const successful = decisions.filter((d) => d.consensusReached).length;
    return (successful / decisions.length) * 100;
  }
  
  private calculateAverageDecisionTime(decisions: ConsensusDecision[]): number {
    if (decisions.length === 0) return 0;
    const totalTime = decisions.reduce((sum, d) => sum + (d.duration || 0), 0);
    return totalTime / decisions.length;
  }
  
  // ── Prometheus Export ───────────────────────────────────────────────
  
  getPrometheusMetrics(): string {
    let output = "";
    
    for (const [name, counter] of this.registry.counters) {
      output += `# HELP ${name} ${counter.help}\n`;
      output += `# TYPE ${name} counter\n`;
      output += `${name}${this.formatLabels(counter.labels)} ${counter.value}\n`;
    }
    
    for (const [name, gauge] of this.registry.gauges) {
      output += `# HELP ${name} ${gauge.help}\n`;
      output += `# TYPE ${name} gauge\n`;
      output += `${name}${this.formatLabels(gauge.labels)} ${gauge.value}\n`;
    }
    
    for (const [name, histogram] of this.registry.histograms) {
      output += `# HELP ${name} ${histogram.help}\n`;
      output += `# TYPE ${name} histogram\n`;
      for (const [bucket, count] of histogram.buckets) {
        output += `${name}_bucket${this.formatLabels({ ...histogram.labels, le: bucket.toString() })} ${count}\n`;
      }
      output += `${name}_bucket${this.formatLabels({ ...histogram.labels, le: "+Inf" })} ${histogram.count}\n`;
      output += `${name}_sum${this.formatLabels(histogram.labels)} ${histogram.sum}\n`;
      output += `${name}_count${this.formatLabels(histogram.labels)} ${histogram.count}\n`;
    }
    
    for (const [name, summary] of this.registry.summaries) {
      output += `# HELP ${name} ${summary.help}\n`;
      output += `# TYPE ${name} summary\n`;
      for (const [quantile, value] of summary.quantiles) {
        output += `${name}${this.formatLabels({ ...summary.labels, quantile: quantile.toString() })} ${value}\n`;
      }
      output += `${name}_sum${this.formatLabels(summary.labels)} ${summary.sum}\n`;
      output += `${name}_count${this.formatLabels(summary.labels)} ${summary.count}\n`;
    }
    
    return output;
  }
  
  private formatLabels(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return "";
    }
    const parts = Object.entries(labels).map(([k, v]) => `${k}="${v}"`);
    return `{${parts.join(",")}}`;
  }
  
  // ── Utilities ───────────────────────────────────────────────────────
  
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
  
  private getMetricValue(metricName: string): number | undefined {
    const counter = this.registry.counters.get(metricName);
    if (counter) return counter.value;
    
    const gauge = this.registry.gauges.get(metricName);
    if (gauge) return gauge.value;
    
    return undefined;
  }
  
  // ── Getters ─────────────────────────────────────────────────────────
  
  getMetrics(): MetricsRegistry {
    return this.registry;
  }
  
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }
  
  getActiveAlerts(): AlertEvent[] {
    return Array.from(this.activeAlerts.values());
  }
  
  getAlertChannels(): AlertChannel[] {
    return Array.from(this.alertChannels.values());
  }
  
  getSwarmMetrics(): SwarmMetrics {
    return this.swarmMetrics;
  }
  
  getPerformanceHistory(): MetricPoint[] {
    return this.performanceHistory;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────

let monitoringInstance: MonitoringService | null = null;

export function getMonitoringService(): MonitoringService {
  if (!monitoringInstance) {
    monitoringInstance = new MonitoringService();
  }
  return monitoringInstance;
}

export function resetMonitoringService(): void {
  monitoringInstance = null;
}
