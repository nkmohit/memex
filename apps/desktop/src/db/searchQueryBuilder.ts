import { escapeLikePattern } from "./helpers";
import type { SearchOptions } from "./types";
import { sanitizeSource } from "../lib/validation";

/**
 * Pure SQL builder helpers for FTS search.
 * Extracted from db/search.ts to keep search.ts small and testable.
 */

/**
 * Weights passed to FTS5 `bm25()`, in `messages_fts` column order:
 * content, title, conversation_id (UNINDEXED), message_id (UNINDEXED).
 * Title is weighted above body. Unindexed id columns contribute nothing.
 */
export const FTS_BM25_WEIGHTS = [1, 5, 0, 0] as const;

export function bm25RankExpression(): string {
  const weights = FTS_BM25_WEIGHTS.map((weight) => `${weight}.0`).join(", ");
  return `bm25(messages_fts, ${weights})`;
}

export interface FtsWhereResult {
  whereClause: string;
  params: unknown[];
  titleLikeParam: string;
  rawQueryLower: string;
}

export function buildOrderBy(sort?: SearchOptions["sort"]): string {
  if (sort === "relevance") return "rank ASC, last_occurrence DESC";
  if (sort === "occurrence_count_desc") return "occurrence_count DESC, rank ASC";
  if (sort === "title_az") return "title COLLATE NOCASE ASC, rank ASC";
  if (sort === "title_za") return "title COLLATE NOCASE DESC, rank ASC";
  return "last_occurrence DESC, rank ASC";
}

export function buildFtsWhereClause(
  rawQuery: string,
  normalizedQuery: string,
  opts: SearchOptions
): FtsWhereResult {
  const validatedSource = sanitizeSource(opts.source);
  const titleLikeParam = `%${escapeLikePattern(rawQuery.toLowerCase())}%`;
  const rawQueryLower = rawQuery.toLowerCase();
  let whereClause = "messages_fts MATCH $1";
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
  }
  return { whereClause, params, titleLikeParam, rawQueryLower };
}

export interface SnippetWhereResult {
  whereClause: string;
  params: unknown[];
}

export function buildSnippetWhereClause(
  normalizedQuery: string,
  conversationId: string,
  opts: SearchOptions
): SnippetWhereResult {
  let whereClause = "messages_fts MATCH $1 AND messages_fts.conversation_id = $2";
  const params: unknown[] = [normalizedQuery, conversationId];
  let idx = 3;
  if (typeof opts.dateFrom === "number") {
    whereClause += ` AND COALESCE(m.created_at, 0) >= $${idx}`;
    params.push(opts.dateFrom);
    idx += 1;
  }
  if (typeof opts.dateTo === "number") {
    whereClause += ` AND COALESCE(m.created_at, 0) <= $${idx}`;
    params.push(opts.dateTo);
  }
  return { whereClause, params };
}

export function buildCountSql(whereClause: string): string {
  return `SELECT COUNT(DISTINCT messages_fts.conversation_id) AS total FROM messages_fts JOIN conversations c ON c.id = messages_fts.conversation_id JOIN messages m ON m.id = messages_fts.message_id WHERE ${whereClause}`;
}

export function buildTotalOccurrencesSql(whereClause: string): string {
  return `SELECT COALESCE(CAST(SUM((LENGTH(LOWER(m.content)) - LENGTH(REPLACE(LOWER(m.content), $3, ''))) / NULLIF(LENGTH($3), 0)) AS INTEGER), 0) AS total FROM messages_fts JOIN conversations c ON c.id = messages_fts.conversation_id JOIN messages m ON m.id = messages_fts.message_id WHERE ${whereClause}`;
}

export function buildRankedRowsSql(
  whereClause: string,
  orderBy: string,
  limit: number,
  offset: number
): string {
  const matchPrefix = "messages_fts MATCH $1";
  const filter = whereClause.startsWith(matchPrefix)
    ? whereClause
        .slice(matchPrefix.length)
        .trim()
        .replace(/^AND\s+/i, "")
    : "";
  const filterSql = filter.length > 0 ? `WHERE ${filter}` : "";
  // bm25() is only valid in a query whose FROM clause is the FTS table.
  // MATERIALIZED keeps that query from being flattened into the joins below.
  return `WITH fts_hits AS MATERIALIZED (
        SELECT
          messages_fts.conversation_id AS conversation_id,
          messages_fts.message_id AS message_id,
          ${bm25RankExpression()} AS row_rank
        FROM messages_fts
        WHERE messages_fts MATCH $1
      ),
      ranked_rows AS (
        SELECT
          c.id AS conversation_id,
          COALESCE(c.title, 'Untitled') AS title,
          c.source AS source,
          COALESCE(c.created_at, 0) AS created_at,
          COALESCE(m.created_at, 0) AS message_created_at,
          m.id AS message_id,
          (LENGTH(LOWER(m.content)) - LENGTH(REPLACE(LOWER(m.content), $3, ''))) / NULLIF(LENGTH($3), 0) AS occurrence_in_message,
          fts_hits.row_rank AS row_rank
        FROM fts_hits
        JOIN conversations c ON c.id = fts_hits.conversation_id
        JOIN messages m ON m.id = fts_hits.message_id
        ${filterSql}
      ),
      grouped AS (
        SELECT conversation_id, title, source, created_at,
          MAX(message_created_at) AS last_occurrence,
          CAST(SUM(occurrence_in_message) AS INTEGER) AS occurrence_count,
          COUNT(DISTINCT message_id) AS message_match_count,
          MIN(row_rank) AS rank,
          (SELECT message_id FROM ranked_rows r2 WHERE r2.conversation_id = ranked_rows.conversation_id ORDER BY r2.row_rank ASC, r2.message_created_at ASC LIMIT 1) AS first_match_message_id
        FROM ranked_rows GROUP BY conversation_id, title, source, created_at
      )
      SELECT conversation_id, title, source, created_at, COALESCE(last_occurrence, 0) AS last_occurrence,
        occurrence_count, message_match_count, rank, first_match_message_id
      FROM grouped ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`;
}
