# Japanese Learning Assistant V0.1 for Windows — Design

**Status:** READY_FOR_EXECUTION  
**Design owner:** MASTER  
**Frozen:** 2026-09-01

## 1. Architecture

Use a single Electron application with four boundaries:

```text
React renderer
    |
    | typed, allow-listed IPC through contextBridge
    v
Electron preload
    |
    v
Electron main/application services
    |-- conversation
    |-- AI provider
    |-- TTS provider
    |-- notes
    |-- Obsidian export
    |-- attachment storage
    v
SQLite + application data files
```

Recommended source shape:

```text
src/
  main/
    ai/
    attachments/
    conversation/
    database/
    notes/
    obsidian/
    settings/
    tts/
    ipc/
  preload/
  renderer/
    components/
    pages/
    state/
    styles/
  shared/
    contracts/
    schemas/
    types/
```

Keep domain/provider contracts in `src/shared` or narrow domain modules; Electron and React details must not leak into them.

## 2. Electron Security Boundary

- `contextIsolation: true`.
- `nodeIntegration: false`.
- No generic `ipcRenderer.send` exposure.
- Expose a small typed API from preload.
- Validate every IPC request in main with shared schemas.
- Do not load remote pages in the renderer.
- Add a restrictive Content Security Policy compatible with the local application.
- Do not use `shell.openExternal` on model/user-controlled URLs without protocol allow-listing.

## 3. Storage

Use SQLite in Electron main. A native SQLite library is acceptable provided Electron rebuild and Windows packaging are configured and verified in Windows CI.

Minimum durable records:

- `conversations`
- `messages`
- `attachments`
- `analyses`
- `vocabulary_items`
- `grammar_items`
- `notes`
- `settings`
- `schema_migrations`

Store structured analysis as validated JSON plus queryable child records where needed. Use migrations from the first version. Enable foreign keys. Repository interfaces must hide SQL from renderer/UI code.

Runtime locations:

- database: under `app.getPath('userData')`;
- attachments/audio cache: under application-managed subdirectories of `userData`;
- Obsidian files: only under the user-selected vault.

## 4. Secrets and Settings

Settings include:

- AI base URL, API key, model;
- TTS base URL, API key, model/voice;
- Obsidian Vault Path;
- response language (Simplified Chinese default).

Use Electron `safeStorage` for API key encryption before durable persistence. Never log keys or include them in renderer state after the request is complete. If OS-backed encryption is unavailable, keep the key session-only and clearly inform the user rather than writing plaintext.

## 5. AI Provider

Define an interface equivalent to:

```ts
interface AIProvider {
  analyze(request: AnalyzeRequest): Promise<JapaneseAnalysis>
}
```

The V0.1 implementation is OpenAI-compatible and supports text plus image data. The request prompt must ask for learning-oriented analysis and a strict structured response matching the shared schema.

Requirements:

- Validate response with a runtime schema.
- Normalize optional arrays/fields safely.
- Make at most one bounded repair/retry for malformed structured data.
- Preserve the user's message and attachments if analysis fails.
- Return categorized errors: configuration, authentication, rate limit, network, invalid response, unknown.
- Do not render arbitrary model Markdown/HTML as trusted UI.

The shared `JapaneseAnalysis` contract must cover all PRD section 8 fields.

## 6. Conversation and Image Flow

The composer accepts:

- typed/pasted text;
- pasted clipboard images;
- drag-and-drop image files;
- native file picker image selection.

Validation defaults:

- PNG, JPEG, and WebP;
- maximum 10 MiB per image;
- maximum 4 images per message.

Store accepted images in application attachment storage with generated IDs/names. Never trust the original filename for a storage path. Show previews and allow removal before send.

Sending creates/persists the user message first, then runs analysis, then persists the assistant analysis. Failure produces a retryable error state without deleting the message.

## 7. UI

Pages:

1. Chat
2. Notes
3. History
4. Settings

Use a desktop-first responsive layout suitable for a typical Windows laptop. Required states include empty, loading, success, configuration-required, provider error, no search results, and destructive confirmation.

Analysis cards expose:

- original and reading;
- natural and optional literal translation;
- whole-sentence TTS controls;
- vocabulary cards with reading, meanings, part of speech, explanation, example, TTS, recommendation, and save state;
- grammar cards and save state;
- tone/context/learning points;
- sentence save action.

Saving must be one click. Duplicate saves should be idempotent and visibly marked as already saved.

## 8. TTS

Define a provider interface equivalent to:

```ts
interface TTSProvider {
  speak(text: string, options?: TTSOptions): Promise<AudioResult>
}
```

Implement the OpenAI-compatible provider in main. Cache generated audio by a stable hash of provider/model/voice/text. The renderer receives a safe app-local audio URL or bytes through the typed bridge. Playback speeds are implemented using audio playback rate for 0.75x and 1.0x.

Never pass API credentials into an HTML audio URL.

## 9. Notes and Saved Recognition

Support word, sentence, and grammar notes. Persist source context, original sentence, translation, optional source metadata, timestamps, and screenshot association.

Stable duplicate keys:

- word: normalized `lemma` when present, otherwise normalized surface;
- sentence: normalized original text;
- grammar: normalized pattern.

After every analysis load, annotate items using note lookup so previously saved content is recognized, satisfying PRD Case 5 without implementing V0.2 encounter counting.

## 10. Obsidian Export

The user selects a Vault Path through a native directory dialog or supplies a path that is validated in main.

Create only these directories under the vault:

```text
Japanese/Words
Japanese/Sentences
Japanese/Grammar
Japanese/Assets
```

Export Markdown with YAML front matter and UTF-8 content. Copy associated screenshots into `Japanese/Assets` and use Obsidian embeds with relative paths.

Windows safety requirements:

- use Node `path` APIs rather than string separators;
- reject path traversal and ensure resolved targets remain under the selected vault;
- sanitize Windows-invalid filename characters and reserved device names;
- handle collisions deterministically without overwriting unrelated files;
- use temporary file + rename for atomic writes where practical;
- surface permission, missing-drive, and read-only errors.

Exporting the same note again should update that note's managed file or return its existing result, not create uncontrolled duplicates.

## 11. Build and Packaging

Use npm scripts for development, lint, type checking, unit tests, integration tests, production build, and packaging. Configure an Electron packager/builder for:

- Windows x64;
- NSIS installer;
- unpacked Windows directory target for smoke inspection;
- application identifier and product name;
- required native dependency rebuild/unpack rules.

Add a Windows GitHub Actions workflow that installs dependencies with the lockfile and runs lint, typecheck, tests, build, and Windows packaging. Do not require signing credentials.

## 12. Testing Strategy

Minimum automated coverage:

- Japanese analysis schema validation and malformed-response behavior;
- AI/TTS provider request shaping with mocked HTTP;
- database migrations and repositories;
- duplicate note recognition;
- Windows filename/path sanitization and vault containment;
- Markdown export and screenshot asset references;
- image validation;
- settings secret persistence behavior with a mock safe-storage adapter;
- core renderer interactions for text send, analysis display, save, notes search, history selection, settings validation;
- smoke start/build test where the environment permits.

No test may require real paid API credentials.

## 13. Failure and Rollback

- Database migrations run transactionally and record versions.
- Failed analysis/TTS/export operations must not corrupt successful prior data.
- Keep provider/service boundaries replaceable.
- Do not mutate `docs/PRD.md`.
- The implementation may be discarded by returning to the recorded baseline; no external data migration exists before V0.1.
