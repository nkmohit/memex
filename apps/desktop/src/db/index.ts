// Central barrel — re-exports public DB API for backwards compatibility.
// Importing from "./db" continues to work via this index file.

export { withDbLock, withWriteLock, getDb, rawGetDb } from "./connection";
export { initDatabase } from "./migrations";
export type {
  DbStats,
  SourceStats,
  ConversationRow,
  MessageRow,
  SearchResultRow,
  SearchMessagesResult,
  ActivityDayPoint,
  ActivityHeatmapPoint,
  SearchOptions,
  DashboardSnapshot,
  ConversationListRow,
} from "./types";
export { escapeLikePattern, normalizeQuery } from "./helpers";
export {
  getDataVersion,
  markDataChanged,
  getCachedDashboardSnapshot,
  getDashboardSnapshot,
} from "./dashboard";
export {
  getStats,
  rebuildSearchIndex,
  getActivityCountByDay,
  getActivityTimeline,
  getActivityHeatmapTimeline,
  getSourceStats,
  getConversations,
  getAllConversationsForSearch,
  getMessages,
  clearAllData,
} from "./queries";
export { searchMessages } from "./search";
