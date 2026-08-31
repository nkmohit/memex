import { getDb, withDbLock } from "./connection";
import { escapeLikePattern, normalizeQuery } from "./helpers";
import type { SearchMessagesResult, SearchOptions, SearchResultRow } from "./types";
import { clampLimit, clampOffset, sanitizeSource } from "../lib/validation";
import { cosineSimilarity, embed } from "../lib/vector";
import { logger } from "../lib/logger";

async function runFtsSearch(
  database: Awaited<ReturnType<typeof getDb>>,
  rawQuery: string,
  normalizedQuery: string,
  opts: SearchOptions
): Promise<SearchMessagesResult> {
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
  let orderBy = "last_occurrence DESC, rank ASC";
  if (sort === "relevance") orderBy = "rank ASC, last_occurrence DESC";
  else if (sort === "occurrence_count_desc") orderBy = "occurrence_count DESC, rank ASC";
  else if (sort === "title_az") orderBy = "title COLLATE NOCASE ASC, rank ASC";
  else if (sort === "title_za") orderBy = "title COLLATE NOCASE DESC, rank ASC";

  const rowsSql = `WITH ranked_rows AS (
        SELECT
          c.id AS conversation_id,
          COALESCE(c.title, 'Untitled') AS title,
          c.source AS source,
          COALESCE(c.created_at, 0) AS created_at,
          COALESCE(m.created_at, 0) AS message_created_at,
          m.id AS message_id,
          (LENGTH(LOWER(m.content)) - LENGTH(REPLACE(LOWER(m.content), $3, ''))) / NULLIF(LENGTH($3), 0) AS occurrence_in_message,
          CASE WHEN LOWER(COALESCE(c.title, '')) LIKE $2 ESCAPE '\\' THEN -5.0 ELSE 0.0 END AS title_boost
        FROM messages_fts
        JOIN conversations c ON c.id = messages_fts.conversation_id
        JOIN messages m ON m.id = messages_fts.message_id
        WHERE ${whereClause}
      ),
      grouped AS (
        SELECT conversation_id, title, source, created_at,
          MAX(message_created_at) AS last_occurrence,
          CAST(SUM(occurrence_in_message) AS INTEGER) AS occurrence_count,
          COUNT(DISTINCT message_id) AS message_match_count,
          (-1.0 * SUM(occurrence_in_message)) + MIN(title_boost) AS rank,
          (SELECT message_id FROM ranked_rows r2 WHERE r2.conversation_id = ranked_rows.conversation_id ORDER BY r2.message_created_at ASC LIMIT 1) AS first_match_message_id
        FROM ranked_rows GROUP BY conversation_id, title, source, created_at
      )
      SELECT conversation_id, title, source, created_at, COALESCE(last_occurrence, 0) AS last_occurrence,
        occurrence_count, message_match_count, rank, first_match_message_id
      FROM grouped ORDER BY ${orderBy} LIMIT ${safeLimit} OFFSET ${safeOffset}`;

  const countSql = `SELECT COUNT(DISTINCT messages_fts.conversation_id) AS total FROM messages_fts JOIN conversations c ON c.id = messages_fts.conversation_id JOIN messages m ON m.id = messages_fts.message_id WHERE ${whereClause}`;
  const totalOccSql = `SELECT COALESCE(CAST(SUM((LENGTH(LOWER(m.content)) - LENGTH(REPLACE(LOWER(m.content), $3, ''))) / NULLIF(LENGTH($3), 0)) AS INTEGER), 0) AS total FROM messages_fts JOIN conversations c ON c.id = messages_fts.conversation_id JOIN messages m ON m.id = messages_fts.message_id WHERE ${whereClause}`;
  const countRows = await database.select<{ total: number }[]>(countSql, params);
  const totalOccRows = await database.select<{ total: number }[]>(totalOccSql, params);
  const rawRows = await database.select<Omit<SearchResultRow, "snippet" | "snippets">[]>(
    rowsSql,
    params
  );
  const rows: SearchResultRow[] = [];
  for (const row of rawRows) {
    let snippetWhere = "messages_fts MATCH $1 AND messages_fts.conversation_id = $2";
    const snippetParams: unknown[] = [normalizedQuery, row.conversation_id];
    let idx = 3;
    if (typeof opts.dateFrom === "number") {
      snippetWhere += ` AND COALESCE(m.created_at, 0) >= $${idx}`;
      snippetParams.push(opts.dateFrom);
      idx += 1;
    }
    if (typeof opts.dateTo === "number") {
      snippetWhere += ` AND COALESCE(m.created_at, 0) <= $${idx}`;
      snippetParams.push(opts.dateTo);
    }
    const snippetRows = await database.select<{ snippet: string }[]>(
      `SELECT snippet(messages_fts, 0, '<mark>', '</mark>', '...', 10) AS snippet FROM messages_fts JOIN messages m ON m.id = messages_fts.message_id WHERE ${snippetWhere} ORDER BY COALESCE(m.created_at, 0) DESC LIMIT 3`,
      snippetParams
    );
    const snippets = snippetRows.map((r) => r.snippet.trim()).filter(Boolean);
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
    totalOccurrences: totalOccRows[0]?.total ?? 0,
  };
}

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

  // Semantic / hybrid path — vector search offline, deterministic
  const mode = opts.mode ?? "fts";
  if (mode === "semantic" || mode === "hybrid") {
    return logger.withSpan("searchMessages", () =>
      withDbLock(async () => {
        const database = await getDb();
        const safeLimit = clampLimit(opts.limit, 20, 100);
        const safeOffset = clampOffset(opts.offset);
        const validatedSource = sanitizeSource(opts.source);
        const queryVec = embed(rawQuery);
        const SEMANTIC_THRESHOLD = 0.22;

        // Fetch all messages with conversation join — filtered by source/date in JS
        // Use a broad query that FakeDB and real sqlite both handle; filter in JS for portability.
        const allRows = await database.select<
          {
            message_id: string;
            conversation_id: string;
            content: string;
            message_created_at: number;
            title: string;
            source: string;
            conv_created_at: number;
          }[]
        >(
          `SELECT m.id AS message_id, m.conversation_id AS conversation_id, m.content AS content,
                COALESCE(m.created_at, 0) AS message_created_at,
                COALESCE(c.title, 'Untitled') AS title,
                c.source AS source,
                COALESCE(c.created_at, 0) AS conv_created_at
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id`,
          []
        );

        type Scored = {
          conversation_id: string;
          title: string;
          source: string;
          conv_created_at: number;
          message_id: string;
          message_created_at: number;
          content: string;
          score: number;
        };

        const scored: Scored[] = [];
        for (const row of allRows) {
          if (validatedSource && row.source !== validatedSource) continue;
          if (typeof opts.dateFrom === "number" && row.message_created_at < opts.dateFrom) continue;
          if (typeof opts.dateTo === "number" && row.message_created_at > opts.dateTo) continue;
          const sim = cosineSimilarity(queryVec, embed(row.content));
          if (sim >= SEMANTIC_THRESHOLD) {
            scored.push({
              conversation_id: row.conversation_id,
              title: row.title,
              source: row.source,
              conv_created_at: row.conv_created_at,
              message_id: row.message_id,
              message_created_at: row.message_created_at,
              content: row.content,
              score: sim,
            });
          }
        }

        // Group by conversation
        const grouped = new Map<
          string,
          {
            conversation_id: string;
            title: string;
            source: string;
            created_at: number;
            last_occurrence: number;
            occurrence_count: number;
            message_match_count: number;
            rank: number;
            first_match_message_id: string;
            bestScore: number;
            snippets: string[];
          }
        >();

        for (const s of scored) {
          let entry = grouped.get(s.conversation_id);
          if (!entry) {
            entry = {
              conversation_id: s.conversation_id,
              title: s.title,
              source: s.source,
              created_at: s.conv_created_at,
              last_occurrence: s.message_created_at,
              occurrence_count: 0,
              message_match_count: 0,
              rank: 0,
              first_match_message_id: s.message_id,
              bestScore: s.score,
              snippets: [],
            };
            grouped.set(s.conversation_id, entry);
          }
          entry.occurrence_count += 1;
          entry.message_match_count += 1;
          if (s.message_created_at > entry.last_occurrence)
            entry.last_occurrence = s.message_created_at;
          if (s.score > entry.bestScore) {
            entry.bestScore = s.score;
            entry.first_match_message_id = s.message_id;
          }
          // keep up to 3 snippets per conversation
          if (entry.snippets.length < 3) {
            const snippet = s.content.length > 160 ? `${s.content.slice(0, 160)}...` : s.content;
            entry.snippets.push(snippet);
          }
        }

        let semanticRows: typeof grouped extends Map<string, infer V> ? V[] : never = Array.from(
          grouped.values()
        ) as any;

        // Rank: higher bestScore -> lower rank (better)
        for (const r of semanticRows as any[]) {
          (r as any).rank = 1 - (r as any).bestScore;
        }

        if (mode === "hybrid") {
          // Also run FTS and merge
          const ftsResult = await runFtsSearch(database, rawQuery, normalizedQuery, opts);
          // Merge: union by conversation_id, keep best rank, sum occurrence_count
          const merged = new Map<string, (typeof semanticRows)[number] & { ftsRank?: number }>();
          for (const r of semanticRows as any[])
            merged.set(r.conversation_id, { ...r, ftsRank: undefined });
          for (const fr of ftsResult.rows as any[]) {
            const existing = merged.get(fr.conversation_id);
            if (existing) {
              existing.occurrence_count = Math.max(existing.occurrence_count, fr.occurrence_count);
              existing.message_match_count = Math.max(
                existing.message_match_count,
                fr.message_match_count
              );
              // hybrid rank blend
              const ftsRank = fr.rank;
              const semRank = (existing as any).rank as number;
              const hybrid = (ftsRank + semRank) / 2;
              (existing as any).rank = hybrid;
              existing.ftsRank = ftsRank;
              if (fr.snippets?.length) (existing as any).snippets = fr.snippets;
            } else {
              merged.set(fr.conversation_id, {
                conversation_id: fr.conversation_id,
                title: fr.title,
                source: fr.source,
                created_at: fr.created_at,
                last_occurrence: fr.last_occurrence,
                occurrence_count: fr.occurrence_count,
                message_match_count: fr.message_match_count,
                rank: fr.rank,
                first_match_message_id: fr.first_match_message_id,
                bestScore: 0,
                snippets: fr.snippets,
                ftsRank: fr.rank,
              } as any);
            }
          }
          semanticRows = Array.from(merged.values()) as any;
          // Sort by rank then last_occurrence
          (semanticRows as any[]).sort(
            (a: any, b: any) => a.rank - b.rank || b.last_occurrence - a.last_occurrence
          );
        } else {
          (semanticRows as any[]).sort(
            (a: any, b: any) => a.rank - b.rank || b.last_occurrence - a.last_occurrence
          );
        }

        const totalMatches = semanticRows.length;
        const sliced = (semanticRows as any[]).slice(safeOffset, safeOffset + safeLimit);

        // Build final rows with snippet handling
        const rows: SearchResultRow[] = sliced.map((r: any) => ({
          conversation_id: r.conversation_id,
          title: r.title,
          source: r.source,
          snippet: r.snippets[0] ?? "",
          snippets: r.snippets,
          created_at: r.created_at,
          last_occurrence: r.last_occurrence,
          occurrence_count: r.occurrence_count,
          message_match_count: r.message_match_count,
          rank: r.rank,
          first_match_message_id: r.first_match_message_id,
        }));

        // For hybrid we already have totalOccurrences from FTS, for pure semantic use occurrence_count sum
        const totalOccurrences =
          mode === "hybrid"
            ? rows.reduce((s, r) => s + r.occurrence_count, 0) || totalMatches
            : rows.reduce((s, r) => s + r.occurrence_count, 0) || totalMatches;

        return { rows, totalMatches, totalOccurrences };
      })
    );
  }

  return logger.withSpan("searchMessages", () =>
    withDbLock(async () => {
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
    })
  );
}
