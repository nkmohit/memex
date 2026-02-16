import type React from "react";
import { formatDate } from "../utils";
import type { ConversationRow, SourceStats } from "../db";

type ConversationListPanelProps = {
  conversations: ConversationRow[];
  loading: boolean;
  selectedConvId: string | null;
  activeSource: string | null;
  availableSources: string[];
  sourceStats: SourceStats[];
  convItemRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  onSelectSource: (source: string | null) => void;
  onSelectConversation: (convId: string) => void;
  sourceLabel: (source: string) => string;
};

function sourceConvCount(sourceStats: SourceStats[], source: string): number {
  return sourceStats.find((s) => s.source === source)?.conversationCount ?? 0;
}

export default function ConversationListPanel({
  conversations,
  loading,
  selectedConvId,
  activeSource,
  availableSources,
  sourceStats,
  convItemRefs,
  onSelectSource,
  onSelectConversation,
  sourceLabel,
}: ConversationListPanelProps) {
  return (
    <aside className="conv-panel">
      <div className="conv-panel-header">
        <div className="conv-header-top">
          <h1>Conversations</h1>
          <span className="conv-count">{conversations.length}</span>
        </div>
        <select
          value={activeSource ?? ""}
          onChange={(e) => onSelectSource(e.target.value || null)}
          aria-label="Filter by source"
          className="conv-source-select"
        >
          <option value="">All sources</option>
          {availableSources.map((src) => (
            <option key={src} value={src}>
              {sourceLabel(src)} ({sourceConvCount(sourceStats, src)})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="conv-list conv-list-skeleton" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="conv-item skeleton">
              <div className="conv-title-skeleton" />
              <div className="conv-meta-skeleton" />
            </div>
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <div className="empty-text" aria-live="polite">
          No conversations yet. Import to get started.
        </div>
      ) : (
        <div className="conv-list">
          {conversations.map((c) => (
            <button
              key={c.id}
              ref={(element) => {
                convItemRefs.current[c.id] = element;
              }}
              className={`conv-item ${selectedConvId === c.id ? "selected" : ""}`}
              onClick={() => onSelectConversation(c.id)}
            >
              <span className="conv-title">{c.title || "Untitled"}</span>
              <span className="conv-meta">
                <span className="source-tag">{sourceLabel(c.source)}</span>
                <span>{c.message_count} msgs</span>
                <span>{formatDate(c.last_message_at)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
