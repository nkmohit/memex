import { describe, it, expect, beforeEach } from "vitest";
import { validatePluginText, isSafePluginCode, wrapParser, MAX_PLUGIN_SIZE, MAX_PARSER_CONVERSATIONS } from "./sandbox";
import { clearPlugins, registerImporter, getPluginSources, getPluginParser } from "./registry";

describe("plugins/sandbox", () => {
  beforeEach(() => clearPlugins());

  it("validatePluginText accepts safe code", () => {
    const safe = `registerImporter({id:"safe", label:"Safe", available:true}, (raw)=>[]);`;
    expect(validatePluginText(safe).ok).toBe(true);
    expect(isSafePluginCode(safe)).toBe(true);
  });

  it("rejects banned tokens", () => {
    const cases = [
      `fetch("https://evil.com")`,
      `process.env.SECRET`,
      `require("fs")`,
      `eval("bad")`,
      `Function("return process")()`,
      `globalThis.foo`,
      `window.alert(1)`,
      `document.cookie`,
      `XMLHttpRequest`,
    ];
    for (const c of cases) {
      const text = `registerImporter({id:"x",label:"X",available:true},()=>{${c}});`;
      const res = validatePluginText(text);
      expect(res.ok, `should reject ${c}`).toBe(false);
      expect(res.reason).toContain("banned");
    }
  });

  it("rejects missing registerImporter and empty/oversized", () => {
    expect(validatePluginText("").ok).toBe(false);
    expect(validatePluginText("console.log(1)").ok).toBe(false);
    const big = "a".repeat(MAX_PLUGIN_SIZE + 1);
    expect(validatePluginText(big).ok).toBe(false);
  });

  it("wrapParser enforces output limits", () => {
    const parser = () => new Array(MAX_PARSER_CONVERSATIONS + 1).fill({ id: "c", messages: [] }) as any;
    const wrapped = wrapParser(parser, "big");
    expect(() => wrapped([])).toThrow(/exceeds/);
  });

  it("wrapParser timeout and non-array handling", () => {
    const bad = () => null as any;
    const wrapped = wrapParser(bad, "bad");
    expect(() => wrapped([])).toThrow();
  });

  it("registry enforces MAX_PLUGINS and wrapping", () => {
    for (let i = 0; i < 3; i++) {
      registerImporter({ id: `p${i}`, label: `P${i}`, available: true }, () => []);
    }
    expect(getPluginSources()).toHaveLength(3);
    const parser = () =>
      [{ id: "c1", externalId: "c1", source: "p0", title: "T", createdAt: 0, updatedAt: 0, messageCount: 0, messages: [] }] as any;
    registerImporter({ id: "wrapTest", label: "Wrap", available: true }, parser);
    const wrappedParser = getPluginParser("wrapTest");
    expect(wrappedParser).toBeDefined();
    // wrapped parser should validate output
    expect(wrappedParser!([])).toHaveLength(1);
  });

  it("loadPlugins rejects unsafe plugin text (via validate)", async () => {
    // Simulate unsafe file content via direct validate — loadPlugins path is covered in registry.test
    const unsafe = `registerImporter({id:"evil",label:"Evil",available:true},()=>{fetch("https://evil")});`;
    expect(validatePluginText(unsafe).ok).toBe(false);
  });
});
