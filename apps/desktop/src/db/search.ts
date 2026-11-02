import { getDb, withDbLock } from "./connection";
import { normalizeQuery } from "./helpers";
import type { SearchMessagesResult, SearchOptions, SearchResultRow } from "./types";
import { clampLimit, clampOffset } from "../lib/validation";
import { logger } from "../lib/logger";
import { validateSearchOptions } from "../lib/schemas";

import {
  buildCountSql,
  buildFtsWhereClause,
  buildOrderBy,
  buildRankedRowsSql,
  buildSnippetWhereClause,
  buildTotalOccurrencesSql,
} from "./searchQueryBuilder";

export function searchMessages(
  query: string,
  opts: SearchOptions = {}
): Promise<SearchMessagesResult> {
  const rawQuery = query.trim();
  if (!rawQuery) {
    return Promise.resolve({ rows: [], totalMatches: 0, totalOccurrences: 0 });
  }
  const normalizedQuery = normalizeQuery(rawQuery);
  if (!normalizedQuery) {
    return Promise.resolve({ rows: [], totalMatches: 0, totalOccurrences: 0 });
  }

  if (rawQuery.length > 500) {
    return Promise.resolve({ rows: [], totalMatches: 0, totalOccurrences: 0 });
  }

  let validatedOpts: SearchOptions;
  try {
    const parsed = validateSearchOptions(opts);
    validatedOpts = {
      source: parsed.source,
      dateFrom: parsed.dateFrom,
      dateTo: parsed.dateTo,
      limit: parsed.limit,
      offset: parsed.offset,
      sort: parsed.sort as SearchOptions["sort"],
    };
  } catch {
    validatedOpts = {};
  }

  return logger.withSpan("searchMessages", () =>
    withDbLock(async () => {
      const database = await getDb();

      const safeLimit = clampLimit(validatedOpts.limit, 20, 100);
      const safeOffset = clampOffset(validatedOpts.offset);
      const { whereClause, params } = buildFtsWhereClause(rawQuery, normalizedQuery, validatedOpts);

      const countSql = buildCountSql(whereClause);
      const totalOccurrencesSql = buildTotalOccurrencesSql(whereClause);
      const orderBy = buildOrderBy(validatedOpts.sort);
      const rowsSql = buildRankedRowsSql(whereClause, orderBy, safeLimit, safeOffset);

      const countRows = await database.select<{ total: number }[]>(countSql, params);
      const totalOccurrencesRows = await database.select<{ total: number }[]>(
        totalOccurrencesSql,
        params
      );
      const rawRows = await database.select<Omit<SearchResultRow, "snippet" | "snippets">[]>(
        rowsSql,
        params
      );
      const rows: SearchResultRow[] = [];

      for (const row of rawRows) {
        const { whereClause: snippetWhereClause, params: snippetParams } = buildSnippetWhereClause(
          normalizedQuery,
          row.conversation_id,
          validatedOpts
        );

        const snippetRows = await database.select<{ snippet: string }[]>(
          `SELECT snippet(messages_fts, 0, '<mark>', '</mark>', '...', 10) AS snippet
         FROM messages_fts
         JOIN messages m ON m.id = messages_fts.message_id
         WHERE ${snippetWhereClause}
         ORDER BY COALESCE(m.created_at, 0) DESC
         LIMIT 3`,
          snippetParams
        );

        const snippets = snippetRows.map((snippetRow) => snippetRow.snippet.trim()).filter(Boolean);

        rows.push({
          conversation_id: row.conversation_id,
          title: row.title,
          source: row.source,
          snippet: snippets[0] ?? "",
          snippets,
          created_at: row.created_at,
          last_occurrence: row.last_occurrence,
          occurrence_count: row.occurrence_count,
          message_match_count: row.message_match_count,
          rank: row.rank,
          first_match_message_id: row.first_match_message_id,
        });
      }

      return {
        rows,
        totalMatches: countRows[0]?.total ?? 0,
        totalOccurrences: totalOccurrencesRows[0]?.total ?? 0,
      };
    })
  );
}
