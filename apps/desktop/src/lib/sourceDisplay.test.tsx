import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { sourceLabel, SourceIcon, BrandSourceIcon } from "./sourceDisplay";

describe("sourceLabel", () => {
  it("returns Claude for claude", () => {
    expect(sourceLabel("claude")).toBe("Claude");
  });

  it("returns ChatGPT for chatgpt", () => {
    expect(sourceLabel("chatgpt")).toBe("ChatGPT");
  });

  it("returns Gemini for gemini", () => {
    expect(sourceLabel("gemini")).toBe("Gemini");
  });

  it("returns Grok for grok", () => {
    expect(sourceLabel("grok")).toBe("Grok");
  });

  it("capitalizes unknown source", () => {
    expect(sourceLabel("unknown")).toBe("Unknown");
    expect(sourceLabel("customSource")).toBe("CustomSource");
  });

  it("is case-insensitive via lowercasing? sourceLabel is case-sensitive but falls back to capitalized", () => {
    // sourceLabel uses exact id match, so "Claude" capital not found -> capitalized fallback
    expect(sourceLabel("Claude")).toBe("Claude");
  });
});

describe("SourceIcon", () => {
  it("renders span with source-claude for claude", () => {
    const { container } = render(<SourceIcon source="claude" />);
    expect(container.firstChild).toHaveClass("source-claude");
  });

  it("renders source-chatgpt for chatgpt", () => {
    const { container } = render(<SourceIcon source="chatgpt" />);
    expect(container.firstChild).toHaveClass("source-chatgpt");
  });

  it("renders default dot for unknown", () => {
    const { container } = render(<SourceIcon source="unknown" />);
    expect(container.firstChild).toHaveClass("overview-source-dot");
    expect(container.firstChild).not.toHaveClass("source-claude");
  });

  it("renders gemini and grok", () => {
    const { container: c1 } = render(<SourceIcon source="gemini" />);
    expect(c1.firstChild).toHaveClass("source-gemini");
    const { container: c2 } = render(<SourceIcon source="grok" />);
    expect(c2.firstChild).toHaveClass("source-grok");
    const { container: c3 } = render(<SourceIcon source="GEMINI" />);
    expect(c3.firstChild).toHaveClass("source-gemini");
  });
});

describe("BrandSourceIcon", () => {
  it("renders claude/chatgpt/gemini/grok and null for unknown", () => {
    const { container: c1 } = render(<BrandSourceIcon source="claude" size={24} />);
    expect(c1.firstChild).toBeTruthy();
    const { container: c2 } = render(<BrandSourceIcon source="chatgpt" />);
    expect(c2.firstChild).toBeTruthy();
    const { container: c3 } = render(<BrandSourceIcon source="gemini" />);
    expect(c3.firstChild).toBeTruthy();
    const { container: c4 } = render(<BrandSourceIcon source="grok" />);
    expect(c4.firstChild).toBeTruthy();
    const { container: c5 } = render(<BrandSourceIcon source="unknown" />);
    expect(c5.firstChild).toBeNull();
  });
});
