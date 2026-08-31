import { useEffect, useState } from "react";
import type { ThemeMode } from "../hooks/useThemeMode";
import { getFlags, setFlag, type FlagName } from "../lib/flags";

type SettingsPanelProps = {
  theme: ThemeMode;
  onSetTheme: (mode: ThemeMode) => void;
  clearingData: boolean;
  importing: boolean;
  loading: boolean;
  onClearAllDataClick: () => void;
  clearDataTriggerRef: React.RefObject<HTMLButtonElement | null>;
};

export default function SettingsPanel({
  theme,
  onSetTheme,
  clearingData,
  importing,
  loading,
  onClearAllDataClick,
  clearDataTriggerRef,
}: SettingsPanelProps) {
  const [flags, setFlagsState] = useState(() => getFlags());

  useEffect(() => {
    setFlagsState(getFlags());
  }, []);

  const toggleFlag = (name: FlagName) => {
    const next = !flags[name];
    setFlag(name, next);
    setFlagsState((prev) => ({ ...prev, [name]: next }));
  };

  const flagLabels: Record<FlagName, string> = {
    semanticSearch: "Semantic search (hybrid FTS + vector)",
    vector: "Vector embeddings",
    summarize: "Offline summarize (Insights)",
    plugins: "Plugins",
    topicTimeline: "Topic timeline",
  };

  return (
    <main className="settings-main" id="main-content">
      <h1 className="settings-title">Settings</h1>
      <div className="settings-section">
        <h2>Theme</h2>
        <div className="settings-theme-options">
          {(["light", "dark", "system"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`settings-theme-option ui-btn ui-btn--secondary ${theme === mode ? "selected" : ""}`}
              onClick={() => onSetTheme(mode)}
            >
              {theme === mode && <span aria-hidden>●</span>}
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="settings-section">
        <h2>Feature flags</h2>
        <p className="settings-hint">Gated rollout — toggle semantic, summarize, topics.</p>
        <div className="settings-flags">
          {(Object.keys(flagLabels) as FlagName[]).map((name) => (
            <label key={name} className="settings-flag-row">
              <input
                type="checkbox"
                checked={flags[name]}
                onChange={() => toggleFlag(name)}
                aria-label={flagLabels[name]}
              />
              <span>{flagLabels[name]}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="settings-section">
        <h2>Data</h2>
        <button
          ref={clearDataTriggerRef}
          type="button"
          className="settings-danger-btn ui-btn ui-btn--danger"
          onClick={onClearAllDataClick}
          disabled={importing || clearingData || loading}
        >
          {clearingData ? "Clearing..." : "Clear all data"}
        </button>
      </div>
    </main>
  );
}
