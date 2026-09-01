# Japanese Learning Assistant Usage Fixes — Execution Evidence

**Executor:** right-side implementation writer (Grok 4.6)  
**Date:** 2026-09-01  
**Mode:** IMPLEMENT  
**Host:** macOS darwin arm64  
**Git operations:** none (no commit, rebase, checkout, or reset)

## Summary

All five reported issues are addressed in approved scope:

1. App shell is a bounded viewport (`html`/`body`/`#root`/` .app-shell`/` .main` `overflow: hidden`). Only `.page` scrolls; `.nav` is an independent sticky column (including the 900px breakpoint).
2. `新对话` is on the Chat header only. History is browse/open. Create failure leaves the current conversation and shows an error.
3. `vocabularySaveItem` / `grammarSaveItem` strip UI-only `alreadySaved` before `api.notes.save`. `vocabularyItemSchema` and `grammarItemSchema` remain `.strict()`.
4. Composer clears immediately. An optimistic user message (temp `pending-*` id, including staged image bytes) and `正在分析…` appear before `messages.send` resolves. Composer is not disabled while sending. Failures keep the bubble and Retry.
5. `attachments.read` IPC returns `{ mimeType, dataBase64 }` by attachment ID through repository metadata + `AttachmentStore.read`. Renderer never receives a filesystem path. Optimistic images use staged data URLs; persisted images load by ID.

## Verification

Commands run on 2026-09-01 in this IMPLEMENT session, in the listed order.

### `npm run format`

Exit **0**.

```text
> prettier --check .
Checking formatting...
All matched files use Prettier code style!
```

### `npm run lint`

Exit **0**.

```text
> eslint .
```

No findings printed.

### `npm run typecheck`

Exit **0**.

```text
> tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json
```

### `npm test -- --run`

Exit **0**.

```text
 Test Files  21 passed (21)
      Tests  59 passed (59)
```

Includes usage-fix coverage: `tests/save-payload.test.ts`, `tests/attachment-read.test.ts`, `tests/renderer/attachment-image.test.tsx`, expanded `tests/renderer/app.test.tsx` (History has no `新对话`; Chat `新对话`; deferred send; failed send + 重试).

Vitest printed a deprecation warning (`environmentMatchGlobs`); not treated as a failure.

### `npm run build`

Exit **0**.

```text
out/main/index.js  74.77 kB
out/preload/index.js  2.29 kB
../../out/renderer/index.html                   0.42 kB
../../out/renderer/assets/index-BRG_NjNS.css    5.35 kB
../../out/renderer/assets/index-fK6uJSXh.js   267.62 kB
```

### `JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev`

Exit **0**. Log included `JLA_STARTUP_DB_OK`. Vite used `http://localhost:5174/` because 5173 was occupied. Smoke quits without a Chat window, so layout/image/optimistic UI were not visually confirmed in this hook.

### `npm run package:dir`

Exit **0**. `electron-builder 26.15.3` packaged `platform=darwin arch=arm64 electron=44.1.0` to `release/mac-arm64`. Native rebuild skipped (`npmRebuild: false`). Default Electron icon; macOS code signing skipped (`identity` null).

## Deviations

- Optimistic send that throws before persistence shows Retry by re-sending from staged bytes, not `messages.retry` (no durable message ID yet). Persisted analysis failures still use `messages.retry`.
- Smoke used port 5174 because 5173 was occupied.
- `src/renderer/App.tsx` was listed as a possible design touch but did not need edits; Chat/History/CSS/Composer changes were sufficient.

## Failures

None of the listed commands failed.

## Unverified areas

- Visual sticky-nav vs long Chat/Notes/History/Settings scroll was covered by CSS and renderer tests, not a manual GUI scroll session.
- Live drag-image → analyze → reload on a Windows host was not run.
- Packaged Windows installer was not executed.
- Real Kokoro models / live AI round-trip were not exercised in this packet.

## Changed files (this packet)

```text
src/renderer/styles/app.css
src/renderer/pages/ChatPage.tsx
src/renderer/pages/HistoryPage.tsx
src/renderer/components/AnalysisCard.tsx
src/renderer/components/Composer.tsx
src/renderer/components/AttachmentImage.tsx
src/shared/constants.ts
src/shared/types.ts
src/shared/schemas.ts
src/shared/save-payload.ts
src/preload/index.ts
src/main/ipc/register.ts
src/main/app-services.ts
tests/helpers/fake-api.ts
tests/renderer/app.test.tsx
tests/renderer/attachment-image.test.tsx
tests/save-payload.test.ts
tests/attachment-read.test.ts
docs/changes/jla-usage-fixes/execution.md
```

`docs/PRD.md`, packet specs (`context.md` / `design.md` / `tasks.md` / `review.md`), `.DS_Store`, `docs/.DS_Store`, and `.omx/` were not modified.

## MASTER independent verification — 2026-09-01

- `npm run format`: exit 0.
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm test -- --run`: exit 0; **21 test files / 59 tests passed**.
- `npm run build`: exit 0.
- `JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev`: exit 0 outside the restricted sandbox; `JLA_STARTUP_DB_OK` observed. Vite used `http://localhost:5174/` because 5173 was occupied. The sandbox-only attempt produced `listen EPERM ::1:5173` and was not treated as an application failure.
- `npm run package:dir`: exit 0; updated main/preload/renderer bundle packaged successfully for macOS arm64.

The packet is VERIFIED. Manual GUI scroll, real Windows drag/analyze/reload, Windows installer execution, and live AI/Kokoro calls remain unverified and are explicitly documented above.
