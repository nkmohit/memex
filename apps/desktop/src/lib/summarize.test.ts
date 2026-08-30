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
});
