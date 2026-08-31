/**
 * Advanced analytics — TF-IDF topic timeline.
 * Offline, deterministic, no network. Computes top terms per month and globally.
 * Documents = conversation titles / message snippets (any strings).
 */

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "as",
  "by",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "has",
  "have",
  "had",
  "it",
  "this",
  "that",
  "these",
  "those",
  "you",
  "your",
  "we",
  "our",
  "they",
  "their",
  "from",
  "about",
  "into",
  "over",
  "after",
  "before",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "can",
  "will",
  "just",
  "don",
  "should",
  "now",
  "what",
  "which",
  "who",
  "whom",
  "about",
  "up",
  "out",
  "if",
  "while",
  "during",
  "above",
  "below",
  "my",
  "me",
  "i",
  "im",
  "ive",
  "id",
  "ll",
  "t",
  "s",
  "d",
  "m",
  "o",
  "y",
  "re",
  "ve",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

export function computeTopTopics(texts: string[], topK = 5): string[] {
  if (!texts.length) return [];
  const N = texts.length;
  const docFreq = new Map<string, number>();
  const termFreqs: Map<string, number>[] = [];
  const allTerms = new Set<string>();

  for (const text of texts) {
    const tokens = tokenize(text);
    const tf = new Map<string, number>();
    const seen = new Set<string>();
    for (const tok of tokens) {
      tf.set(tok, (tf.get(tok) ?? 0) + 1);
      if (!seen.has(tok)) {
        docFreq.set(tok, (docFreq.get(tok) ?? 0) + 1);
        seen.add(tok);
      }
      allTerms.add(tok);
    }
    // normalize tf by doc length
    const len = tokens.length || 1;
    for (const [k, v] of tf.entries()) tf.set(k, v / len);
    termFreqs.push(tf);
  }

  const scores = new Map<string, number>();
  for (const term of allTerms) {
    const df = docFreq.get(term) ?? 1;
    const idf = Math.log((N + 1) / (df + 1)) + 1; // smoothed
    let tfidfSum = 0;
    for (const tf of termFreqs) tfidfSum += (tf.get(term) ?? 0) * idf;
    // boost for terms appearing in multiple docs but not too common
    scores.set(term, tfidfSum);
  }

  return (
    Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([term]) => term)
      // capitalize for display
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
  );
}

export interface TopicTimelinePoint {
  month: string; // YYYY-MM
  topTopics: string[];
  count: number;
}

export function computeTopicTimeline(
  items: { text: string; date: number | string }[],
  topKPerMonth = 3
): TopicTimelinePoint[] {
  if (!items.length) return [];
  const byMonth = new Map<string, string[]>();
  for (const item of items) {
    const d = typeof item.date === "string" ? new Date(item.date) : new Date(item.date as number);
    if (Number.isNaN(d.getTime())) continue;
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const arr = byMonth.get(month) ?? [];
    arr.push(item.text);
    byMonth.set(month, arr);
  }
  const points: TopicTimelinePoint[] = [];
  for (const [month, texts] of Array.from(byMonth.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const topTopics = computeTopTopics(texts, topKPerMonth);
    points.push({ month, topTopics, count: texts.length });
  }
  return points;
}
