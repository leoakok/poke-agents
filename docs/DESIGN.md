# Design: Poke agents MCP (vendored session readers)

## Goals

1. **MCP only** — clients use **tools**; no first-party HTTP UI in the base design.
2. **Broad editor coverage** — reuse maintained third-party readers under `vendor/session-editors/` rather than reimplementing every product.
3. **Stable dispatch** — list via merged `getAllChats()`, load threads via `getMessages(chat)` using the same routing rules as the vendored bundle.

## Vendored tree

- **Location:** `vendor/session-editors/`
- **Attribution / license:** root **[`NOTICE`](../NOTICE)** (not repeated in other docs).
- **CommonJS:** `vendor/session-editors/package.json` has `"type": "commonjs"` so `.js` adapters load under the parent package (`"type": "module"`).

## Session identity (unified disk id)

The vendored **`getMessages(chat)`** expects the **full chat object** from each adapter’s `getChats()`, not only a short id.

- **`nativeId`** = `base64url(JSON.stringify(chat))` (see `chat-ref.ts`).
- **Unified MCP id** = **`${chat.source}:${nativeId}`**

The `session` tool verifies the prefix **`source`** matches `chat.source` in the decoded payload.

## Connector registry

For each export in `vendor/session-editors/index.js`, we build one **`AgentConnector`**:

| Field | Source |
|--------|--------|
| `id` | `editor.name` |
| `displayName` | Merged `editorLabels` / `editor.labels` |
| `listSessions` | `editor.getChats()` → `SessionSummary` |
| `getMessages` | Decode payload → **`bundle.getMessages(chat)`** so variant `chat.source` values resolve correctly |

Merged inbox **`listAllSessionsMerged`** calls **`getAllChats()`** and applies optional `source` / `project_path` filters (MCP `sessions` tool exposes them as `editor` / `folder`). The `source` filter accepts either **`chat.source`** or the parent **`editor.name`** (e.g. `claude` matches rows whose source is `claude-code`).

## Dependencies

Several adapters use **`better-sqlite3`** (native). It is declared in the root `package.json`.

## MCP server

Implemented under `src/mcp/`: **stdio** (default) for editor MCP clients; **`--http`** + `/mcp` for Poke (`poke tunnel`). Read tools match [`MCP_TOOLS.md`](MCP_TOOLS.md); listing respects [`profile.ts`](../src/profile.ts) (`POKE_AGENTS_EDITORS`, default `cursor,opencode`).

## Control plane (`src/control/`)

- **Cursor:** spawn the **`agent`** CLI ([docs](https://cursor.com/docs/cli/overview)) for `create-chat`, headless `-p` runs, and `about` / `status`.
- **OpenCode:** same **tool names** and `provider` argument; handlers return “not implemented” until a CLI surface is added.
- **Session status** combines disk decode (same encoding as read tools) with optional full message count.
