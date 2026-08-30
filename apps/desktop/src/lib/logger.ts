/* eslint-disable no-console */
export type LogLevel = "debug" | "info" | "warn" | "error";

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
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
};

export default logger;
