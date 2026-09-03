# JLA Obsidian Delete Sync — Plan

**Status:** VERIFIED
**Mode:** IMPLEMENT
**Master:** Codex
**Executor:** 右侧 Herdr Grok 4.6 xhigh（唯一实现文件写入者）
**Date:** 2026-09-03
**Baseline commit:** `9192d1ec69de6a3bbbf4ca76e0680f8d02377650`

## Objective

删除应用内收藏笔记时，如果该笔记已经导出到当前配置的 Obsidian Vault，同时删除其已记录的 Markdown 文件；如果 Obsidian 删除失败，则保留应用数据库记录并向用户显示可操作错误，避免出现“应用里已删除但 Vault 文件残留”的不一致。

## Non-goals

- 不扫描或批量整理整个 Vault。
- 不删除未被 `note.exportRelPath` 明确记录的文件。
- 不删除导出截图资产；当前 schema 未持久化精确导出资产路径，贸然推断会有误删风险。
- 不同步用户在 Obsidian 中主动删除/重命名的文件回应用。
- 不引入文件监听、双向同步、云同步或数据库 schema 迁移。
- 不修改 AI、TTS、对话、图片分析或 MiniMax 设计。

## Reproduction and current evidence

Deterministic red-capable command already run repeatedly:

```bash
node_modules/.bin/vite-node -r /private/tmp \
  -c /Users/renxiaowen/Desktop/japan-listener/vitest.config.ts \
  /private/tmp/jla-repro-delete-export.ts
```

Observed twice:

```text
FAIL: exported Obsidian file still exists after note deletion: .../Japanese/Sentences/今日はいい天気ですね。.md
```

Source evidence:

- `NotesService.delete()` only calls `repos.deleteNote(id)`.
- `src/main/ipc/register.ts` routes `notes:delete` directly to `services.notes.delete(id)`.
- `ObsidianExporter.exportNote()` records the relative Markdown path in `note.exportRelPath`, but there is no inverse deletion operation.
- `NotesPage` awaits deletion without catching/displaying filesystem errors.

## Ranked hypotheses and disposition

1. **Confirmed:** delete path only removes the SQLite row and never invokes the exporter/filesystem.
2. **Confirmed:** `exportRelPath` exists but is ignored by deletion.
3. **Confirmed:** renderer has no deletion failure state, so IPC rejection is not actionable.
4. **Rejected as primary cause:** export failure/path generation; reproduction proves export succeeds and file exists before deletion.

## Approved design

### Main-process orchestration

Add an `AppServices.deleteNote(id)` orchestration method:

1. Load the note before any deletion.
2. If `exportRelPath` exists, request `ObsidianExporter` to remove that exact Markdown file from the current configured Vault.
3. Only after the external deletion succeeds or the file is already absent, delete the SQLite note row.
4. Return a typed result with a user-facing success message and whether an Obsidian file was removed.
5. If Vault validation or filesystem deletion fails, throw an actionable error and do **not** delete the database row.

Change IPC `notes:delete` to call `services.deleteNote(id)` rather than the repository-only notes service method.

### Safe file deletion

Add a focused exporter deletion method accepting a full `NoteRecord` and current Vault path.

- If `exportRelPath` is absent, perform no filesystem operation.
- Require a configured, existing, writable Vault using the existing validation path.
- Split the recorded relative path and require the exact app-owned shape:
  - `Japanese/Words/<file>.md` for word
  - `Japanese/Sentences/<file>.md` for sentence
  - `Japanese/Grammar/<file>.md` for grammar
- Reject traversal, unexpected folder/kind, non-Markdown target, or directories.
- Resolve under the Vault and additionally verify the real parent directory remains under the real Vault root so a symlinked parent cannot escape.
- Delete only the recorded Markdown file. Missing file (`ENOENT`) counts as already synchronized and permits database deletion.
- Do not infer/delete screenshots or other files.

The current configured Vault is the only available safe root in the existing schema. The UI must state that an exported file in the **current configured Vault** will also be deleted. No arbitrary paths are accepted from renderer input.

### Shared/renderer contract

Add a result shape such as:

```ts
interface DeleteNoteResult {
  ok: true
  obsidianFileDeleted: boolean
  message: string
}
```

Update `JapaneseAssistantAPI.notes.delete()` and preload typing accordingly; IPC payload remains `{ id }` validated by `idSchema`.

Update `NotesPage`:

- Confirmation copy says an exported Markdown file in the current configured Vault will also be removed.
- On success, close dialog, refresh list, and display result message.
- On failure, do not optimistically remove the note; close or retain the dialog consistently and show an error banner with the IPC error message.
- Preserve export success messaging and existing tabs/search behavior.

## Pre-existing dirty files

The verified but uncommitted MiniMax TTS task is pre-existing and must be preserved exactly. In particular, `src/main/app-services.ts` and several tests are already modified. Extend them without discarding MiniMax work.

```text
M src/main/app-services.ts
M src/main/settings/service.ts
M src/renderer/pages/SettingsPage.tsx
M src/renderer/styles/app.css
M src/shared/constants.ts
M src/shared/schemas.ts
M src/shared/tts.ts
M src/shared/types.ts
M tests/helpers/app.ts
M tests/helpers/fake-api.ts
M tests/obsidian-export.test.ts
M tests/prd-cases.test.ts
M tests/renderer/app.test.tsx
M tests/renderer/chat-history.test.tsx
M tests/renderer/settings-tts.test.tsx
M tests/settings-secrets.test.ts
M tests/settings-voice.test.ts
?? docs/changes/jla-minimax-tts/
?? src/main/tts/minimax.ts
?? tests/minimax-tts.test.ts
?? tests/settings-minimax.test.ts
```

Do not modify/delete `docs/PRD.md`, `.DS_Store`, `docs/.DS_Store`, or `.omx/`.

## Expected affected files/modules

- `src/main/obsidian/export.ts`
- `src/main/app-services.ts` (preserve MiniMax changes)
- `src/main/ipc/register.ts`
- `src/shared/types.ts` (preserve MiniMax changes)
- `src/renderer/pages/NotesPage.tsx`
- `tests/helpers/fake-api.ts` if required
- new focused backend regression test, preferably `tests/obsidian-delete.test.ts`
- new/updated renderer test for success/failure messaging
- `docs/changes/jla-obsidian-delete-sync/execution.md`

## Implementation steps

1. Add the focused regression test first and run it to capture the expected red failure matching the user symptom.
2. Implement safe exporter deletion and AppServices orchestration.
3. Route IPC through orchestration and update shared/preload-facing return types.
4. Add renderer confirmation and success/failure handling.
5. Verify database retention on deletion failure, missing-file idempotence, non-exported note deletion, and path/symlink protections.
6. Re-run the original `/private/tmp/jla-repro-delete-export.ts` feedback loop and the full suite.
7. Record red/green evidence, exact commands, deviations, and unverified areas in `execution.md`.

## Acceptance criteria

- Exported sentence Markdown is absent after deleting its collection record.
- Exported word and grammar files use the same behavior through kind-specific path validation.
- A non-exported note deletes from SQLite without requiring a Vault.
- An already missing exported file is treated as synchronized and the database note is deleted.
- Invalid/missing Vault, filesystem permission failure, malformed export path, kind-folder mismatch, directory target, or realpath escape prevents database deletion and returns an actionable error.
- The renderer displays success and failure; it does not silently remove the item when external deletion fails.
- Only the exact recorded app Markdown file is removed; no screenshot assets or unrelated Vault files are deleted.
- Existing Obsidian export behavior, MiniMax TTS changes, and the rest of the suite remain green.

## Verification commands

Focused/red-green:

```bash
npm test -- --run tests/obsidian-delete.test.ts
node_modules/.bin/vite-node -r /private/tmp \
  -c /Users/renxiaowen/Desktop/japan-listener/vitest.config.ts \
  /private/tmp/jla-repro-delete-export.ts
```

Full:

```bash
npm run format:write
npm run format
npm run lint
npm run typecheck
npm test -- --run
npm run build
git diff --check
```

## Compatibility and rollback

- No SQL migration; existing `exportRelPath` is reused.
- Existing callers compile against the new typed delete result.
- Files already missing in Obsidian do not block cleanup of stale database records.
- Rollback restores database-only deletion behavior; no bulk or irreversible migration occurs.

## Unresolved questions

None blocking under the default conservative design. Full historical Vault tracking and screenshot-asset cleanup require separate schema/design work.
