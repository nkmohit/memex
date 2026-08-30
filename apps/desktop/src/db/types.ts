export interface DbStats {
  conversationCount: number;
  messageCount: number;
  indexedMessageCount: number;
  latestMessageTimestamp: number | null;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
}

export interface SourceStats {
  source: string;
  conversationCount: number;
  messageCount: number;
  /** Latest message timestamp for this source (for "last sync" display). */
  lastActivityTimestamp: number | null;
}

export interface ConversationRow {
  id: string;
  source: string;
  title: string;
  created_at: number;
  last_message_at: number;
  message_count: number;
}

export interface MessageRow {
  id: string;
  sender: "human" | "assistant";
  content: string;
  created_at: number;
}

export interface SearchResultRow {
  conversation_id: string;
  title: string;
  source: string;
  snippet: string;
  snippets: string[];
  created_at: number;
  last_occurrence: number;
  occurrence_count: number;
  message_match_count: number;
  rank: number;
  first_match_message_id: string | null;
}

export interface SearchMessagesResult {
  rows: SearchResultRow[];
  totalMatches: number;
  totalOccurrences: number;
}

export interface ActivityDayPoint {
  day: string; // YYYY-MM-DD in local time
  count: number;
}

export interface ActivityHeatmapPoint {
  day: string; // YYYY-MM-DD in local time
  totalCount: number;
  chatgptCount: number;
  claudeCount: number;
  geminiCount: number;
  grokCount: number;
  otherCount: number;
}

export interface SearchOptions {
  source?: string;
  dateFrom?: number;
  dateTo?: number;
  limit?: number;
  offset?: number;
  sort?: "relevance" | "last_occurrence_desc" | "occurrence_count_desc" | "title_az" | "title_za";
  /** Search mode: FTS (default), semantic (vector), or hybrid (FTS + vector). */
  mode?: "fts" | "semantic" | "hybrid";
}

export interface DashboardSnapshot {
  stats: DbStats;
  sourceStats: SourceStats[];
  recentConversations: ConversationRow[];
  activityTimeline: ActivityHeatmapPoint[];
  dataVersion: number;
  updatedAt: number;
}

export interface ConversationListRow {
  conversation_id: string;
  title: string;
  source: string;
  created_at: number;
  last_message_at: number;
  message_count: number;
}
