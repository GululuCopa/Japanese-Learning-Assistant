# Windows V0.1 Review Findings

**Status:** VERIFIED  
**Reviewer:** MASTER  
**Date:** 2026-09-01  
**Baseline:** `8e465febcde349901c9cb8ba8d0e8a04d3dc1173`

Only the unresolved findings below are in scope for `FIX_REVIEW`.

## JLA-001 — High — Fresh development startup fails because native SQLite has the wrong ABI

**Affected behavior:** documented Windows/macOS development flow and Task 1 acceptance.

**Evidence:** after restoring the normal Node ABI and running the documented flow, `ELECTRON_ENABLE_LOGGING=1 npm run dev` reached Electron startup and failed with:

```text
better_sqlite3.node was compiled against NODE_MODULE_VERSION 137.
This version of Node.js requires NODE_MODULE_VERSION 133.
```

`package.json` has no lifecycle/script that reliably prepares `better-sqlite3` for Electron before `dev`. Conversely, packaging rebuilds it for Electron and then ordinary Node/Vitest tests fail until `npm rebuild better-sqlite3`.

**Required correction:** make the supported scripts self-preparing and deterministic. At minimum:

- `npm run dev` must prepare the Electron ABI automatically;
- `npm test -- --run` must prepare the Node ABI automatically;
- packaging must still produce the Electron/Windows ABI;
- README must document the actual automatic behavior rather than requiring users to understand ABI state;
- add a lightweight regression assertion for the relevant lifecycle scripts/configuration where practical.

Do not replace SQLite or change the approved architecture.

## JLA-002 — Medium — The repository's formatting verification command fails

**Affected files:** 26 source, test, README, and execution-evidence files reported by Prettier.

**Evidence:** `npm run format` exits 1 with `Code style issues found in 26 files`.

**Required correction:** format approved implementation files, tests, README, and `execution.md`; then make `npm run format` pass. Do not reformat or edit `docs/PRD.md`, `context.md`, `design.md`, or `tasks.md`.

## JLA-003 — High — Native image picker reads unbounded files in the privileged main process

**Affected behavior:** `src/main/ipc/register.ts`, Task 4's maximum four images / 10 MiB validation, and the secure IPC boundary.

**Evidence:** `attachments:pick` accepts unlimited selections and calls `readFile(filePath)` before checking count or byte size. Renderer validation occurs only after all selected files have already been loaded and base64-encoded by main.

**Required correction:** enforce the maximum count before reading; check each file's size before `readFile`; reject oversized/invalid selections with actionable errors; keep MIME magic-byte validation; add unit coverage for too many and oversized native-picker files by extracting a testable helper if needed. Keep the limits centralized in shared constants.

## JLA-004 — Medium — Non-JSON provider bodies are not categorized as invalid responses

**Affected behavior:** `OpenAICompatibleAIProvider.complete`, provider error contract.

**Evidence:** `response.json()` parse failure escapes as a plain error. Conversation handling categorizes it as `unknown`, although the frozen design requires malformed provider output to be categorized as `invalid_response`.

**Required correction:** map response-body JSON/shape parsing failures to `ProviderError('invalid_response', ...)`; preserve the single bounded structured repair behavior; add a provider test proving a successful HTTP response with a non-JSON or invalid wire body produces `invalid_response` rather than `unknown`.

## Required Re-verification

Record fresh results in `execution.md`:

```bash
npm ci
npm run format
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run dev
npm run package:dir
npm run package:win
```

For `npm run dev`, a bounded GUI/startup smoke is sufficient: prove the database initializes and no native ABI/unhandled startup error occurs, then stop it cleanly. Packaging remains last because it may leave the native module in Electron/target ABI state. Report Windows execution limitations honestly.

## JLA-001 Follow-up — Still unresolved after first FIX_REVIEW

**Independent evidence:** immediately after the executor's successful `package:win`, the MASTER ran:

```bash
node scripts/ensure-sqlite-abi.mjs node
node -e "const Database=require('better-sqlite3'); const db=new Database(':memory:')"
```

The helper exited 0 without rebuilding, while actual database construction failed with `ERR_DLOPEN_FAILED` (`slice is not valid mach-o file`) because the installed binding was the Windows target. `require('better-sqlite3')` alone does not force the native binding to load.

**Required correction:** ABI inspection must perform a real in-memory database open/close (or another definitive native-binding load), not merely require the JS wrapper. It must rebuild Node after either module-version mismatch or wrong-platform native binary. Add a regression test that demonstrates the probe invokes real database construction, and independently verify this sequence:

```bash
npm run package:win
npm test -- --run
```

The second command must automatically restore the Node/current-host binding and pass, without a manual `npm rebuild`. Also re-run format, lint, typecheck, build, and the bounded dev startup smoke. Update `execution.md` with this follow-up evidence.

## JLA-005 — High — Packaged runtime uses an Electron version with known high-severity advisories

**Affected behavior:** packaged Windows/macOS runtime and security acceptance.

**Evidence:** on 2026-09-01, `npm audit --json` reports 2 high vulnerabilities. The direct `electron@35.7.5` dependency is affected by multiple Electron advisories, including high-severity use-after-free/sandbox issues; `extract-zip` is transitively affected through Electron. npm reports a fix available at stable `electron@44.1.0`.

**Required correction:** upgrade Electron to a current non-vulnerable stable release (use `44.1.0` unless repository compatibility evidence requires another stable version that produces zero high/critical audit findings). Update the lockfile and any directly related compatibility configuration only. Do not suppress or ignore audit findings.

Required verification:

```bash
npm ci
npm audit --audit-level=high
npm run format
npm run lint
npm run typecheck
npm test -- --run
npm run build
JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev
npm run package:dir
CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:win
npm test -- --run
```

Confirm the Windows executable and packaged `better_sqlite3.node` remain x86-64 PE files, and record any Electron 44 compatibility changes or failures in `execution.md`.

## JLA-006 — High — macOS development renderer is blank because duplicate CSP directives block the React preamble

**Reported behavior:** macOS `npm run dev` opens a white Electron window.

**Reproduction:** `ELECTRON_ENABLE_LOGGING=1 npm run dev` (with the existing dev server occupied, the new renderer used `http://localhost:5174/`) produced:

```text
Ignoring duplicate Content-Security-Policy directive 'script-src'.
Ignoring duplicate Content-Security-Policy directive 'connect-src'.
Ignoring duplicate Content-Security-Policy directive 'style-src'.
Executing inline script violates ... script-src 'self'.
Uncaught Error: @vitejs/plugin-react can't detect preamble. Something is wrong.
```

The cause is `src/main/index.ts`: development directives are appended to a policy that already contains `script-src`, `connect-src`, and `style-src`. Chromium honors the first directive and ignores the later development override, so the Vite React preamble is blocked and React never mounts.

**Required correction:** change the CSP builder so each directive appears once. Production must retain the strict policy. Development must explicitly allow only the local Vite requirements (`unsafe-eval`/`unsafe-inline` and localhost Vite/HMR endpoints) in the single corresponding directives. Do not weaken production CSP or allow arbitrary remote origins.

Add a focused regression test at a testable seam proving:

- production policy has no duplicate directive names and does not include development localhost/unsafe directives;
- development policy has no duplicate directive names and includes the required local Vite allowances.

After the fix independently verify:

```bash
npm run format
npm run lint
npm run typecheck
npm test -- --run
ELECTRON_ENABLE_LOGGING=1 npm run dev
```

The dev smoke must show the normal React/Vite startup without `@vitejs/plugin-react can't detect preamble`, and a bounded smoke hook must still print `JLA_STARTUP_DB_OK`. Update `execution.md` with the white-screen reproduction and fresh results. Preserve Windows behavior and protected files.
