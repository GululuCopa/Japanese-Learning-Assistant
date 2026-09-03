# One-click environment check and desktop installation — Execution Evidence

**Executor:** right-side Herdr Grok 4.6 xhigh
**Date:** 2026-09-03
**Mode:** IMPLEMENT
**Host:** macOS darwin arm64, Node v24.12.0, npm 11.6.2
**Baseline:** `314c83e0cd2ee0a7d2bdd92107b1e278ae3e50a1`
**Git operations:** none

## Summary

Added Windows/macOS one-click entrypoints that resolve the repo from the script path and call `scripts/deploy-install.mjs`. Shared policy covers args, Node >=22 (warning above 22), win32/x64 and darwin/arm64, `npm.cmd` vs `npm`, unique `release/*-setup-x64.exe`, exact `release/mac-arm64/Japanese Learning Assistant.app`, and `$HOME/Applications/Japanese Learning Assistant.app` containment. README documents what the scripts do and do not do. Production `src/` and workflows were not modified.

## Tests first

`tests/deploy-install.test.ts` was red with `Cannot find module '../scripts/deploy-install-policy.mjs'`, then green after the policy/wrappers existed (**10 passed**).

## Verification

Commands run on 2026-09-03 in this IMPLEMENT session.

### `npm test -- --run tests/deploy-install.test.ts`

Exit **0**. 10 passed.

### `bash -n scripts/install.sh install-macos.command`

Exit **0**. `BASH_N_OK`

### `./install-macos.command --help`

Exit **0**. Printed Chinese usage for `--help` / `--check-only` / `--skip-checks` / `--package-only`.

### `(cd /tmp && .../install-macos.command --check-only)`

Exit **0**. From `/tmp`, resolved `项目目录：/Users/renxiaowen/Desktop/japan-listener`. Printed Node 24 warning `更高版本未经 CI 固定验证`, then `已选择 --check-only：未安装依赖，未构建，未安装应用。`

### PowerShell parse

`pwsh` and `powershell` were **not** on PATH (`NO_POWERSHELL`). `scripts/install.ps1` was not parser-checked.

### `npm run format`

Exit **0** after Prettier write of the new/edited files.

### `npm run lint`

Exit **0**.

### `npm run typecheck`

Exit **0**.

### `npm test -- --run`

Exit **0**.

```text
 Test Files  28 passed (28)
      Tests  113 passed (113)
```

Previous 27 files / 103 tests remain; plus 10 deploy-install tests.

### `npm run build`

Exit **0**. main `87.66 kB`.

### `npm run package:dir`

Exit **0**. `electron-builder 26.15.3` packaged `platform=darwin arch=arm64` to `release/mac-arm64`.

### `git diff --check`

Exit **0**.

### `git status --short`

```text
 M README.md
 M tsconfig.node.json
?? docs/changes/one-click-install/
?? install-macos.command
?? install-windows.cmd
?? scripts/deploy-install-policy.mjs
?? scripts/deploy-install.mjs
?? scripts/install.ps1
?? scripts/install.sh
?? tests/deploy-install.test.ts
```

`install-macos.command` and `scripts/install.sh` are executable (`-rwxr-xr-x`).

## Deviations

- `tsconfig.node.json` include gained `scripts/deploy-install-policy.mjs` so typecheck can import it from tests, matching `scripts/sqlite-abi-policy.mjs`. Not a runtime/src/workflow change.
- Default end-to-end `npm ci` + install/launch was not executed (would rebuild `node_modules` and write `$HOME/Applications`). `--check-only` and `package:dir` were executed instead.

## Failures

None of the listed available commands failed after Prettier/tsconfig fixes.

## Unverified areas

- Windows `install-windows.cmd` / `scripts/install.ps1` execution and PowerShell `Parser.ParseFile`.
- Live `npm run package:win`, NSIS setup launch, and installer exit-code propagation.
- Default macOS copy into `$HOME/Applications` and `open`.
- `--skip-checks` / `--package-only` full flows (covered by policy tests, not live npm ci).

## Changed files

```text
install-windows.cmd                              new
install-macos.command                            new, executable
scripts/install.ps1                              new
scripts/install.sh                               new, executable
scripts/deploy-install-policy.mjs                new
scripts/deploy-install.mjs                       new
tests/deploy-install.test.ts                     new
README.md
tsconfig.node.json
docs/changes/one-click-install/execution.md
```

`src/`, `.github/workflows/`, `docs/PRD.md`, `.DS_Store`, and `.omx/` were not modified. No Git commit was created.
