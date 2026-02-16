import type React from "react";
import type { ThemeMode } from "../hooks/useThemeMode";

type SettingsPanelProps = {
  theme: ThemeMode;
  onSetTheme: (mode: ThemeMode) => void;
  clearResult: string | null;
  clearError: string | null;
  clearingData: boolean;
  importing: boolean;
  loading: boolean;
  onClearAllDataClick: () => void;
  clearDataTriggerRef: React.RefObject<HTMLButtonElement | null>;
};

export default function SettingsPanel({
  theme,
  onSetTheme,
  clearResult,
  clearError,
  clearingData,
  importing,
  loading,
  onClearAllDataClick,
  clearDataTriggerRef,
}: SettingsPanelProps) {
  return (
    <main className="settings-main" id="main-content">
      <h1 className="settings-title">Settings</h1>
      {(clearResult || clearError) && (
        <div className="settings-banners">
          {clearResult && (
            <div className="banner success" role="status">
              {clearResult}
            </div>
          )}
          {clearError && (
            <div className="banner error" role="alert">
              {clearError}
            </div>
          )}
        </div>
      )}
      <div className="settings-section">
        <h2>Theme</h2>
        <div className="settings-theme-options">
          {(["light", "dark", "system"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`settings-theme-option ${theme === mode ? "selected" : ""}`}
              onClick={() => onSetTheme(mode)}
            >
              {theme === mode && <span aria-hidden>●</span>}
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="settings-section">
        <h2>Data</h2>
        <button
          ref={clearDataTriggerRef}
          type="button"
          className="settings-danger-btn"
          onClick={onClearAllDataClick}
          disabled={importing || clearingData || loading}
        >
          {clearingData ? "Clearing..." : "Clear all data"}
        </button>
      </div>
    </main>
  );
}
