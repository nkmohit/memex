import { useEffect, useState } from "react";
import type { SearchPageSnapshot } from "../SearchPage";

const SEARCH_STATE_KEY = "memex-search-state";

type PersistedSearchState = {
  query: string;
  source: string;
  dateFrom: string;
  dateTo: string;
  sort: SearchPageSnapshot["sort"];
};

function loadSearchState(): Partial<PersistedSearchState> | null {
  try {
    const raw = localStorage.getItem(SEARCH_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && "query" in parsed) {
      const p = parsed as Record<string, unknown>;
      return {
        query: typeof p.query === "string" ? p.query : "",
        source: typeof p.source === "string" ? p.source : "",
        dateFrom: typeof p.dateFrom === "string" ? p.dateFrom : "",
        dateTo: typeof p.dateTo === "string" ? p.dateTo : "",
        sort:
          typeof p.sort === "string" &&
          ["relevance", "last_occurrence_desc", "occurrence_count_desc", "title_az", "title_za"].includes(p.sort)
            ? (p.sort as PersistedSearchState["sort"])
            : "last_occurrence_desc",
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function saveSearchState(state: PersistedSearchState) {
  try {
    localStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function usePersistedSearchState() {
  const [query, setQuery] = useState(() => loadSearchState()?.query ?? "");
  const [snapshot, setSnapshot] = useState<SearchPageSnapshot>(() => {
    const loaded = loadSearchState();
    return {
      source: loaded?.source ?? "",
      dateFrom: loaded?.dateFrom ?? "",
      dateTo: loaded?.dateTo ?? "",
      sort: loaded?.sort ?? "last_occurrence_desc",
      results: [],
      totalMatches: 0,
      totalOccurrences: 0,
      latencyMs: null,
    };
  });

  useEffect(() => {
    saveSearchState({
      query,
      source: snapshot.source,
      dateFrom: snapshot.dateFrom,
      dateTo: snapshot.dateTo,
      sort: snapshot.sort,
    });
  }, [query, snapshot.source, snapshot.dateFrom, snapshot.dateTo, snapshot.sort]);

  function clearPersistedState() {
    setQuery("");
    setSnapshot({
      source: "",
      dateFrom: "",
      dateTo: "",
      sort: "last_occurrence_desc",
      results: [],
      totalMatches: 0,
      totalOccurrences: 0,
      latencyMs: null,
    });
    saveSearchState({
      query: "",
      source: "",
      dateFrom: "",
      dateTo: "",
      sort: "last_occurrence_desc",
    });
  }

  return {
    query,
    setQuery,
    snapshot,
    setSnapshot,
    clearPersistedState,
  };
}

