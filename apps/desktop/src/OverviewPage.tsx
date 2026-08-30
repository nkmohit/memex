import { useEffect, useMemo, useState } from "react";
import { Clock3, Database, FilePlus2, Search, Sparkles } from "lucide-react";
import {
  getCachedDashboardSnapshot,
  getDashboardSnapshot,
  type ConversationRow,
  type DashboardSnapshot,
  type DbStats,
  type SourceStats,
} from "./db";
import { formatDate, formatTimestamp } from "./utils";
import OverviewMemoryPulse from "./components/OverviewMemoryPulse";
import { SourceIcon, sourceLabel } from "./lib/sourceDisplay";
import { summarizeText } from "./lib/summarize";

interface OverviewPageProps {
  onOpenImport: () => void;
  onOpenSearch: () => void;
  onSelectConversation: (convId: string) => void;
  onRebuildIndex: () => void;
}

function OverviewSkeleton() {
  return (
    <>
      <section className="overview-hero overview-stage stage-1" aria-hidden>
        <div className="overview-skeleton-line w-30" />
        <div className="overview-skeleton-line w-50" />
      </section>
      <section className="overview-metric-band overview-stage stage-2" aria-hidden>
        {Array.from({ length: 4 }).map((_, idx) => (
          <article key={idx} className="overview-metric-card overview-card-skeleton" />
        ))}
      </section>
      <section className="overview-memory-pulse overview-stage stage-3" aria-hidden>
        <div className="overview-pulse-main overview-card-skeleton tall" />
        <aside className="overview-pulse-side overview-card-skeleton tall" />
      </section>
    </>
  );
}

export default function OverviewPage({
  onOpenImport,
  onOpenSearch,
  onSelectConversation,
  onRebuildIndex,
}: OverviewPageProps) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const cached = await getCachedDashboardSnapshot();
      if (!cancelled && cached) {
        setSnapshot(cached);
        setLoading(false);
      }
      const fresh = await getDashboardSnapshot();
      if (!cancelled) {
        setSnapshot(fresh);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats: DbStats | null = snapshot?.stats ?? null;
  const sourceStats: SourceStats[] = useMemo(
    () => snapshot?.sourceStats ?? [],
    [snapshot?.sourceStats]
  );
  const recent: ConversationRow[] = useMemo(
    () => snapshot?.recentConversations ?? [],
    [snapshot?.recentConversations]
  );
  const activityTimeline = useMemo(() => snapshot?.activityTimeline ?? [], [snapshot?.activityTimeline]);

  const topSource = useMemo(() => {
    if (sourceStats.length === 0) return null;
    return [...sourceStats].sort((a, b) => b.messageCount - a.messageCount)[0] ?? null;
  }, [sourceStats]);

  const totalConvs = stats?.conversationCount ?? 0;
  const totalMsgs = stats?.messageCount ?? 0;
  const indexedMsgs = stats?.indexedMessageCount ?? 0;
  const indexedPct = totalMsgs > 0 ? Math.round((indexedMsgs / totalMsgs) * 100) : 100;
  const lastImport = stats?.latestMessageTimestamp
    ? formatTimestamp(stats.latestMessageTimestamp)
    : "No activity yet";
  const inputTokens = stats?.estimatedInputTokens ?? 0;
  const outputTokens = stats?.estimatedOutputTokens ?? 0;
  const totalTokens = stats?.estimatedTotalTokens ?? 0;

  const isEmpty = totalConvs === 0 && totalMsgs === 0;
  const needsIndexRebuild = totalMsgs > 0 && indexedMsgs === 0;
  const recentRows = recent.slice(0, 8);

  const [insights, setInsights] = useState<string[] | null>(null);

  useEffect(() => {
    if (!snapshot || isEmpty) {
      setInsights(null);
      return;
    }
    let cancelled = false;
    const recentTitles = recent.slice(0, 8).map((r) => r.title || "Untitled").join(". ");
    const text = [
      `You have ${totalConvs} conversations and ${totalMsgs} messages across ${sourceStats.length} sources.`,
      `Most active source is ${topSource ? sourceLabel(topSource.source) : "none"} with ${topSource?.messageCount ?? 0} messages.`,
      `Recent threads: ${recentTitles}.`,
      `Indexed ${indexedPct}% of messages. Token estimate ${totalTokens}.`,
    ].join(" ");
    void summarizeText(text).then((bullets) => {
      if (!cancelled) setInsights(bullets);
    });
    return () => {
      cancelled = true;
    };
  }, [snapshot, isEmpty, totalConvs, totalMsgs, sourceStats.length, topSource, recent, indexedPct, totalTokens]);

  return (
    <main className="overview-main" id="main-content">
      {!snapshot && loading ? (
        <OverviewSkeleton />
      ) : (
        <>
          <section
            className="overview-hero overview-stage stage-1"
            aria-labelledby="overview-heading"
          >
            <div>
              <p className="overview-kicker">Memex</p>
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
                <button
                  type="button"
                  className="overview-btn ui-btn ui-btn--secondary"
                  onClick={onOpenImport}
                >
                  <FilePlus2 size={15} /> Import data
                </button>
                <button
                  type="button"
                  className="overview-btn ui-btn ui-btn--primary"
                  onClick={onOpenSearch}
                >
                  <Search size={15} /> Search (Cmd K)
                </button>
              </div>
            </div>
          </section>

          {isEmpty && (
            <div className="overview-empty-state overview-stage stage-1">
              <p className="overview-empty-text">
                No data yet. Import a conversation archive to activate the dashboard.
              </p>
              <button
                type="button"
                className="overview-btn ui-btn ui-btn--primary"
                onClick={onOpenImport}
              >
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
              <button
                type="button"
                className="overview-index-btn ui-btn ui-btn--secondary ui-btn--sm"
                onClick={onRebuildIndex}
              >
                Rebuild index
              </button>
            </div>
          )}

          <section className="overview-metric-band overview-stage stage-2" aria-label="Key metrics">
            <article className="overview-metric-card primary">
              <p className="overview-metric-label">Messages</p>
              <p className="overview-metric-value">{totalMsgs.toLocaleString("en-US")}</p>
              <p className="overview-metric-meta">
                {indexedPct}% indexed • {indexedMsgs.toLocaleString("en-US")} indexed messages
              </p>
            </article>
            <article className="overview-metric-card">
              <p className="overview-metric-label">Conversations</p>
              <p className="overview-metric-value">{totalConvs.toLocaleString("en-US")}</p>
              <p className="overview-metric-meta">Imported threads</p>
            </article>
            <article className="overview-metric-card">
              <p className="overview-metric-label">Token count</p>
              <p className="overview-metric-value">{totalTokens.toLocaleString("en-US")}</p>
              <p className="overview-metric-meta">
                In {inputTokens.toLocaleString("en-US")} • Out{" "}
                {outputTokens.toLocaleString("en-US")} (estimated)
              </p>
            </article>
            <article className="overview-metric-card accent">
              <p className="overview-metric-label">Most active source</p>
              <p className="overview-metric-value">
                {topSource ? sourceLabel(topSource.source) : "—"}
              </p>
              <p className="overview-metric-meta">
                {topSource
                  ? `${topSource.messageCount.toLocaleString("en-US")} messages`
                  : "No source data yet"}
              </p>
            </article>
          </section>

          <OverviewMemoryPulse
            activityTimeline={activityTimeline}
            sourceStats={sourceStats}
            topicTexts={recent.map((r) => r.title || "Untitled")}
            topicDates={recent.map((r) => r.last_message_at)}
          />

          <section
            className="overview-recent-activity overview-stage stage-4"
            aria-label="Recent activity table"
          >
            <div className="overview-section-head">
              <h2 className="overview-section-title">
                <Database size={16} /> Recent activity
              </h2>
              <p className="overview-section-meta">
                Latest imported conversations available for instant recall
              </p>
            </div>
            {recentRows.length === 0 ? (
              <p className="overview-muted">
                No conversations yet. Import data to populate this feed.
              </p>
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
                      {conversation.message_count.toLocaleString("en-US")}
                    </span>
                    <span className="overview-table-time" role="cell">
                      {formatDate(conversation.last_message_at)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section
            className="overview-secondary-rail overview-stage stage-4"
            aria-label="Insights and status"
          >
            <article className="overview-note-card" aria-live="polite">
              <h3>
                <Sparkles size={15} /> Insights
              </h3>
              {insights ? (
                <ul className="overview-insights-list">
                  {insights.map((b, i) => (
                    <li key={i} className="overview-insight-bullet">
                      {b}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  AI insight cards will surface recurring topics, high-value threads, and relationship
                  trails across sources.
                </p>
              )}
            </article>
            <article className="overview-note-card">
              <h3>
                <Clock3 size={15} /> Data status
              </h3>
              <p>
                All data is stored locally on this device. Last recorded activity: {lastImport}.
              </p>
            </article>
          </section>
        </>
      )}
    </main>
  );
}
