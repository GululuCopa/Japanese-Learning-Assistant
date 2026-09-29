# AGENTS.md

Guidance for AI coding agents (Devin, etc.) working in this repository.

## Project

Japanese Learning Assistant — an Electron + React + TypeScript desktop app that
analyses Japanese text and screenshots (reading, translation, vocabulary,
grammar), plays pronunciation, and exports notes to Obsidian. Target platform is
Windows 10/11 x64; macOS is supported for development. See `README.md` (Chinese)
and `docs/PRD.md` for product details.

## Environment

- Node.js 22 (matches `.github/workflows/windows.yml`). npm is the package
  manager; `package-lock.json` is committed, so install with `npm ci`.
- `better-sqlite3` is a native module. `npm run dev` and `npm test` first run
  `scripts/ensure-sqlite-abi.mjs`, which rebuilds the binding for the Electron
  or Node ABI as needed. If you see `NODE_MODULE_VERSION` errors, run
  `npm run rebuild:sqlite:node` or `npm run rebuild:sqlite:electron`.
- No secrets are required for lint, typecheck, tests or build. AI API keys are
  entered at runtime in the app's settings and stored in Electron `userData`;
  never commit real keys. `.env.example` only documents optional local
  developer overrides.

## Commands

| Task          | Command                |
| ------------- | ---------------------- |
| Install       | `npm ci`               |
| Lint          | `npm run lint`         |
| Typecheck     | `npm run typecheck`    |
| Tests         | `npm test -- --run`    |
| Format check  | `npm run format`       |
| Format write  | `npm run format:write` |
| Build         | `npm run build`        |
| Run app (dev) | `npm run dev`          |

CI (`.github/workflows/windows.yml`, `windows-latest`) runs lint, typecheck,
tests, build and `npm run package:win`. Run lint, typecheck, tests and
`npm run format` locally before pushing.

`npm run dev` and packaging need a desktop session; in a headless environment
verify changes with the test suite and `npm run build` instead.

## Layout

- `src/main` — Electron main process: `ai`, `tts`, `notes`, `obsidian`,
  `database`, `conversation`, `attachments`, `settings`, `ipc`.
- `src/preload` — context-isolated bridge exposed to the renderer.
- `src/renderer` — React UI (`pages`, `components`, `state`, `styles`).
- `src/shared` — types and schemas shared across processes.
- `tests` — Vitest suites; `tests/renderer/*` use Testing Library + jsdom.
- `docs/changes/<topic>` — per-change design/verification notes.

## Conventions

- TypeScript everywhere; validate external and IPC payloads with `zod` schemas
  in `src/shared`.
- Keep renderer code free of Node APIs: go through the preload bridge and IPC
  handlers in `src/main/ipc`.
- Prettier (`.prettierrc.json`) and ESLint (`eslint.config.mjs`) define style —
  do not hand-format; run `npm run format:write`.
- Cross-platform paths matter (Windows and macOS are both supported); use
  `node:path` rather than string concatenation, and keep path assertions in
  tests platform-aware.
- Add or update tests in `tests/` for behaviour changes.
