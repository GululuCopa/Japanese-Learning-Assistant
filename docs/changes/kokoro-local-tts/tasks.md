# Kokoro Local TTS Integration — Tasks

**Status:** VERIFIED
**Mode:** IMPLEMENT
**Implementation writer:** right-side Herdr Grok agent only

Read `context.md`, `design.md`, `docs/PRD.md`, and repository instructions before editing. Do not change the approved design or broaden scope.

## Task 1 — Local Kokoro lifecycle and provider

- Add a typed main-process lifecycle seam for a locally managed Kokoro-FastAPI-compatible process.
- Resolve packaged/development runtime resources safely; support only explicit developer environment overrides, never arbitrary renderer input.
- Probe readiness before requests, reuse one process, and clean it up on app quit.
- Use fixed local `/v1/audio/speech` contract with `model=kokoro` and Japanese male/female voice mapping.
- Preserve safe cache behavior and include gender/speed in cache identity.
- Ensure no startup crash when the runtime is absent; return a categorized actionable error.

## Task 2 — Settings and IPC contract

- Replace renderer-facing TTS backend fields with a single `voiceGender` choice (`female`/`male`), default `female`.
- Remove TTS URL/model/voice/API-key fields from `SettingsPage`, `PublicSettings`, and `SettingsUpdate` where safe; keep tolerant loading of legacy persisted settings.
- Persist the gender choice and make TTS calls use the current setting.
- Preserve AI key encryption and all AI/Obsidian settings behavior.

## Task 3 — Packaging and documentation

- Add only the resource/launcher hooks needed for a user-supplied or bundled Kokoro-FastAPI runtime without committing weights or secrets.
- Ensure resources that must execute are unpacked from asar and paths work on Windows and macOS.
- Update README with the actual setup/run behavior, voice choice, runtime/model prerequisites, and failure troubleshooting. Be explicit about what is and is not bundled in the repository.

## Task 4 — Tests and evidence

Add/update deterministic tests for:

- voice gender defaults and persistence;
- male/female voice mapping;
- local endpoint request payload and speed/cache key behavior;
- missing runtime/readiness/cleanup failure handling;
- legacy settings compatibility;
- settings UI no longer exposes backend configuration fields.

Run and record in `docs/changes/kokoro-local-tts/execution.md`:

```bash
npm run format
npm run lint
npm run typecheck
npm test -- --run
npm run build
JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev
npm run package:dir
```

If a real Kokoro runtime/model is unavailable, do not fake that result: record local provider contract tests and the exact unverified runtime/platform items.

## Acceptance criteria

- Settings has no TTS backend URL/model/API-key configuration fields; it has one clear male/female voice choice.
- TTS calls are local and app-managed through Kokoro-FastAPI-compatible `/v1/audio/speech`, with no remote credential requirement.
- The app remains usable for AI analysis when local TTS is unavailable; playback shows an actionable error.
- Repeated identical word/sentence requests hit the local audio cache.
- Windows-safe packaging/path handling is preserved, and macOS dev does not regress to a white screen.
- All listed automated checks pass; unverified real-runtime limitations are documented.
