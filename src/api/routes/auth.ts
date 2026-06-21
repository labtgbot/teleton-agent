import { Hono } from "hono";

export function createAuthRoutes() {
  const app = new Hono();

  app.post("/validate", (c) => {
    // If we reach this handler, auth middleware already validated the key
    const keyPrefix = c.get("keyPrefix") ?? "unknown";
    return c.json({ valid: true, keyPrefix });
  });

  return app;
}
