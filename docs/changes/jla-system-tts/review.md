# JLA System TTS — Review

**Status:** VERIFIED
**Master:** Codex
**Date:** 2026-09-03
**Baseline:** `065c9ba7a227f494fe6a25ab05fd6e8f26ac6277`

## Result

No unresolved review findings. The implementation matches the approved system-TTS design: macOS uses `say` plus `afconvert`, Windows uses a fixed PowerShell/System.Speech adapter, renderer IPC remains speak-only, Kokoro runtime/install/package surfaces are removed, and no user runtime data is automatically deleted.

## Scope review

- AI, conversation, image, history, notes, settings persistence and database schema were not redesigned.
- `docs/PRD.md`, `.DS_Store`, `.omx/`, and the historical `docs/changes/jla-tts-one-click-install/` packet were preserved.
- Deleted Kokoro implementation/resources/tests are within the superseded TTS scope.
- `src/renderer/play-audio.ts` is an approved focused helper used by Settings and analysis-card pronunciation.

## Security and failure review

- User text is passed as a direct macOS argv value or written to a UTF-8 Windows temp file; it is not shell-interpolated.
- Child commands use `shell: false`, bounded timeouts and request-scoped cleanup.
- Windows script paths are PowerShell single-quote escaped; the script itself is generated from fixed application code.
- Missing Japanese voices, unsupported platforms, timeouts and empty/failed audio produce renderer-visible messages.
- No TTS API key, remote request, container, Python process or long-running local service remains.

## Approved deviation

Windows cache identity uses platform + requested gender + text rather than the concrete selected system voice name. This is approved as low risk because the concrete voice is selected inside the fixed one-pass PowerShell script. It can only cause an old cached pronunciation to remain after the installed Windows voice inventory changes; it does not increase synthesis, security or billing risk.

## MASTER verification

Successful commands/evidence:

```text
git diff --check                 exit 0
npm run format                  exit 0
npm run lint                    exit 0
npm run typecheck               exit 0
npm test -- --run               exit 0 — 23 files / 77 tests
npm run build                   exit 0
npm run package:dir             exit 0 — macOS arm64
npm run package:win             exit 0 — Windows x64 NSIS + dir
JLA_SMOKE=1 ELECTRON_ENABLE_LOGGING=1 npm run dev
                                 exit 0, JLA_STARTUP_DB_OK
```

The first sandboxed packaging attempts could not resolve `github.com`; both packaging commands were rerun with approved network access and completed successfully.

Real provider smoke on macOS:

- female preference generated `audio/wav`, RIFF header, 140,592 bytes; the second request at 0.75x reused the same cached normal-speed WAV;
- male preference generated `audio/wav`, RIFF header, 93,304 bytes;
- direct `say` testing confirmed the localized Japanese Eddy voice identifier is accepted.

Package inspection found no `*kokoro*` path in `release/mac-arm64` or `release/win-unpacked`.

## Remaining release validation

- Run the packaged application on a real Windows 10/11 x64 host with the Japanese speech pack installed and verify both gender preference and fallback.
- Manually click Settings `测试发音` and analysis-card 0.75x/1.0x in packaged Windows and macOS UI.
- The macOS-hosted Windows package build proves packaging configuration only; native Windows application startup still belongs in Windows CI/host validation.
