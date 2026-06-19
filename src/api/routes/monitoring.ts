/**
 * DEPRECATED — SECURITY FIX H-01: Removed dead monitoring routes.
 *
 * This file was dead code (no consumers, no server registration) that exposed
 * system internals (memory usage, CPU load, uptime) to unauthenticated HTTP.
 * The monitoring-service.ts has also been neutralized.
 *
 * This stub remains to prevent import errors in case any external code
 * references the path. All routes return 410 Gone.
 */

import { Hono } from "hono";

// SECURITY FIX H-01: All monitoring endpoints removed — return 410 Gone
export const monitoringRoutes = new Hono();
monitoringRoutes.all("/*", (c) => {
  return c.json(
    {
      error: "Gone",
      message: "Monitoring endpoints have been removed for security (H-01)",
    },
    410
  );
});

export default monitoringRoutes;
