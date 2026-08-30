import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { sourceLabel, SourceIcon } from "./sourceDisplay";

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
});
