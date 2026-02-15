import { useEffect, useState } from "react";
import {
  ClaudeIcon,
  ChatGPTIcon,
  GeminiIcon,
  GrokIcon,
} from "./icons";
import { getActivityCountByDay, getConversations, getSourceStats, getStats } from "./db";
import type { ConversationRow, DbStats, SourceStats } from "./db";
import { formatDate, formatTimestamp } from "./utils";
import { IMPORT_SOURCES } from "./importer";

function SourceIcon({ source }: { source: string }) {
  switch (source.toLowerCase()) {
    case "claude":
      return <ClaudeIcon size={16} />;
    case "chatgpt":
      return <ChatGPTIcon size={16} />;
    case "gemini":
      return <GeminiIcon size={16} />;
    case "grok":
      return <GrokIcon size={16} />;
    default:
      return null;
  }
}

function sourceLabel(source: string): string {
  const meta = IMPORT_SOURCES.find((s) => s.id === source);
  return meta?.label ?? source.charAt(0).toUpperCase() + source.slice(1);
}

interface OverviewPageProps {
  onOpenImport: () => void;
  onSelectConversation: (convId: string) => void;
}

export default function OverviewPage({
  onOpenImport,
  onSelectConversation,
}: OverviewPageProps) {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([]);
  const [recent, setRecent] = useState<ConversationRow[]>([]);
  const [activityByDay, setActivityByDay] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [s, ss, convs, activity] = await Promise.all([
          getStats(),
          getSourceStats(),
          getConversations(10),
          getActivityCountByDay(30),
        ]);
        if (!cancelled) {
          setStats(s);
          setSourceStats(ss);
          setRecent(convs);
          setActivityByDay(activity);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="overview-main">
        <h1 className="overview-title">Overview</h1>
        <p className="empty-text">Loading...</p>
      </main>
    );
  }

  const totalConvs = stats?.conversationCount ?? 0;
  const totalMsgs = stats?.messageCount ?? 0;
  const lastImport = stats?.latestMessageTimestamp
    ? formatTimestamp(stats.latestMessageTimestamp)
    : "—";

  const isEmpty = totalConvs === 0 && totalMsgs === 0;

  return (
    <main className="overview-main">
      <h1 className="overview-title">Overview</h1>

      {isEmpty && (
        <div className="overview-empty-state">
          <p className="overview-empty-text">No data yet. Import conversations to get started.</p>
          <button type="button" className="overview-cta overview-empty-cta" onClick={onOpenImport}>
            Import
          </button>
        </div>
      )}

      <div className="overview-metrics">
        <div className="overview-card">
          <div className="overview-card-label">Total Conversations</div>
          <div className="overview-card-value">{totalConvs}</div>
        </div>
        <div className="overview-card">
          <div className="overview-card-label">Total Messages</div>
          <div className="overview-card-value">{totalMsgs.toLocaleString()}</div>
        </div>
        <div className="overview-card">
          <div className="overview-card-label">Last Import</div>
          <div className="overview-card-value">{lastImport}</div>
        </div>
        <div className="overview-card">
          <div className="overview-card-label">Token count</div>
          <div className="overview-card-value" style={{ fontSize: "14px", color: "var(--color-muted-foreground)" }}>
            Coming soon
          </div>
        </div>
      </div>

      <div className="overview-section-title" style={{ marginTop: "8px" }}>
        30-day activity
      </div>
      <div className="overview-heatmap" style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(30, 1fr)",
            gap: "4px",
            maxWidth: "400px",
          }}
        >
          {Array.from({ length: 30 }).map((_, i) => {
            const count = activityByDay[i] ?? 0;
            const max = Math.max(1, ...activityByDay);
            const opacity = max > 0 ? 0.3 + 0.5 * (count / max) : 0.3;
            return (
              <div
                key={i}
                style={{
                  height: "16px",
                  borderRadius: "4px",
                  background: "var(--color-muted)",
                  opacity,
                }}
                title={`Day ${30 - i}${count > 0 ? `: ${count} message${count !== 1 ? "s" : ""}` : ""}`}
              />
            );
          })}
        </div>
        <p style={{ fontSize: "12px", color: "var(--color-muted-foreground)", marginTop: "6px" }}>
          Message activity per day (last 30 days)
        </p>
      </div>

      <div className="overview-section-title">Recent conversations</div>
      <div className="overview-recent-list" style={{ marginBottom: "24px" }}>
        {recent.length === 0 ? (
          <p className="empty-text">No conversations yet. Import to get started.</p>
        ) : (
          recent.map((c) => (
            <button
              key={c.id}
              type="button"
              className="overview-recent-item"
              onClick={() => onSelectConversation(c.id)}
            >
              <SourceIcon source={c.source} />
              <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.title || "Untitled"}
              </span>
              <span style={{ fontSize: "12px", color: "var(--color-muted-foreground)" }}>
                {formatDate(c.last_message_at)}
              </span>
            </button>
          ))
        )}
      </div>

      <div className="overview-section-title">Source breakdown</div>
      <div style={{ marginBottom: "24px", display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
        {sourceStats.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--color-muted-foreground)" }}>No data yet.</p>
        ) : (
          sourceStats.map((s) => (
            <div
              key={s.source}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                background: "var(--color-muted)",
                borderRadius: "8px",
              }}
            >
              <SourceIcon source={s.source} />
              <span>{sourceLabel(s.source)}</span>
              <span style={{ fontWeight: 600 }}>{s.conversationCount}</span>
            </div>
          ))
        )}
      </div>

      <div className="overview-section-title">Insights & tips</div>
      <p style={{ fontSize: "13px", color: "var(--color-muted-foreground)", marginBottom: "24px" }}>
        Placeholder for future AI-powered insights.
      </p>

      <div className="overview-section-title">Frequent topics</div>
      <p style={{ fontSize: "13px", color: "var(--color-muted-foreground)", marginBottom: "24px" }}>
        Coming soon
      </p>

      <div className="overview-section-title">Data status</div>
      <p style={{ fontSize: "13px", color: "var(--color-muted-foreground)", marginBottom: "12px" }}>
        All data is stored locally. Last sync: {lastImport}
      </p>
      <button type="button" className="overview-cta" onClick={onOpenImport}>
        Import New Data
      </button>
    </main>
  );
}
