import Database from "@tauri-apps/plugin-sql";

/**
 * Single SQLite connection singleton + serialized lock.
 * All DB work is routed through withDbLock to avoid concurrent IPC calls.
 */

let db: Database | null = null;

async function rawGetDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:memex.db");
  }
  return db;
}

let dbLock: Promise<void> = Promise.resolve();

export function withDbLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = dbLock.then(fn, fn);
  dbLock = next.then(
    () => {},
    () => {}
  );
  return next;
}

export const withWriteLock = withDbLock;

export async function getDb(): Promise<Database> {
  return rawGetDb();
}

// Exposed for migrations — only call inside withDbLock
export { rawGetDb };
