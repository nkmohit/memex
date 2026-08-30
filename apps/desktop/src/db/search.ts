import { getDb, withDbLock } from "./connection";
import { escapeLikePattern, normalizeQuery } from "./helpers";
import type { SearchMessagesResult, SearchOptions, SearchResultRow } from "./types";
import { clampLimit, clampOffset, sanitizeSource } from "../lib/validation";

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

  // Input length guard (validation layer)
  if (rawQuery.length > 500) {
    return Promise.resolve({ rows: [], totalMatches: 0, totalOccurrences: 0 });
  }

  return withDbLock(async () => {
    const database = await getDb();

    const safeLimit = clampLimit(opts.limit, 20, 100);
    const safeOffset = clampOffset(opts.offset);
    const sort = opts.sort ?? "last_occurrence_desc";
    const validatedSource = sanitizeSource(opts.source);
    const titleLikeParam = `%${escapeLikePattern(rawQuery.toLowerCase())}%`;

    let whereClause = "messages_fts MATCH $1";
    const rawQueryLower = rawQuery.toLowerCase();
    const params: unknown[] = [normalizedQuery, titleLikeParam, rawQueryLower];
    let paramIndex = 4;

    if (validatedSource) {
      whereClause += ` AND c.source = $${paramIndex}`;
      params.push(validatedSource);
      paramIndex += 1;
    }

    if (typeof opts.dateFrom === "number") {
      whereClause += ` AND COALESCE(m.created_at, 0) >= $${paramIndex}`;
      params.push(opts.dateFrom);
      paramIndex += 1;
    }

    if (typeof opts.dateTo === "number") {
      whereClause += ` AND COALESCE(m.created_at, 0) <= $${paramIndex}`;
      params.push(opts.dateTo);
      paramIndex += 1;
    }

    const countSql = `SELECT COUNT(DISTINCT messages_fts.conversation_id) AS total
      FROM messages_fts
      JOIN conversations c ON c.id = messages_fts.conversation_id
      JOIN messages m ON m.id = messages_fts.message_id
      WHERE ${whereClause}`;

    const totalOccurrencesSql = `SELECT COALESCE(CAST(SUM(
        (LENGTH(LOWER(m.content)) - LENGTH(REPLACE(LOWER(m.content), $3, ''))) / NULLIF(LENGTH($3), 0)
      ) AS INTEGER), 0) AS total
      FROM messages_fts
      JOIN conversations c ON c.id = messages_fts.conversation_id
      JOIN messages m ON m.id = messages_fts.message_id
      WHERE ${whereClause}`;

    let orderBy = "last_occurrence DESC, rank ASC";
    if (sort === "relevance") {
      orderBy = "rank ASC, last_occurrence DESC";
    } else if (sort === "occurrence_count_desc") {
      orderBy = "occurrence_count DESC, rank ASC";
    } else if (sort === "title_az") {
      orderBy = "title COLLATE NOCASE ASC, rank ASC";
    } else if (sort === "title_za") {
      orderBy = "title COLLATE NOCASE DESC, rank ASC";
    }

    const rowsSql = `WITH ranked_rows AS (
        SELECT
          c.id AS conversation_id,
          COALESCE(c.title, 'Untitled') AS title,
          c.source AS source,
          COALESCE(c.created_at, 0) AS created_at,
          COALESCE(m.created_at, 0) AS message_created_at,
          m.id AS message_id,
          (LENGTH(LOWER(m.content)) - LENGTH(REPLACE(LOWER(m.content), $3, ''))) / NULLIF(LENGTH($3), 0) AS occurrence_in_message,
          CASE
            WHEN LOWER(COALESCE(c.title, '')) LIKE $2 ESCAPE '\\' THEN -5.0
            ELSE 0.0
          END AS title_boost
        FROM messages_fts
        JOIN conversations c ON c.id = messages_fts.conversation_id
        JOIN messages m ON m.id = messages_fts.message_id
        WHERE ${whereClause}
      ),
      grouped AS (
        SELECT
          conversation_id,
          title,
          source,
          created_at,
          MAX(message_created_at) AS last_occurrence,
          CAST(SUM(occurrence_in_message) AS INTEGER) AS occurrence_count,
          COUNT(DISTINCT message_id) AS message_match_count,
          (-1.0 * SUM(occurrence_in_message)) + MIN(title_boost) AS rank,
          (SELECT message_id FROM ranked_rows r2
           WHERE r2.conversation_id = ranked_rows.conversation_id
           ORDER BY r2.message_created_at ASC
           LIMIT 1) AS first_match_message_id
        FROM ranked_rows
        GROUP BY conversation_id, title, source, created_at
      )
      SELECT
        conversation_id,
        title,
        source,
        created_at,
        COALESCE(last_occurrence, 0) AS last_occurrence,
        occurrence_count,
        message_match_count,
        rank,
        first_match_message_id
      FROM grouped
      ORDER BY ${orderBy}
      LIMIT ${safeLimit}
      OFFSET ${safeOffset}`;

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
      let snippetWhereClause = "messages_fts MATCH $1 AND messages_fts.conversation_id = $2";
      const snippetParams: unknown[] = [normalizedQuery, row.conversation_id];
      let snippetParamIndex = 3;

      if (typeof opts.dateFrom === "number") {
        snippetWhereClause += ` AND COALESCE(m.created_at, 0) >= $${snippetParamIndex}`;
        snippetParams.push(opts.dateFrom);
        snippetParamIndex += 1;
      }
      if (typeof opts.dateTo === "number") {
        snippetWhereClause += ` AND COALESCE(m.created_at, 0) <= $${snippetParamIndex}`;
        snippetParams.push(opts.dateTo);
      }

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
  });
}
