# Japanese Learning Assistant Usage Fixes — Design

**Status:** READY_FOR_EXECUTION

## Approved design decisions

1. **Layout:** Make the app shell a bounded viewport. The navigation is a non-scrolling column (`position: sticky` or equivalent grid/flex containment) and only the content area scrolls. The fix must work at the existing responsive breakpoint.
2. **New conversation:** Add `新对话` to the Chat page header. It creates a conversation, switches the active conversation, and clears the current Chat page state. Remove the action from History; History remains for browsing/opening existing conversations.
3. **收藏 payload:** Strip UI-only annotation fields before calling `api.notes.save`, preferably with a typed helper that constructs the allowed `VocabularyItem`/`GrammarItem` payload. Do not weaken the strict IPC schema merely to accept renderer metadata.
4. **Immediate pending message:** On send, create a renderer-local optimistic user message for the active conversation using a unique temporary ID, text, and staged image data. Clear the composer immediately, render the message and a visible waiting indicator, then await the existing IPC request. On success, replace/reload with persisted conversation data; on failure, retain/merge the user message and show retryable error state. Do not create duplicate messages.
5. **Image display:** Add a typed, ID-based `attachments.read` IPC method. Main validates the attachment ID, looks up its repository metadata, reads bytes only through `AttachmentStore`, and returns `{ mimeType, dataBase64 }` (never a path). Renderer renders persisted image message parts using a small component/hook, with loading and broken-image fallback. For optimistic messages, use the staged image data directly. Avoid adding raw image bytes to SQLite message JSON.
6. **No broad API weakening:** Keep the `vocabularyItemSchema` and `grammarItemSchema` strict. Keep attachment path traversal protections. Only add the minimal schema/channel/API contract needed for read-by-ID.

## Non-goals

- No streaming provider protocol or token streaming.
- No database schema migration.
- No changes to AI/TTS providers.
- No change to attachment limits or storage naming.
- No redesign of the entire navigation or chat UI.

## Expected affected files/modules

- `src/renderer/styles/app.css`
- `src/renderer/App.tsx`, `src/renderer/pages/ChatPage.tsx`, `src/renderer/pages/HistoryPage.tsx`, `src/renderer/components/AnalysisCard.tsx`, possibly `Composer.tsx`
- `src/shared/constants.ts`, `src/shared/types.ts`, `src/shared/schemas.ts`
- `src/preload/index.ts`, `src/main/ipc/register.ts`, `src/main/app-services.ts`
- `src/main/attachments/store.ts` and/or repositories for safe read-by-ID
- tests under `tests/` and test helpers

## Failure behavior

- A read attachment failure shows a non-crashing placeholder/fallback in the message.
- AI request failure preserves the optimistic user message and displays its categorized retry action.
- New conversation failure leaves the current conversation intact and shows an error.
