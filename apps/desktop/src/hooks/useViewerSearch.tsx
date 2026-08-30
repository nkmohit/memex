import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MessageRow } from "../db";

export function useViewerSearch(
  messages: MessageRow[],
  prefersReducedMotion: boolean,
  messageRefs: React.MutableRefObject<Record<string, HTMLElement | null>>
) {
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [messageSearchMatchIndex, setMessageSearchMatchIndex] = useState(0);
  const [viewerSearchOpen, setViewerSearchOpen] = useState(false);
  const [viewerMenuOpen, setViewerMenuOpen] = useState(false);
  const viewerSearchInputRef = useRef<HTMLInputElement>(null);
  const viewerMenuRef = useRef<HTMLDivElement>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const occurrences = useMemo(() => {
    if (!messageSearchQuery.trim()) return [];
    const escaped = messageSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "gi");
    const result: { messageId: string; localIndex: number }[] = [];
    for (const m of messages) {
      re.lastIndex = 0;
      let count = 0;
      while (re.exec(m.content) !== null) {
        result.push({ messageId: m.id, localIndex: count });
        count += 1;
      }
    }
    return result;
  }, [messages, messageSearchQuery]);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? <mark key={i}>{part}</mark> : part
    );
  };

  const matchCount = occurrences.length;
  const messageMatchCount = useMemo(
    () => new Set(occurrences.map((o) => o.messageId)).size,
    [occurrences]
  );
  const currentMatchIndex = Math.min(messageSearchMatchIndex, Math.max(0, matchCount - 1));

  const goToPrevMatch = useCallback(() => {
    if (matchCount <= 0) return;
    setMessageSearchMatchIndex((i) => (i <= 0 ? matchCount - 1 : i - 1));
  }, [matchCount]);

  const goToNextMatch = useCallback(() => {
    if (matchCount <= 0) return;
    setMessageSearchMatchIndex((i) => (i >= matchCount - 1 ? 0 : i + 1));
  }, [matchCount]);

  useEffect(() => {
    setMessageSearchMatchIndex(0);
    if (!messageSearchQuery.trim()) setHighlightedMessageId(null);
  }, [messageSearchQuery, matchCount]);

  useEffect(() => {
    if (!viewerSearchOpen || !messageSearchQuery.trim()) return;
    Object.values(messageRefs.current).forEach((msgEl) => {
      msgEl?.querySelectorAll("mark").forEach((m) => m.classList.remove("current-match"));
    });
    if (matchCount === 0) return;
    const occ = occurrences[currentMatchIndex];
    if (!occ) return;
    setHighlightedMessageId(occ.messageId);
    const el = messageRefs.current[occ.messageId];
    if (el) {
      const marks = el.querySelectorAll("mark");
      const mark = marks[occ.localIndex] ?? marks[0];
      if (mark) mark.classList.add("current-match");
      (mark || el).scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
      });
    }
  }, [
    viewerSearchOpen,
    messageSearchQuery,
    currentMatchIndex,
    matchCount,
    occurrences,
    prefersReducedMotion,
    messageRefs,
  ]);

  useEffect(() => {
    if (viewerSearchOpen) {
      const id = setTimeout(() => {
        viewerSearchInputRef.current?.focus();
        viewerSearchInputRef.current?.select();
      }, 0);
      return () => clearTimeout(id);
    }
  }, [viewerSearchOpen]);

  useEffect(() => {
    if (!viewerMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (viewerMenuRef.current && !viewerMenuRef.current.contains(e.target as Node)) {
        setViewerMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [viewerMenuOpen]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const inViewer = (e.target as Node)?.parentElement?.closest(".viewer");
      if (!inViewer) return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (viewerMenuOpen) {
          setViewerMenuOpen(false);
          return;
        }
        if (viewerSearchOpen) {
          const searchInput = viewerSearchInputRef.current;
          if (searchInput) {
            searchInput.blur();
            searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
          }
          setViewerSearchOpen(false);
        }
        return;
      }

      if (!viewerSearchOpen || !messageSearchQuery.trim() || matchCount <= 0) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        goToPrevMatch();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        goToNextMatch();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) goToPrevMatch();
        else goToNextMatch();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    viewerSearchOpen,
    messageSearchQuery,
    matchCount,
    goToPrevMatch,
    goToNextMatch,
    viewerMenuOpen,
  ]);

  return {
    messageSearchQuery,
    setMessageSearchQuery,
    messageSearchMatchIndex,
    setMessageSearchMatchIndex,
    viewerSearchOpen,
    setViewerSearchOpen,
    viewerMenuOpen,
    setViewerMenuOpen,
    viewerSearchInputRef,
    viewerMenuRef,
    highlightedMessageId,
    setHighlightedMessageId,
    occurrences,
    highlightText,
    matchCount,
    messageMatchCount,
    currentMatchIndex,
    goToPrevMatch,
    goToNextMatch,
  };
}
