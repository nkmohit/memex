import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  toStartOfDayTimestamp,
  toEndOfDayTimestamp,
  useSearchPageQuery,
} from "./useSearchPageQuery";
import type { SearchPageSnapshot } from "../SearchPage";

vi.mock("../db", async () => {
  const actual = await vi.importActual("../db");
  return {
    ...(actual as object),
    searchMessages: vi.fn(async () => ({ rows: [], totalMatches: 0, totalOccurrences: 0 })),
    getAllConversationsForSearch: vi.fn(async () => ({ rows: [], totalMatches: 0 })),
  };
});

import { searchMessages, getAllConversationsForSearch } from "../db";

describe("toStartOfDayTimestamp / toEndOfDayTimestamp", () => {
  it("returns undefined for empty", () => {
    expect(toStartOfDayTimestamp("")).toBeUndefined();
    expect(toEndOfDayTimestamp("")).toBeUndefined();
  });
  it("parses valid date", () => {
    expect(toStartOfDayTimestamp("2024-01-15")).toBe(new Date("2024-01-15T00:00:00").getTime());
    expect(toEndOfDayTimestamp("2024-01-15")).toBe(new Date("2024-01-15T23:59:59.999").getTime());
  });
  it("returns undefined for invalid", () => {
    expect(toStartOfDayTimestamp("invalid")).toBeUndefined();
    expect(toEndOfDayTimestamp("not-a-date")).toBeUndefined();
  });
});

function makeSnapshot(overrides: Partial<SearchPageSnapshot> = {}): SearchPageSnapshot {
  return {
    source: "",
    dateFrom: "",
    dateTo: "",
    sort: "last_occurrence_desc",
    results: [],
    totalMatches: 0,
    totalOccurrences: 0,
    latencyMs: null,
    ...overrides,
  };
}

describe("useSearchPageQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("queryTooShort when 1-2 chars", async () => {
    const { result } = renderHook(() =>
      useSearchPageQuery({ query: "ab", snapshot: makeSnapshot() })
    );
    expect(result.current.queryTooShort).toBe(true);
    expect(result.current.hasQuery).toBe(false);
  });

  it("hasQuery when >=3 chars", async () => {
    const { result } = renderHook(() =>
      useSearchPageQuery({ query: "hello", snapshot: makeSnapshot() })
    );
    expect(result.current.hasQuery).toBe(true);
    expect(result.current.queryTooShort).toBe(false);
  });

  it("debounces searchMessages for query >=3", async () => {
    const mockedSearch = vi.mocked(searchMessages);
    mockedSearch.mockResolvedValue({
      rows: [
        {
          conversation_id: "c1",
          title: "t",
          source: "claude",
          snippet: "",
          snippets: [],
          created_at: 0,
          last_occurrence: 0,
          occurrence_count: 1,
          message_match_count: 1,
          rank: 0,
          first_match_message_id: null,
        },
      ],
      totalMatches: 1,
      totalOccurrences: 1,
    });
    const { result } = renderHook(() =>
      useSearchPageQuery({ query: "hello world", snapshot: makeSnapshot() })
    );
    expect(mockedSearch).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
      await Promise.resolve();
    });
    // after debounce, search should have been called at least once
    // use runAllTimers to flush
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(mockedSearch).toHaveBeenCalled();
    expect(result.current.loading).toBeDefined();
  });

  it("loads all conversations when no query (browse mode)", async () => {
    const mockedAll = vi.mocked(getAllConversationsForSearch);
    mockedAll.mockResolvedValue({
      rows: [
        {
          conversation_id: "c1",
          title: "t",
          source: "claude",
          created_at: 0,
          last_message_at: 100,
          message_count: 2,
        },
      ],
      totalMatches: 1,
    });
    renderHook(() => useSearchPageQuery({ query: "", snapshot: makeSnapshot() }));
    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(mockedAll).toHaveBeenCalled();
  });

  it("exposes handleLoadMore", async () => {
    const { result } = renderHook(() =>
      useSearchPageQuery({ query: "hi", snapshot: makeSnapshot() })
    );
    expect(typeof result.current.handleLoadMore).toBe("function");
  });

  it("skipSearchOnceRef skips search", async () => {
    const mockedSearch = vi.mocked(searchMessages);
    const ref = { current: true };
    renderHook(() =>
      useSearchPageQuery({ query: "hello", snapshot: makeSnapshot(), skipSearchOnceRef: ref })
    );
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(mockedSearch).not.toHaveBeenCalled();
  });
});
