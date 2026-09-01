# Kokoro Local TTS Integration — Context

**Status:** READY_FOR_EXECUTION
**Baseline:** `8e465febcde349901c9cb8ba8d0e8a04d3dc1173` plus the existing uncommitted V0.1 implementation and task artifacts. Do not remove or reset pre-existing files.
**Executor:** right-side Herdr Grok agent only (`IMPLEMENT`).

## User request

Use the first previously discussed option, Kokoro-FastAPI, and encapsulate it into the current app. Expose male/female as a single user-facing choice. Remove the page fields that configure a remote TTS backend.

## Current evidence

- `src/main/tts/openai-compatible.ts` calls a configurable OpenAI-compatible `POST /audio/speech` endpoint.
- `SettingsUpdate`/`PublicSettings` and `SettingsPage` currently expose TTS base URL, model, voice, and API key.
- `AppServices.createTTSProvider()` requires those settings and `speak()` currently ignores the requested playback speed when calling the provider.
- Electron packaging already has an `asarUnpack` section for native modules but no local TTS runtime/resource management.
- Existing TTS tests mock HTTP and must remain deterministic.

## External compatibility evidence

Kokoro-FastAPI's upstream project exposes an OpenAI-compatible `POST /v1/audio/speech` endpoint, uses model `kokoro`, accepts voice IDs, and documents Windows CPU startup through `start-cpu.ps1`. The app should use the stable local HTTP contract, not scrape its Web UI.

## Constraints

- Windows 10/11 x64 remains the primary target; macOS development must continue to work.
- Do not commit model weights, API keys, databases, generated audio, or installers.
- Do not make production CSP less strict.
- Preserve existing cloud AI configuration and Obsidian behavior.
- Backward compatibility: existing persisted settings may contain old TTS fields; loading them must not crash or leak secrets. Old TTS keys may be ignored/cleared safely, but no migration may delete unrelated settings.
- Only one implementation writer is active.
