# Memex

Memex is a desktop knowledge archive for your AI conversations.

It lets you import, search, and revisit chat history from multiple LLM providers — locally, privately, and instantly.

Built with **React 19 + Tauri 2 + SQLite (FTS5)**.

## What it does

- Import conversation archives (Claude supported, others planned)
- Full-text search across all messages (SQLite FTS5)
- Prefix search support (`salary*`)
- Ranked results (BM25)
- Highlighted matches
- Per-conversation message search
- Source filtering
- Activity tracking by day
- Dark / Light / System theme
- Local-first (no cloud, no telemetry)

## Core concept

Memex is not a chat app.

It is a **recall engine** — a searchable memory layer over your past AI conversations.

## Architecture

- **Frontend**: React 19 + Vite 7
- **Desktop runtime**: Tauri 2
- **Database**: SQLite (`memex.db`)
- **Search**: FTS5 (BM25 ranking, snippet highlighting)
- **Styling**: Tailwind CSS v4
- **Icons**: `lucide-react` + custom LLM brand icons

All data is stored locally in `memex.db`.

## Database schema (simplified)

**conversations**

- id
- source
- title
- created_at
- updated_at
- message_count

**messages**

- id
- conversation_id
- sender
- content
- created_at

**messages_fts** (FTS5 virtual table)

- content
- title
- conversation_id (UNINDEXED)
- message_id (UNINDEXED)

## Getting started

From the repo root:

```bash
cd apps/desktop

# install dependencies
NPM_CONFIG_REGISTRY=https://registry.npmjs.org npm install

# start dev mode
npm run tauri dev
```

## Search behavior

- Full-text search via SQLite FTS5
- Prefix search supported (`term*`)
- Ranked by BM25
- Results grouped by conversation
- Message-level highlighting
- Conversation viewer with in-place search


Preference is persisted in `localStorage`.

## Current focus

Memex is evolving toward a **thinking dashboard**:

- Better recall
- Relevance scoring
- Activity visualization
- Related conversation surfacing

## Status

Actively developed.
Local-first.
No telemetry.
No accounts.

