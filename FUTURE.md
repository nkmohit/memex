# Future ideas

Not implemented. Nothing in this list is a committed feature.

- Semantic search that uses a real embedding model (the hash in `lib/vector.ts` is a stub, not this item)
- Encryption of `memex.db`
- A plugin loader that the app actually calls, with an isolation boundary stronger than a regex denylist
- Floating recall window
- Knowledge graph
- Canonical memory / governance layer
- MCP integration
- Context firewall
- Offline LLM summaries (`lib/summarize.ts` is sentence ranking only)

Claude, ChatGPT, Gemini, and Grok JSON import are already implemented.
