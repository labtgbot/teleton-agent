/**
 * DEPRECATED — SECURITY FIX H-01: Monitoring service removed.
 *
 * Stubs only — returns null/empty to prevent import errors.
 * Do not use. Use the health-check routes instead.
 */

export interface AlertRule {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface AlertChannel {
  id: string;
  type: string;
  [key: string]: unknown;
}

export function getMonitoringService(): never {
  throw new Error("Monitoring service has been removed for security (SECURITY FIX H-01)");
}
