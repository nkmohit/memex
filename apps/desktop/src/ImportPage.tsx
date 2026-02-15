import { useEffect, useState } from "react";
import {
  ClaudeIcon,
  ChatGPTIcon,
  GeminiIcon,
  GrokIcon,
} from "./icons";
import { getSourceStats, getStats } from "./db";
import type { DbStats, SourceStats } from "./db";
import { formatDate } from "./utils";
import { IMPORT_SOURCES, type ImportSource } from "./importer";

function SourceIcon({ source }: { source: string }) {
  switch (source.toLowerCase()) {
    case "claude":
      return <ClaudeIcon size={20} />;
    case "chatgpt":
      return <ChatGPTIcon size={20} />;
    case "gemini":
      return <GeminiIcon size={20} />;
    case "grok":
      return <GrokIcon size={20} />;
    default:
      return null;
  }
}

interface ImportPageProps {
  onImport: (source: ImportSource) => void;
  importing: boolean;
  importError: string | null;
  importResult: string | null;
  refreshKey: number;
}

export default function ImportPage({
  onImport,
  importing,
  importError,
  importResult,
  refreshKey,
}: ImportPageProps) {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [s, ss] = await Promise.all([
          getStats(),
          getSourceStats(),
        ]);
        if (!cancelled) {
          setStats(s);
          setSourceStats(ss);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, retryTrigger]);

  const getStatsForSource = (source: string) =>
    sourceStats.find((s) => s.source.toLowerCase() === source.toLowerCase());

  if (loading && !stats && !loadError) {
    return (
      <main className="import-main">
        <h1 className="import-title">Import</h1>
        <p className="empty-text">Loading...</p>
      </main>
    );
  }

  const totalConvs = stats?.conversationCount ?? 0;
  const totalMsgs = stats?.messageCount ?? 0;
  const lastSyncOverall = stats?.latestMessageTimestamp
    ? formatDate(stats.latestMessageTimestamp)
    : "—";

  return (
    <main className="import-main">
      <h1 className="import-title">Import</h1>
      <p className="import-description">
        Add conversations from supported providers. Data is stored only on your device.
      </p>

      {loadError && (
        <div className="import-banners">
          <div className="banner error import-load-error" role="alert">
            <span>{loadError}</span>
            <button
              type="button"
              className="import-retry-btn"
              onClick={() => setRetryTrigger((t) => t + 1)}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {(importError || importResult) && (
        <div className="import-banners">
          {importError && (
            <div className="banner error" role="alert">
              {importError}
            </div>
          )}
          {importResult && (
            <div className="banner success" role="status">
              {importResult}
            </div>
          )}
        </div>
      )}

      <section className="import-summary">
        <h2 className="import-section-title">Your data</h2>
        <div className="import-summary-grid">
          <div className="import-summary-card">
            <span className="import-summary-label">Total conversations</span>
            <span className="import-summary-value">{totalConvs.toLocaleString()}</span>
          </div>
          <div className="import-summary-card">
            <span className="import-summary-label">Total messages</span>
            <span className="import-summary-value">{totalMsgs.toLocaleString()}</span>
          </div>
          <div className="import-summary-card">
            <span className="import-summary-label">Last sync (any source)</span>
            <span className="import-summary-value">{lastSyncOverall}</span>
          </div>
        </div>
      </section>

      <section className="import-sources">
        <h2 className="import-section-title">Sources</h2>
        <p className="import-section-desc">
          What has been added per source and when it was last updated.
        </p>
        <div className="import-source-list">
          {IMPORT_SOURCES.map((src) => {
            const stat = getStatsForSource(src.id);
            const lastSync = stat?.lastActivityTimestamp
              ? formatDate(stat.lastActivityTimestamp)
              : "Never";
            const convCount = stat?.conversationCount ?? 0;
            const msgCount = stat?.messageCount ?? 0;

            return (
              <div key={src.id} className="import-source-card">
                <div className="import-source-header">
                  <SourceIcon source={src.id} />
                  <div className="import-source-info">
                    <span className="import-source-label">{src.label}</span>
                    <span className="import-source-meta">
                      {convCount} conversations · {msgCount.toLocaleString()} messages
                    </span>
                    <span className="import-source-last">
                      Last sync: {lastSync}
                    </span>
                  </div>
                  <div className="import-source-action">
                    {src.available ? (
                      <button
                        type="button"
                        className="import-source-btn"
                        onClick={() => onImport(src.id)}
                        disabled={importing}
                      >
                        {importing ? "Importing…" : "Import"}
                      </button>
                    ) : (
                      <span className="import-coming-soon">Coming soon</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
