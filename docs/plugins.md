# Plugins

`apps/desktop/src/plugins/registry.ts` holds an in-memory map of extra importers.

`registerImporter(meta, parser)` stores a parser. `importer.ts` calls `getPluginParser` when the source id is not `claude`, `chatgpt`, `gemini`, or `grok`. Tests use that path (`importer.test.ts`, `registry.test.ts`).

`getAllSources` concatenates a caller-supplied list with the map. The overview, import, and onboarding screens use `IMPORT_SOURCES` directly. They do not call `getAllSources`.

## Disk loader

`loadPlugins()` tries to `readDir("~/.memex/plugins")`, read `*.js` files, run `validatePluginText` (`plugins/sandbox.ts`), and `new Function("registerImporter", "exports", "module", text)`.

No module in `apps/desktop/src` calls `loadPlugins()` except the plugin tests. Starting the app does not scan that directory, and a file dropped there does not show up as an import source.

`capabilities/default.json` allows `readTextFile` under Downloads and Documents only. `~/.memex/plugins` is not on that list, so a Tauri `readTextFile` of the plugin path is denied even if something called `loadPlugins()`.

## Sandbox

`validatePluginText` rejects empty files, files over 50KB, files that do not contain the substring `registerImporter`, and files that match a list of regular expressions (`process`, `require`, `fetch`, and others). That is a string filter. It is not a sandbox. `new Function` runs with the privileges of the webview.

`packages/core/example-plugins/notion.example.js` is a sample parser. The app does not load it.

## Limits coded next to the filter

`MAX_PLUGINS` is 20. `wrapParser` checks elapsed time after the parser returns (it does not interrupt a running call), rejects a non-array, and caps conversations at 1000 and messages at 10000. Those checks run only for parsers registered through `registerImporter` / `loadPlugins`.
