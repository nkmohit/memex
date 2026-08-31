/**
 * Search worker — offloads vector scoring off main thread.
 * Keep UI 60fps for 1000+ results by moving embed/cosine out of searchMessages hot path.
 * Fallback: if Worker unavailable (jsdom/tests), searchMessages runs scoring synchronously.
 */
import { cosineSimilarity, embed } from "../lib/vector";

export interface WorkerScoreInput {
  query: string;
  rows: {
    message_id: string;
    conversation_id: string;
    content: string;
    message_created_at: number;
    title: string;
    source: string;
    conv_created_at: number;
  }[];
  threshold: number;
}

export interface WorkerScoreOutput {
  message_id: string;
  conversation_id: string;
  content: string;
  message_created_at: number;
  title: string;
  source: string;
  conv_created_at: number;
  score: number;
}

export function scoreRows(input: WorkerScoreInput): WorkerScoreOutput[] {
  const qVec = embed(input.query);
  const out: WorkerScoreOutput[] = [];
  for (const r of input.rows) {
    const sim = cosineSimilarity(qVec, embed(r.content));
    if (sim >= input.threshold) {
      out.push({ ...r, score: sim });
    }
  }
  return out;
}

// Message protocol for dedicated Worker
export type WorkerRequest = { type: "score"; id: number; payload: WorkerScoreInput };
export type WorkerResponse =
  { id: number; scored: WorkerScoreOutput[] } | { id: number; error: string };

if (
  typeof self !== "undefined" &&
  typeof (self as unknown as { postMessage?: unknown }).postMessage === "function"
) {
  self.onmessage = (e: MessageEvent<WorkerRequest>) => {
    const req = e.data;
    if (req?.type === "score") {
      try {
        const scored = scoreRows(req.payload);
        const res: WorkerResponse = { id: req.id, scored };
        (self as unknown as { postMessage: (m: unknown) => void }).postMessage(res);
      } catch (err) {
        const res: WorkerResponse = {
          id: req.id,
          error: err instanceof Error ? err.message : String(err),
        };
        (self as unknown as { postMessage: (m: unknown) => void }).postMessage(res);
      }
    }
  };
}
