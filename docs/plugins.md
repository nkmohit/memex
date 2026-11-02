# Plugins

`apps/desktop/src/plugins/registry.ts` holds an in-memory map of extra importers.

`registerImporter(meta, parser)` stores a parser. `importer.ts` calls `getPluginParser` when the source id is not `claude`, `chatgpt`, `gemini`, or `grok`. Tests use that path (`importer.test.ts`, `registry.test.ts`).

`getAllSources` concatenates a caller-supplied list with the map. The overview, import, and onboarding screens use `IMPORT_SOURCES` directly. They do not call `getAllSources`.

`loadPlugins()` returns `0`. It does not read `~/.memex/plugins` and it does not evaluate JavaScript. The regex denylist that used to sit in `plugins/sandbox.ts` has been removed. There is no replacement sandbox.

`packages/core/example-plugins/notion.example.js` is a sample file. The app does not load it.

`capabilities/default.json` allows `readTextFile` under Downloads and Documents only.
