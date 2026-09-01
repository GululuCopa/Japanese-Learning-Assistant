# Japanese Learning Assistant Usage Fixes — Review

**Status:** VERIFIED
**Reviewer:** Codex MASTER
**Baseline:** `8e465febcde349901c9cb8ba8d0e8a04d3dc1173` plus pre-existing uncommitted V0.1/Kokoro implementation.

## Review result

No unresolved findings.

- Layout uses a bounded shell so the content pane owns scrolling while the navigation remains in its own full-height column.
- `新对话` is only rendered by Chat; History is browse/open only.
- Save actions use explicit payload constructors, while strict Zod schemas remain strict and reject `alreadySaved` if passed directly.
- Chat renders a temporary outgoing message with staged image bytes before awaiting the provider, clears the composer, and preserves a retryable error bubble.
- Persisted images are read through an ID-validated IPC method returning bytes and MIME type only; no filesystem path crosses preload.

## Independent evidence

- `npm run format`: passed.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm test -- --run`: passed, 21 files / 59 tests.
- `npm run build`: passed.
- External Electron smoke: passed with `JLA_STARTUP_DB_OK`; Vite selected port 5174 because 5173 was occupied.
- `npm run package:dir`: passed for macOS arm64; Electron bundle includes updated main/preload/renderer code.

## Unverified limitations

Manual GUI scrolling and real drag/drop on Windows were not executed in this macOS environment. Real AI/Kokoro calls remain outside automated tests.
