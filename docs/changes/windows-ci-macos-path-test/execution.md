# Execution evidence — Windows CI macOS path-policy test fix

**Plan:** `docs/changes/windows-ci-macos-path-test/plan.md`
**Status:** COMPLETE
**Executor:** OpenCode — DeepSeek V4 Pro
**Date:** 2026-09-03
**Baseline:** `f813f55d02e5d1e6a1c42993c88849aa31a33721` (verified `git rev-parse HEAD`)

## 1. Summary

Applied the approved test-only POSIX path fix to `tests/deploy-install.test.ts`:

- Added `const macPath = path.posix` alias.
- macOS `selectMacApp` test now passes `macPath` as the `pathApi` argument and uses
  `macPath.sep` / `macPath.join`, so it no longer depends on the runner's default `path.sep`.
- macOS `assertMacInstallTarget` test now constructs `expected`, `Applications`, `Desktop`,
  `..` paths with `macPath.join`, and passes `macPath` as the `pathApi` argument to every
  `assertMacInstallTarget` call.

No production code, install scripts, README, workflow, or protected files were modified.
The test still invokes the real policy functions; only the test's path semantics are pinned
to POSIX/macOS.

## 2. Changed files

- `tests/deploy-install.test.ts` (test-only change)

Only one tracked file is modified. `docs/changes/windows-ci-macos-path-test/` remains
untracked (plan + this evidence). Confirmed via `git status` and `git diff`.

## 3. Verification results

All commands from the plan's "Verification commands" section were run exactly as listed,
from the repository root, with results and exit codes below.

### 3.1 Focused test

```bash
npm test -- --run tests/deploy-install.test.ts
```

```
 RUN  v3.2.7 /Users/renxiaowen/Desktop/japan-listener
 ✓ tests/deploy-install.test.ts (10 tests) 6ms
 Test Files  1 passed (1)
      Tests  10 passed (10)
```

Exit: 0

### 3.2 Format

```bash
npm run format
```

```
Checking formatting...
All matched files use Prettier code style!
```

Exit: 0

### 3.3 Lint

```bash
npm run lint
```

No output (clean). Exit: 0

### 3.4 Typecheck

```bash
npm run typecheck
```

No output (clean). Exit: 0

### 3.5 Full test suite

```bash
npm test -- --run
```

```
 Test Files  28 passed (28)
      Tests  113 passed (113)
```

Exit: 0

### 3.6 Build

```bash
npm run build
```

```
vite v6.4.3 building SSR bundle for production... (main / preload / renderer)
✓ built in 128ms / 8ms / 303ms
```

Exit: 0

### 3.7 Shell syntax check

```bash
bash -n scripts/install.sh install-macos.command
```

Exit: 0

### 3.8 Help smoke test

```bash
./install-macos.command --help
```

Printed the expected help text (usage / options / notes). Exit: 0

### 3.9 Check-only smoke test (from /tmp, absolute path)

```bash
(cd /tmp && /Users/renxiaowen/Desktop/japan-listener/install-macos.command --check-only)
```

```
操作系统：darwin arm64
Node.js：v24.12.0
npm：11.6.2
项目目录：/Users/renxiaowen/Desktop/japan-listener
警告：当前 Node.js 为 24，推荐使用 Node.js 22。更高版本未经 CI 固定验证。
环境检查通过。
已选择 --check-only：未安装依赖，未构建，未安装应用。
```

Exit: 0

### 3.10 Diff whitespace check

```bash
git diff --check
```

Exit: 0 (no whitespace errors)

## 4. Diff summary

`git diff -- tests/deploy-install.test.ts` shows only the intended additions:

- `+const macPath = path.posix`
- `selectMacApp(...)` now receives `macPath` and uses `macPath.sep` / `macPath.join`.
- `assertMacInstallTarget(...)` calls now receive `macPath` and use `macPath.join` for
  `expected`, `Applications`, `Desktop`, and `..` paths.

## 5. Deviations

None. Only the approved test-only POSIX path fix was applied. No production code, install
scripts, README, workflow, or protected files were modified. No commit, push, rebase, or
checkout was performed.

## 6. Unverified areas

- **Windows runner execution**: The fix is designed to make the test pass on Windows
  (GitHub Actions job `100693170240`), but the Windows runner was not available locally.
  Verification here was performed on `darwin arm64` only. The fix was reasoned against the
  failure mode (Windows `path.join` vs `path.resolve` divergence on `/Users/...` POSIX input)
  and by forcing `path.posix` semantics, which is platform-independent.
- **PowerShell installer (`scripts/install.ps1`, `install-windows.cmd`)**: not executed locally
  (macOS host). Only their referenced wrapper wiring is asserted by the test suite
  (`tests/deploy-install.test.ts` "wires root entrypoints...").

## 7. Rollback

Revert `tests/deploy-install.test.ts` (and delete this evidence doc) to restore the prior
state. No other files were touched.
