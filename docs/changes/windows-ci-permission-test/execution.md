# Windows CI Permission Test — Execution Evidence

**Executor:** Herdr Grok 4.6 xhigh
**Date:** 2026-09-03
**Mode:** IMPLEMENT
**Host:** macOS darwin arm64
**Baseline:** `5a9fb898d4401efb69427a6b33a3f398f76e809e`
**Git operations:** none

## Summary

The Obsidian delete permission case no longer uses Unix `chmod 0555`. It spies `fs.unlinkSync`, throws `EPERM` for the exported Markdown path, still calls `AppServices.deleteNote()`, and restores the spy in `finally`. SQLite row and Markdown file remain. Production code and GitHub workflow were not modified.

## Verification

Commands run on 2026-09-03 in this IMPLEMENT session.

### `npm test -- --run tests/obsidian-delete.test.ts`

Exit **0**.

```text
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

### `npm run format`

Exit **0**. `All matched files use Prettier code style!`

### `npm run lint`

Exit **0**. `ESLint: No issues found`

### `npm run typecheck`

Exit **0**.

### `npm test -- --run`

Exit **0**.

```text
 Test Files  27 passed (27)
      Tests  103 passed (103)
```

### `npm run build`

Exit **0**. main `87.66 kB`.

### `git diff --check`

Exit **0**.

`git status` shows only `tests/obsidian-delete.test.ts` and this packet under `docs/changes/windows-ci-permission-test/`.

## Deviations

None. `vi.spyOn(fs, 'unlinkSync')` intercepts the production `fs.unlinkSync` call; no production seam was added.

## Failures

None of the listed commands failed.

## Unverified areas

- GitHub Actions `windows-latest` job was not re-run from this host. The test no longer depends on NTFS chmod behavior, but live Windows CI remains a release check.

## Changed files

```text
tests/obsidian-delete.test.ts
docs/changes/windows-ci-permission-test/execution.md
```

`docs/PRD.md`, `.github/workflows/`, production source, `.DS_Store`, and `.omx/` were not modified. No Git commit was created.
