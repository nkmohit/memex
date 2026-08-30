import { logger } from "./logger";

export interface ErrorContext {
  componentStack?: string;
  extra?: Record<string, unknown>;
}

let initialized = false;

export function initErrorTracking(): void {
  if (initialized) return;
  initialized = true;
  logger.debug("errorTracking: initialized (local stub, no outbound)");
}

export function reportError(error: unknown, context?: ErrorContext): void {
  // Local-first: never sends outbound, just structured log.
  // Future: could forward to Sentry/Tauri if user opts in.
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error("[memex:error]", message, {
    stack,
    ...context,
  });
}

export function isErrorTrackingInitialized(): boolean {
  return initialized;
}

export function resetErrorTrackingForTest(): void {
  initialized = false;
}
