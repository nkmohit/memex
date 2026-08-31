import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { getAllConversationsForSearch, searchMessages } from "../db";
import type { SearchResultRow } from "../db";
import type { SearchPageSnapshot } from "../SearchPage";

export function toStartOfDayTimestamp(dateValue: string): number | undefined {
  if (!dateValue) return undefined;
  const date = new Date(`${dateValue}T00:00:00`);
  const ts = date.getTime();
  return Number.isNaN(ts) ? undefined : ts;
}

export function toEndOfDayTimestamp(dateValue: string): number | undefined {
  if (!dateValue) return undefined;
  const date = new Date(`${dateValue}T23:59:59.999`);
  const ts = date.getTime();
  return Number.isNaN(ts) ? undefined : ts;
}

export interface UseSearchPageQueryOptions {
  query: string;
  snapshot: SearchPageSnapshot;
  skipSearchOnceRef?: MutableRefObject<boolean>;
  mode?: "fts" | "semantic" | "hybrid";
}

export function useSearchPageQuery({
  query,
  snapshot,
  skipSearchOnceRef,
  mode,
}: UseSearchPageQueryOptions) {
  const MIN_QUERY_LENGTH = 3;
  const PAGE_SIZE = 50;

  const [source, setSource] = useState(snapshot.source);
  const [dateFrom, setDateFrom] = useState(snapshot.dateFrom);
  const [dateTo, setDateTo] = useState(snapshot.dateTo);
  const [sort, setSort] = useState(snapshot.sort);
  const [results, setResults] = useState<SearchResultRow[]>(snapshot.results);
  const [totalMatches, setTotalMatches] = useState(snapshot.totalMatches);
  const [totalOccurrences, setTotalOccurrences] = useState(snapshot.totalOccurrences ?? 0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(snapshot.latencyMs);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const searchRunIdRef = useRef(0);

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length >= MIN_QUERY_LENGTH;
  const hasAnyQuery = trimmedQuery.length > 0;
  const queryTooShort = hasAnyQuery && !hasQuery;

  const searchParams = useMemo(
    () => ({
      source: source || undefined,
      dateFrom: toStartOfDayTimestamp(dateFrom),
      dateTo: toEndOfDayTimestamp(dateTo),
      sort,
      mode,
    }),
    [source, dateFrom, dateTo, sort, mode]
  );

  useEffect(() => {
    if (skipSearchOnceRef?.current) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const debounceMs = 250;
    const runId = ++searchRunIdRef.current;

    if (queryTooShort) {
      setError(null);
      setLoading(false);
      setLoadingMore(false);
      setResults([]);
      setTotalMatches(0);
      setTotalOccurrences(0);
      setSelectedIndex(-1);
      setLatencyMs(null);
      return;
    }

    async function runSearch() {
      if (queryTooShort) {
        setError(null);
        setLoading(false);
        setLoadingMore(false);
        setResults([]);
        setTotalMatches(0);
        setTotalOccurrences(0);
        setSelectedIndex(-1);
        setLatencyMs(null);
        return;
      }
      if (!hasQuery) {
        setError(null);
        setLoading(true);
        const start = performance.now();
        try {
          const response = await getAllConversationsForSearch({
            ...searchParams,
            limit: PAGE_SIZE,
            offset: 0,
          });
          if (cancelled || searchRunIdRef.current !== runId) return;
          const convertedResults: SearchResultRow[] = response.rows.map((row) => ({
            conversation_id: row.conversation_id,
            title: row.title,
            source: row.source,
            snippet: "",
            snippets: [],
            created_at: row.created_at,
            last_occurrence: row.last_message_at,
            occurrence_count: row.message_count,
            message_match_count: 0,
            rank: 0,
            first_match_message_id: null,
          }));
          setResults(convertedResults);
          setTotalMatches(response.totalMatches);
          setTotalOccurrences(0);
          setSelectedIndex(convertedResults.length > 0 ? 0 : -1);
          setLatencyMs(Math.round(performance.now() - start));
        } catch (err) {
          if (cancelled || searchRunIdRef.current !== runId) return;
          setResults([]);
          setTotalMatches(0);
          setTotalOccurrences(0);
          setSelectedIndex(-1);
          setLatencyMs(null);
          setError(err instanceof Error ? err.message : "Failed to load conversations");
        } finally {
          if (!cancelled && searchRunIdRef.current === runId) {
            setLoading(false);
            setLoadingMore(false);
          }
        }
        return;
      }

      setError(null);
      setLoading(true);
      const start = performance.now();
      try {
        const response = await searchMessages(query, {
          ...searchParams,
          limit: PAGE_SIZE,
          offset: 0,
        });
        if (cancelled || searchRunIdRef.current !== runId) return;
        setResults(response.rows);
        setTotalMatches(response.totalMatches);
        setTotalOccurrences(response.totalOccurrences ?? 0);
        setSelectedIndex(response.rows.length > 0 ? 0 : -1);
        setLatencyMs(Math.round(performance.now() - start));
      } catch (err) {
        if (cancelled || searchRunIdRef.current !== runId) return;
        setResults([]);
        setTotalMatches(0);
        setTotalOccurrences(0);
        setSelectedIndex(-1);
        setLatencyMs(null);
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (!cancelled && searchRunIdRef.current === runId) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }

    setLoading(true);
    const timeoutId = window.setTimeout(() => {
      void runSearch();
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [PAGE_SIZE, hasQuery, query, queryTooShort, searchParams, skipSearchOnceRef]);

  // Keep selectedIndex in sync when results change externally (e.g., snapshot init)
  useEffect(() => {
    setSelectedIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  async function handleLoadMore() {
    if (loading || loadingMore || results.length >= totalMatches) return;
    setLoadingMore(true);
    setError(null);
    const runId = searchRunIdRef.current;
    try {
      if (!hasQuery) {
        const response = await getAllConversationsForSearch({
          ...searchParams,
          limit: PAGE_SIZE,
          offset: results.length,
        });
        const convertedResults: SearchResultRow[] = response.rows.map((row) => ({
          conversation_id: row.conversation_id,
          title: row.title,
          source: row.source,
          snippet: "",
          snippets: [],
          created_at: row.created_at,
          last_occurrence: row.last_message_at,
          occurrence_count: row.message_count,
          message_match_count: 0,
          rank: 0,
          first_match_message_id: null,
        }));
        if (searchRunIdRef.current !== runId) return;
        setResults((prev) => [...prev, ...convertedResults]);
        setTotalMatches(response.totalMatches);
      } else {
        const response = await searchMessages(query, {
          ...searchParams,
          limit: PAGE_SIZE,
          offset: results.length,
        });
        if (searchRunIdRef.current !== runId) return;
        setResults((prev) => [...prev, ...response.rows]);
        setTotalMatches(response.totalMatches);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoadingMore(false);
    }
  }

  return {
    // filters
    source,
    setSource,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    sort,
    setSort,
    // results
    results,
    setResults,
    totalMatches,
    setTotalMatches,
    totalOccurrences,
    setTotalOccurrences,
    loading,
    setLoading,
    loadingMore,
    error,
    setError,
    latencyMs,
    setLatencyMs,
    selectedIndex,
    setSelectedIndex,
    // derived
    hasQuery,
    queryTooShort,
    searchParams,
    searchRunIdRef,
    PAGE_SIZE,
    MIN_QUERY_LENGTH,
    handleLoadMore,
  };
}
