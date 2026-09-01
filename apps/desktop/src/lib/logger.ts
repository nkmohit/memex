/* eslint-disable no-console */
import { recordSearchLatency as otelRecordSearch, resetOtel } from "./otel";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Span {
  name: string;
  start: number;
  attributes?: Record<string, unknown>;
}

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  startSpan: (name: string, attributes?: Record<string, unknown>) => Span;
  endSpan: (span: Span, extra?: Record<string, unknown>) => number;
  withSpan: <T>(
    name: string,
    fn: () => Promise<T> | T,
    attributes?: Record<string, unknown>
  ) => Promise<T>;
}

function formatArgs(level: LogLevel, args: unknown[]): unknown[] {
  const prefix = `[memex:${level}]`;
  if (args.length === 0) return [prefix];
  return [prefix, ...args];
}

// Structured logger — groups output, preserves stack for errors, and
// degrades gracefully in production (debug suppressed unless TAURI_DEBUG).
const isDebug =
  typeof globalThis !== "undefined" &&
  (globalThis as unknown as { process?: { env?: Record<string, string> } }).process?.env
    ?.TAURI_DEBUG === "true";

const spanRecords = new Map<string, number[]>();

export function recordSpanLatency(name: string, durationMs: number): void {
  const arr = spanRecords.get(name) ?? [];
  arr.push(durationMs);
  if (arr.length > 1000) arr.shift();
  spanRecords.set(name, arr);
  if (name === "searchMessages") {
    try {
      otelRecordSearch(durationMs);
    } catch {
      // ignore
    }
  }
}

export function getSpanLatencies(name: string): number[] {
  return [...(spanRecords.get(name) ?? [])];
}

export function computeP95(latencies: number[]): number | null {
  if (latencies.length === 0) return null;
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? null;
}

export function clearSpans(): void {
  spanRecords.clear();
  try {
    resetOtel();
  } catch {
    // ignore
  }
}

export const logger: Logger = {
  debug: (...args: unknown[]) => {
    if (isDebug) console.log(...formatArgs("debug", args));
  },
  info: (...args: unknown[]) => {
    console.log(...formatArgs("info", args));
  },
  warn: (...args: unknown[]) => {
    console.warn(...formatArgs("warn", args));
  },
  error: (...args: unknown[]) => {
    console.error(...formatArgs("error", args));
  },
  startSpan: (name: string, attributes) => {
    const span: Span = { name, start: Date.now(), attributes };
    // OTEL-style log
    console.log(...formatArgs("debug", [`span:start ${name}`, attributes ?? {}]));
    return span;
  },
  endSpan: (span: Span, extra) => {
    const duration = Date.now() - span.start;
    recordSpanLatency(span.name, duration);
    console.log(
      ...formatArgs("debug", [
        `span:end ${span.name} ${duration}ms`,
        { ...span.attributes, ...extra },
      ])
    );
    return duration;
  },
  withSpan: async (name, fn, attributes) => {
    const span = { name, start: Date.now(), attributes };
    try {
      const result = await fn();
      const duration = Date.now() - span.start;
      recordSpanLatency(name, duration);
      return result;
    } catch (err) {
      const duration = Date.now() - span.start;
      recordSpanLatency(name, duration);
      throw err;
    }
  },
};

export default logger;
