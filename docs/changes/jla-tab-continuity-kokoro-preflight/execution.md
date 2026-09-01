# Tab 切换分析连续性与 Kokoro 启动预检 — Execution Evidence

**Executor:** right-side implementation writer (Grok 4.6)  
**Date:** 2026-09-01  
**Mode:** IMPLEMENT  
**Host:** macOS darwin arm64  
**Git operations:** none

## Summary

- `App` keeps a single `ChatPage` mounted inside a `.route-panel`. Non-chat tabs set `hidden`/`aria-hidden`; CSS `[hidden] { display: none !important }` so the panel takes no layout space and is skipped by role queries.
- Pending is a per-conversation id set. Same-id tab round-trips keep optimistic text/images/`正在分析…` and apply send completion. Opening a different History id does not show the old pending and is not overwritten by the stale send.
- `KokoroRuntime` treats `launch.sh`/`launch.ps1` as a hook only. Without `start-cpu.*`, standalone binary, or wrapper venv python, `ensureReady()` throws non-retryable `configuration` before spawn. `JLA_KOKORO_BIN` and backing `start-cpu` still spawn.
- Settings copy: 发音由本地 Kokoro 完成，但需安装 runtime/model.

No models or extra dependencies were downloaded.

## Tests first

`tests/renderer/chat-lifecycle.test.tsx` and placeholder Kokoro cases were red against the previous Chat unmount / launcher-as-runtime behavior, then green after the changes.

## Verification

### `npm run format`

Exit **0**.

### `npm run lint`

Exit **0**.

### `npm run typecheck`

Exit **0**.

### `npm test -- --run`

Exit **0**.

```text
 Test Files  23 passed (23)
      Tests  67 passed (67)
```

### `npm run build`

Exit **0**.

### `npm run package:dir`

Exit **0**. `platform=darwin arch=arm64 electron=44.1.0` → `release/mac-arm64`.

### `JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev`

Exit **0**. `JLA_STARTUP_DB_OK`. Vite `http://localhost:5174/` (5173 busy). Smoke does not click Chat/TTS.

## Deviations

- Child early-exit capture was not added (would extend `SpawnedProcess`). Placeholder roots fail **before** spawn, which meets the packet.
- Smoke used port 5174.

## Failures

None of the listed commands failed.

## Unverified areas

- Manual GUI: send with image, switch Notes/Settings, wait for live AI.
- Clicking 发音 against a real missing runtime in the packaged app (unit-tested only).
- Windows installer / live Kokoro models (out of scope).

## Changed files

```text
src/renderer/App.tsx
src/renderer/styles/app.css
src/renderer/pages/ChatPage.tsx
src/renderer/pages/SettingsPage.tsx
src/main/tts/kokoro-runtime.ts
tests/renderer/chat-lifecycle.test.tsx
tests/renderer/chat-history.test.tsx
tests/renderer/app.test.tsx
tests/kokoro-runtime.test.ts
docs/changes/jla-tab-continuity-kokoro-preflight/execution.md
```

`docs/PRD.md`, packet specs other than this file, `.DS_Store`, `docs/.DS_Store`, and `.omx/` were not modified.
