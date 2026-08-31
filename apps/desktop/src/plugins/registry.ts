/**
 * Plugin registry — extensible importers via `~/.memex/plugins/*.js`.
 * Plugins are CommonJS modules that call `registerImporter(meta, parser)`.
 * The registry merges plugin sources into `IMPORT_SOURCES` at runtime.
 * See `docs/plugins.md` for authoring guide.
 */

import type { ParsedConversation } from "@memex/core";

export interface PluginSourceMeta {
  id: string;
  label: string;
  available: boolean;
  isPlugin: true;
  filePath?: string;
}

export type PluginParsedConversation = Omit<ParsedConversation, "source"> & { source: string };
export type ParserFn = (rawJson: unknown) => PluginParsedConversation[];

export interface PluginRegistration {
  meta: PluginSourceMeta;
  parser: ParserFn;
}

const pluginSources = new Map<string, PluginRegistration>();
const PLUGIN_DIR = "~/.memex/plugins";

export function registerImporter(meta: Omit<PluginSourceMeta, "isPlugin">, parser: ParserFn): void {
  if (!meta.id || !meta.label) throw new Error("Plugin meta must have id and label");
  if (typeof parser !== "function") throw new Error("Plugin parser must be a function");
  const id = meta.id.toLowerCase();
  if (pluginSources.has(id)) throw new Error(`Plugin source "${id}" already registered`);
  // validate id format
  if (!/^[a-z0-9_-]{2,20}$/.test(id)) throw new Error(`Invalid plugin id "${id}" (2-20 alnum/_/-)`);
  pluginSources.set(id, {
    meta: { ...meta, id, isPlugin: true },
    parser,
  });
}

export function unregisterImporter(id: string): boolean {
  return pluginSources.delete(id.toLowerCase());
}

export function getPluginSources(): PluginSourceMeta[] {
  return Array.from(pluginSources.values()).map((r) => r.meta);
}

export function getPluginParser(id: string): ParserFn | undefined {
  return pluginSources.get(id.toLowerCase())?.parser;
}

export function isPluginSource(id: string): boolean {
  return pluginSources.has(id.toLowerCase());
}

export function clearPlugins(): void {
  pluginSources.clear();
}

export function getAllSources(
  builtin: { id: string; label: string; available: boolean }[]
): ((typeof builtin)[number] | PluginSourceMeta)[] {
  return [...builtin, ...getPluginSources()];
}

/**
 * Load plugins from disk via Tauri FS (browser fallback: no-op).
 * Each file should be a CommonJS module exporting `registerImporter`.
 * In tests, this is mocked to load in-memory plugins.
 */
export async function loadPlugins(): Promise<number> {
  let loaded = 0;
  try {
    // Dynamic import to avoid hard dependency in tests where plugin-fs not available
    const fs = await import("@tauri-apps/plugin-fs");
    // `readDir` may not exist in older plugin-fs; guard
    const readDir = (fs as unknown as { readDir?: (path: string) => Promise<{ name: string }[]> })
      .readDir;
    if (!readDir) return 0;
    const entries = await readDir(PLUGIN_DIR);
    for (const entry of entries) {
      if (!entry.name.endsWith(".js")) continue;
      const filePath = `${PLUGIN_DIR}/${entry.name}`;
      try {
        const text = await (
          fs as unknown as { readTextFile: (p: string) => Promise<string> }
        ).readTextFile(filePath);
        // Simple CJS evaluate: provide `registerImporter` as global
        const fn = new Function("registerImporter", "exports", "module", text);
        const modExports: Record<string, unknown> = {};
        const mod = { exports: modExports };
        fn(registerImporter, modExports, mod);
        loaded += 1;
      } catch (err) {
        console.warn(`[plugins] failed to load ${filePath}`, err);
      }
    }
  } catch {
    // Tauri not available (browser/tests) — no-op
  }
  return loaded;
}

export const __internal = { PLUGIN_DIR, pluginSources };
