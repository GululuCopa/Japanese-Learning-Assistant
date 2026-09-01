# Kokoro Local TTS Integration — Design

**Status:** READY_FOR_EXECUTION

## Approved decisions

1. TTS is a local, app-managed Kokoro-FastAPI-compatible service. The renderer never receives a TTS URL, model, or API key.
2. Use a fixed loopback endpoint owned by the app (default `127.0.0.1:8880`, with a collision-safe fallback if the preferred port is occupied). The provider calls `/v1/audio/speech` with `model: kokoro`, `response_format: mp3`, and the selected voice.
3. The main process owns startup/readiness/cleanup of the local service. It must not shell out through a user-controlled string. In development, support an explicit developer-only command/path override through environment variables; in packaged builds resolve only bundled resources or a documented local runtime location. If no runtime is available, return a categorized actionable error rather than crashing the app.
4. Do not include model weights in Git or npm. Packaging must include the launcher/resource hook and documentation for supplying the Kokoro-FastAPI runtime/model bundle; the runtime location must be outside the asar archive when required.
5. The only TTS setting shown to users is `voiceGender: 'female' | 'male'`, defaulting to `female`. Map it to stable Kokoro Japanese voices (female `jf_alpha`, male `jm_kumo`, with constants in shared code). The mapping is an implementation seam so voice IDs can be adjusted without changing UI/API contracts.
6. Remove TTS base URL/model/voice/API-key inputs and TTS secret handling from the settings UI and public settings contract. Keep compatibility parsing for old persisted records; do not expose old values to the renderer. TTS is not an optional cloud provider anymore.
7. Keep the existing `TTSProvider` abstraction and audio cache. Include voice gender and playback speed in the cache key. Pass speed to Kokoro where supported; retain renderer-side playback-rate behavior as a fallback.
8. Keep the existing word/sentence pronunciation buttons and loading/error states. The user can switch male/female in Settings and subsequent playback uses that choice.

## Non-goals

- No cloud TTS provider selector.
- No voice mixing, SSML, streaming UI, or arbitrary voice ID input.
- No automatic download of large model weights during npm install or app startup without an explicit user-visible/documented action.
- No changes to AI provider configuration.

## Expected modules

Likely affected (executor may add narrowly scoped files):

- `src/shared/constants.ts`, `src/shared/types.ts`, `src/shared/schemas.ts`
- `src/main/settings/service.ts`, `src/main/app-services.ts`, `src/main/paths.ts`
- `src/main/tts/*` (local service lifecycle/provider)
- `src/main/index.ts` for lifecycle shutdown if needed
- `src/renderer/pages/SettingsPage.tsx`, `src/renderer/App.tsx` or state plumbing
- `electron-builder.yml`, `.gitignore`, `README.md`, `.env.example` only if required for developer setup
- focused tests under `tests/`

## Compatibility and failure behavior

- Existing old settings records load with the default `female` voice when no new gender exists.
- Missing local runtime, failed startup, readiness timeout, port conflict, invalid response, and service exit map to actionable retryable/non-retryable provider errors.
- Shutdown must terminate only the child process created by this app.
- Credentials must not be present in URLs, request logs, renderer state, or persisted settings.
