import type React from "react";
import { MoreHorizontal } from "lucide-react";
import type { ConversationRow, DbStats, MessageRow } from "../db";
import { formatDate, formatTimestamp } from "../utils";

type ConversationViewerPanelProps = {
  stats: DbStats | null;
  selectedConversation: ConversationRow | null;
  messages: MessageRow[];
  messagesLoading: boolean;

  openedConversationFromSearch: boolean;
  onBackToSearch: () => void;

  viewerMenuOpen: boolean;
  onToggleViewerMenu: () => void;
  onCloseViewerMenu: () => void;
  viewerMenuRef: React.RefObject<HTMLDivElement | null>;

  viewerSearchOpen: boolean;
  onOpenViewerSearch: () => void;
  messageSearchQuery: string;
  onMessageSearchQueryChange: (query: string) => void;
  viewerSearchInputRef: React.RefObject<HTMLInputElement | null>;
  matchCount: number;
  messageMatchCount: number;
  currentMatchIndex: number;
  onPrevMatch: () => void;
  onNextMatch: () => void;

  copyToast: string | null;
  onCopyConversation: () => void;
  onCopyMessage: (message: MessageRow) => void;

  messageRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  highlightedMessageId: string | null;
  highlightText: (text: string, query: string) => React.ReactNode;
  sourceLabel: (src: string) => string;
};

export default function ConversationViewerPanel({
  stats,
  selectedConversation,
  messages,
  messagesLoading,
  openedConversationFromSearch,
  onBackToSearch,
  viewerMenuOpen,
  onToggleViewerMenu,
  onCloseViewerMenu,
  viewerMenuRef,
  viewerSearchOpen,
  onOpenViewerSearch,
  messageSearchQuery,
  onMessageSearchQueryChange,
  viewerSearchInputRef,
  matchCount,
  messageMatchCount,
  currentMatchIndex,
  onPrevMatch,
  onNextMatch,
  copyToast,
  onCopyConversation,
  onCopyMessage,
  messageRefs,
  highlightedMessageId,
  highlightText,
  sourceLabel,
}: ConversationViewerPanelProps) {
  return (
    <main
      id="main-content"
      className={`viewer${viewerSearchOpen && messageSearchQuery.trim() ? " viewer-has-search" : ""}`}
    >
      {!selectedConversation ? (
        <div className="viewer-empty">
          <p className="viewer-empty-text" aria-live="polite">
            {stats && stats.conversationCount > 0
              ? "Select a conversation to view messages."
              : "Import conversations to get started."}
          </p>
          {stats && stats.conversationCount > 0 && (
            <p className="viewer-empty-stats">
              {stats.conversationCount} conversations{" \u00B7 "}
              {stats.messageCount} messages{" \u00B7 "}
              Last: {formatTimestamp(stats.latestMessageTimestamp)}
            </p>
          )}
        </div>
      ) : messagesLoading ? (
        <div className="viewer-empty">
          <p className="viewer-empty-text">Loading messages...</p>
        </div>
      ) : (
        <>
          <div className="viewer-header">
            <div className="viewer-header-left">
              {openedConversationFromSearch && (
                <button
                  type="button"
                  className="viewer-back-to-search-btn"
                  onClick={onBackToSearch}
                  title="Back to search (Backspace)"
                  aria-label="Back to search"
                >
                  ←
                </button>
              )}
              <div>
                <h2>{selectedConversation.title || "Untitled"}</h2>
                <p className="viewer-header-meta">
                  <span className="source-tag">{sourceLabel(selectedConversation.source)}</span>
                  <span>
                    {viewerSearchOpen && messageSearchQuery.trim()
                      ? `${matchCount} occurrence${matchCount !== 1 ? "s" : ""} in ${messageMatchCount} message${
                          messageMatchCount !== 1 ? "s" : ""
                        }`
                      : `${messages.length} messages`}
                  </span>
                  <span>{formatDate(selectedConversation.last_message_at)}</span>
                </p>
              </div>
            </div>
            <div className="viewer-header-actions">
              <div className="viewer-header-menu-wrap" ref={viewerMenuRef}>
                <button
                  type="button"
                  className="viewer-menu-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleViewerMenu();
                  }}
                  title="Options"
                  aria-label="Options"
                  aria-expanded={viewerMenuOpen}
                  aria-haspopup="true"
                >
                  <MoreHorizontal size={20} />
                </button>
                {viewerMenuOpen && (
                  <div className="viewer-header-menu">
                    <button
                      type="button"
                      className="viewer-header-menu-item"
                      onClick={() => {
                        onCopyConversation();
                        onCloseViewerMenu();
                      }}
                    >
                      Copy conversation
                    </button>
                  </div>
                )}
              </div>
              {viewerSearchOpen ? (
                <div className="viewer-search">
                  <input
                    ref={viewerSearchInputRef}
                    type="search"
                    className="viewer-search-input"
                    placeholder="Search in conversation..."
                    value={messageSearchQuery}
                    onChange={(e) => onMessageSearchQueryChange(e.target.value)}
                  />
                  {messageSearchQuery.trim() && matchCount > 0 && (
                    <div className="viewer-search-nav">
                      <span className="viewer-search-count">
                        {currentMatchIndex + 1} of {matchCount}
                      </span>
                      <button
                        type="button"
                        className="viewer-search-nav-btn"
                        onClick={onPrevMatch}
                        title="Previous match"
                        aria-label="Previous match"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="viewer-search-nav-btn"
                        onClick={onNextMatch}
                        title="Next match"
                        aria-label="Next match"
                      >
                        ↓
                      </button>
                    </div>
                  )}
                  {messageSearchQuery.trim() && matchCount === 0 && (
                    <span className="viewer-search-no-results">No results</span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="viewer-search-icon-btn"
                  onClick={onOpenViewerSearch}
                  title="Search in conversation (⌘F)"
                  aria-label="Search in conversation"
                >
                  <span className="viewer-search-icon" aria-hidden="true">
                    ⌕
                  </span>
                </button>
              )}
            </div>
          </div>
          {copyToast && (
            <div className="copy-toast" role="status" aria-live="polite">
              {copyToast}
            </div>
          )}
          <div className="msg-list">
            {messages.map((m) => (
              <article
                key={m.id}
                ref={(el) => {
                  messageRefs.current[m.id] = el;
                }}
                className={`msg ${m.sender === "human" ? "human" : "assistant"}${
                  highlightedMessageId === m.id ? " highlighted" : ""
                }`}
              >
                <div className="msg-top">
                  <span className="sender-pill">
                    {m.sender === "human" ? "You" : sourceLabel(selectedConversation.source)}
                  </span>
                  <span className="msg-top-right">
                    <time>{formatTimestamp(m.created_at)}</time>
                    <button
                      type="button"
                      className="msg-copy-btn"
                      onClick={() => onCopyMessage(m)}
                      title="Copy message"
                      aria-label="Copy message"
                    >
                      Copy
                    </button>
                  </span>
                </div>
                <div className="msg-body">{highlightText(m.content, viewerSearchOpen ? messageSearchQuery : "")}</div>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
