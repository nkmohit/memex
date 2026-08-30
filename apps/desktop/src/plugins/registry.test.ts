import { describe, it, expect, beforeEach } from "vitest";
import { registerImporter, getPluginSources, getPluginParser, isPluginSource, clearPlugins, getAllSources, unregisterImporter } from "./registry";

describe("plugins/registry", () => {
  beforeEach(() => clearPlugins());

  it("registers and retrieves a plugin source", () => {
    registerImporter({ id: "notion", label: "Notion", available: true }, (raw) => {
      const arr = raw as unknown[];
      return arr.map((_, i) => ({
        id: `c${i}`,
        externalId: `c${i}`,
        source: "notion",
        title: "T",
        createdAt: 0,
        updatedAt: 0,
        messageCount: 0,
        messages: [],
      }));
    });
    expect(getPluginSources()).toHaveLength(1);
    expect(getPluginSources()[0].id).toBe("notion");
    expect(isPluginSource("notion")).toBe(true);
    expect(getPluginParser("notion")).toBeDefined();
  });

  it("getAllSources merges builtin + plugins", () => {
    const builtin = [{ id: "claude", label: "Claude", available: true }];
    registerImporter({ id: "example", label: "Example", available: true }, () => []);
    const all = getAllSources(builtin);
    expect(all).toHaveLength(2);
    expect(all.some((s) => s.id === "example")).toBe(true);
  });

  it("validates id format and duplicates", () => {
    registerImporter({ id: "dup", label: "Dup", available: true }, () => []);
    expect(() => registerImporter({ id: "dup", label: "Dup2", available: true }, () => [])).toThrow(/already registered/);
    expect(() => registerImporter({ id: "a", label: "A", available: true }, () => [])).toThrow(/Invalid plugin id/);
    expect(() => registerImporter({ id: "bad id!", label: "Bad", available: true }, () => [])).toThrow(/Invalid plugin id/);
  });

  it("validates parser is function", () => {
    expect(() => registerImporter({ id: "bad", label: "Bad", available: true }, null as any)).toThrow(/parser must be a function/);
  });

  it("unregister and clear", () => {
    registerImporter({ id: "todel", label: "ToDel", available: true }, () => []);
    expect(unregisterImporter("todel")).toBe(true);
    expect(getPluginSources()).toHaveLength(0);
    registerImporter({ id: "a2", label: "A2", available: true }, () => []);
    registerImporter({ id: "b2", label: "B2", available: true }, () => []);
    clearPlugins();
    expect(getPluginSources()).toHaveLength(0);
  });

  it("isPluginSource case-insensitive", () => {
    registerImporter({ id: "case", label: "Case", available: true }, () => []);
    expect(isPluginSource("CASE")).toBe(true);
    expect(getPluginParser("CASE")).toBeDefined();
  });

  it("parser is invoked correctly", () => {
    registerImporter({ id: "parse", label: "Parse", available: true }, (raw) => {
      const data = raw as { id: string }[];
      return data.map((d) => ({
        id: d.id,
        externalId: d.id,
        source: "parse",
        title: "X",
        createdAt: 1,
        updatedAt: 1,
        messageCount: 1,
        messages: [{ id: "m1", conversationId: d.id, sender: "human" as const, content: "hi", createdAt: 1 }],
      }));
    });
    const parser = getPluginParser("parse")!;
    const res = parser([{ id: "c1" }]);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("c1");
  });
});
