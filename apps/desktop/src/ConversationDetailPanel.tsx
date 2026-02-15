import type { MessageRow } from "./db";
import { formatTimestamp } from "./utils";
import { IMPORT_SOURCES } from "./importer";
import { X } from "lucide-react";

interface ConversationDetailPanelProps {
  title: string;
  source: string;
  messages: MessageRow[];
  loading: boolean;
  onCopyThread: () => void;
  onClose?: () => void;
}

function sourceLabel(source: string): string {
  const meta = IMPORT_SOURCES.find((s) => s.id === source);
  return meta?.label ?? source.charAt(0).toUpperCase() + source.slice(1);
}

export default function ConversationDetailPanel({
  title,
  source,
  messages,
  loading,
  onCopyThread,
  onClose,
}: ConversationDetailPanelProps) {
  return (
    <div className="search-detail-panel">
      <div className="viewer-header">
        <div>
          <h2>{title || "Untitled"}</h2>
          <p className="viewer-header-meta">
            <span className="source-tag">{sourceLabel(source)}</span>
            <span>{messages.length} messages</span>
          </p>
        </div>
        <div className="viewer-header-actions">
          <button
            type="button"
            className="viewer-copy-conv-btn"
            onClick={onCopyThread}
            title="Copy thread"
          >
            Copy Thread
          </button>
          {onClose && (
            <button
              type="button"
              className="viewer-close-panel-btn"
              onClick={onClose}
              title="Close conversation"
              aria-label="Close conversation"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <div className="viewer-empty">
          <p className="viewer-empty-text">Loading messages...</p>
        </div>
      ) : (
        <div className="msg-list">
          {messages.map((m) => (
            <article
              key={m.id}
              className={`msg ${m.sender === "human" ? "human" : "assistant"}`}
            >
              <div className="msg-top">
                <span className="sender-pill">
                  {m.sender === "human" ? "You" : sourceLabel(source)}
                </span>
                <time>{formatTimestamp(m.created_at)}</time>
              </div>
              <div className="msg-body">{m.content}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
