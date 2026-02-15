import { useRef, useState, useEffect } from "react";
import type { MessageRow } from "./db";
import { formatTimestamp } from "./utils";
import { IMPORT_SOURCES } from "./importer";
import { MoreHorizontal, X } from "lucide-react";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [menuOpen]);

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
          <div className="viewer-header-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="viewer-menu-trigger"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((open) => !open);
              }}
              title="Options"
              aria-label="Options"
              aria-expanded={menuOpen}
              aria-haspopup="true"
            >
              <MoreHorizontal size={20} />
            </button>
            {menuOpen && (
              <div className="viewer-header-menu">
                <button
                  type="button"
                  className="viewer-header-menu-item"
                  onClick={() => {
                    onCopyThread();
                    setMenuOpen(false);
                  }}
                >
                  Copy Thread
                </button>
              </div>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              className="viewer-close-panel-btn"
              onClick={onClose}
              title="Close panel"
              aria-label="Close panel"
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
