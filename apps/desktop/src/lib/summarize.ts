/**
 * Offline LLM summarize — local, deterministic, no network.
 * Summarizes a conversation (or any text) into 3 bullets, cached in dashboard_cache.
 * A pluggable provider (tauri-plugin-llm / WebLLM) can be injected for real LLM;
 * fallback is a heuristic sentence-ranker so tests and offline use still work.
 */

import { getDb } from "../db/connection";
import { logger } from "./logger";

export type SummarizeProvider = (prompt: string) => Promise<string>;

const CACHE_PREFIX = "summary:";
const memoryCache = new Map<string, string[]>();

export function __clearMemoryCache() {
  memoryCache.clear();
}

function hashKey(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function splitSentences(text: string): string[] {
  // keep sentences with 10+ chars, split on .!? + whitespace
  const matches = text.match(/[^.!?]+[.!?]+/g);
  if (!matches) {
    // fallback: split by newlines
    return text
      .split(/\n+/g)
      .map((s) => s.trim())
      .filter((s) => s.length >= 12);
  }
  return matches.map((s) => s.trim()).filter((s) => s.length >= 12);
}

function scoreSentences(sentences: string[]): number[] {
  const wordFreq = new Map<string, number>();
  for (const s of sentences) {
    const words = s
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter(Boolean);
    for (const w of words) wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
  }
  return sentences.map((s) => {
    const words = s
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter(Boolean);
    const uniq = new Set(words);
    let freqScore = 0;
    for (const w of uniq) freqScore += Math.log(1 + (wordFreq.get(w) ?? 0));
    // prefer medium length (80-140 chars) and higher freq
    const lenScore = Math.min(s.length, 140) / 140;
    return freqScore * 0.7 + lenScore * 0.3;
  });
}

function heuristicBullets(text: string): string[] {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    const trimmed = text.trim().slice(0, 160);
    if (!trimmed)
      return ["No content to summarize.", "Import more data.", "Insights will appear here."];
    return [
      trimmed,
      "Key takeaway: conversation contains notable details.",
      "Review full thread for context.",
    ];
  }
  if (sentences.length <= 3) {
    return sentences.map((s) => s.slice(0, 160));
  }
  const scores = scoreSentences(sentences);
  const ranked = sentences
    .map((s, idx) => ({ s, score: scores[idx]!, idx }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .sort((a, b) => a.idx - b.idx)
    .map((x) => x.s.slice(0, 160));
  return ranked;
}

function parseProviderBullets(raw: string): string[] {
  const lines = raw
    .split(/\n+/g)
    .map((l) => l.replace(/^[-•\d.)\s]+/, "").trim())
    .filter(Boolean);
  if (lines.length >= 3) return lines.slice(0, 3).map((l) => l.slice(0, 160));
  if (lines.length > 0) {
    // pad to 3
    while (lines.length < 3) lines.push("Additional insight pending.");
    return lines.slice(0, 3);
  }
  return heuristicBullets(raw);
}

export async function getCachedSummary(key: string): Promise<string[] | null> {
  const cacheKey = `${CACHE_PREFIX}${hashKey(key)}`;
  if (memoryCache.has(cacheKey)) return memoryCache.get(cacheKey)!;
  try {
    const db = await getDb();
    const rows = await db.select<{ payload: string }[]>(
      "SELECT payload FROM dashboard_cache WHERE cache_key = $1 LIMIT 1",
      [cacheKey]
    );
    if (rows[0]?.payload) {
      const parsed = JSON.parse(rows[0].payload) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCache.set(cacheKey, parsed);
        return parsed;
      }
    }
  } catch (err) {
    logger.debug("summarize: cache read miss", err);
  }
  // fallback to localStorage in browser (for tests without DB)
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(cacheKey) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) {
        memoryCache.set(cacheKey, parsed);
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function setCachedSummary(key: string, bullets: string[]): Promise<void> {
  const cacheKey = `${CACHE_PREFIX}${hashKey(key)}`;
  const payload = JSON.stringify(bullets);
  const now = Date.now();
  memoryCache.set(cacheKey, bullets);
  try {
    const db = await getDb();
    await db.execute(
      `INSERT INTO dashboard_cache (cache_key, payload, data_version, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      [cacheKey, payload, 0, now]
    );
  } catch (err) {
    logger.debug("summarize: cache write DB miss", err);
  }
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(cacheKey, payload);
  } catch {
    // ignore
  }
}

export async function summarizeText(
  text: string,
  opts: { provider?: SummarizeProvider; useCache?: boolean } = {}
): Promise<string[]> {
  const trimmed = text.trim();
  if (!trimmed)
    return ["No content to summarize.", "Try importing data.", "Insights will appear here."];
  const cacheKeyText = trimmed.slice(0, 500);
  if (opts.useCache !== false) {
    const cached = await getCachedSummary(cacheKeyText);
    if (cached) return cached;
  }

  let bullets: string[];
  if (opts.provider) {
    try {
      const prompt = `Summarize the following conversation into exactly 3 bullet points (each <=25 words):\n\n${trimmed.slice(0, 4000)}`;
      const raw = await opts.provider(prompt);
      bullets = parseProviderBullets(raw);
    } catch (err) {
      logger.warn("summarize: provider failed, falling back to heuristic", err);
      bullets = heuristicBullets(trimmed);
    }
  } else {
    bullets = heuristicBullets(trimmed);
  }

  if (opts.useCache !== false) await setCachedSummary(cacheKeyText, bullets);
  return bullets;
}

export async function summarizeMessages(
  messages: { content: string }[],
  opts: { provider?: SummarizeProvider; useCache?: boolean } = {}
): Promise<string[]> {
  const text = messages.map((m) => m.content).join("\n\n");
  return summarizeText(text, opts);
}

// For tests: simple mock provider factory
export function createMockProvider(response: string): SummarizeProvider {
  return async () => response;
}
