# Japanese Learning Assistant Usage Fixes — Context

**Status:** READY_FOR_EXECUTION
**Baseline:** `8e465febcde349901c9cb8ba8d0e8a04d3dc1173` plus the existing uncommitted V0.1 and Kokoro implementation. Preserve all existing user files, including `.DS_Store`, `docs/.DS_Store`, `.omx/`, and `docs/PRD.md`.
**Executor:** right-side Herdr Grok agent only (`IMPLEMENT`).

## User-reported issues

1. The left navigation scrolls/moves with the right conversation content; it must remain fixed while the content pane scrolls.
2. The `新对话` action is on History but belongs on the Chat page. Remove it from History and put it in Chat.
3. Clicking 收藏 fails in main IPC because the renderer sends analysis-only `alreadySaved` metadata inside `item`, while the strict save schema rejects it.
4. While the model is responding, the user's message remains in the composer and the page appears blocked until the response arrives. The user message should be inserted/displayed immediately with a waiting state; the composer should clear and the UI should remain responsive. Errors must still leave the user message visible and retryable.
5. After dragging an image and analyzing it, the conversation does not display the image. The persisted attachment must be rendered in the user message and remain visible after reload/restart.

## Evidence from current source

- `src/renderer/styles/app.css`: `.app-shell` is a 100% grid and `.main`/`.page` do not establish a bounded scrolling column; `.page` owns overflow, allowing layout behavior that moves the nav with page content in the current window.
- `src/renderer/pages/HistoryPage.tsx`: owns the only `新对话` button.
- `src/renderer/pages/ChatPage.tsx`: waits for `api.messages.send()` before reloading/rendering; `sending` disables Composer and only renders a separate `正在分析…` text after the request settles. `MessageView` renders images as only `含截图`.
- `src/renderer/components/AnalysisCard.tsx`: passes the full vocabulary item, including `alreadySaved`, to `api.notes.save()`.
- `src/shared/schemas.ts`: `vocabularyItemSchema` is strict and intentionally does not accept `alreadySaved`.
- `src/preload/index.ts`, `src/main/ipc/register.ts`, and `src/shared/types.ts`: attachments only expose `pickImages`; there is no safe read-by-ID bridge for stored attachments.
- `src/main/conversation/service.ts` and repositories persist attachment metadata/content linkage under generated names, so a main-process read-by-ID seam can safely serve the stored bytes without exposing filesystem paths.

## Compatibility constraints

- Windows 10/11 x64 and macOS development must continue to work.
- Keep strict IPC validation and context isolation; do not expose arbitrary filesystem paths or Node APIs to renderer.
- Preserve current asynchronous AI/TTS behavior, retry semantics, attachment limits, and existing settings/Kokoro behavior.
- Do not change PRD.md.
