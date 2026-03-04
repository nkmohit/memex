import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Clock3,
  Database,
  FilePlus2,
  Flame,
  Search,
  Sparkles,
} from "lucide-react";
import {
  getActivityHeatmapTimeline,
  getConversations,
  getSourceStats,
  getStats,
} from "./db";
import type { ActivityHeatmapPoint, ConversationRow, DbStats, SourceStats } from "./db";
import AppSelect from "./components/AppSelect";
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

function dayToDate(day: string): Date {
  const [y, m, d] = day.split("-").map((p) => Number(p));
  return new Date(y, (m || 1) - 1, d || 1);
}

function dayFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface OverviewPageProps {
  onOpenImport: () => void;
  onOpenSearch: () => void;
  onSelectConversation: (convId: string) => void;
  onRebuildIndex: () => void;
}

export default function OverviewPage({
  onOpenImport,
  onOpenSearch,
  onSelectConversation,
  onRebuildIndex,
}: OverviewPageProps) {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([]);
  const [recent, setRecent] = useState<ConversationRow[]>([]);
  const [activityTimeline, setActivityTimeline] = useState<ActivityHeatmapPoint[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("all");
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
          getActivityHeatmapTimeline(),
        ]);
        if (!cancelled) {
          setStats(s);
          setSourceStats(ss);
          setRecent(convs);
          setActivityTimeline(activity);
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

  const yearOptions = useMemo(() => {
    const years = Array.from(new Set(activityTimeline.map((point) => point.day.slice(0, 4)))).sort((a, b) =>
      b.localeCompare(a)
    );
    return [{ value: "all", label: "All time" }, ...years.map((year) => ({ value: year, label: year }))];
  }, [activityTimeline]);

  useEffect(() => {
    if (selectedYear !== "all" && !yearOptions.some((option) => option.value === selectedYear)) {
      setSelectedYear("all");
    }
  }, [selectedYear, yearOptions]);

  const heatmapDays = useMemo(() => {
    if (activityTimeline.length === 0) return [];

    const sorted = [...activityTimeline].sort((a, b) => a.day.localeCompare(b.day));
    const byDay = new Map(sorted.map((point) => [point.day, point]));

    const startDate =
      selectedYear === "all" ? dayToDate(sorted[0]!.day) : new Date(Number(selectedYear), 0, 1);

    let endDate =
      selectedYear === "all" ? dayToDate(sorted[sorted.length - 1]!.day) : new Date(Number(selectedYear), 11, 31);

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (selectedYear !== "all" && Number(selectedYear) === now.getFullYear()) {
      endDate = now;
    }

    const days: ActivityHeatmapPoint[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayKey = dayFromDate(d);
      const point = byDay.get(dayKey);
      days.push(
        point ?? {
          day: dayKey,
          totalCount: 0,
          chatgptCount: 0,
          claudeCount: 0,
          geminiCount: 0,
          grokCount: 0,
          otherCount: 0,
        }
      );
    }

    return days;
  }, [activityTimeline, selectedYear]);

  const maxActivity = Math.max(1, ...heatmapDays.map((point) => point.totalCount));
  const activeDays = heatmapDays.filter((point) => point.totalCount > 0).length;
  const activityTotal = heatmapDays.reduce((sum, point) => sum + point.totalCount, 0);

  const heatmapCells = useMemo(() => {
    if (heatmapDays.length === 0) return [] as Array<ActivityHeatmapPoint | null>;
    const firstWeekday = dayToDate(heatmapDays[0]!.day).getDay();
    const leading = Array.from({ length: firstWeekday }, () => null as ActivityHeatmapPoint | null);
    const base = [...leading, ...heatmapDays];
    const trailingCount = (7 - (base.length % 7)) % 7;
    const trailing = Array.from({ length: trailingCount }, () => null as ActivityHeatmapPoint | null);
    return [...base, ...trailing];
  }, [heatmapDays]);

  function intensityLevel(count: number): number {
    if (count <= 0) return 0;
    const ratio = count / maxActivity;
    if (ratio < 0.25) return 1;
    if (ratio < 0.5) return 2;
    if (ratio < 0.75) return 3;
    return 4;
  }

  function dayTooltip(point: ActivityHeatmapPoint): string {
    const dateText = dayToDate(point.day).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const sourceBreakdown: Array<[string, number]> = [
      ["ChatGPT", point.chatgptCount],
      ["Claude", point.claudeCount],
      ["Gemini", point.geminiCount],
      ["Grok", point.grokCount],
      ["Other", point.otherCount],
    ];
    const sourceLines = sourceBreakdown
      .filter(([, count]) => count > 0)
      .map(([label, count]) => `${label}: ${count}`);

    const totalLine = `${point.totalCount.toLocaleString()} message${point.totalCount === 1 ? "" : "s"}`;
    return sourceLines.length > 0
      ? `${dateText}\n${totalLine}\n${sourceLines.join("\n")}`
      : `${dateText}\nNo messages`;
  }

  const sourceMessageTotal = sourceStats.reduce((sum, source) => sum + source.messageCount, 0);
  const recentRows = recent.slice(0, 8);

  if (loading) {
    return (
      <main className="overview-main" id="main-content">
        <h1 className="overview-title">Command Center</h1>
        <p className="empty-text">Loading dashboard...</p>
      </main>
    );
  }

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
            <button type="button" className="overview-btn ui-btn ui-btn--primary" onClick={onOpenSearch}>
              <Search size={15} /> Search (Cmd K)
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
          <p className="overview-metric-meta">{indexedPct}% indexed • {indexedMsgs.toLocaleString()} indexed messages</p>
        </article>

        <article className="overview-metric-card">
          <p className="overview-metric-label">Token count</p>
          <p className="overview-metric-value">{totalTokens.toLocaleString()}</p>
          <p className="overview-metric-meta">
            In {inputTokens.toLocaleString()} • Out {outputTokens.toLocaleString()} (estimated)
          </p>
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
            <div className="overview-pulse-controls">
              <AppSelect
                ariaLabel="Pulse timeframe"
                className="overview-pulse-select app-select"
                size="sm"
                value={selectedYear}
                onChange={setSelectedYear}
                options={yearOptions}
              />
              <p className="overview-section-meta">
                {activityTotal.toLocaleString()} messages • {activeDays} active day{activeDays === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div
            className="overview-pulse-strip overview-heatmap-grid"
            role="img"
            aria-label={`Daily conversation activity heatmap: ${selectedYear === "all" ? "all time" : selectedYear}`}
          >
            {heatmapCells.map((point, index) => {
              if (!point) {
                return <span key={`empty-${index}`} className="overview-heatmap-cell empty" aria-hidden />;
              }
              const level = intensityLevel(point.totalCount);
              return (
                <span
                  key={point.day}
                  className={`overview-heatmap-cell level-${level}`}
                  title={dayTooltip(point)}
                  aria-label={`${point.day}: ${point.totalCount} message${point.totalCount === 1 ? "" : "s"}`}
                />
              );
            })}
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
