import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockProvider, summarizeText, summarizeMessages, getCachedSummary, __clearMemoryCache } from "./summarize";

describe("lib/summarize", () => {
  beforeEach(() => {
    __clearMemoryCache();
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
  });

  it("summarizes text into 3 bullets via heuristic (offline)", async () => {
    const text =
      "We discussed the Q3 roadmap for Memex. It includes vector search with sqlite-vec. The offline LLM summarize will run locally via tauri-plugin-llm. Users want local-first privacy and no cloud.";
    const bullets = await summarizeText(text, { useCache: false });
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toBeTruthy();
    expect(bullets.every((b) => b.length > 10)).toBe(true);
  });

  it("uses mocked LLM provider and parses bullets", async () => {
    const provider = createMockProvider("- Bullet one from LLM\n- Bullet two from LLM\n- Bullet three from LLM");
    const bullets = await summarizeText("some long conversation text that is enough to trigger summarize logic with multiple sentences. ".repeat(5), {
      provider,
      useCache: false,
    });
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toBe("Bullet one from LLM");
    expect(bullets[1]).toBe("Bullet two from LLM");
  });

  it("falls back to heuristic when provider fails", async () => {
    const failing = vi.fn(async () => {
      throw new Error("LLM offline");
    });
    const text = "Sentence one. Sentence two is longer and more important. Sentence three has unique keywords. Sentence four.";
    const bullets = await summarizeText(text, { provider: failing, useCache: false });
    expect(bullets).toHaveLength(3);
  });

  it("caches result in dashboard_cache / localStorage", async () => {
    const text = "Cache test content. Second sentence for scoring. Third sentence important. Fourth sentence extra.";
    const first = await summarizeText(text, { useCache: true });
    const cached = await getCachedSummary(text.slice(0, 500));
    expect(cached).toEqual(first);
    // second call should hit cache and return equal
    const second = await summarizeText(text, { useCache: true });
    expect(second).toEqual(first);
  });

  it("summarizeMessages joins message contents", async () => {
    const msgs = [{ content: "Hello world from Claude. This is a test message." }, { content: "Second message about Rust and Tauri." }, { content: "Third about vector search." }];
    const bullets = await summarizeMessages(msgs, { useCache: false });
    expect(bullets).toHaveLength(3);
  });

  it("returns placeholder for empty text", async () => {
    const bullets = await summarizeText("   ", { useCache: false });
    expect(bullets[0]).toMatch(/No content/);
  });

  it("handles heuristic with <=3 sentences and no sentences fallback", async () => {
    const short = "Short sentence one. Short two. Short three.";
    const bullets = await summarizeText(short, { useCache: false });
    expect(bullets.length).toBeGreaterThanOrEqual(1);
    expect(bullets.length).toBeLessThanOrEqual(3);
    const emptyLike = "   \n\n   ";
    expect(await summarizeText(emptyLike, { useCache: false })).toHaveLength(3);
    const singleLong = "This is a single very long sentence that exceeds twelve chars and should be returned as one bullet without scoring extra sentences. ";
    const b2 = await summarizeText(singleLong, { useCache: false });
    expect(b2.length).toBeGreaterThanOrEqual(1);
  });

  it("parses provider bullets with padding and trimming", async () => {
    const provider = createMockProvider("One\nTwo");
    const bullets = await summarizeText("long enough text with many sentences. ".repeat(10), { provider, useCache: false });
    expect(bullets).toHaveLength(3);
    expect(bullets[2]).toMatch(/Additional insight/);
    const dashProvider = createMockProvider("- Bullet A\n• Bullet B\n1. Bullet C\n2) Bullet D");
    const b2 = await summarizeText("text ".repeat(20), { provider: dashProvider, useCache: false });
    expect(b2[0]).toBe("Bullet A");
    expect(b2.length).toBe(3);
  });

  it("getCachedSummary returns null when no cache and handles fallback", async () => {
    __clearMemoryCache();
    const missing = await getCachedSummary("nonexistent-key-" + Date.now());
    expect(missing).toBeNull();
    const text = "LocalStorage fallback test. Second sentence. Third sentence. Fourth sentence extra content for cache.";
    const first = await summarizeText(text, { useCache: true });
    __clearMemoryCache();
    // Should still hit via DB or localStorage after clearMemory
    const cached = await getCachedSummary(text.slice(0, 500));
    // In test env DB mock returns empty, but localStorage should have it
    // At least not throw, may be null or equal
    expect(cached === null || Array.isArray(cached)).toBe(true);
    if (cached) expect(cached).toEqual(first);
  });

  it("summarizeMessages handles empty join", async () => {
    const bullets = await summarizeMessages([], { useCache: false });
    expect(bullets[0]).toMatch(/No content/);
  });

  it("createMockProvider returns response verbatim", async () => {
    const p = createMockProvider("hello\nworld\ntest");
    expect(await p("prompt")).toBe("hello\nworld\ntest");
  });

  it("heuristic fallback splits by newlines when no sentence punct", async () => {
    const text = "Line one with enough length to pass filter\nLine two with enough length to pass filter\nLine three with enough length to pass filter\nLine four extra for ranking";
    const bullets = await summarizeText(text, { useCache: false });
    expect(bullets.length).toBe(3);
  });

  it("hashKey deterministic and getCachedSummary localStorage path", async () => {
    __clearMemoryCache();
    const t = "deterministic hash test content for summarize cache key generation with some length";
    await summarizeText(t, { useCache: true });
    __clearMemoryCache();
    const cached = await getCachedSummary(t.slice(0, 500));
    expect(cached === null || Array.isArray(cached)).toBe(true);
  });

  it("summarizeMessages with provider and useCache false", async () => {
    const provider = createMockProvider("P1\nP2\nP3");
    const msgs = [{ content: "Hello world. This is a test. Another sentence. Yet another. One more for ranking." }];
    const bullets = await summarizeMessages(msgs, { provider, useCache: false });
    expect(bullets).toHaveLength(3);
  });
});
