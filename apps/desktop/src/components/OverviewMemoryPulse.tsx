import { useEffect, useMemo, useState } from "react";
import { Activity, Flame, Hash } from "lucide-react";
import AppSelect from "./AppSelect";
import type { ActivityHeatmapPoint, SourceStats } from "../db";
import { SourceIcon, sourceLabel } from "../lib/sourceDisplay";
import { computeTopTopics, computeTopicTimeline } from "../lib/topics";

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

interface HeatmapHoverState {
  point: ActivityHeatmapPoint;
  x: number;
  y: number;
}

interface Props {
  activityTimeline: ActivityHeatmapPoint[];
  sourceStats: SourceStats[];
  topicTexts?: string[];
  topicDates?: number[];
}

export default function OverviewMemoryPulse({ activityTimeline, sourceStats, topicTexts, topicDates }: Props) {
  const [selectedYear, setSelectedYear] = useState<string>("latest");
  const [hoveredHeatmap, setHoveredHeatmap] = useState<HeatmapHoverState | null>(null);

  const yearOptions = useMemo(() => {
    const years = Array.from(new Set(activityTimeline.map((point) => point.day.slice(0, 4))))
      .sort((a, b) => b.localeCompare(a))
      .map((year) => ({ value: year, label: year }));
    const currentYear = String(new Date().getFullYear());
    if (!years.some((year) => year.value === currentYear)) {
      years.unshift({ value: currentYear, label: currentYear });
    }
    return [{ value: "latest", label: "Latest" }, ...years];
  }, [activityTimeline]);

  useEffect(() => {
    if (!yearOptions.some((opt) => opt.value === selectedYear)) {
      setSelectedYear("latest");
    }
  }, [selectedYear, yearOptions]);

  const heatmapDays = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let start: Date;
    let end: Date;
    if (selectedYear === "latest") {
      end = now;
      start = new Date(now);
      start.setDate(start.getDate() - 364);
    } else {
      const yearNum = Number(selectedYear);
      if (!Number.isFinite(yearNum)) return [];
      start = new Date(yearNum, 0, 1);
      end = new Date(yearNum, 11, 31);
    }
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
    const trailing = Array.from(
      { length: trailingCount },
      () => null as ActivityHeatmapPoint | null
    );
    return [...base, ...trailing];
  }, [heatmapDays]);

  const weekCount = Math.max(1, Math.ceil(heatmapCells.length / 7));
  const heatmapTrackMinWidth = Math.max(240, weekCount * 15 + 24);

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

  const topTopics = useMemo(() => {
    if (!topicTexts || topicTexts.length === 0) return [];
    return computeTopTopics(topicTexts, 5);
  }, [topicTexts]);

  const topicTimeline = useMemo(() => {
    if (!topicTexts || !topicDates || topicTexts.length === 0) return [];
    const items = topicTexts.map((text, i) => ({ text, date: topicDates[i] ?? Date.now() }));
    return computeTopicTimeline(items, 3);
  }, [topicTexts, topicDates]);

  return (
    <section
      className="overview-memory-pulse overview-stage stage-3"
      aria-label="Memory pulse strip"
    >
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
              {activityTotal.toLocaleString("en-US")} messages • {activeDays} active day
              {activeDays === 1 ? "" : "s"}
            </p>
          </div>
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
          <div className="overview-heatmap-scroll">
            <div
              className="overview-heatmap-track"
              style={{ minWidth: `${heatmapTrackMinWidth}px` }}
            >
              <div
                className="overview-heatmap-months"
                style={{ gridTemplateColumns: `repeat(${weekCount}, 12px)` }}
              >
                {monthMarkers.map((marker, idx) => (
                  <span
                    key={`${marker.label}-${idx}`}
                    style={{ gridColumnStart: marker.column + 1 }}
                  >
                    {marker.label}
                  </span>
                ))}
              </div>
              <div className="overview-heatmap-canvas">
                <div
                  className="overview-pulse-strip overview-heatmap-grid"
                  role="img"
                  aria-label={`Daily conversation activity heatmap: ${selectedYear === "latest" ? "latest 12 months" : selectedYear}`}
                >
                  {heatmapCells.map((point, index) => {
                    if (!point) {
                      return (
                        <span
                          key={`empty-${index}`}
                          className="overview-heatmap-cell empty"
                          aria-hidden
                        />
                      );
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
                          const container = event.currentTarget
                            .closest(".overview-heatmap-canvas")
                            ?.getBoundingClientRect();
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
                    style={{
                      left: hoveredHeatmap.x,
                      top: hoveredHeatmap.y,
                      transform: "translate(-50%, -100%)",
                    }}
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
                const pct =
                  sourceMessageTotal > 0 ? (source.messageCount / sourceMessageTotal) * 100 : 0;
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

        {topTopics.length > 0 && (
          <div className="overview-topics" aria-label="Top topics">
            <h4 className="overview-topics-title">
              <Hash size={14} /> Top topics: {topTopics.join(", ")}
            </h4>
            {topicTimeline.length > 0 && (
              <ul className="overview-topic-timeline" aria-label="Topic timeline">
                {topicTimeline.map((point) => (
                  <li key={point.month} className="overview-topic-point">
                    <span className="overview-topic-month">{point.month}</span>
                    <span className="overview-topic-terms">{point.topTopics.join(", ") || "—"}</span>
                    <span className="overview-topic-count">{point.count} threads</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </aside>
    </section>
  );
}
