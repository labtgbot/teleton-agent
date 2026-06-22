import { Hono } from "hono";

interface ApiVariables {
  keyPrefix: string;
  requestId: string;
}

export function createAuthRoutes() {
  const app = new Hono<{ Variables: ApiVariables }>();

  app.post("/validate", (c) => {
    // If we reach this handler, auth middleware already validated the key
    const keyPrefix = c.get("keyPrefix") ?? "unknown";
    return c.json({ valid: true, keyPrefix });
  });

  return app;
}
