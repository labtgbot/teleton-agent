/**
 * Monitoring API Routes
 *
 * Provides REST endpoints for monitoring metrics, alerts, and traces.
 */

import { Hono } from "hono";
import { getMonitoringService } from "../monitoring-service.js";
import type { AlertRule, AlertChannel } from "../monitoring-service.js";

// ── Types ─────────────────────────────────────────────────────────────

interface MonitoringState {
  enabled: boolean;
  prometheusEnabled: boolean;
  tracingEnabled: boolean;
  alertingEnabled: boolean;
}

// ── State ─────────────────────────────────────────────────────────────

const monitoringState: MonitoringState = {
  enabled: true,
  prometheusEnabled: true,
  tracingEnabled: true,
  alertingEnabled: true,
};

// ── Router ────────────────────────────────────────────────────────────

export const monitoringRoutes = new Hono();

// ── Health Check ──────────────────────────────────────────────────────

monitoringRoutes.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// ── Prometheus Metrics ────────────────────────────────────────────────

monitoringRoutes.get("/metrics", (c) => {
  if (!monitoringState.prometheusEnabled) {
    return c.text("Prometheus metrics disabled", 403);
  }

  const monitoring = getMonitoringService();
  const metrics = monitoring.getPrometheusMetrics();

  return c.text(metrics, {
    headers: {
      "Content-Type": "text/plain; version=0.0.4",
    },
  });
});

// ── Metrics Overview ──────────────────────────────────────────────────

monitoringRoutes.get("/api/metrics", (c) => {
  const monitoring = getMonitoringService();
  const registry = monitoring.getMetrics();

  const summary = {
    counters: Array.from(registry.counters.values()),
    gauges: Array.from(registry.gauges.values()),
    histograms: Array.from(registry.histograms.values()).map((h) => ({
      ...h,
      buckets: Array.from(h.buckets.entries()).map(([le, count]) => ({ le, count })),
    })),
    summaries: Array.from(registry.summaries.values()).map((s) => ({
      ...s,
      quantiles: Array.from(s.quantiles.entries()).map(([q, v]) => ({ q, v })),
    })),
  };

  return c.json(summary);
});

// ── Performance Metrics ───────────────────────────────────────────────

monitoringRoutes.get("/api/performance", (c) => {
  const monitoring = getMonitoringService();
  const history = monitoring.getPerformanceHistory();
  const swarmMetrics = monitoring.getSwarmMetrics();

  return c.json({
    current: {
      memoryUsage: history.length > 0 ? history[history.length - 1] : null,
      swarm: swarmMetrics,
    },
    history: history.slice(-100), // Last 100 data points
  });
});

// ── Alert Rules ───────────────────────────────────────────────────────

monitoringRoutes.get("/api/alerts/rules", (c) => {
  const monitoring = getMonitoringService();
  const rules = monitoring.getAlertRules();
  return c.json({ rules });
});

monitoringRoutes.post("/api/alerts/rules", async (c) => {
  try {
    const body = await c.req.json();
    const rule: AlertRule = {
      id: body.id || `rule_${Date.now()}`,
      name: body.name,
      description: body.description || "",
      metric: body.metric,
      condition: body.condition,
      threshold: body.threshold,
      duration: body.duration || 60,
      severity: body.severity || "warning",
      channels: body.channels || [],
      enabled: body.enabled !== false,
      createdAt: Date.now(),
      triggerCount: 0,
    };

    const monitoring = getMonitoringService();
    monitoring.addAlertRule(rule);

    return c.json({ success: true, rule }, 201);
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
});

monitoringRoutes.put("/api/alerts/rules/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();

    const monitoring = getMonitoringService();
    monitoring.updateAlertRule(id, body);

    return c.json({ success: true });
  } catch {
    return c.json({ error: "Rule not found" }, 404);
  }
});

monitoringRoutes.delete("/api/alerts/rules/:id", (c) => {
  const id = c.req.param("id");
  const monitoring = getMonitoringService();
  monitoring.removeAlertRule(id);
  return c.json({ success: true });
});

// ── Active Alerts ─────────────────────────────────────────────────────

monitoringRoutes.get("/api/alerts/active", (c) => {
  const monitoring = getMonitoringService();
  const alerts = monitoring.getActiveAlerts();
  return c.json({ alerts });
});

// ── Alert Channels ────────────────────────────────────────────────────

monitoringRoutes.get("/api/alerts/channels", (c) => {
  const monitoring = getMonitoringService();
  const channels = monitoring.getAlertChannels();
  return c.json({ channels });
});

monitoringRoutes.post("/api/alerts/channels", async (c) => {
  try {
    const body = await c.req.json();
    const channel: AlertChannel = {
      id: body.id || `channel_${Date.now()}`,
      type: body.type,
      config: body.config || {},
      enabled: body.enabled !== false,
    };

    const monitoring = getMonitoringService();
    monitoring.addAlertChannel(channel);

    return c.json({ success: true, channel }, 201);
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
});

monitoringRoutes.delete("/api/alerts/channels/:id", (c) => {
  const id = c.req.param("id");
  const monitoring = getMonitoringService();
  monitoring.removeAlertChannel(id);
  return c.json({ success: true });
});

// ── Tracing ───────────────────────────────────────────────────────────

monitoringRoutes.get("/api/traces/:traceId", (c) => {
  const traceId = c.req.param("traceId");
  const monitoring = getMonitoringService();
  const trace = monitoring.getTrace(traceId);

  if (!trace) {
    return c.json({ error: "Trace not found" }, 404);
  }

  return c.json({ trace });
});

monitoringRoutes.get("/api/traces", (c) => {
  // Return recent traces (simplified implementation)
  return c.json({ traces: [] });
});

// ── Swarm Metrics ─────────────────────────────────────────────────────

monitoringRoutes.get("/api/swarm", (c) => {
  const monitoring = getMonitoringService();
  const swarmMetrics = monitoring.getSwarmMetrics();
  return c.json(swarmMetrics);
});

// ── Configuration ─────────────────────────────────────────────────────

monitoringRoutes.get("/api/config", (c) => {
  return c.json(monitoringState);
});

monitoringRoutes.put("/api/config", async (c) => {
  try {
    const body = await c.req.json();
    Object.assign(monitoringState, body);
    return c.json(monitoringState);
  } catch {
    return c.json({ error: "Invalid request body" }, 400);
  }
});

// ── Export ────────────────────────────────────────────────────────────

export default monitoringRoutes;
