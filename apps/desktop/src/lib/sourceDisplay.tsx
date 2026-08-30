/* eslint-disable react-refresh/only-export-components */
import { IMPORT_SOURCES } from "../importer";

export function sourceLabel(source: string): string {
  const meta = IMPORT_SOURCES.find((s) => s.id === source);
  return meta?.label ?? source.charAt(0).toUpperCase() + source.slice(1);
}

export function SourceIcon({ source }: { source: string }) {
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
