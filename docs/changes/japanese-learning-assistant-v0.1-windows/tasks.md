# Japanese Learning Assistant V0.1 for Windows — Execution Tasks

**Status:** VERIFIED  
**Baseline:** `8e465febcde349901c9cb8ba8d0e8a04d3dc1173`  
**Executor mode:** IMPLEMENT  
**Implementation writer:** right-side Herdr Grok agent only

Read `context.md`, `design.md`, and `docs/PRD.md` before editing. The design is frozen. Stop rather than making a design/scope change.

## Task 1 — Project foundation and secure Windows desktop shell

Deliver:

- Electron + React + TypeScript project with lockfile.
- Main/preload/renderer/shared boundaries from the design.
- secure BrowserWindow and typed preload bridge.
- application navigation shell for Chat, Notes, History, Settings.
- lint, formatting, typecheck, tests, build, dev, and package scripts.
- `.gitignore` that ignores OS files, dependencies, build output, local env/config, databases, attachments, audio, and installers without deleting pre-existing files.
- Windows x64/NSIS packaging config and Windows CI skeleton.

Acceptance:

- development build starts without renderer Node access;
- production build completes;
- no API keys or runtime data paths are committed;
- no runtime code assumes POSIX paths.

## Task 2 — Shared contracts, SQLite, settings, and provider abstractions

Deliver:

- runtime-validated shared schemas and TypeScript types for PRD structured output.
- SQLite migrations and repositories.
- conversation/message/attachment/analysis/note/settings persistence.
- AIProvider and TTSProvider abstractions.
- settings UI and typed IPC.
- encrypted-at-rest API key handling via a replaceable safe-storage adapter.

Acceptance:

- migrations work on a fresh database and reopen cleanly;
- repository and settings tests pass;
- plaintext keys do not appear in the database or logs when encryption is available;
- unavailable encryption produces session-only behavior and a visible warning.

## Task 3 — Text analysis vertical slice

Deliver:

- create/select conversation;
- send Japanese, Chinese, mixed, or natural-language text;
- OpenAI-compatible analysis provider;
- strict structured parsing with one bounded repair attempt;
- persistence of user message and assistant analysis;
- full analysis card rendering;
- retryable, categorized errors.

Acceptance:

- mocked input `俺に構うな` renders reading, Chinese translation, vocabulary, grammar, and tone;
- malformed provider data never crashes or renders trusted arbitrary HTML;
- failed requests preserve the user message and can be retried;
- tests use mocked HTTP only.

## Task 4 — Multimodal image input

Deliver:

- clipboard paste, drag/drop, and native file selection;
- preview/removal before send;
- PNG/JPEG/WebP validation, 10 MiB per image, maximum four;
- generated attachment storage under app data;
- OpenAI-compatible multimodal request mapping;
- saved screenshot linkage.

Acceptance:

- all three input paths converge on the same validated attachment flow;
- invalid/oversized inputs show actionable messages;
- original filenames cannot escape attachment storage;
- mocked screenshot analysis renders the same structured card as text.

## Task 5 — TTS

Deliver:

- word and sentence pronunciation buttons;
- OpenAI-compatible TTS provider;
- safe local audio caching;
- 0.75x and 1.0x playback;
- loading/error/disabled states.

Acceptance:

- provider and cache tests pass without real credentials;
- credentials never appear in audio URLs or renderer logs;
- repeated identical requests reuse cached audio;
- PRD Case 1 is demonstrable with a mocked provider fixture.

## Task 6 — Notes, saved-state recognition, history, and search

Deliver:

- one-click word, sentence, and grammar save actions;
- AI recommendation indicator without auto-save;
- idempotent duplicate behavior;
- Notes tabs, search, detail, delete confirmation, and export action entry point;
- History list, conversation reopening, and new conversation;
- saved-state annotation when content reappears.

Acceptance:

- saving `構う` creates a word note with reading and meanings;
- repeated save does not create a duplicate;
- analyzing `構う` again shows it as saved;
- history survives application restart;
- repository and UI interaction tests cover these paths.

## Task 7 — Obsidian and screenshot export

Deliver:

- native vault directory selection and validation;
- Windows-safe directories and filenames;
- Markdown/YAML templates for word, sentence, and grammar notes;
- associated screenshot copy and Obsidian embed;
- collision/idempotency policy;
- actionable export errors and successful-path display.

Acceptance:

- exporting `構う` produces `Japanese/Words/構う.md` when safe and available;
- Windows reserved names/invalid characters are sanitized;
- traversal attempts cannot write outside the vault;
- screenshot export lands under `Japanese/Assets` with a valid relative embed;
- tests use temporary directories and include Windows-style path cases.

## Task 8 — Integration, Windows readiness, docs, and evidence

Deliver:

- polished empty/loading/error/configuration-required states;
- keyboard-friendly composer and accessible controls;
- complete Windows build/CI configuration;
- README with Windows development, configuration, data locations, testing, packaging, and unsigned-installer notes;
- deterministic mock/demo test fixtures for PRD Cases 1–5;
- `docs/changes/japanese-learning-assistant-v0.1-windows/execution.md` containing commands, outputs/summaries, deviations, failures, and unverified Windows-only areas.

Acceptance:

- all five PRD V0.1 Definition of Done cases are covered by automated tests or a deterministic documented smoke path;
- no V0.2/V0.3 scope appears in the UI or data behavior;
- Windows CI runs install, lint, typecheck, test, build, and package;
- exact changed-file list is recorded;
- no commits, rebases, checkouts, resets, or destructive Git operations are performed.

## Required Verification Commands

Use the scripts actually defined by the implementation. At minimum run and record:

```bash
npm ci
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run package:dir
```

Also run the Windows packaging command on a Windows environment when available, and configure CI to run it, for example:

```bash
npm run package:win
```

If macOS cannot produce or execute the Windows artifact, record that exact limitation rather than claiming it passed.

## Final Executor Report

The executor must reply concisely with:

1. implementation summary;
2. changed file groups;
3. verification commands and results;
4. deviations/failures/unverified areas;
5. path to `execution.md`.

The executor must not declare the overall task complete; final acceptance belongs to the MASTER.
