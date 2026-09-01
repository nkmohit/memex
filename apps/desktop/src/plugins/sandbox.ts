/**
 * Plugin sandbox — Phase 3-4 hardening.
 * Validates plugin source before evaluation and wraps parsers with
 * timeouts + output limits. Keeps `registry.ts` load path safe.
 */

export const MAX_PLUGIN_SIZE = 50 * 1024; // 50KB per file
export const MAX_PLUGINS = 20;
export const PLUGIN_TIMEOUT_MS = 500;
export const MAX_PARSER_CONVERSATIONS = 1000;
export const MAX_PARSER_MESSAGES = 10000;

// Banned patterns — disallow access to Node/browser privileged APIs
const BANNED_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\bprocess\b/, reason: "process" },
  { re: /\brequire\s*\(/, reason: "require" },
  { re: /\bimport\s*\(/, reason: "import()" },
  { re: /\bimport\s+/, reason: "import" },
  { re: /\beval\s*\(/, reason: "eval" },
  { re: /\bFunction\s*\(/, reason: "Function" },
  { re: /\bglobalThis\b/, reason: "globalThis" },
  { re: /\bglobal\b/, reason: "global" },
  { re: /\bwindow\s*\./, reason: "window" },
  { re: /\bdocument\s*\./, reason: "document" },
  { re: /\blocalStorage\b/, reason: "localStorage" },
  { re: /\bsessionStorage\b/, reason: "sessionStorage" },
  { re: /\bindexedDB\b/, reason: "indexedDB" },
  { re: /\bfetch\s*\(/, reason: "fetch" },
  { re: /\bXMLHttpRequest\b/, reason: "XMLHttpRequest" },
  { re: /\bWebSocket\b/, reason: "WebSocket" },
  { re: /\bWebWorker\b/, reason: "Worker" },
  { re: /\bchild_process\b/, reason: "child_process" },
  { re: /\bfs\s*\./, reason: "fs" },
  { re: /\bexec\s*\(/, reason: "exec" },
  { re: /\b__proto__\b/, reason: "__proto__" },
  { re: /\bconstructor\s*\[/, reason: "constructor" },
];

export function validatePluginText(text: string): { ok: boolean; reason?: string } {
  if (typeof text !== "string") return { ok: false, reason: "not string" };
  if (text.length > MAX_PLUGIN_SIZE) return { ok: false, reason: `exceeds ${MAX_PLUGIN_SIZE} bytes` };
  if (text.length === 0) return { ok: false, reason: "empty" };
  for (const { re, reason } of BANNED_PATTERNS) {
    if (re.test(text)) return { ok: false, reason: `banned: ${reason}` };
  }
  // Must call registerImporter at least once
  if (!text.includes("registerImporter")) return { ok: false, reason: "missing registerImporter" };
  return { ok: true };
}

export function isSafePluginCode(text: string): boolean {
  return validatePluginText(text).ok;
}

// Wrap parser to enforce timeout + output limits
import type { ParserFn } from "./registry";

export function wrapParser(parser: ParserFn, id: string): ParserFn {
  return (rawJson: unknown) => {
    let result: ReturnType<ParserFn> | null = null;
    let error: unknown = null;
    let done = false;
    // Synchronous parser — enforce via elapsed time + try/catch
    const start = Date.now();
    try {
      result = parser(rawJson);
    } catch (e) {
      error = e;
      done = true;
    }
    const elapsed = Date.now() - start;
    if (elapsed > PLUGIN_TIMEOUT_MS) {
      throw new Error(`Plugin "${id}" parser timeout ${elapsed}ms > ${PLUGIN_TIMEOUT_MS}ms`);
    }
    if (error) throw error;
    if (!done && result === null) throw new Error(`Plugin "${id}" parser returned null`);
    const arr = result as unknown[];
    if (!Array.isArray(arr)) throw new Error(`Plugin "${id}" parser must return array`);
    if (arr.length > MAX_PARSER_CONVERSATIONS) {
      throw new Error(`Plugin "${id}" exceeds ${MAX_PARSER_CONVERSATIONS} conversations`);
    }
    let totalMessages = 0;
    for (const conv of arr as Array<{ messages?: unknown[] }>) {
      if (conv && Array.isArray(conv.messages)) totalMessages += conv.messages.length;
      if (totalMessages > MAX_PARSER_MESSAGES) {
        throw new Error(`Plugin "${id}" exceeds ${MAX_PARSER_MESSAGES} messages`);
      }
    }
    return result as ReturnType<ParserFn>;
  };
}
