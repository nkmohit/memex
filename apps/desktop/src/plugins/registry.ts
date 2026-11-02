/**
 * In-memory importer registry.
 * Callers (tests, and `importer.ts` for unknown source ids) register parsers
 * with `registerImporter`. Disk plugin files are not loaded.
 */

import type { ParsedConversation } from "@memex/core";

const MAX_PLUGINS = 20;

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

export function registerImporter(meta: Omit<PluginSourceMeta, "isPlugin">, parser: ParserFn): void {
  if (!meta.id || !meta.label) throw new Error("Plugin meta must have id and label");
  if (typeof parser !== "function") throw new Error("Plugin parser must be a function");
  const id = meta.id.toLowerCase();
  if (pluginSources.has(id)) throw new Error(`Plugin source "${id}" already registered`);
  // validate id format
  if (!/^[a-z0-9_-]{2,20}$/.test(id)) throw new Error(`Invalid plugin id "${id}" (2-20 alnum/_/-)`);
  if (pluginSources.size >= MAX_PLUGINS) throw new Error(`Plugin limit ${MAX_PLUGINS} reached`);
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

/** Disk plugin loading was removed with the sandbox stub. Always returns 0. */
export function loadPlugins(): Promise<number> {
  return Promise.resolve(0);
}

export const __internal = { pluginSources, MAX_PLUGINS };
