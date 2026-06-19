import { Hono } from "hono";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const API_VERSION = "1.0.0";

function readPackageVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    // Try from dist/ or src/ layout
    const candidates = [
      join(__dirname, "../../package.json"),
      join(__dirname, "../../../package.json"),
    ];
    for (const p of candidates) {
      try {
        const pkg = JSON.parse(readFileSync(p, "utf-8"));
        return pkg.version ?? "unknown";
      } catch {
        continue;
      }
    }
  } catch {
    // ignore
  }
  return "unknown";
}

const cachedVersion = readPackageVersion();

export function createSystemRoutes() {
  const app = new Hono();

  // SECURITY FIX M-05: /version is public (minimal info), /info requires admin auth
  app.get("/version", (c) => {
    return c.json({
      teleton: cachedVersion,
      apiVersion: API_VERSION,
    });
  });

  // SECURITY FIX M-05: Detailed system info is restricted.
  // This endpoint exposes CPU model, cores, load average, memory usage, and uptime
  // — information useful for fingerprinting and planning attacks.
  // Only accessible via the WebUI (which requires auth) since these routes are
  // registered behind the /api/* auth middleware.
  app.get("/info", (c) => {
    const cpus = os.cpus();

    return c.json({
      cpu: {
        cores: cpus.length,
        loadAvg: os.loadavg(),
      },
      memory: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
      },
      uptime: {
        process: Math.floor(process.uptime()),
      },
    });
  });

  return app;
}
