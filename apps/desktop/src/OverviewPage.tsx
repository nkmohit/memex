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
  getCachedDashboardSnapshot,
  getDashboardSnapshot,
  type ActivityHeatmapPoint,
  type ConversationRow,
  type DashboardSnapshot,
  type DbStats,
  type SourceStats,
} from "./db";
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

function getFiscalEndYear(date: Date): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  return month >= 2 ? year + 1 : year;
}

function fiscalWindowBounds(endYear: number): { start: Date; end: Date } {
  return {
    start: new Date(endYear - 1, 2, 1),
    end: new Date(endYear, 2, 0),
  };
}

interface HeatmapHoverState {
  point: ActivityHeatmapPoint;
  x: number;
  y: number;
}

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
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [hoveredHeatmap, setHoveredHeatmap] = useState<HeatmapHoverState | null>(null);
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
  const sourceStats: SourceStats[] = snapshot?.sourceStats ?? [];
  const recent: ConversationRow[] = snapshot?.recentConversations ?? [];
  const activityTimeline: ActivityHeatmapPoint[] = snapshot?.activityTimeline ?? [];

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
    const years = Array.from(
      new Set(
        activityTimeline.map((point) => {
          return String(getFiscalEndYear(dayToDate(point.day)));
        })
      )
    )
      .sort((a, b) => b.localeCompare(a))
      .map((year) => ({ value: year, label: year }));

    if (years.length === 0) {
      const fallback = String(getFiscalEndYear(new Date()));
      return [{ value: fallback, label: fallback }];
    }

    return years;
  }, [activityTimeline]);

  useEffect(() => {
    if (!selectedYear) {
      setSelectedYear(Number(yearOptions[0]?.value));
      return;
    }
    const stillValid = yearOptions.some((opt) => Number(opt.value) === selectedYear);
    if (!stillValid) setSelectedYear(Number(yearOptions[0]?.value));
  }, [selectedYear, yearOptions]);

  const heatmapDays = useMemo(() => {
    if (!selectedYear) return [];
    const { start, end } = fiscalWindowBounds(selectedYear);
    const byDay = new Map(activityTimeline.map((point) => [point.day, point]));

    const days: ActivityHeatmapPoint[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
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

  const weekCount = Math.max(1, Math.ceil(heatmapCells.length / 7));

  const monthMarkers = useMemo(() => {
    const markers: Array<{ column: number; label: string }> = [];
    const seenColumns = new Set<number>();
    const firstDay = heatmapDays[0];
    if (!firstDay) return markers;

    const firstWeekday = dayToDate(firstDay.day).getDay();
    for (let dayIndex = 0; dayIndex < heatmapDays.length; dayIndex += 1) {
      const point = heatmapDays[dayIndex];
      const date = dayToDate(point.day);
      if (date.getDate() !== 1 && dayIndex !== 0) continue;
      const column = Math.floor((firstWeekday + dayIndex) / 7);
      if (seenColumns.has(column)) continue;
      seenColumns.add(column);
      markers.push({
        column,
        label: date.toLocaleDateString(undefined, { month: "short" }),
      });
    }
    return markers;
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

    const totalLine = `${point.totalCount.toLocaleString("en-US")} message${point.totalCount === 1 ? "" : "s"}`;
    return sourceLines.length > 0
      ? `${dateText}\n${totalLine}\n${sourceLines.join("\n")}`
      : `${dateText}\nNo messages`;
  }

  function heatmapTooltipDetails(point: ActivityHeatmapPoint): Array<[string, number]> {
    const rows: Array<[string, number]> = [
      ["ChatGPT", point.chatgptCount],
      ["Claude", point.claudeCount],
      ["Gemini", point.geminiCount],
      ["Grok", point.grokCount],
      ["Other", point.otherCount],
    ];
    return rows.filter(([, count]) => count > 0);
  }

  const sourceMessageTotal = sourceStats.reduce((sum, source) => sum + source.messageCount, 0);
  const recentRows = recent.slice(0, 8);

  return (
    <main className="overview-main" id="main-content">
      {!snapshot && loading ? (
        <OverviewSkeleton />
      ) : (
        <>
          <section className="overview-hero overview-stage stage-1" aria-labelledby="overview-heading">
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
            <article className="overview-metric-card primary">
              <p className="overview-metric-label">Messages</p>
              <p className="overview-metric-value">{totalMsgs.toLocaleString("en-US")}</p>
              <p className="overview-metric-meta">{indexedPct}% indexed • {indexedMsgs.toLocaleString("en-US")} indexed messages</p>
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
                In {inputTokens.toLocaleString("en-US")} • Out {outputTokens.toLocaleString("en-US")} (estimated)
              </p>
            </article>

            <article className="overview-metric-card accent">
              <p className="overview-metric-label">Most active source</p>
              <p className="overview-metric-value">{topSource ? sourceLabel(topSource.source) : "—"}</p>
              <p className="overview-metric-meta">
                {topSource ? `${topSource.messageCount.toLocaleString("en-US")} messages` : "No source data yet"}
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
                    value={String(selectedYear ?? yearOptions[0]?.value ?? "")}
                    onChange={(value) => setSelectedYear(Number(value))}
                    options={yearOptions}
                  />
                  <p className="overview-section-meta">
                    {activityTotal.toLocaleString("en-US")} messages • {activeDays} active day{activeDays === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="overview-heatmap-months" style={{ gridTemplateColumns: `repeat(${weekCount}, 12px)` }}>
                {monthMarkers.map((marker, idx) => (
                  <span key={`${marker.label}-${idx}`} style={{ gridColumnStart: marker.column + 1 }}>
                    {marker.label}
                  </span>
                ))}
              </div>

              <div className="overview-heatmap-with-days">
                <div className="overview-heatmap-day-labels" aria-hidden>
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>
                <div className="overview-heatmap-canvas">
                  <div
                    className="overview-pulse-strip overview-heatmap-grid"
                    role="img"
                    aria-label={`Daily conversation activity heatmap for fiscal year ending ${selectedYear ?? ""}`}
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
                          onMouseEnter={(event) => {
                            const target = event.currentTarget.getBoundingClientRect();
                            const container = event.currentTarget.closest(".overview-heatmap-canvas")?.getBoundingClientRect();
                            if (!container) return;
                            setHoveredHeatmap({
                              point,
                              x: target.left - container.left + target.width / 2,
                              y: target.top - container.top - 8,
                            });
                          }}
                          onMouseLeave={() => setHoveredHeatmap(null)}
                        />
                      );
                    })}
                  </div>
                  {hoveredHeatmap && (
                    <div
                      className="overview-heatmap-tooltip"
                      style={{ left: hoveredHeatmap.x, top: hoveredHeatmap.y, transform: "translate(-50%, -100%)" }}
                    >
                      <div className="overview-heatmap-tooltip-date">
                        {dayToDate(hoveredHeatmap.point.day).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div className="overview-heatmap-tooltip-total">
                        {hoveredHeatmap.point.totalCount.toLocaleString("en-US")} messages
                      </div>
                      <div className="overview-heatmap-tooltip-breakdown">
                        {heatmapTooltipDetails(hoveredHeatmap.point).map(([label, count]) => (
                          <span key={label}>
                            {label}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {activityTotal === 0 && (
                <p className="overview-muted">No activity for this selected year.</p>
              )}
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
        </>
      )}
    </main>
  );
}
