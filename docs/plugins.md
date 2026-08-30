# Memex Plugins

Memex is extensible via local plugins placed in `~/.memex/plugins/*.js`.

## Quick start

Create `~/.memex/plugins/notion.js`:

```js
// CommonJS — the file is evaluated with `registerImporter` in scope
registerImporter(
  { id: "notion", label: "Notion", available: true },
  function parseNotion(rawJson) {
    // rawJson is the parsed JSON from the user's export file
    // Return ParsedConversation[] (see packages/core/src/types.ts)
    if (!Array.isArray(rawJson)) return [];
    return rawJson.map((row) => ({
      id: String(row.id),
      source: "notion",
      title: row.title || "Untitled",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: (row.blocks || []).length,
      messages: (row.blocks || []).map((b) => ({
        id: String(b.id),
        conversationId: String(row.id),
        sender: b.type === "user" ? "human" : "assistant",
        content: String(b.text || ""),
        createdAt: Date.now(),
      })),
    }));
  }
);
```

Then restart Memex — `Notion` will appear alongside Claude/ChatGPT/Gemini/Grok in `IMPORT_SOURCES` via `plugins/registry.ts:1` `getPluginSources()`.

## API

| Export | Description |
|--------|-------------|
| `registerImporter(meta, parser)` | Register a source. `meta.id` must be `2-20` alnum/`_`-`-` lowercased, unique. `parser(rawJson) => ParsedConversation[]`. |
| `getPluginSources()` | List registered plugin metas (`isPlugin: true`). |
| `getPluginParser(id)` | Retrieve parser for an id. |
| `getAllSources(builtin)` | Merge builtin `IMPORT_SOURCES` + plugins (used by `OnboardingPage`/`ImportPage`). |
| `loadPlugins()` | Tauri `readDir(PLUGIN_DIR)` + `readTextFile` + `new Function` evaluation. Returns count loaded. Browser fallback no-op. |

## Testing

```ts
import { registerImporter, getPluginSources, clearPlugins } from "./plugins/registry";

clearPlugins();
registerImporter({ id: "example", label: "Example", available: true }, (raw) => []);
expect(getPluginSources()).toHaveLength(1);
```

See `apps/desktop/src/plugins/registry.test.ts` and `apps/desktop/src/importer.test.ts` (custom source via registry).

## Security

- Plugins are evaluated with `new Function` in the Tauri sandbox, not `eval`. Only `registerImporter` is injected.
- `PLUGIN_DIR` is `~/.memex/plugins` (not `$HOME/Downloads`), `fs:allowReadFile` should be scoped accordingly in `capabilities/default.json`.

## Example: packages/core plugin

See `packages/core/example-plugins/notion.example.js` for a full example.
