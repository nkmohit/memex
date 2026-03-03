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
  onSkip: () => void;
}

export default function OnboardingPage({
  onImport,
  importing,
  importingSource,
  onSkip,
}: OnboardingPageProps) {
  return (
    <main className="onboarding-root" id="main-content">
      <header className="onboarding-topbar">
        <div className="onboarding-brand">
          <MemexLogoIcon size={28} />
          <span>Memex</span>
        </div>
        <button type="button" className="onboarding-skip" onClick={onSkip}>
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
                  <button
                    type="button"
                    className="onboarding-card-btn"
                    onClick={() => onImport(src.id)}
                    disabled={importing}
                  >
                    {importing && importingSource === src.id ? "Importing…" : "Import"}
                  </button>
                ) : (
                  <span className="onboarding-card-soon">Coming soon</span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="onboarding-status">
        <div className="onboarding-status-left">
          <div className="onboarding-status-icon">Sync</div>
          <div>
            <div className="onboarding-status-title">Ready to index</div>
            <div className="onboarding-status-sub">No files selected yet</div>
          </div>
        </div>
        <button type="button" className="onboarding-status-btn" disabled>
          Start Indexing
        </button>
      </section>

      <div className="onboarding-privacy">
        <span className="onboarding-privacy-icon">Lock</span>
        <span>No data leaves this device.</span>
      </div>
    </main>
  );
}
