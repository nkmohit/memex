import { describe, it, expect } from "vitest";
import { cosineSimilarity, embed, hybridScore } from "./vector";

describe("lib/vector", () => {
  it("embed is normalized and deterministic", () => {
    const a = embed("hello world");
    const b = embed("hello world");
    expect(a).toEqual(b);
    const norm = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("empty text returns zero vector", () => {
    const v = embed("");
    expect(v.every((x) => x === 0)).toBe(true);
  });

  it("synonyms have high cosine (vacation ~ holiday trip)", () => {
    const a = embed("vacation");
    const b = embed("holiday trip");
    expect(cosineSimilarity(a, b)).toBeGreaterThan(0.3);
  });

  it("unrelated terms have low cosine", () => {
    const a = embed("vacation");
    const b = embed("quantum physics");
    expect(cosineSimilarity(a, b)).toBeLessThan(0.3);
  });

  it("identical texts have cosine 1", () => {
    const a = embed("react frontend ui");
    const b = embed("react frontend ui");
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it("hybridScore blends FTS and semantic", () => {
    const s = hybridScore(-5, 0.9, 0.5);
    expect(s).toBeGreaterThan(0.5);
    // pure semantic
    expect(hybridScore(-5, 1, 0)).toBeCloseTo(1, 1);
    expect(hybridScore(-5, -1, 0)).toBeCloseTo(0, 1);
  });
});
