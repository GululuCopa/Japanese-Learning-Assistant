# Japanese Learning Assistant Usage Fixes — Tasks

**Status:** VERIFIED
**Mode:** IMPLEMENT
**Implementation writer:** right-side Herdr Grok agent only

Read `context.md`, `design.md`, `docs/PRD.md`, and repository instructions before editing. Implement only the approved design. Do not commit/reset/checkout.

## Task 1 — Fixed navigation and Chat new-conversation action

- Make only the main content pane scroll; keep the left navigation fixed.
- Move `新对话` from History to Chat, with a clear active-chat behavior and error handling.
- Add renderer tests for both placement and action.

## Task 2 — Strict save payload fix

- Ensure word/grammar save actions do not send UI-only `alreadySaved` metadata.
- Preserve strict Zod validation and add a regression test that the actual save action succeeds through the relevant boundary/helper.

## Task 3 — Responsive pending-message flow

- Display the user's outgoing message immediately, including text/images, before the AI response resolves.
- Clear the composer immediately after submission, keep the page interactive, show a pending/分析中 state, and merge the eventual response without duplicates.
- Preserve failed-message persistence/retry behavior.
- Add tests with a deferred messages.send promise and a rejected promise.

## Task 4 — Persisted image rendering

- Add safe read-by-ID attachment IPC and typed preload/API contract.
- Render persisted user-message images after send and after conversation reload; render optimistic staged images immediately.
- Add mocked IPC/API and renderer tests; do not expose filesystem paths.

## Task 5 — Verification and evidence

Run and record in `docs/changes/jla-usage-fixes/execution.md`:

```bash
npm run format
npm run lint
npm run typecheck
npm test -- --run
npm run build
JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev
npm run package:dir
```

## Acceptance criteria

- Left nav remains visually fixed while a long Chat/Notes/History/Settings page scrolls.
- Only Chat contains `新对话`; clicking it creates/switches to a blank conversation.
- Clicking 收藏 no longer produces a Zod `unrecognized_keys: alreadySaved` error; strict schemas remain strict.
- User message appears and composer clears while AI is still pending; a visible waiting state is shown; errors retain the message and retry affordance.
- Dragged/pasted/picked images appear in the conversation, including after reload, without renderer filesystem access.
- Existing V0.1/Kokoro behavior remains intact; listed checks pass; unverified platform limitations are documented honestly.
