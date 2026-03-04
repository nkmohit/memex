import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Clock3,
  Database,
  FilePlus2,
  Flame,
  Sparkles,
} from "lucide-react";
import {
  getActivityCountByDay,
  getConversations,
  getSourceStats,
  getStats,
} from "./db";
import type { ConversationRow, DbStats, SourceStats } from "./db";
import { formatDate, formatTimestamp } from "./utils";
import { IMPORT_SOURCES } from "./importer";

function SourceIcon({ source }: { source: string }) {
  switch (source.toLowerCase()) {
    case "claude":
      return <span className="overview-source-dot source-claude" aria-hidden />;
    case "chatgpt":
      return <span className="overview-source-dot source-chatgpt" aria-hidden />;
    case "gemini":
      return <span className="overview-source-dot source-gemini" aria-hidden />;
    case "grok":
      return <span className="overview-source-dot source-grok" aria-hidden />;
    default:
      return <span className="overview-source-dot" aria-hidden />;
  }
}

function sourceLabel(source: string): string {
  const meta = IMPORT_SOURCES.find((s) => s.id === source);
  return meta?.label ?? source.charAt(0).toUpperCase() + source.slice(1);
}

interface OverviewPageProps {
  onOpenImport: () => void;
  onSelectConversation: (convId: string) => void;
  onRebuildIndex: () => void;
}

export default function OverviewPage({
  onOpenImport,
  onSelectConversation,
  onRebuildIndex,
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
          getConversations(12),
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

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const topSource = useMemo(() => {
    if (sourceStats.length === 0) return null;
    return [...sourceStats].sort((a, b) => b.messageCount - a.messageCount)[0] ?? null;
  }, [sourceStats]);

  if (loading) {
    return (
      <main className="overview-main" id="main-content">
        <h1 className="overview-title">Command Center</h1>
        <p className="empty-text">Loading dashboard...</p>
      </main>
    );
  }

  const totalConvs = stats?.conversationCount ?? 0;
  const totalMsgs = stats?.messageCount ?? 0;
  const indexedMsgs = stats?.indexedMessageCount ?? 0;
  const lastImport = stats?.latestMessageTimestamp
    ? formatTimestamp(stats.latestMessageTimestamp)
    : "No activity yet";

  const isEmpty = totalConvs === 0 && totalMsgs === 0;
  const needsIndexRebuild = totalMsgs > 0 && indexedMsgs === 0;
  const indexedPct = totalMsgs > 0 ? Math.round((indexedMsgs / totalMsgs) * 100) : 100;

  const maxActivity = Math.max(1, ...activityByDay);
  const activeDays = activityByDay.filter((count) => count > 0).length;
  const activityTotal = activityByDay.reduce((sum, count) => sum + count, 0);

  const sourceMessageTotal = sourceStats.reduce((sum, source) => sum + source.messageCount, 0);
  const recentRows = recent.slice(0, 8);

  return (
    <main className="overview-main" id="main-content">
      <section className="overview-hero overview-stage stage-1" aria-labelledby="overview-heading">
        <div>
          <p className="overview-kicker">Memex desktop intelligence</p>
          <h1 className="overview-title" id="overview-heading">
            Command Center
          </h1>
          <p className="overview-subtitle">
            Local-first memory analytics for your imported AI conversations.
          </p>
        </div>

        <div className="overview-hero-controls">
          <div className="overview-sync-chip" role="status" aria-live="polite">
            <Clock3 size={14} />
            <span>Latest activity: {lastImport}</span>
          </div>
          <div className="overview-hero-actions">
            <button type="button" className="overview-btn ui-btn ui-btn--secondary" onClick={onOpenImport}>
              <FilePlus2 size={15} /> Import data
            </button>
            <button
              type="button"
              className="overview-btn ui-btn ui-btn--primary"
              onClick={() => {
                if (recent[0]?.id) onSelectConversation(recent[0].id);
              }}
              disabled={!recent[0]?.id}
            >
              <ArrowUpRight size={15} /> Open latest thread
            </button>
          </div>
        </div>
      </section>

      {isEmpty && (
        <div className="overview-empty-state overview-stage stage-1">
          <p className="overview-empty-text">No data yet. Import a conversation archive to activate the dashboard.</p>
          <button type="button" className="overview-btn ui-btn ui-btn--primary" onClick={onOpenImport}>
            Start import
          </button>
        </div>
      )}

      {needsIndexRebuild && (
        <div className="overview-index-banner overview-stage stage-1" role="status">
          <div>
            <div className="overview-index-title">Search index is missing</div>
            <div className="overview-index-sub">
              Rebuild now to restore full-text results and highlighting.
            </div>
          </div>
          <button type="button" className="overview-index-btn ui-btn ui-btn--secondary ui-btn--sm" onClick={onRebuildIndex}>
            Rebuild index
          </button>
        </div>
      )}

      <section className="overview-metric-band overview-stage stage-2" aria-label="Key metrics">
        <article className="overview-metric-card">
          <p className="overview-metric-label">Conversations</p>
          <p className="overview-metric-value">{totalConvs.toLocaleString()}</p>
          <p className="overview-metric-meta">Imported threads</p>
        </article>

        <article className="overview-metric-card">
          <p className="overview-metric-label">Messages</p>
          <p className="overview-metric-value">{totalMsgs.toLocaleString()}</p>
          <p className="overview-metric-meta">Total entries in memory</p>
        </article>

        <article className="overview-metric-card">
          <p className="overview-metric-label">Search index coverage</p>
          <p className="overview-metric-value">{indexedPct}%</p>
          <p className="overview-metric-meta">{indexedMsgs.toLocaleString()} indexed messages</p>
        </article>

        <article className="overview-metric-card accent">
          <p className="overview-metric-label">Most active source</p>
          <p className="overview-metric-value">{topSource ? sourceLabel(topSource.source) : "—"}</p>
          <p className="overview-metric-meta">
            {topSource ? `${topSource.messageCount.toLocaleString()} messages` : "No source data yet"}
          </p>
        </article>
      </section>

      <section className="overview-memory-pulse overview-stage stage-3" aria-label="Memory pulse strip">
        <div className="overview-pulse-main">
          <div className="overview-section-head">
            <h2 className="overview-section-title">
              <Activity size={16} /> Memory pulse strip
            </h2>
            <p className="overview-section-meta">
              {activityTotal.toLocaleString()} messages in the last 30 days • {activeDays} active day
              {activeDays === 1 ? "" : "s"}
            </p>
          </div>

          <div className="overview-pulse-strip" role="img" aria-label="Message activity intensity over the last 30 days">
            {activityByDay.map((count, i) => {
              const ratio = count / maxActivity;
              const height = Math.max(12, Math.round(12 + ratio * 66));
              return (
                <div key={i} className="overview-pulse-bar-wrap" title={`Day ${i + 1}: ${count} message${count === 1 ? "" : "s"}`}>
                  <div className="overview-pulse-bar" style={{ height: `${height}px`, opacity: 0.28 + ratio * 0.72 }} />
                </div>
              );
            })}
          </div>

          <div className="overview-pulse-legend" aria-hidden>
            <span>Low</span>
            <div className="overview-pulse-scale" />
            <span>High</span>
          </div>
        </div>

        <aside className="overview-pulse-side" aria-label="Source momentum">
          <div className="overview-section-head tight">
            <h3 className="overview-section-title small">
              <Flame size={15} /> Source momentum
            </h3>
            <p className="overview-section-meta">Share of message volume by source</p>
          </div>

          {sourceStats.length === 0 ? (
            <p className="overview-muted">No source data yet.</p>
          ) : (
            <ul className="overview-source-list">
              {sourceStats
                .slice()
                .sort((a, b) => b.messageCount - a.messageCount)
                .map((source) => {
                  const pct = sourceMessageTotal > 0 ? (source.messageCount / sourceMessageTotal) * 100 : 0;
                  return (
                    <li key={source.source} className="overview-source-item">
                      <div className="overview-source-label">
                        <SourceIcon source={source.source} />
                        <span>{sourceLabel(source.source)}</span>
                      </div>
                      <div className="overview-source-meter" aria-hidden>
                        <div style={{ width: `${Math.max(6, pct)}%` }} />
                      </div>
                      <span className="overview-source-value">{Math.round(pct)}%</span>
                    </li>
                  );
                })}
            </ul>
          )}
        </aside>
      </section>

      <section className="overview-recent-activity overview-stage stage-4" aria-label="Recent activity table">
        <div className="overview-section-head">
          <h2 className="overview-section-title">
            <Database size={16} /> Recent activity
          </h2>
          <p className="overview-section-meta">Latest imported conversations available for instant recall</p>
        </div>

        {recentRows.length === 0 ? (
          <p className="overview-muted">No conversations yet. Import data to populate this feed.</p>
        ) : (
          <div className="overview-table" role="table" aria-label="Recent conversations">
            <div className="overview-table-row overview-table-head" role="row">
              <span role="columnheader">Source</span>
              <span role="columnheader">Thread title</span>
              <span role="columnheader">Messages</span>
              <span role="columnheader">Updated</span>
            </div>
            {recentRows.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className="overview-table-row"
                role="row"
                onClick={() => onSelectConversation(conversation.id)}
                title={conversation.title || "Untitled"}
              >
                <span className="overview-table-source" role="cell">
                  <SourceIcon source={conversation.source} />
                  {sourceLabel(conversation.source)}
                </span>
                <span className="overview-table-title" role="cell">
                  {conversation.title || "Untitled"}
                </span>
                <span className="overview-table-count" role="cell">
                  {conversation.message_count.toLocaleString()}
                </span>
                <span className="overview-table-time" role="cell">
                  {formatDate(conversation.last_message_at)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="overview-secondary-rail overview-stage stage-4" aria-label="Insights and status">
        <article className="overview-note-card">
          <h3>
            <Sparkles size={15} /> Insights
          </h3>
          <p>
            AI insight cards will surface recurring topics, high-value threads, and relationship trails across
            sources.
          </p>
        </article>

        <article className="overview-note-card">
          <h3>
            <Clock3 size={15} /> Data status
          </h3>
          <p>All data is stored locally on this device. Last recorded activity: {lastImport}.</p>
        </article>
      </section>
    </main>
  );
}
