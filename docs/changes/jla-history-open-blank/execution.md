# 历史会话打开后空白 — Execution Evidence

**Executor:** right-side implementation writer (Grok 4.6)  
**Date:** 2026-09-01  
**Mode:** IMPLEMENT  
**Host:** macOS darwin arm64  
**Git operations:** none (no commit, rebase, checkout, or reset)

## Summary

ChatPage no longer treats a History open as a blank new chat when load fails, skip is leftover, or a prior send completes.

- `skipLoadForId` replaces boolean `skipNextLoad`; only the created/first-send id is skipped; a different History id always calls `conversations.get`.
- `get` failures set `error` (StatusBanner), clear loading, keep existing detail, and do not show the empty CTA.
- `mountedRef` + `conversationIdRef` + `loadGeneration` ignore stale `get`/`reload`/`send` completions. A deferred send cannot `onConversationChange` after the user opened another conversation.

Existing 新对话, optimistic send, retry, and History remount of a filled conversation remain covered.

## Tests first

`tests/renderer/chat-history.test.tsx` was added and run red (3 fail / 1 pass) against the old ChatPage, then green after the ChatPage change.

## Verification

Commands run on 2026-09-01 in this IMPLEMENT session.

### `npm run format`

Exit **0**. `All matched files use Prettier code style!`

### `npm run lint`

Exit **0**.

### `npm run typecheck`

Exit **0**.

### `npm test -- --run`

Exit **0**.

```text
 Test Files  22 passed (22)
      Tests  63 passed (63)
```

Includes 4 new cases in `tests/renderer/chat-history.test.tsx` plus existing `tests/renderer/app.test.tsx` (5).

### `npm run build`

Exit **0**. Renderer bundle `out/renderer/assets/index-BU0MS8iO.js`.

### `npm run package:dir`

Exit **0**. `electron-builder 26.15.3` packaged `platform=darwin arch=arm64 electron=44.1.0` to `release/mac-arm64`.

### `JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev`

Exit **0**. Log included `JLA_STARTUP_DB_OK`. Vite used `http://localhost:5175/` (5173 and 5174 occupied). Smoke does not open History.

## Deviations

- Smoke used port 5175 because 5173/5174 were occupied.
- `tests/helpers/fake-api.ts` gained `failGet`, `distinctCreate`, and `historyConversations` only; no IPC/schema change.

## Failures

None of the listed commands failed.

## Unverified areas

- Manual GUI: History click while a live AI request is in flight (Windows and macOS).
- Packaged Windows installer was not executed.
- Smoke does not exercise Chat/History UI.

## Changed files

```text
src/renderer/pages/ChatPage.tsx
tests/renderer/chat-history.test.tsx
tests/helpers/fake-api.ts
docs/changes/jla-history-open-blank/execution.md
```

`docs/PRD.md`, packet specs other than this execution file, `.DS_Store`, `docs/.DS_Store`, and `.omx/` were not modified.
