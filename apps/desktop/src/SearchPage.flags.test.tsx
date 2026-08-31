import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SearchPage from "./SearchPage";
import * as flags from "./lib/flags";

vi.mock("./db", () => ({
  getAllConversationsForSearch: vi.fn(async () => ({ rows: [], totalMatches: 0 })),
  searchMessages: vi.fn(async () => ({ rows: [], totalMatches: 0, totalOccurrences: 0 })),
}));

describe("SearchPage flags gating", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    } as unknown as Storage);
    flags.resetFlags();
    vi.restoreAllMocks();
  });

  it("hides Hybrid toggle when semanticSearch disabled", () => {
    vi.spyOn(flags, "isEnabled").mockImplementation((name) => name !== "semanticSearch");
    render(
      <SearchPage
        query=""
        onQueryChange={vi.fn()}
        availableSources={["claude"]}
        sourceLabel={(s) => s}
        snapshot={{
          source: "",
          dateFrom: "",
          dateTo: "",
          sort: "last_occurrence_desc",
          results: [],
          totalMatches: 0,
          totalOccurrences: 0,
          latencyMs: null,
        }}
        onSnapshotChange={vi.fn()}
      />
    );
    expect(screen.queryByText("Hybrid")).not.toBeInTheDocument();
    expect(screen.queryByText("Keyword")).not.toBeInTheDocument();
  });

  it("shows Hybrid toggle when semanticSearch enabled and switches mode", () => {
    vi.spyOn(flags, "isEnabled").mockImplementation(() => true);
    render(
      <SearchPage
        query="hello world"
        onQueryChange={vi.fn()}
        availableSources={["claude"]}
        sourceLabel={(s) => s}
        snapshot={{
          source: "",
          dateFrom: "",
          dateTo: "",
          sort: "last_occurrence_desc",
          results: [],
          totalMatches: 0,
          totalOccurrences: 0,
          latencyMs: null,
        }}
        onSnapshotChange={vi.fn()}
      />
    );
    expect(screen.getByText("Hybrid")).toBeInTheDocument();
    expect(screen.getByText("Keyword")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Hybrid"));
    expect(screen.getByText("Hybrid").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByText("Keyword"));
    expect(screen.getByText("Keyword").getAttribute("aria-pressed")).toBe("true");
  });

  it("passes hybrid mode to search when enabled", async () => {
    vi.spyOn(flags, "isEnabled").mockImplementation(() => true);
    const { searchMessages } = await import("./db");
    const mockSearch = vi.mocked(searchMessages);
    mockSearch.mockClear();
    render(
      <SearchPage
        query="hello world test"
        onQueryChange={vi.fn()}
        availableSources={["claude"]}
        sourceLabel={(s) => s}
        snapshot={{
          source: "",
          dateFrom: "",
          dateTo: "",
          sort: "last_occurrence_desc",
          results: [],
          totalMatches: 0,
          totalOccurrences: 0,
          latencyMs: null,
        }}
        onSnapshotChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("Hybrid"));
    // Wait for debounce 250ms + search
    await new Promise((r) => setTimeout(r, 400));
    // searchMessages should have been called with mode hybrid
    expect(mockSearch).toHaveBeenCalled();
    const lastCall = mockSearch.mock.calls[mockSearch.mock.calls.length - 1];
    expect(lastCall?.[1]).toMatchObject({ mode: "hybrid" });
  });
});
