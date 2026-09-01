# Japanese Learning Assistant V0.1 — Execution Evidence

**Executor:** right-side implementation writer (Grok 4.6)  
**Date:** 2026-09-01  
**Mode:** FIX_REVIEW (JLA-006; JLA-001–JLA-005 accepted)  
**Host:** macOS darwin arm64, Node v24.12.0  
**Baseline:** `8e465febcde349901c9cb8ba8d0e8a04d3dc1173`  
**Git operations:** none (no commit, rebase, checkout, reset, or destructive Git commands)

## Packet validation

- HEAD remains `8e465febcde349901c9cb8ba8d0e8a04d3dc1173`
- Findings JLA-001–JLA-004 required no design/stack/PRD change
- JLA-005 required Electron 44.1.0 plus directly related native/packaging compatibility only
- JLA-006 is a CSP construction bug only; production policy stays strict
- `docs/PRD.md`, `context.md`, `design.md`, `tasks.md`, `review.md` were not edited
- Pre-existing untracked files were left untouched: `.DS_Store`, `docs/.DS_Store`, `.omx/`

## Finding resolutions

### JLA-001

`scripts/ensure-sqlite-abi.mjs` rebuilds `better-sqlite3` only when the compiled NODE_MODULE_VERSION does not match the requested runtime.

- `npm run dev` → Electron ABI, then `electron-vite dev`
- `npm test` / `npm test -- --run` → Node ABI, then Vitest
- `package:dir` / `package:win` still use electron-builder native rebuild

README now describes that automatic behavior. Regression: `tests/sqlite-abi-scripts.test.ts`.

Smoke hook: after SQLite opens, main prints `JLA_STARTUP_DB_OK`. `JLA_SMOKE=1` then quits without a window.

### JLA-001 Follow-up

`require('better-sqlite3')` does not load the `.node` file; `new Database(':memory:')` does. After `package:win` the binding was `PE32+` Windows x64: `require` succeeded and the old helper exited 0, while a real open failed with `ERR_DLOPEN_FAILED` (`slice is not valid mach-o file`).

The probe now opens and closes an in-memory database. Node rebuilds on module-version mismatch **or** wrong-platform `dlopen`. Regression: `tests/sqlite-abi-scripts.test.ts` (probe must be called with `':memory:'` and `close()`; `ERR_DLOPEN_FAILED` / invalid mach-o forces Node rebuild; this process can `SELECT 1` on `:memory:`).

### JLA-005

Upgraded the packaged runtime from `electron@35.7.5` to pinned `electron@44.1.0`. `npm audit --audit-level=high` reports **0** vulnerabilities (previously 2 high: Electron use-after-free/sandbox and `extract-zip` via Electron).

Directly required compatibility (no architecture change):

- `better-sqlite3` 11.10.0 does not compile against Electron 44 V8 headers (`GetIsolate`, `External::Value` tag). Raised to `^13.0.3`, which uses **N-API prebuilds**.
- `electron-builder.yml` `npmRebuild: false` so Windows packaging from macOS does not try to cross-compile natives; the app loads `prebuilds/${platform}-${arch}.node` at runtime.
- ABI helper skips rebuild when an in-memory database already opens (N-API host prebuild is valid in Electron).
- `scripts/ensure-sqlite-abi.mjs` calls `require('electron')` so Electron 44's lazy binary/`path.txt` exists before electron-vite.
- `electron.vite.config.ts` sets `build.target: 'node22'` because electron-vite 3.1's Node target table stops at Electron 35.

### JLA-006

macOS `npm run dev` showed a white window because development CSP strings were **appended** to the production policy. Chromium kept the first `script-src`/`connect-src`/`style-src` (`'self'` only) and ignored the Vite overrides (`Ignoring duplicate Content-Security-Policy directive`). The React refresh preamble then failed (`@vitejs/plugin-react can't detect preamble`).

`buildContentSecurityPolicy` in `src/main/content-security-policy.ts` now emits each directive **once**. Production is the existing strict map. Development replaces only `script-src`, `style-src`, and `connect-src` with local Vite/HMR values (`unsafe-eval`, `unsafe-inline`, `http://localhost:*`, `http://127.0.0.1:*`, `ws://localhost:*`, `ws://127.0.0.1:*`). No remote origins. Tests: `tests/content-security-policy.test.ts`.

### JLA-002

Approved implementation, tests, README, and this file were formatted. Packet docs listed above stay ignored by Prettier. `npm run format` exits 0.

### JLA-003

Native picker staging lives in `src/main/attachments/pick.ts`:

- count `MAX_IMAGES_PER_MESSAGE` before any stat/read
- `statSize` vs `MAX_IMAGE_BYTES` before `readFile`
- magic-byte MIME check after a size-bounded read
- actionable errors; Composer surfaces picker failures

`.gitignore` pattern `attachments/` was ignoring `src/main/attachments/`; it is now `/attachments/` so only a repo-root runtime folder is ignored. Tests: `tests/image-picker.test.ts`.

### JLA-004

`OpenAICompatibleAIProvider.complete` maps `response.json()` failures to `ProviderError('invalid_response')`. Structured-output repair (one retry) is unchanged. Test: successful HTTP 200 with body `not-json {` rejects with `invalid_response`.

## Required re-verification (FIX_REVIEW order)

### `npm ci`

Exit **0**. `added 589 packages, and audited 590 packages in 25s`. Same npm deprecation warnings and `2 high severity vulnerabilities` as before; not treated as command failures.

### `npm run format`

Exit **0**. `All matched files use Prettier code style!`

### `npm run lint`

Exit **0**.

### `npm run typecheck`

Exit **0**.

### `npm test -- --run`

Exit **0**. Script invoked `node scripts/ensure-sqlite-abi.mjs node && vitest --run`.

```text
Test Files  15 passed (15)
     Tests  36 passed (36)
```

### `npm run build`

Exit **0**.

```text
out/main/index.js  65.99 kB
out/preload/index.js  2.16 kB
out/renderer/assets/index-bjLJGfG6.js  263.49 kB
```

### `npm run dev`

Bounded smoke: `JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev`

Exit **0**. Log included `JLA_STARTUP_DB_OK`. No `NODE_MODULE_VERSION` mismatch. Electron quit from the smoke hook after database init.

### `npm run package:dir`

Exit **0**. `release/mac-arm64/Japanese Learning Assistant.app` (darwin arm64 unpacked). electron-builder rebuilt `better-sqlite3` for Electron arm64.

### `npm run package:win`

Exit **0** with `CSC_IDENTITY_AUTO_DISCOVERY=false`.

```text
appOutDir=release/win-unpacked
building target=nsis file=release/Japanese Learning Assistant-0.1.0-setup-x64.exe
```

Installer ~79 MiB. Not launched on Windows.

electron-builder printed that `@electron/rebuild` is also a direct devDependency. That package is required by `ensure-sqlite-abi.mjs`; it was not removed. A `postinstall: electron-builder install-app-deps` hook was **not** added, because that would force the Electron ABI after `npm ci` and break Node tests.

## JLA-001 follow-up re-verification

Independent pre-check immediately after `package:win`, before `npm test`:

```text
better_sqlite3.node: PE32+ executable (DLL) (GUI) x86-64, for MS Windows
require-ok
open-fail ERR_DLOPEN_FAILED ... slice is not valid mach-o file
```

### `npm run package:win`

Exit **0** (`CSC_IDENTITY_AUTO_DISCOVERY=false`). Rebuilt `better-sqlite3` for Electron win x64, wrote `release/win-unpacked` and `Japanese Learning Assistant-0.1.0-setup-x64.exe`.

### `npm test -- --run` (must restore host Node ABI, no manual rebuild)

Exit **0**. Helper printed `rebuilt dependencies successfully` then Vitest ran.

```text
> node scripts/ensure-sqlite-abi.mjs node && vitest --run
rebuilt dependencies successfully
Test Files  15 passed (15)
     Tests  40 passed (40)
```

### `npm run format`

Exit **0**. `All matched files use Prettier code style!`

### `npm run lint`

Exit **0**.

### `npm run typecheck`

Exit **0**.

### `npm run build`

Exit **0**. `out/main/index.js` 65.99 kB.

### bounded `npm run dev`

`JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev` exit **0**. Log included `JLA_STARTUP_DB_OK`. No `NODE_MODULE_VERSION` error.

## JLA-005 re-verification

Exact command order from the finding:

### `npm ci`

Exit **0**. `added 564 packages, and audited 565 packages in 5s` then `found 0 vulnerabilities`.

### `npm audit --audit-level=high`

Exit **0**.

```text
found 0 vulnerabilities
```

No `--audit-level` ignore/suppress flags were used.

### `npm run format` / `lint` / `typecheck`

All exit **0**.

### `npm test -- --run` (before packaging)

Exit **0**. `Test Files 15 passed (15)`, `Tests 41 passed (41)`.

### `npm run build`

Exit **0**. Electron-vite production build of main/preload/renderer.

### bounded `npm run dev`

`JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev` exit **0**. Log: `start electron app...` then `JLA_STARTUP_DB_OK`. No `NODE_MODULE_VERSION` error. First attempt failed with electron-vite `Error: Electron uninstall` until the ABI helper forced the Electron 44 binary download.

### `npm run package:dir`

Exit **0**. `packaging platform=darwin arch=arm64 electron=44.1.0 appOutDir=release/mac-arm64`. `skipped dependencies rebuild reason=npmRebuild is set to false`.

### `CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:win`

Exit **0**. `packaging platform=win32 arch=x64 electron=44.1.0 appOutDir=release/win-unpacked`. NSIS `Japanese Learning Assistant-0.1.0-setup-x64.exe` (~107 MiB).

Artifact inspection:

```text
Japanese Learning Assistant.exe: PE32+ executable (GUI) x86-64, for MS Windows
prebuilds/win32-x64.node: PE32+ executable (DLL) (GUI) x86-64, for MS Windows
```

### `npm test -- --run` (after `package:win`)

Exit **0**. `Tests 41 passed (41)`. Host Node still opens `:memory:` via the darwin N-API prebuild (no manual `npm rebuild`).

## JLA-006 re-verification

### `npm run format` / `lint` / `typecheck`

All exit **0**.

### `npm test -- --run`

Exit **0**. `Test Files 16 passed (16)`, `Tests 43 passed (43)` including CSP uniqueness tests.

### `ELECTRON_ENABLE_LOGGING=1 npm run dev` (real window, not JLA_SMOKE)

Ran ~15s then stopped. Log included:

```text
JLA_STARTUP_DB_OK
[vite] connecting...
[vite] connected.
Download the React DevTools for a better development experience
```

Grep for `Ignoring duplicate Content-Security-Policy` and `can't detect preamble`: **no matches**. Chromium printed the packaged-app-only warning that development `script-src` includes `unsafe-eval` (expected).

### bounded `JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev`

Exit **0**. Log included `JLA_STARTUP_DB_OK`.

## Deviations / unverified

- Default Electron icon
- Vitest `environmentMatchGlobs` deprecation (non-failing)
- `npm audit --audit-level=high` is clean after Electron 44.1.0 (0 high/critical)
- Windows installer/app not executed on Windows 10/11 (SmartScreen, DPAPI, native dialogs, `D:\` vaults, packaged sqlite load, Actions `windows-latest`)
- Full Chat/Notes/History/Settings click-through in the live window was not a JLA-006 acceptance item; renderer mount was confirmed via Vite/React console logs
- Windows packaged N-API load of `prebuilds/win32-x64.node` inside Electron 44 was not executed on a Windows host
- Installer size grew (~79 MiB → ~107 MiB) because all better-sqlite3 platform prebuilds are packed

## Exact changed files

Untracked/modified implementation files after FIX_REVIEW (not committed). Packet docs that already existed and were not edited are listed separately.

### JLA-006

```text
src/main/content-security-policy.ts
src/main/index.ts
tests/content-security-policy.test.ts
docs/changes/japanese-learning-assistant-v0.1-windows/execution.md
```

### JLA-005

```text
package.json
package-lock.json
electron-builder.yml
electron.vite.config.ts
scripts/ensure-sqlite-abi.mjs
scripts/sqlite-abi-policy.mjs
tests/sqlite-abi-scripts.test.ts
docs/changes/japanese-learning-assistant-v0.1-windows/execution.md
```

### JLA-001 follow-up only

```text
scripts/ensure-sqlite-abi.mjs
scripts/sqlite-abi-policy.mjs
tests/sqlite-abi-scripts.test.ts
docs/changes/japanese-learning-assistant-v0.1-windows/execution.md
```

### Added or updated for JLA-001–JLA-004 (plus formatted implementation)

```text
.gitignore
.prettierignore
README.md
package.json
package-lock.json
eslint.config.mjs
tsconfig.node.json
scripts/ensure-sqlite-abi.mjs
scripts/sqlite-abi-policy.mjs
src/main/ai/openai-compatible.ts
src/main/attachments/pick.ts
src/main/attachments/store.ts
src/main/index.ts
src/main/ipc/register.ts
src/renderer/components/Composer.tsx
tests/ai-provider.test.ts
tests/image-picker.test.ts
tests/sqlite-abi-scripts.test.ts
docs/changes/japanese-learning-assistant-v0.1-windows/execution.md
```

Prettier also rewrote other already-approved `src/**` and `tests/**` files, `electron.vite.config.ts`, workflow YAML, and README-adjacent config so `npm run format` passes. Those remain implementation/docs/config files, not packet spec docs.

### Packet files not edited

```text
docs/PRD.md
docs/changes/japanese-learning-assistant-v0.1-windows/context.md
docs/changes/japanese-learning-assistant-v0.1-windows/design.md
docs/changes/japanese-learning-assistant-v0.1-windows/tasks.md
docs/changes/japanese-learning-assistant-v0.1-windows/review.md
```

### Preserved and not staged

```text
.DS_Store
docs/.DS_Store
.omx/
```

### Generated locally (gitignored)

```text
node_modules/
out/
release/
```
