import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SearchResultsList from "./SearchResultsList";
import type { SearchResultRow } from "./db";

function makeRow(overrides: Partial<SearchResultRow> = {}): SearchResultRow {
  return {
    conversation_id: "c1",
    title: "Test Title",
    source: "claude",
    snippet: "hello <mark>world</mark>",
    snippets: ["hello <mark>world</mark>"],
    created_at: Date.now(),
    last_occurrence: Date.now(),
    occurrence_count: 2,
    message_match_count: 1,
    rank: -0.5,
    first_match_message_id: "m1",
    ...overrides,
  };
}

describe("SearchResultsList", () => {
  it("renders results and calls onSelectRow (happy path)", () => {
    const onSelect = vi.fn();
    render(
      <SearchResultsList
        results={[makeRow()]}
        hasQuery={true}
        selectedIndex={0}
        onSelectRow={onSelect}
        onHoverRow={vi.fn()}
        resultRefs={{ current: [] }}
        sourceLabel={(s) => s.toUpperCase()}
        loading={false}
        loadingMore={false}
        totalMatches={1}
        onLoadMore={vi.fn()}
      />
    );
    expect(screen.getByText("Test Title")).toBeInTheDocument();
    expect(screen.getByText("CLAUDE")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Test Title"));
    expect(onSelect).toHaveBeenCalled();
  });

  it("shows too-short state when queryTooShort", () => {
    render(
      <SearchResultsList
        results={[]}
        hasQuery={true}
        queryTooShort={true}
        minQueryLength={3}
        selectedIndex={-1}
        onSelectRow={vi.fn()}
        onHoverRow={vi.fn()}
        resultRefs={{ current: [] }}
        sourceLabel={(s) => s}
        loading={false}
        loadingMore={false}
        totalMatches={0}
        onLoadMore={vi.fn()}
      />
    );
    expect(screen.getByText("Keep typing to search.")).toBeInTheDocument();
  });

  it("shows empty state when no results", () => {
    render(
      <SearchResultsList
        results={[]}
        hasQuery={true}
        selectedIndex={-1}
        onSelectRow={vi.fn()}
        onHoverRow={vi.fn()}
        resultRefs={{ current: [] }}
        sourceLabel={(s) => s}
        loading={false}
        loadingMore={false}
        totalMatches={0}
        onLoadMore={vi.fn()}
      />
    );
    expect(screen.getByText("No search results for this query/filter.")).toBeInTheDocument();
  });

  it("renders load more when more matches", () => {
    const onLoadMore = vi.fn();
    render(
      <SearchResultsList
        results={[makeRow(), makeRow({ conversation_id: "c2" })]}
        hasQuery={true}
        selectedIndex={-1}
        onSelectRow={vi.fn()}
        onHoverRow={vi.fn()}
        resultRefs={{ current: [] }}
        sourceLabel={(s) => s}
        loading={false}
        loadingMore={false}
        totalMatches={5}
        onLoadMore={onLoadMore}
      />
    );
    fireEvent.click(screen.getByText("Load more"));
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("highlights snippet with mark tags", () => {
    render(
      <SearchResultsList
        results={[makeRow({ snippet: "a <mark>b</mark> c", snippets: ["a <mark>b</mark> c"] })]}
        hasQuery={true}
        selectedIndex={-1}
        onSelectRow={vi.fn()}
        onHoverRow={vi.fn()}
        resultRefs={{ current: [] }}
        sourceLabel={(s) => s}
        loading={false}
        loadingMore={false}
        totalMatches={1}
        onLoadMore={vi.fn()}
      />
    );
    expect(screen.getByText("b").tagName).toBe("MARK");
  });

  it("virtualizes large result sets (>50) with contentVisibility:auto", () => {
    const rows = Array.from({ length: 100 }, (_, i) =>
      makeRow({ conversation_id: `c${i}`, title: `Title ${i}` })
    );
    const { container } = render(
      <SearchResultsList
        results={rows}
        hasQuery={true}
        selectedIndex={-1}
        onSelectRow={vi.fn()}
        onHoverRow={vi.fn()}
        resultRefs={{ current: [] }}
        sourceLabel={(s) => s}
        loading={false}
        loadingMore={false}
        totalMatches={100}
        onLoadMore={vi.fn()}
      />
    );
    const items = container.querySelectorAll("li");
    expect(items.length).toBe(100);
    // each <li> should have contentVisibility:auto + containIntrinsicSize when >50 results
    for (const li of Array.from(items)) {
      const el = li as HTMLElement;
      expect(el.style.contentVisibility).toBe("auto");
      expect(el.style.containIntrinsicSize).toBe("0 120px");
    }
    // spot check a few titles still render correctly
    expect(screen.getByText("Title 0")).toBeInTheDocument();
    expect(screen.getByText("Title 99")).toBeInTheDocument();
  });

  it("does not virtualize small result sets (<=50)", () => {
    const rows = Array.from({ length: 3 }, (_, i) =>
      makeRow({ conversation_id: `s${i}`, title: `Small ${i}` })
    );
    const { container } = render(
      <SearchResultsList
        results={rows}
        hasQuery={true}
        selectedIndex={-1}
        onSelectRow={vi.fn()}
        onHoverRow={vi.fn()}
        resultRefs={{ current: [] }}
        sourceLabel={(s) => s}
        loading={false}
        loadingMore={false}
        totalMatches={3}
        onLoadMore={vi.fn()}
      />
    );
    for (const li of Array.from(container.querySelectorAll("li"))) {
      expect((li as HTMLElement).style.contentVisibility).toBe("");
    }
  });
});
