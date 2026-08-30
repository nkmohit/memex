import { useEffect, useRef, useState } from "react";
import type { ConversationRow } from "../db";
import { usePersistedSearchState } from "./usePersistedSearchState";

export function useSearchSession(activeView: string) {
  const {
    query: searchPageQuery,
    setQuery: setSearchPageQuery,
    snapshot: searchPageSnapshot,
    setSnapshot: setSearchPageSnapshot,
    clearPersistedState: clearPersistedSearchState,
  } = usePersistedSearchState();

  const [searchFocusRequestId, setSearchFocusRequestId] = useState<number | null>(null);
  const [openedConversationFromSearch, setOpenedConversationFromSearch] = useState(false);
  const [searchRestoreConversationId, setSearchRestoreConversationId] = useState<string | null>(
    null
  );
  const [searchSelectedConvId, setSearchSelectedConvId] = useState<string | null>(null);
  const [searchSelectedConversation, setSearchSelectedConversation] =
    useState<ConversationRow | null>(null);
  const skipSearchOnceRef = useRef(false);

  useEffect(() => {
    if (activeView === "search") {
      const id = window.setTimeout(() => {
        skipSearchOnceRef.current = false;
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [activeView]);

  return {
    searchPageQuery,
    setSearchPageQuery,
    searchPageSnapshot,
    setSearchPageSnapshot,
    clearPersistedSearchState,
    searchFocusRequestId,
    setSearchFocusRequestId,
    openedConversationFromSearch,
    setOpenedConversationFromSearch,
    searchRestoreConversationId,
    setSearchRestoreConversationId,
    searchSelectedConvId,
    setSearchSelectedConvId,
    searchSelectedConversation,
    setSearchSelectedConversation,
    skipSearchOnceRef,
  };
}
