import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ConversationViewerPanel from "./ConversationViewerPanel";

function makeProps(overrides: Partial<React.ComponentProps<typeof ConversationViewerPanel>> = {}) {
  return {
    stats: { conversationCount: 1, messageCount: 5, indexedMessageCount: 5, latestMessageTimestamp: Date.now(), estimatedInputTokens: 0, estimatedOutputTokens: 0, estimatedTotalTokens: 0 },
    selectedConversation: { id: "c1", source: "claude", title: "Hello", created_at: Date.now(), last_message_at: Date.now(), message_count: 2 },
    messages: [
      { id: "m1", sender: "human" as const, content: "hello world", created_at: Date.now() },
      { id: "m2", sender: "assistant" as const, content: "response", created_at: Date.now() },
    ],
    messagesLoading: false,
    openedConversationFromSearch: false,
    onBackToSearch: vi.fn(),
    viewerMenuOpen: false,
    onToggleViewerMenu: vi.fn(),
    onCloseViewerMenu: vi.fn(),
    viewerMenuRef: { current: null },
    viewerSearchOpen: false,
    onOpenViewerSearch: vi.fn(),
    onCloseViewerSearch: vi.fn(),
    messageSearchQuery: "",
    onMessageSearchQueryChange: vi.fn(),
    viewerSearchInputRef: { current: null },
    matchCount: 0,
    messageMatchCount: 0,
    currentMatchIndex: 0,
    onPrevMatch: vi.fn(),
    onNextMatch: vi.fn(),
    copyToast: null,
    onCopyConversation: vi.fn(),
    onCopyMessage: vi.fn(),
    messageRefs: { current: {} },
    highlightedMessageId: null,
    highlightText: (t: string) => t,
    sourceLabel: (s: string) => s.toUpperCase(),
    ...overrides,
  };
}

describe("ConversationViewerPanel", () => {
  it("renders empty state when no conversation", () => {
    render(<ConversationViewerPanel {...makeProps({ selectedConversation: null, stats: null })} />);
    expect(screen.getByText("Import conversations to get started.")).toBeInTheDocument();
  });

  it("renders loading when messagesLoading", () => {
    render(<ConversationViewerPanel {...makeProps({ messagesLoading: true })} />);
    expect(screen.getByText("Loading messages...")).toBeInTheDocument();
  });

  it("renders messages with source label and handles copy/menu (happy path)", () => {
    const onCopy = vi.fn();
    const onToggle = vi.fn();
    render(<ConversationViewerPanel {...makeProps({ onCopyMessage: onCopy, onToggleViewerMenu: onToggle })} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("hello world")).toBeInTheDocument();
    expect(screen.getAllByText("CLAUDE").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText("Options"));
    expect(onToggle).toHaveBeenCalled();
    fireEvent.click(screen.getAllByText("Copy")[0]!);
    expect(onCopy).toHaveBeenCalled();
  });

  it("shows search input when viewerSearchOpen", () => {
    render(<ConversationViewerPanel {...makeProps({ viewerSearchOpen: true, messageSearchQuery: "hello", matchCount: 2, messageMatchCount: 1, currentMatchIndex: 0 })} />);
    expect(screen.getByPlaceholderText("Search in conversation...")).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });

  it("shows back button when opened from search", () => {
    const onBack = vi.fn();
    render(<ConversationViewerPanel {...makeProps({ openedConversationFromSearch: true, onBackToSearch: onBack })} />);
    fireEvent.click(screen.getByLabelText("Back to search"));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows highlighted message class", () => {
    render(<ConversationViewerPanel {...makeProps({ highlightedMessageId: "m1" })} />);
    const articles = document.querySelectorAll("article.msg");
    expect(articles[0]?.classList.contains("highlighted")).toBe(true);
  });
});
