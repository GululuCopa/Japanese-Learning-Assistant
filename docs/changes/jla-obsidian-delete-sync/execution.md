# JLA Obsidian Delete Sync — Execution Evidence

**Executor:** right-side implementation writer (Grok 4.6)
**Date:** 2026-09-03
**Mode:** IMPLEMENT
**Host:** macOS darwin arm64
**Baseline:** `9192d1ec69de6a3bbbf4ca76e0680f8d02377650`
**Git operations:** none

## Summary

Deleting a collected note now goes through `AppServices.deleteNote()`. If `exportRelPath` is set, the exporter removes that exact Markdown file from the current Vault first; only then is the SQLite row deleted. Vault/path/permission failures keep the database row and return an actionable error. Missing files count as already synced. Screenshot assets are not deleted. MiniMax TTS uncommitted work was left in place.

## Tests first

`tests/obsidian-delete.test.ts` was run red against the old API:

```text
TypeError: app.deleteNote is not a function
```

The original `/private/tmp` repro was also red:

```text
FAIL: exported Obsidian file still exists after note deletion: .../Japanese/Sentences/今日はいい天気ですね。.md
```

After the orchestration was added, the focused suite went green (8 backend + 2 renderer). The `/private/tmp` repro then printed `PASS: exported Obsidian file removed`.

## Verification

### Focused

`npm test -- --run tests/obsidian-delete.test.ts`
Exit **0**. 8 passed.

```bash
node_modules/.bin/vite-node -r /private/tmp \
  -c /Users/renxiaowen/Desktop/japan-listener/vitest.config.ts \
  /private/tmp/jla-repro-delete-export.ts
```

Exit **0**. `PASS: exported Obsidian file removed`

### `npm run format:write` / `npm run format`

Exit **0**.

### `npm run lint`

Exit **0**.

### `npm run typecheck`

Exit **0**.

### `npm test -- --run`

Exit **0**.

```text
 Test Files  27 passed (27)
      Tests  103 passed (103)
```

Includes MiniMax tests (10 + 5) unchanged in behavior.

### `npm run build`

Exit **0**. main `87.66 kB`.

### `git diff --check`

Exit **0**.

## Deviations

- `/private/tmp/jla-repro-delete-export.ts` originally called `app.notes.delete` (repository-only). After the approved IPC path was `AppServices.deleteNote`, the repro was switched to `app.deleteNote` so the listed command exercises the real orchestration. `NotesService.delete` remains database-only and is used internally after the file is gone.
- Confirmation dialog is closed on both success and failure; failure keeps the note in the list and shows an error banner.

## Failures

None of the listed verification commands failed after implementation.

## Unverified areas

- Manual GUI delete of an exported note against a real Obsidian Vault on Windows.
- Live EACCES from a non-owner process (unit-tested via directory mode 0555 on this macOS host).

## Changed files (this packet)

```text
src/main/obsidian/export.ts
src/main/app-services.ts
src/main/ipc/register.ts
src/shared/types.ts
src/renderer/pages/NotesPage.tsx
tests/obsidian-delete.test.ts                    new
tests/renderer/notes-delete.test.tsx             new
tests/helpers/fake-api.ts
docs/changes/jla-obsidian-delete-sync/execution.md
```

MiniMax TTS files were not discarded. `docs/PRD.md`, `.DS_Store`, and `.omx/` were not modified. No Git commit was created.
