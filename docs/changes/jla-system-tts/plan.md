# JLA System TTS — Plan

**Status:** VERIFIED
**Mode:** IMPLEMENT
**Master:** Codex
**Executor:** 右侧 Herdr Grok 4.6 xhigh（唯一实现文件写入者）
**Date:** 2026-09-03
**Baseline commit:** `065c9ba7a227f494fe6a25ab05fd6e8f26ac6277`

## Objective

将应用默认发音从本地 Kokoro/Python/runtime 改为操作系统自带日语 TTS：macOS 调用系统 `say`/`afconvert`，Windows 调用系统 Speech API。用户点击单句发音时才生成并播放音频，不需要启动容器、常驻服务、下载模型、配置 TTS API Key 或承担云 API 费用。

## Non-goals

- 不修改 `docs/PRD.md`、数据库 schema、AI provider、对话、图片分析、收藏或 Obsidian 行为。
- 不增加云 TTS、MiniMax、OpenAI、Azure 或新的 API Key 设置。
- 不实现 Galgame 全局取词、OCR 热键、剪贴板监控或系统级悬浮窗。
- 不保证 Linux TTS；Linux 应返回明确的不支持提示，不得崩溃。
- 不自动删除用户 `userData/kokoro-runtime` 中已下载的旧模型/runtime，避免未经确认删除用户数据。
- 不保留或启动 Kokoro 作为自动 fallback；系统语音失败时应向用户显示可行动错误。

## Current behavior and evidence

- `src/main/app-services.ts` 的默认 `createTTSProvider()` 必须先执行 `kokoro.ensureReady()`，随后调用本地 Kokoro HTTP provider；runtime 未启动/缺失时发音失败。
- 当前未提交的一键安装实现又增加了 installer、模型下载、Python venv、IPC 状态和设置页安装面板，真实使用仍被用户确认“安装后无法使用且看不到后台日志”。
- `src/renderer/components/AnalysisCard.tsx` 已通过 `tts:speak` 获取 base64 音频并用 `Audio` 播放，可保持该 IPC/播放合同。
- 当前设置已持久化 `voiceGender`，可继续作为系统男女声偏好。
- 本机验证：`/usr/bin/say` 与 `/usr/bin/afconvert` 均存在；`say -v '?'` 可列出 `ja_JP` 音色；`say` 输出 AIFF 后经 `afconvert -f WAVE -d LEI16@22050` 可生成有效 PCM WAV。
- Windows 构建目标为 x64；当前 Electron builder 已包含 Windows NSIS/dir 配置。

## Pre-existing dirty files

以下内容来自已完成但未提交的 `jla-tts-one-click-install` 工作，本任务明确取代其中的 Kokoro 安装实现；Executor 可在本任务范围内修改或删除这些文件，但不得丢弃其他用户改动：

```text
M README.md
M resources/kokoro/README.md
M src/main/app-services.ts
M src/main/ipc/register.ts
M src/main/tts/kokoro-runtime.ts
M src/preload/index.ts
M src/renderer/pages/SettingsPage.tsx
M src/renderer/styles/app.css
M src/shared/constants.ts
M src/shared/types.ts
M tests/helpers/fake-api.ts
M tests/kokoro-runtime.test.ts
M tests/renderer/app.test.tsx
?? docs/changes/jla-tts-one-click-install/
?? src/main/tts/kokoro-download.ts
?? src/main/tts/kokoro-installer.ts
?? src/main/tts/kokoro-manifest.ts
?? tests/kokoro-installer.test.ts
?? tests/renderer/settings-tts.test.tsx
?? tests/tts-install-ipc.test.ts
?? tests/tts-install-stop.test.ts
```

Do not modify/delete unrelated `.DS_Store`, `.omx/`, or `docs/PRD.md` files.

## Approved design decisions

### Provider contract

Add a main-process `SystemTTSProvider` implementing the existing `TTSProvider` contract and returning cached WAV bytes:

```ts
speak(text, { voiceGender, speed }): Promise<{
  mimeType: 'audio/wav'
  bytes: Uint8Array
  cached: boolean
}>
```

- Keep the renderer-facing `tts:speak` IPC and `SpeakResult` shape unchanged.
- Generate normal-speed audio and keep the existing renderer `audio.playbackRate = speed` behavior for exact 0.75x/1.0x playback. Cache identity therefore includes platform, selected voice and text, but does not need separate audio files per playback speed.
- Reject empty/whitespace-only text with a user-facing error.
- Use argument arrays and temporary files; never interpolate user text into shell scripts/commands.
- Apply a bounded timeout and terminate only child processes created for the current synthesis request.
- Write cache via temporary output followed by atomic rename; remove request temp files in `finally`.

### macOS adapter

- Invoke absolute system paths `/usr/bin/say` and `/usr/bin/afconvert`; do not use a shell.
- Discover installed voices via `say -v '?'`, parse only rows whose locale is `ja_JP`, and cache the discovered selection in memory.
- Prefer known female names (`Kyoko`, `Flo`, `Sandy`, `Shelley`, `Grandma`) and known male names (`Otoya`, `Eddy`, `Reed`, `Rocko`, `Grandpa`); if the requested gender is unavailable, fall back to any installed `ja_JP` voice.
- Run `say -v <voice> -o <temp.aiff> <text>` and then `afconvert -f WAVE -d LEI16@22050 <temp.aiff> <temp.wav>`.
- If no Japanese voice exists, report: `未找到 macOS 日语系统语音，请先在系统设置中下载日语语音后重试。`

### Windows adapter

- Invoke `powershell.exe` or `powershell` directly with `-NoProfile -NonInteractive -ExecutionPolicy Bypass -File <generated-script>`; do not invoke through `cmd.exe` or a shell.
- Put input text in a UTF-8 temporary text file. The fixed generated PowerShell script reads that file and writes WAV to a supplied path using `.NET System.Speech.Synthesis.SpeechSynthesizer`.
- Select an enabled installed voice whose culture starts with `ja`; prefer the requested `VoiceGender`, then fall back to any enabled Japanese voice.
- If no Japanese voice exists, return: `未找到 Windows 日语系统语音，请先在 Windows 语言设置中安装日语语音包后重试。`
- PowerShell stderr/exit failures must be converted into concise visible errors without exposing arbitrary command lines or temp paths.

### Unsupported platforms

Return a non-retryable configuration error indicating that system TTS currently supports Windows and macOS only.

### App integration

- `AppServices.createTTSProvider()` should instantiate the system provider by default and continue honoring the injected `ttsProvider` test override.
- Remove Kokoro runtime/installer lifecycle from `AppServices.close()` and app startup.
- Remove Kokoro install/status/cancel/progress IPC channels, preload methods and shared public types.
- Remove Kokoro constants/mapping; retain generic `normalizeVoiceGender`.
- Keep AI settings and `voiceGender` persistence backward-compatible. Existing databases require no migration.

### Renderer/settings

- Remove the Kokoro installation panel, install progress and related styling.
- Keep the female/male radio choice.
- Explain that pronunciation uses the installed Windows/macOS Japanese system voice and requires no container/model/API.
- Add a `测试发音` button using `api.tts.speak()` with a fixed Japanese sentence, then play the returned audio through the same safe Blob/Audio flow. Show `正在生成…`, success/playing state if useful, and an inline actionable error. Do not expose stack traces.
- Existing analysis-card 0.75x and 1.0x buttons must continue to work.

### Kokoro cleanup

- Delete the untracked one-click installer implementation/tests superseded by this task.
- Remove baseline Kokoro runtime/provider/tests/resources and Kokoro packaging entries if no production reference remains.
- Do not delete the historical `docs/changes/jla-tts-one-click-install/` evidence packet.
- Do not delete an already installed userData runtime from disk; update README troubleshooting with an optional manual cleanup note only.
- `src/main/tts/openai-compatible.ts` may remain unused because it is a generic provider and outside the required cleanup; do not wire it into the app.

## Expected affected files/modules

Likely implementation scope:

```text
src/main/tts/system.ts                         new
src/main/app-services.ts
src/main/ipc/register.ts
src/preload/index.ts
src/shared/constants.ts
src/shared/types.ts
src/shared/tts.ts
src/renderer/pages/SettingsPage.tsx
src/renderer/components/AnalysisCard.tsx       only if playback helper extraction is useful
src/renderer/styles/app.css                    only for obsolete installer styles/test button
resources/kokoro/*                             remove
src/main/tts/kokoro-*.ts                       remove
src/main/tts/kokoro-runtime.ts                 remove
electron-builder.yml
README.md
tests/system-tts.test.ts                       new
tests/renderer/settings-tts.test.tsx           adapt/new
tests/renderer/app.test.tsx
tests/helpers/fake-api.ts
obsolete Kokoro installer/runtime/provider tests remove
```

Focused helper files within the same modules are allowed when they improve testability. No unrelated implementation files.

## Implementation steps

1. Implement a dependency-injected command runner and cross-platform `SystemTTSProvider` with timeout, cleanup, cache and actionable errors.
2. Add unit tests covering macOS command selection/conversion, Windows fixed-script arguments and gender selection contract, cache hits, missing Japanese voices, command failure, timeout/cleanup, unsupported platform and shell-injection-resistant text handling.
3. Replace the default Kokoro provider/runtime integration in `AppServices` with `SystemTTSProvider` while preserving test overrides and IPC result shape.
4. Remove Kokoro installer IPC/preload/shared API surface and obsolete types/constants/mappings.
5. Simplify Settings UI and add test pronunciation with visible error feedback; update renderer tests/fake API.
6. Remove Kokoro resources, provider/runtime/installer code, obsolete tests and builder packaging rules only after references are gone.
7. Update README to describe system TTS prerequisites and troubleshooting for Windows/macOS, and to remove Kokoro installation/runtime claims.
8. Record exact changes, deletions, deviations and verification output in `docs/changes/jla-system-tts/execution.md`.

## Acceptance criteria

1. On macOS, clicking pronunciation generates playable `audio/wav` using installed `ja_JP` system voice without network, container, Python or a long-running child service.
2. On Windows, the provider uses installed Japanese system voice through the fixed PowerShell/System.Speech adapter and produces WAV without network/container/model files.
3. Female/male remains a preference; when a matching-gender Japanese voice is unavailable, playback falls back to an installed Japanese voice instead of failing.
4. Missing Japanese system voice produces an inline platform-specific installation message in Settings test and analysis-card playback.
5. 0.75x and 1.0x controls play at the requested renderer playback rate without duplicate synthesis for the same text/voice.
6. Settings contains no Kokoro install/download/runtime UI and no TTS API configuration.
7. Production startup no longer constructs, launches, downloads or stops Kokoro components; no Kokoro IPC/public API remains.
8. Electron packaging no longer bundles `resources/kokoro` or declares Kokoro asar unpacking.
9. Existing AI, conversation, image, history, notes and settings behavior remains unchanged.
10. No secret, arbitrary command, user text or temp path is logged or shell-interpolated.
11. macOS real smoke confirms system synthesis can create a valid WAV; Windows behavior is unit-tested and `package:win` is attempted when feasible.

## Verification commands

Executor must run and record:

```bash
npm run format:write
npm run format
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run package:dir
```

MASTER final verification additionally runs a macOS real provider/smoke check and attempts:

```bash
npm run package:win
```

If Windows packaging cannot complete on macOS, record the exact failure and leave Windows runtime behavior explicitly unverified on a real Windows host.

## Compatibility requirements

- Runtime targets: Windows 10/11 x64 and macOS arm64; macOS x64 code path should use the same system commands.
- Preserve stored `voiceGender` and existing settings schema; no database migration.
- Preserve existing renderer `JapaneseAssistantAPI.tts.speak` signature and analysis-card controls.
- No network access is required for TTS after the OS Japanese voice is installed.

## Failure and rollback considerations

- System commands may be missing, blocked, time out, or have no Japanese voice; every case must fail quickly with an actionable renderer-visible message.
- Temporary audio/script/text files must be request-scoped and cleaned after success/failure/timeout.
- Cache failures should not corrupt a prior valid cached WAV.
- Existing downloaded Kokoro data is left untouched, so rollback to the prior implementation remains possible from Git/worktree state without redownloading if user data still exists.
- If Windows System.Speech cannot reliably access Windows 10/11 installed Japanese voices based on source/tests, stop and report the design conflict rather than silently substituting another architecture.

## Unresolved questions

None blocking. Real Windows voice discovery/playback requires validation on a Windows 10/11 x64 machine before release; unit tests and packaging are the required evidence in this environment.

## Approved review deviation

Windows cache identity uses platform + requested gender + text instead of the concrete installed voice name because voice selection occurs inside the fixed PowerShell synthesis script. MASTER approved this low-risk deviation on 2026-09-03: it preserves normal cache behavior and may only retain prior audio after the OS voice inventory changes. Real Windows playback remains a release validation item.
