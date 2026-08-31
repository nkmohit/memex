import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

function rootPath(...parts: string[]): string {
  // vitest cwd is apps/desktop when run via --prefix, so go up 2 to repo root
  return join(process.cwd(), "..", "..", ...parts);
}

describe("security hardening", () => {
  it("tauri.conf.json has CSP and publisher", async () => {
    const confPath = join(process.cwd(), "src-tauri", "tauri.conf.json");
    const altPath = rootPath("apps", "desktop", "src-tauri", "tauri.conf.json");
    let raw = "";
    try {
      raw = await readFile(confPath, "utf-8");
    } catch {
      raw = await readFile(altPath, "utf-8");
    }
    const conf = JSON.parse(raw);
    expect(conf.app?.security?.csp).toBeTruthy();
    expect(String(conf.app.security.csp)).toContain("default-src");
    expect(conf.bundle?.publisher).toBeTruthy();
    expect(conf.bundle?.createUpdaterArtifacts).toBe(true);
  });

  it("SECURITY.md and THREAT_MODEL.md exist with expected sections", async () => {
    const secPath = rootPath("SECURITY.md");
    const raw = await readFile(secPath, "utf-8");
    expect(raw).toMatch(/Supported Versions/);
    expect(raw).toMatch(/Threat Model|threat/i);
    expect(raw).toMatch(/SBOM|cyclonedx/i);
    const threatPath = rootPath("THREAT_MODEL.md");
    const threat = await readFile(threatPath, "utf-8");
    expect(threat).toMatch(/Threat Model|Assets/);
  });

  it("perf budgets enforced", async () => {
    const budgetsPath = rootPath("perf", "budgets.json");
    const raw = await readFile(budgetsPath, "utf-8");
    const data = JSON.parse(raw);
    expect(data.budgets[0].maxSizeKB).toBeLessThanOrEqual(500);
  });
});
