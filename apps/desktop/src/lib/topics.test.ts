import { describe, it, expect } from "vitest";
import { computeTopTopics, computeTopicTimeline } from "./topics";

describe("lib/topics", () => {
  it("computes top topics from titles (happy path)", () => {
    const texts = [
      "React frontend UI discussion about hooks",
      "Rust Cargo Tauri desktop app",
      "React and Rust integration for Memex",
      "Python data analysis unrelated",
    ];
    const topics = computeTopTopics(texts, 3);
    expect(topics.length).toBe(3);
    // React and Rust should be top due to frequency
    expect(topics.map((t) => t.toLowerCase())).toEqual(expect.arrayContaining(["react", "rust"]));
  });

  it("returns empty for no texts", () => {
    expect(computeTopTopics([])).toEqual([]);
    expect(computeTopicTimeline([])).toEqual([]);
  });

  it("filters stopwords and short tokens", () => {
    const topics = computeTopTopics(["the and is a test of the system system", "system test"], 2);
    expect(topics.map((t) => t.toLowerCase())).toContain("system");
    expect(topics.map((t) => t.toLowerCase())).not.toContain("the");
  });

  it("computes topic timeline per month", () => {
    const items = [
      { text: "React hooks", date: new Date("2026-01-10").getTime() },
      { text: "React state", date: new Date("2026-01-20").getTime() },
      { text: "Rust ownership", date: new Date("2026-02-05").getTime() },
    ];
    const timeline = computeTopicTimeline(items, 2);
    expect(timeline).toHaveLength(2);
    expect(timeline[0].month).toBe("2026-01");
    expect(timeline[0].count).toBe(2);
    expect(timeline[0].topTopics.map((t) => t.toLowerCase())).toContain("react");
    expect(timeline[1].month).toBe("2026-02");
    expect(timeline[1].topTopics.map((t) => t.toLowerCase())).toContain("rust");
  });

  it("caps at topK", () => {
    const texts = Array.from({ length: 20 }, (_, i) => `uniqueWord${i} common`);
    const topics = computeTopTopics(texts, 5);
    expect(topics).toHaveLength(5);
  });
});
