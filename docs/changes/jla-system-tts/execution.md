# JLA System TTS — Execution Evidence

**Executor:** right-side implementation writer (Grok 4.6)
**Date:** 2026-09-03
**Mode:** IMPLEMENT
**Host:** macOS darwin arm64 (uname -m arm64, Node v24.12.0)
**Baseline:** `065c9ba7a227f494fe6a25ab05fd6e8f26ac6277`
**Git operations:** none (no commit, rebase, checkout, reset, or clean)

## Summary

Default TTS is now a main-process `SystemTTSProvider`:

- macOS: `/usr/bin/say` + `/usr/bin/afconvert` to WAV (`LEI16@22050`), `ja_JP` voices, known female/male name preference then any Japanese voice.
- Windows: `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File <generated-script>` with UTF-8 text file input and `.NET System.Speech.Synthesis.SpeechSynthesizer`. Culture `ja*`, requested `VoiceGender`, then any enabled Japanese voice.
- Renderer `tts:speak` / `SpeakResult` unchanged. Audio is generated at normal speed; `0.75x` / `1.0x` remain renderer `playbackRate`. Cache key is platform + selected voice + text (speed omitted).
- Settings keeps 女声/男声, explains system Japanese voices, adds `测试发音`, and has no Kokoro install/download UI or TTS API fields.
- Production startup no longer constructs, launches, downloads, or stops Kokoro. Install IPC/public types are gone. Packaging no longer bundles `resources/kokoro`.
- Existing `userData/kokoro-runtime` is not deleted. `docs/changes/jla-tts-one-click-install/` is kept. `src/main/tts/openai-compatible.ts` remains unused.

## Tests first

`tests/system-tts.test.ts` was run red against a missing `src/main/tts/system` module (`Cannot find module '../src/main/tts/system'`), then green after the provider was added (14 provider cases, later 16 including AppServices/IPC). Settings install UI tests were replaced with system-voice cases before the Settings rewrite.

## Verification

Commands run on 2026-09-03 in this IMPLEMENT session.

### `npm run format:write`

Exit **0**. Prettier wrote `src/main/tts/system.ts`, `tests/system-tts.test.ts`, `tests/renderer/app.test.tsx`, and `tests/renderer/settings-tts.test.tsx`. Other matched files unchanged.

### `npm run format`

Exit **0**. `All matched files use Prettier code style!`

### `npm run lint`

Exit **0**. `ESLint: No issues found`

### `npm run typecheck`

Exit **0**. `tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json`

### `npm test -- --run`

Exit **0**.

```text
 Test Files  23 passed (23)
      Tests  77 passed (77)
```

Includes `tests/system-tts.test.ts` (16), `tests/renderer/settings-tts.test.tsx` (3), and `tests/renderer/app.test.tsx` (6, including analysis-card 0.75x/1.0x). Obsolete Kokoro installer/runtime/provider tests were removed.

### `npm run build`

Exit **0**.

```text
out/main/index.js  74.55 kB
out/preload/index.js  2.29 kB
out/renderer/assets/index-C5CINRkA.js   271.92 kB
```

### `npm run package:dir`

Exit **0**. `electron-builder 26.15.3` packaged `platform=darwin arch=arm64 electron=44.1.0` to `release/mac-arm64`. `Contents/Resources/` contains `app.asar`, `app.asar.unpacked`, icons/lproj only. `find release/mac-arm64 -iname '*kokoro*'` returned no paths.

`npm run package:win` was not run (MASTER). No live `SystemTTSProvider` speak against real `say`/`afconvert` was recorded in this executor session; macOS `say -v '?'` on this host listed `Kyoko ja_JP`, and `/usr/bin/say` / `/usr/bin/afconvert` exist.

## Deviations

- Playback Blob/Audio flow was extracted to `src/renderer/play-audio.ts` and used by Settings and `AnalysisCard` (plan allowed this if useful).
- `src/main/index.ts` and `tests/helpers/app.ts` were updated because they only existed to pass Kokoro `appRoot`/`resourcesPath`/`isPackaged` / runtime deps.
- Windows cache identity uses `ja-${voiceGender}` rather than the concrete installed voice name; selection still happens inside the generated Speech script. macOS cache identity uses the resolved `ja_JP` voice name.
- One-click-install additions to `src/main/ipc/register.ts`, `src/preload/index.ts`, and `src/shared/types.ts` were removed and those files now match baseline HEAD (speak-only API).
- Untracked one-click installer implementation/tests were deleted and therefore do not appear in `git status`.

## Failures

None of the listed executor commands failed. An intermediate `typecheck` failed on test types (`SpeakResult` promise and `readonly string[]`); those tests were fixed and typecheck was re-run at exit 0 before the recorded suite.

## Unverified areas

- Real Windows 10/11 x64 Japanese voice discovery/playback via System.Speech.
- `npm run package:win` on this macOS host.
- Manual GUI: Settings `测试发音` and analysis-card 0.75x/1.0x against a live packaged app.
- Live `SystemTTSProvider` synthesis (injected command runner in unit tests only).
- Linux runtime beyond the unit test that returns the unsupported-platform message.
- Whether every Windows 10/11 Japanese voice pack is visible to `System.Speech.Synthesis` (plan: stop for a design change if source/tests prove it cannot; this environment cannot prove that).

## Changed files

```text
src/main/tts/system.ts                         new
src/main/app-services.ts
src/main/index.ts
src/main/ipc/register.ts                       restored to speak-only (matches HEAD)
src/preload/index.ts                           restored to speak-only (matches HEAD)
src/shared/types.ts                            restored to speak-only (matches HEAD)
src/shared/constants.ts
src/shared/tts.ts
src/renderer/pages/SettingsPage.tsx
src/renderer/components/AnalysisCard.tsx
src/renderer/play-audio.ts                     new
src/renderer/styles/app.css
electron-builder.yml
README.md
tests/system-tts.test.ts                       new
tests/renderer/settings-tts.test.tsx           rewritten
tests/renderer/app.test.tsx
tests/helpers/app.ts
tests/helpers/fake-api.ts
docs/changes/jla-system-tts/execution.md
```

## Deleted files

```text
src/main/tts/kokoro-provider.ts
src/main/tts/kokoro-runtime.ts
src/main/tts/kokoro-download.ts                untracked one-click install
src/main/tts/kokoro-installer.ts               untracked one-click install
src/main/tts/kokoro-manifest.ts                untracked one-click install
resources/kokoro/launch.ps1
resources/kokoro/launch.sh
resources/kokoro/README.md
tests/kokoro-runtime.test.ts
tests/tts-provider.test.ts
tests/kokoro-installer.test.ts                 untracked one-click install
tests/tts-install-ipc.test.ts                  untracked one-click install
tests/tts-install-stop.test.ts                 untracked one-click install
```

`docs/PRD.md`, `.DS_Store`, `.omx/`, and `docs/changes/jla-tts-one-click-install/` were not modified or deleted. Unrelated user changes outside this scope were not discarded. No Git commit was created.
