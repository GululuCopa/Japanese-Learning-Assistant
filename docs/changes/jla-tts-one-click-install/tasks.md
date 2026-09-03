# JLA TTS 一键安装 — Tasks

**Status:** VERIFIED
**Mode:** IMPLEMENT
**Implementation writer:** right-side Herdr Grok 4.6 xhigh only

Read `context.md`, `design.md`, `docs/PRD.md`, `AGENTS.md`, and applicable repository instructions before editing. The design is frozen. Stop and report if implementation would require another architecture, new credentials, schema migration, or files outside the expected scope.

## Task 1 — Installer and manifest

- Add a typed main-process installer with fixed platform manifest for Windows x64 and macOS arm64/x64.
- Download uv and pinned Kokoro-FastAPI source archive with streaming progress, SHA-256 verification, temp staging, cancellation and cleanup.
- Create/use a uv-managed Python 3.12 venv; install official `.[cpu]` dependencies; run the pinned model downloader; validate marker, model, config and `jf_alpha.pt`/`jm_kumo.pt`.
- Preserve an existing verified installation on failed reinstall.
- Avoid arbitrary renderer-controlled URLs/commands and avoid shell injection.

## Task 2 — Runtime integration

- Make `KokoroRuntime` detect and launch the managed install without reinstalling on each playback.
- Preserve existing healthy-port reuse, fallback port propagation, readiness polling, timeout error, cleanup and developer overrides.
- Use Windows-safe and macOS-safe paths and child-process arguments.

## Task 3 — IPC/preload/settings UI

- Add status/install/cancel IPC and typed progress listener.
- Expose only these safe methods from preload.
- Update SettingsPage with install state, progress, cancel, retry/reinstall and actionable error copy while retaining the male/female choice and all existing settings behavior.
- Ensure a renderer crash/IPC rejection does not make settings unusable.

## Task 4 — tests/docs/evidence

Add deterministic tests for:

- platform manifest selection and unsupported platform;
- fixed URLs/hashes and no renderer override;
- streaming progress, hash mismatch, non-2xx, cancellation cleanup;
- atomic install marker and preserving previous install;
- already-installed status avoids redownload;
- Windows path/launcher arguments and macOS path/launcher arguments;
- managed runtime launches and still forwards selected port;
- IPC/preload contract;
- settings UI states and only male/female voice config;
- documentation no longer tells a normal user to manually install runtime/model.

Run and record in `execution.md`:

```bash
npm run format
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run package:dir
```

A real Windows installer run cannot be claimed on macOS. Record exact platform limitations and any unverified network/download steps. Do not fake success.

## Acceptance criteria

- On supported Windows 10/11 x64 and macOS arm64/x64, Settings offers one clear install action that downloads/prepares runtime and model without terminal steps.
- Progress, cancellation, retry and failure are visible and do not leave a corrupt installed state.
- After successful install, clicking the existing play/pronunciation action can start the managed local Kokoro service and call the current local API contract.
- Existing healthy external/local Kokoro reuse and developer override behavior remain intact.
- No TTS URL/model/API-key configuration is exposed.
- No model, venv or downloaded binary is committed or bundled into Git/Electron asar.
- All applicable automated checks pass, with unverified real-platform items explicitly documented.
