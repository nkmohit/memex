/**
 * Feature flags persisted in localStorage under `memex:flags`.
 * `summarize` gates the extractive insights block.
 * `topicTimeline` gates the TF-IDF month list.
 */

export type FlagName = "summarize" | "topicTimeline";

export type Flags = Record<FlagName, boolean>;

const STORAGE_KEY = "memex:flags";

const DEFAULTS: Flags = {
  summarize: true,
  topicTimeline: true,
};

function readStorage(): Partial<Flags> {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Flags>;
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeStorage(flags: Flags): void {
  try {
    if (typeof localStorage !== "undefined")
      localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  } catch {
    // ignore quota
  }
}

let memoryFlags: Flags | null = null;

function getMemoryFlags(): Flags {
  if (memoryFlags) return memoryFlags;
  const stored = readStorage();
  memoryFlags = { ...DEFAULTS, ...stored };
  return memoryFlags;
}

export function getFlags(): Flags {
  return { ...getMemoryFlags() };
}

export function isEnabled(flag: FlagName): boolean {
  return getMemoryFlags()[flag] ?? false;
}

export function setFlag(flag: FlagName, enabled: boolean): void {
  const next = { ...getMemoryFlags(), [flag]: enabled };
  memoryFlags = next;
  writeStorage(next);
}

export function setFlags(partial: Partial<Flags>): void {
  const next = { ...getMemoryFlags(), ...partial };
  memoryFlags = next;
  writeStorage(next);
}

export function resetFlags(): void {
  memoryFlags = { ...DEFAULTS };
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getFlagDefaults(): Flags {
  return { ...DEFAULTS };
}

export const __internal = { STORAGE_KEY, DEFAULTS, readStorage, writeStorage };
