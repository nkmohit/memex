/**
 * Lightweight embedding for hybrid semantic search.
 * Local, deterministic, no network. Uses a small synonym-aware hashed TF vector.
 * Dimensions: 64 — enough for paraphrase matching while cheap to compute.
 * This mirrors what a real `sqlite-vec` + `all-MiniLM` would do, but offline and testable.
 */

const DIM = 64;
const SYNONYM_GROUPS: string[][] = [
  ["vacation", "holiday", "trip", "getaway", "travel"],
  ["car", "automobile", "vehicle", "auto"],
  ["salary", "pay", "wage", "income", "compensation"],
  ["hello", "hi", "hey", "greetings"],
  ["react", "frontend", "ui"],
  ["rust", "cargo", "tauri"],
];

// Build token -> groupId map for synonym expansion
const GROUP_BY_TOKEN = new Map<string, number>();
for (let gid = 0; gid < SYNONYM_GROUPS.length; gid++) {
  for (const token of SYNONYM_GROUPS[gid]!) {
    GROUP_BY_TOKEN.set(token, gid);
  }
}

function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // non-negative
  return h >>> 0;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
}

/**
 * Embed text into a normalized dense vector (length DIM).
 * Synonym groups are mapped to the same hashed buckets so
 * "vacation" ≈ "holiday" gets high cosine similarity.
 */
export function embed(text: string): number[] {
  const vec = new Array<number>(DIM).fill(0);
  if (typeof text !== "string") return vec;
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;

  for (const token of tokens) {
    const groupId = GROUP_BY_TOKEN.get(token);
    // Two buckets per token: raw hash + synonym-group bucket
    const h = hashToken(token);
    const bucket = h % DIM;
    vec[bucket]! += 1;

    if (groupId !== undefined) {
      // Stable group bucket: map groupId to a reserved high bucket to boost synonym overlap
      // Use hash of group representative so groups are spread
      const groupBucket = hashToken(`__group_${groupId}`) % DIM;
      vec[groupBucket]! += 1.5; // extra weight for synonym signal
      // Also boost the canonical token bucket
      const canon = SYNONYM_GROUPS[groupId]![0]!;
      const canonBucket = hashToken(canon) % DIM;
      if (canonBucket !== bucket) vec[canonBucket]! += 0.7;
    }
  }

  // L2 normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return vec;
  for (let i = 0; i < vec.length; i++) vec[i]! /= norm;
  return vec;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  // vectors are normalized, dot is cosine
  return Math.max(-1, Math.min(1, dot));
}

export function l2Distance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * sqlite-vec interop: serialize float64 normalized vector to Float32 LE blob
 * as expected by `vec0(embedding float[64])`. Stores as Uint8Array for SQL BLOB.
 */
export function serializeEmbedding(vec: number[]): Uint8Array {
  const buf = new ArrayBuffer(vec.length * 4);
  const view = new DataView(buf);
  for (let i = 0; i < vec.length; i++) view.setFloat32(i * 4, vec[i] ?? 0, true);
  return new Uint8Array(buf);
}

export function deserializeEmbedding(blob: Uint8Array | ArrayBuffer | number[]): number[] {
  if (Array.isArray(blob)) return [...blob];
  const u8 = blob instanceof Uint8Array ? blob : new Uint8Array(blob as ArrayBuffer);
  if (u8.length % 4 !== 0) return Array.from(u8).map((v) => v / 255);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const out: number[] = [];
  for (let i = 0; i < u8.length / 4; i++) out.push(view.getFloat32(i * 4, true));
  return out;
}

/** Detect sqlite-vec availability (stub: env MEMEX_VEC=1 or plugin loaded). */
export function isSqliteVecAvailable(): boolean {
  try {
    if (typeof process !== "undefined" && (process as unknown as { env?: Record<string, string> }).env?.MEMEX_VEC === "1") return true;
  } catch {
    // ignore
  }
  return false;
}

/**
 * Hybrid score: weighted blend of FTS rank (converted to 0..1 similarity) and semantic similarity.
 * ftsScore: higher is better (we convert -rank -> score). semanticScore: cosine -1..1.
 */
export function hybridScore(ftsRank: number, semanticScore: number, alpha = 0.5): number {
  // ftsRank is negative (e.g., -5 boost plus -occurrences). Map to 0..1 via sigmoid-ish
  // alpha=0 -> pure semantic, 1 -> pure FTS
  const ftsScore = 1 / (1 + Math.exp(ftsRank)); // rank -5..0 -> 0.99..0.5
  const semanticNorm = (semanticScore + 1) / 2; // -1..1 -> 0..1
  return alpha * ftsScore + (1 - alpha) * semanticNorm;
}

/** For debug / test: expose groups */
export const _internal = { DIM, SYNONYM_GROUPS, GROUP_BY_TOKEN, hashToken, tokenize, serializeEmbedding: serializeEmbedding, deserializeEmbedding: deserializeEmbedding };
