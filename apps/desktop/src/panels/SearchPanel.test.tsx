import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SearchPanel from "./SearchPanel";
import type { SearchPageSnapshot } from "../SearchPage";

// Mock SearchPage to avoid real DB + complex logic
vi.mock("../SearchPage", () => ({
  default: ({
    query,
    onQueryChange,
  }: {
    query: string;
    onQueryChange: (q: string) => void;
  }) => (
    <div data-testid="search-page">
      <input
        aria-label="mock-query"
        value={query}
        onChange={(e) => onQueryChange((e.target as HTMLInputElement).value)}
      />
    </div>
  ),
}));

function makeSnapshot(): SearchPageSnapshot {
  return {
    source: "",
    dateFrom: "",
    dateTo: "",
    sort: "last_occurrence_desc",
    results: [],
    totalMatches: 0,
    totalOccurrences: 0,
    latencyMs: null,
  };
}

function makeViewer(overrides: Partial<React.ComponentProps<typeof SearchPanel>["viewer"]> = {}) {
  return {
    open: false,
    onClose: vi.fn(),
    selectedConversation: null,
    messages: [],
    messagesLoading: false,
    viewerSearchOpen: false,
    onOpenViewerSearch: vi.fn(),
    onCloseViewerSearch: vi.fn(),
    messageSearchQuery: "",
    onMessageSearchQueryChange: vi.fn(),
    viewerSearchInputRef: { current: null } as React.RefObject<HTMLInputElement | null>,
    matchCount: 0,
    messageMatchCount: 0,
    currentMatchIndex: 0,
    onPrevMatch: vi.fn(),
    onNextMatch: vi.fn(),
    copyToast: null,
    onCopyMessage: vi.fn(),
    messageRefs: { current: {} },
    highlightedMessageId: null,
    highlightText: (t: string) => t,
    ...overrides,
  };
}

describe("SearchPanel", () => {
  it("renders SearchPage and handles query change (happy path)", () => {
    const onQueryChange = vi.fn();
    const onSelectResult = vi.fn();
    render(
      <SearchPanel
        query="hello"
        onQueryChange={onQueryChange}
        availableSources={["claude", "chatgpt"]}
        sourceLabel={(s) => s}
        onSelectResult={onSelectResult}
        selectedConversationId={null}
        focusRequestId={null}
        snapshot={makeSnapshot()}
        onSnapshotChange={vi.fn()}
        skipSearchOnceRef={{ current: false }}
        restoreSelectedConversationId={null}
        onRestoreSelectionDone={vi.fn()}
        viewer={makeViewer()}
      />
    );
    expect(screen.getByTestId("search-page")).toBeInTheDocument();
    const input = screen.getByLabelText("mock-query");
    expect(input).toHaveValue("hello");
    fireEvent.change(input, { target: { value: "world" } });
    expect(onQueryChange).toHaveBeenCalledWith("world");
  });

  it("renders viewer when open with selected conversation", () => {
    const viewer = makeViewer({
      open: true,
      selectedConversation: {
        id: "c1",
        source: "claude",
        title: "Test",
        created_at: Date.now(),
        last_message_at: Date.now(),
        message_count: 2,
      },
      messages: [
        { id: "m1", sender: "human", content: "hello", created_at: Date.now() },
        { id: "m2", sender: "assistant", content: "world", created_at: Date.now() },
      ],
    });
    render(
      <SearchPanel
        query="hello"
        onQueryChange={vi.fn()}
        availableSources={[]}
        sourceLabel={(s) => s}
        onSelectResult={vi.fn()}
        selectedConversationId="c1"
        focusRequestId={null}
        snapshot={makeSnapshot()}
        onSnapshotChange={vi.fn()}
        skipSearchOnceRef={{ current: false }}
        restoreSelectedConversationId={null}
        onRestoreSelectionDone={vi.fn()}
        viewer={viewer}
      />
    );
    expect(screen.getByText("Test")).toBeInTheDocument();
    expect(screen.getByText("2 messages")).toBeInTheDocument();
  });

  it("shows empty viewer when no conversation selected (error/empty path)", () => {
    const viewer = makeViewer({ open: true, selectedConversation: null });
    render(
      <SearchPanel
        query=""
        onQueryChange={vi.fn()}
        availableSources={[]}
        sourceLabel={(s) => s}
        onSelectResult={vi.fn()}
        selectedConversationId={null}
        focusRequestId={null}
        snapshot={makeSnapshot()}
        onSnapshotChange={vi.fn()}
        skipSearchOnceRef={{ current: false }}
        restoreSelectedConversationId={null}
        onRestoreSelectionDone={vi.fn()}
        viewer={viewer}
      />
    );
    expect(screen.getByText("Select a conversation to view messages.")).toBeInTheDocument();
  });
});
