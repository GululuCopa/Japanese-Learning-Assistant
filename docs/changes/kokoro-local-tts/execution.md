# Kokoro Local TTS — Execution Evidence

**Executor:** right-side implementation writer (Grok 4.6)  
**Date:** 2026-09-01  
**Mode:** FIX_REVIEW (KOKORO-001)  
**Host:** macOS darwin arm64, Node v24.12.0  
**Git operations:** none (no commit, rebase, checkout, reset, or destructive Git commands)

## Summary

TTS is now an app-managed local Kokoro-FastAPI-compatible loopback service. Settings expose only 女声/男声 (`voiceGender`, default `female` → `jf_alpha`, male → `jm_kumo`). Remote TTS URL/model/voice/API-key fields and TTS secret handling are gone from the public contract and UI. Missing runtime does not crash startup; playback returns a categorized error. AI and Obsidian settings are unchanged.

## Verification

### `npm run format`

Exit **0**. `.env.example` is prettier-ignored (no parser).

### `npm run lint`

Exit **0**.

### `npm run typecheck`

Exit **0**.

### `npm test -- --run`

Exit **0**.

```text
Test Files  18 passed (18)
     Tests  50 passed (50)
```

Coverage for this packet: voice mapping, `/v1/audio/speech` payload, gender/speed cache identity, missing runtime, readiness reuse/timeout/cleanup, legacy settings load, settings UI without backend TTS fields.

### `npm run build`

Exit **0**.

### `JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev`

Exit **0**. Log included `JLA_STARTUP_DB_OK`. Vite used `http://localhost:5174/` because 5173 was occupied; no white-screen/preamble error in this smoke (window not opened). App did not spawn Kokoro during smoke (no speak).

### `npm run package:dir`

Exit **0**. `electron=44.1.0` darwin arm64. Extra resources present:

```text
release/mac-arm64/Japanese Learning Assistant.app/Contents/Resources/kokoro/
  launch.ps1
  launch.sh
  README.md
```

No model weights bundled.

## KOKORO-001

Wrappers discarded host/port when calling `start-cpu.ps1` / `start-cpu.sh`, and spawn used raw `process.env`, so a fallback port (e.g. 8881) was polled while the engine still bound 8880.

**Fix:** `launch.ps1` / `launch.sh` set `KOKORO_HOST`, `KOKORO_PORT`, `HOST`, and `PORT` before delegating; `launch.sh` also passes `"$HOST" "$PORT"`. `KokoroRuntime` injects the same variables into the child env via `kokoroChildEnv`. Tests: spawn on 8881 includes `KOKORO_PORT=8881`; static check that wrappers assign env before `start-cpu`.

### Re-verification

- `npm run format` exit **0** (launch scripts prettier-ignored: no parser)
- `npm run lint` exit **0**
- `npm run typecheck` exit **0**
- `npm test -- --run` exit **0**, **52** tests (was 50)
- `npm run build` exit **0**

## Deviations

- OpenAI-compatible remote TTS provider class remains in `src/main/tts/openai-compatible.ts` unused by production `AppServices` (HTTP `joinUrl` helper still used). Not wired as a cloud TTS option.
- `.env.example` and `resources/kokoro/launch.{ps1,sh}` are excluded from Prettier because they have no parser.
- Smoke used port 5174 due to a busy 5173; development CSP already allows `localhost:*`.

## Failures

None of the listed commands failed.

## Unverified runtime / platform items

- No real Kokoro-FastAPI process, Python venv, or Japanese model weights were present; live `/v1/audio/speech` audio was **not** generated.
- Windows `start-cpu.ps1` / `powershell.exe -File launch.ps1` spawn, `taskkill` tree teardown, and `D:\` runtime paths were not executed on Windows.
- Packaged extraResources load of `kokoro/` inside a Windows NSIS install was not run.
- Port-collision fallback against a non-Kokoro occupant of 8880 was unit-tested only via injected `isPortOpen`/`fetchImpl`, not a live bind.

## Changed files

KOKORO-001 also updated:

```text
src/main/tts/kokoro-runtime.ts
resources/kokoro/launch.ps1
resources/kokoro/launch.sh
tests/kokoro-runtime.test.ts
.prettierignore
docs/changes/kokoro-local-tts/execution.md
```

Original implementation files:

```text
.env.example
.gitignore
.prettierignore
README.md
electron-builder.yml
src/shared/constants.ts
src/shared/types.ts
src/shared/schemas.ts
src/shared/tts.ts
src/main/settings/service.ts
src/main/app-services.ts
src/main/index.ts
src/main/tts/cache.ts
src/main/tts/kokoro-provider.ts
src/main/tts/kokoro-runtime.ts
src/main/tts/openai-compatible.ts
src/renderer/pages/SettingsPage.tsx
src/renderer/styles/app.css
resources/kokoro/launch.ps1
resources/kokoro/launch.sh
resources/kokoro/README.md
tests/helpers/app.ts
tests/helpers/fake-api.ts
tests/settings-secrets.test.ts
tests/settings-voice.test.ts
tests/prd-cases.test.ts
tests/obsidian-export.test.ts
tests/tts-provider.test.ts
tests/kokoro-runtime.test.ts
tests/renderer/app.test.tsx
docs/changes/kokoro-local-tts/execution.md
```

Packet specs (`context.md`, `design.md`, `tasks.md`) and `docs/PRD.md` were not edited. `.DS_Store`, `docs/.DS_Store`, and `.omx/` were not touched.

## MASTER independent verification — 2026-09-01

- `npm run format`: exit 0.
- `npm run lint`: exit 0.
- `npm run typecheck`: exit 0.
- `npm test -- --run`: exit 0; **18 test files / 52 tests passed**.
- `npm run build`: exit 0.
- `JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev`: exit 0 outside the restricted sandbox; `JLA_STARTUP_DB_OK` observed. Vite selected `http://localhost:5174/` because 5173 was already occupied. The unprivileged sandbox attempt failed with `listen EPERM ::1:5173`, which is an environment restriction rather than an app failure.
- `npm run package:dir`: exit 0; packaged macOS app contains `Resources/kokoro/launch.ps1`, `launch.sh`, and `README.md`.

KOKORO-001 is resolved: selected fallback host/port is propagated through child environment and both launcher wrappers before delegating to `start-cpu` scripts. A regression test covers the propagation.
