import { useEffect, useRef, useState } from "react";
import { formatTimestamp } from "../utils";
import type { MessageRow } from "../db";

export function useCopyClipboard() {
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const copyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copyToClipboard(text: string): Promise<boolean> {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  function showCopyToast(message: string) {
    if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
    setCopyToast(message);
    copyToastTimerRef.current = setTimeout(() => {
      setCopyToast(null);
      copyToastTimerRef.current = null;
    }, 2000);
  }

  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
    };
  }, []);

  function copyMessageToClipboard(m: MessageRow, assistantLabel: string) {
    const sender = m.sender === "human" ? "You" : assistantLabel;
    const line = `${sender} (${formatTimestamp(m.created_at)}): ${m.content}`;
    copyToClipboard(line).then((ok) => ok && showCopyToast("Copied"));
  }

  function copyConversationToClipboard(messages: MessageRow[], assistantLabel: string) {
    const lines = messages.map((m) => {
      const sender = m.sender === "human" ? "You" : assistantLabel;
      const ts = formatTimestamp(m.created_at);
      return `**${sender}** (${ts}):\n\n${m.content}`;
    });
    const text = lines.join("\n\n");
    copyToClipboard(text).then((ok) => ok && showCopyToast("Copied"));
  }

  return {
    copyToast,
    copyToClipboard,
    showCopyToast,
    copyMessageToClipboard,
    copyConversationToClipboard,
  };
}
