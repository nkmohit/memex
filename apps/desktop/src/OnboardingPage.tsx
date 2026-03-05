import {
  ClaudeIcon,
  ChatGPTIcon,
  GeminiIcon,
  GrokIcon,
  MemexLogoIcon,
} from "./icons";
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

const DROP_COPY: Record<ImportSource, { title: string; hint: string }> = {
  chatgpt: { title: "Drop conversations.json", hint: "or click to browse" },
  claude: { title: "Drop export.json", hint: "or click to browse" },
  gemini: { title: "Drop Takeout folder", hint: "or click to browse" },
  grok: { title: "Drop data export", hint: "or click to browse" },
};

interface OnboardingPageProps {
  onImport: (source: ImportSource) => void;
  importing: boolean;
  importingSource: ImportSource | null;
  onCancelImport: () => void;
  importProgress: {
    conversationsDone: number;
    conversationsTotal: number;
    messagesDone: number;
    messagesTotal?: number;
  } | null;
  onSkip: () => void;
}

export default function OnboardingPage({
  onImport,
  importing,
  importingSource,
  onCancelImport,
  importProgress,
  onSkip,
}: OnboardingPageProps) {
  return (
    <main className="onboarding-root" id="main-content">
      <header className="onboarding-topbar">
        <div className="onboarding-brand">
          <MemexLogoIcon size={28} />
          <span>Memex</span>
        </div>
        <button type="button" className="onboarding-skip ui-btn ui-btn--secondary ui-btn--sm" onClick={onSkip}>
          Skip setup
        </button>
      </header>

      <section className="onboarding-hero">
        <h1>Initialize Your Local Memory</h1>
        <p>
          Your personal archive for every conversation. 100% local-first,
          private, and searchable. We never send your data to the cloud.
        </p>
      </section>

      <section className="onboarding-sources">
        {IMPORT_SOURCES.map((src) => {
          const drop = DROP_COPY[src.id];
          return (
            <div key={src.id} className="onboarding-card">
              <div className="onboarding-card-header">
                <SourceIcon source={src.id} />
                <span className="onboarding-card-title">{src.label}</span>
                <span className="onboarding-card-handle">•••</span>
              </div>
              <div className="onboarding-dropzone">
                <div className="onboarding-drop-icon">Upload</div>
                <div className="onboarding-drop-title">{drop.title}</div>
                <div className="onboarding-drop-hint">{drop.hint}</div>
              </div>
              <div className="onboarding-card-footer">
                <span className="onboarding-card-guide">Export guide →</span>
                {src.available ? (
                  importing && importingSource === src.id ? (
                    <div className="onboarding-import-actions">
                      <span className="onboarding-import-progress">
                        {importProgress
                          ? `${importProgress.messagesDone.toLocaleString()} / ${(importProgress.messagesTotal ?? 0).toLocaleString()} msgs`
                          : "Importing..."}
                      </span>
                      <button
                        type="button"
                        className="onboarding-card-btn ui-btn ui-btn--secondary ui-btn--sm"
                        onClick={onCancelImport}
                      >
                        Cancel import
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="onboarding-card-btn ui-btn ui-btn--primary ui-btn--sm"
                      onClick={() => onImport(src.id)}
                      disabled={importing}
                    >
                      Import
                    </button>
                  )
                ) : (
                  <span className="onboarding-card-soon">Coming soon</span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <div className="onboarding-privacy">
        <span className="onboarding-privacy-icon">Lock</span>
        <span>No data leaves this device.</span>
      </div>
    </main>
  );
}
