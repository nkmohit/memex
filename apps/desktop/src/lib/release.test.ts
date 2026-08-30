import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

function rootPath(...parts: string[]): string {
  return join(process.cwd(), "..", "..", ...parts);
}

describe("release automation", () => {
  it("release.yml exists with tag trigger and SBOM", async () => {
    const raw = await readFile(rootPath(".github", "workflows", "release.yml"), "utf-8");
    expect(raw).toContain("on:");
    expect(raw).toContain("tags:");
    expect(raw).toContain("v*");
    expect(raw).toContain("cargo cyclonedx");
    expect(raw).toContain("softprops/action-gh-release");
    expect(raw).toContain("CHANGELOG");
  });

  it("ci.yml has sbom job", async () => {
    const raw = await readFile(rootPath(".github", "workflows", "ci.yml"), "utf-8");
    expect(raw).toContain("sbom:");
    expect(raw).toContain("cargo cyclonedx");
    expect(raw).toContain("SBOM");
  });
});
