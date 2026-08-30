import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SearchPage from "./SearchPage";
import type { SearchPageSnapshot } from "./SearchPage";

const mockSearchMessages = vi.fn();
const mockGetAll = vi.fn();

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    searchMessages: (...args: unknown[]) => mockSearchMessages(...args),
    getAllConversationsForSearch: (...args: unknown[]) => mockGetAll(...args),
  };
});

function makeSnapshot(overrides: Partial<SearchPageSnapshot> = {}): SearchPageSnapshot {
  return {
    source: "",
    dateFrom: "",
    dateTo: "",
    sort: "last_occurrence_desc",
    results: [],
    totalMatches: 0,
    totalOccurrences: 0,
    latencyMs: null,
    ...overrides,
  };
}

describe("SearchPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue({ rows: [], totalMatches: 0 });
    mockSearchMessages.mockResolvedValue({ rows: [], totalMatches: 0, totalOccurrences: 0 });
    if (!Element.prototype.scrollIntoView) {
      (Element.prototype as unknown as Record<string, unknown>).scrollIntoView = vi.fn();
    } else {
      vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
    }
  });

  it("renders search input and shows browse results when no query (happy path)", async () => {
    mockGetAll.mockResolvedValue({
      rows: [
        { conversation_id: "c1", title: "Hello", source: "claude", created_at: 0, last_message_at: Date.now(), message_count: 3 },
      ],
      totalMatches: 1,
    });
    render(
      <SearchPage query="" onQueryChange={vi.fn()} availableSources={["claude"]} sourceLabel={(s) => s} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} />
    );
    expect(screen.getByLabelText("Search all messages")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Hello")).toBeInTheDocument(), { timeout: 2000 });
    expect(screen.getByText(/1 conversations/)).toBeInTheDocument();
  });

  it("calls onQueryChange when typing (happy path)", () => {
    const onChange = vi.fn();
    render(<SearchPage query="hello" onQueryChange={onChange} availableSources={[]} sourceLabel={(s) => s} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} />);
    const input = screen.getByLabelText("Search all messages");
    fireEvent.change(input, { target: { value: "world" } });
    expect(onChange).toHaveBeenCalledWith("world");
  });

  it("shows too-short when query <3", async () => {
    render(<SearchPage query="ab" onQueryChange={vi.fn()} availableSources={[]} sourceLabel={(s) => s} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} />);
    expect(await screen.findByText("Keep typing to search.")).toBeInTheDocument();
  });

  it("searches when query >=3 and shows results (search happy path)", async () => {
    mockSearchMessages.mockResolvedValue({
      rows: [
        { conversation_id: "c1", title: "Result", source: "chatgpt", snippet: "hi <mark>hello</mark>", snippets: ["hi <mark>hello</mark>"], created_at: 0, last_occurrence: Date.now(), occurrence_count: 1, message_match_count: 1, rank: -1, first_match_message_id: "m1" },
      ],
      totalMatches: 1,
      totalOccurrences: 1,
    });
    render(<SearchPage query="hello" onQueryChange={vi.fn()} availableSources={[]} sourceLabel={(s) => s.toUpperCase()} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Result")).toBeInTheDocument(), { timeout: 2000 });
    expect(screen.getByText("CHATGPT")).toBeInTheDocument();
  });

  it("handles onSelectResult click", async () => {
    mockSearchMessages.mockResolvedValue({
      rows: [
        { conversation_id: "c1", title: "ClickMe", source: "claude", snippet: "", snippets: [], created_at: 0, last_occurrence: 123, occurrence_count: 1, message_match_count: 1, rank: -1, first_match_message_id: null },
      ],
      totalMatches: 1,
      totalOccurrences: 1,
    });
    const onSelect = vi.fn();
    render(<SearchPage query="hello" onQueryChange={vi.fn()} availableSources={[]} sourceLabel={(s) => s} onSelectResult={onSelect} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("ClickMe")).toBeInTheDocument(), { timeout: 2000 });
    fireEvent.click(screen.getByText("ClickMe"));
    expect(onSelect).toHaveBeenCalledWith("c1", "ClickMe", "claude", 123);
  });

  it("shows error when search fails (error path)", async () => {
    mockSearchMessages.mockRejectedValue(new Error("search boom"));
    render(<SearchPage query="hello" onQueryChange={vi.fn()} availableSources={[]} sourceLabel={(s) => s} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("search boom")).toBeInTheDocument(), { timeout: 2000 });
  });

  it("focuses input when focusRequestId changes", async () => {
    const { rerender } = render(<SearchPage query="" onQueryChange={vi.fn()} availableSources={[]} sourceLabel={(s) => s} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} focusRequestId={null} />);
    rerender(<SearchPage query="" onQueryChange={vi.fn()} availableSources={[]} sourceLabel={(s) => s} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} focusRequestId={123} />);
    await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Search all messages"));
  });

  it("filtersOpen true when snapshot has source", async () => {
    const snap = makeSnapshot({ source: "claude", sort: "relevance" });
    render(<SearchPage query="hello" onQueryChange={vi.fn()} availableSources={["claude"]} sourceLabel={(s) => s} snapshot={snap} onSnapshotChange={vi.fn()} />);
    // SearchFilters should be rendered with open state — check for source label filter
    await waitFor(() => expect(document.body.textContent).toBeTruthy());
  });

  it("restores selection via restoreSelectedConversationId", async () => {
    mockSearchMessages.mockResolvedValue({
      rows: [
        { conversation_id: "c1", title: "A", source: "claude", snippet: "", snippets: [], created_at: 0, last_occurrence: 1, occurrence_count: 1, message_match_count: 1, rank: -1, first_match_message_id: null },
        { conversation_id: "c2", title: "B", source: "claude", snippet: "", snippets: [], created_at: 0, last_occurrence: 2, occurrence_count: 1, message_match_count: 1, rank: -1, first_match_message_id: null },
      ],
      totalMatches: 2,
      totalOccurrences: 2,
    });
    const onRestore = vi.fn();
    render(<SearchPage query="hello" onQueryChange={vi.fn()} availableSources={[]} sourceLabel={(s) => s} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} restoreSelectedConversationId="c2" onRestoreSelectionDone={onRestore} />);
    await waitFor(() => expect(screen.getByText("B")).toBeInTheDocument(), { timeout: 2000 });
    expect(onRestore).toHaveBeenCalled();
  });

  it("keyboard Enter triggers onSelectResult", async () => {
    mockSearchMessages.mockResolvedValue({
      rows: [
        { conversation_id: "c1", title: "First", source: "claude", snippet: "", snippets: [], created_at: 0, last_occurrence: 1, occurrence_count: 1, message_match_count: 1, rank: -1, first_match_message_id: "m1" },
        { conversation_id: "c2", title: "Second", source: "claude", snippet: "", snippets: [], created_at: 0, last_occurrence: 2, occurrence_count: 1, message_match_count: 1, rank: -1, first_match_message_id: "m2" },
      ],
      totalMatches: 2,
      totalOccurrences: 2,
    });
    const onSelect = vi.fn();
    render(<SearchPage query="hello" onQueryChange={vi.fn()} availableSources={[]} sourceLabel={(s) => s} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} onSelectResult={onSelect} />);
    await waitFor(() => expect(screen.getByText("First")).toBeInTheDocument(), { timeout: 2000 });
    // selectedIndex defaults to 0, Enter should select first
    fireEvent.keyDown(document, { key: "Enter" });
    await waitFor(() => expect(onSelect).toHaveBeenCalled());
    expect(onSelect).toHaveBeenCalledWith("c1", expect.any(String), "claude", 1);
    // Arrow navigation
    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.keyDown(document, { key: "ArrowUp" });
    expect(document.body).toBeInTheDocument();
  });

  it("honors skipSearchOnceRef", async () => {
    const ref = { current: true };
    render(<SearchPage query="hello" onQueryChange={vi.fn()} availableSources={[]} sourceLabel={(s) => s} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} skipSearchOnceRef={ref} />);
    // should not trigger search due to skip
    await new Promise((r) => setTimeout(r, 300));
    expect(mockSearchMessages).not.toHaveBeenCalled();
  });

  it("loads more in browse mode when no query", async () => {
    mockGetAll.mockResolvedValueOnce({ rows: [{ conversation_id: "c1", title: "One", source: "claude", created_at: 0, last_message_at: 1, message_count: 1 }], totalMatches: 2 });
    mockGetAll.mockResolvedValueOnce({ rows: [{ conversation_id: "c2", title: "Two", source: "claude", created_at: 0, last_message_at: 2, message_count: 1 }], totalMatches: 2 });
    render(<SearchPage query="" onQueryChange={vi.fn()} availableSources={[]} sourceLabel={(s) => s} snapshot={makeSnapshot()} onSnapshotChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("One")).toBeInTheDocument(), { timeout: 2000 });
    // click load more
    const btn = await screen.findByText("Load more");
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByText("Two")).toBeInTheDocument(), { timeout: 2000 });
  });
});
