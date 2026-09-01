/**
 * Minimal OTEL-style metrics for p95 latency.
 * Provides histogram recording without pulling @opentelemetry/sdk
 * (keeps bundle small). Search latencies are recorded via logger spans
 * and queried by diagnostics.getPerfStats().
 * Future swap: replace with @opentelemetry/api MeterProvider when needed.
 */

const MAX_POINTS = 1000;

class Histogram {
  readonly name: string;
  readonly description: string;
  readonly unit: string;
  private values: number[] = [];

  constructor(name: string, description: string, unit = "ms") {
    this.name = name;
    this.description = description;
    this.unit = unit;
  }

  record(value: number, _attrs?: Record<string, unknown>): void {
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    this.values.push(value);
    if (this.values.length > MAX_POINTS) this.values.shift();
  }

  getValues(): number[] {
    return [...this.values];
  }

  getCount(): number {
    return this.values.length;
  }

  reset(): void {
    this.values = [];
  }

  computeP95(): number | null {
    if (this.values.length === 0) return null;
    const sorted = [...this.values].sort((a, b) => a - b);
    const idx = Math.ceil(0.95 * sorted.length) - 1;
    return sorted[Math.max(0, idx)] ?? null;
  }

  computeP50(): number | null {
    if (this.values.length === 0) return null;
    const sorted = [...this.values].sort((a, b) => a - b);
    const idx = Math.ceil(0.5 * sorted.length) - 1;
    return sorted[Math.max(0, idx)] ?? null;
  }

  getSummary(): { count: number; p50: number | null; p95: number | null; p99: number | null } {
    if (this.values.length === 0) return { count: 0, p50: null, p95: null, p99: null };
    const sorted = [...this.values].sort((a, b) => a - b);
    const p = (q: number) => sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] ?? null;
    return { count: sorted.length, p50: p(0.5), p95: p(0.95), p99: p(0.99) };
  }
}

const histograms = new Map<string, Histogram>();

function getHistogram(name: string, description = "", unit = "ms"): Histogram {
  let h = histograms.get(name);
  if (!h) {
    h = new Histogram(name, description, unit);
    histograms.set(name, h);
  }
  return h;
}

// Predefined histogram for search
const SEARCH_HISTOGRAM = getHistogram("search.latency", "searchMessages latency", "ms");

export function recordSearchLatency(durationMs: number, attrs?: Record<string, unknown>): void {
  SEARCH_HISTOGRAM.record(durationMs, attrs);
}

export function getSearchLatencies(): number[] {
  return SEARCH_HISTOGRAM.getValues();
}

export function getSearchP95(): number | null {
  return SEARCH_HISTOGRAM.computeP95();
}

export function getSearchSummary(): ReturnType<Histogram["getSummary"]> {
  return SEARCH_HISTOGRAM.getSummary();
}

export function resetOtel(): void {
  for (const h of histograms.values()) h.reset();
}

export function exportOtelMetrics(): Record<string, unknown> {
  const summary = SEARCH_HISTOGRAM.getSummary();
  return {
    "search.latency.count": summary.count,
    "search.latency.p50": summary.p50,
    "search.latency.p95": summary.p95,
    "search.latency.p99": summary.p99,
    histograms: Object.fromEntries(
      Array.from(histograms.entries()).map(([k, h]) => [k, h.getSummary()])
    ),
  };
}

// Minimal tracer stub for future OTEL swap
export interface OtelSpan {
  name: string;
  start: number;
  attributes?: Record<string, unknown>;
  end: (extra?: Record<string, unknown>) => number;
}

export function startOtelSpan(name: string, attributes?: Record<string, unknown>): OtelSpan {
  const start = Date.now();
  return {
    name,
    start,
    attributes,
    end: (extra) => {
      const duration = Date.now() - start;
      if (name === "searchMessages") recordSearchLatency(duration, { ...attributes, ...extra });
      return duration;
    },
  };
}

export const otel = {
  histogram: SEARCH_HISTOGRAM,
  getHistogram,
  recordSearchLatency,
  getSearchLatencies,
  getSearchP95,
  getSearchSummary,
  reset: resetOtel,
  exportMetrics: exportOtelMetrics,
  startSpan: startOtelSpan,
};

export default otel;
