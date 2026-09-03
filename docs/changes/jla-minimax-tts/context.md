# JLA MiniMax TTS — Context

**Status:** VERIFIED
**Mode:** IMPLEMENT
**Master:** Codex
**Executor:** 右侧 Herdr Grok 4.6 xhigh（唯一实现文件写入者）
**Date:** 2026-09-03
**Baseline commit:** `9192d1ec69de6a3bbbf4ca76e0680f8d02377650`

## Objective

修复设置页男声/女声测试预览不生效的问题，并增加 MiniMax TTS 作为显式可选的语音提供商。默认仍为系统 TTS；MiniMax API Key 只在主进程处理并使用现有 safeStorage 机制保存，渲染进程只能看到是否已保存。功能必须兼容 Windows 10/11 x64 与 macOS。

## Current behavior and evidence

- `src/renderer/pages/SettingsPage.tsx` 的“测试发音”只调用 `{ text, speed }`，没有传当前未保存的 `voiceGender`。
- `src/main/app-services.ts` 的 `speak()` 总是从 `settings.getPublic().voiceGender` 读取持久化值，因此切换单选框后立即测试仍会使用旧值。
- 当前主进程已有 `SystemTTSProvider`，macOS 使用 `/usr/bin/say` + `afconvert`，Windows 使用 PowerShell/System.Speech；renderer-facing `tts:speak` 合同为 base64 音频结果。
- 当前 `SettingsService` 已对 AI API Key 使用 Electron safeStorage，并在不可用时保留会话内存；该机制应扩展到 MiniMax Key。
- 当前 `SettingsUpdate` / `PublicSettings` / `speakInputSchema` 没有 MiniMax 配置或单次 voiceGender override。
- 当前工作树基线应保持干净；不得修改 `docs/PRD.md`、`.DS_Store`、`.omx/`。

## MiniMax API evidence

Use the official MiniMax T2A v2 HTTP contract:

- Domestic endpoint: `https://api.minimaxi.com/v1/t2a_v2`
- Global endpoint: `https://api.minimax.io/v1/t2a_v2`
- `Authorization: Bearer <API_KEY>` and JSON POST.
- Recommended default model: `speech-2.8-hd`.
- Use `language_boost: "Japanese"`, `output_format: "hex"`, voice settings with `speed: 1`, `vol: 1`, `pitch: 0`, and MP3 audio settings.
- Decode non-empty even-length hex `data.audio` into MP3 bytes; require `base_resp.status_code === 0`.
- Japanese voice IDs exposed in settings should include configured female and male defaults, including `Japanese_CalmLady` and `Japanese_GentleButler` (allow user selection from a fixed known list).

## Security and spend constraints

- Never expose the MiniMax API Key to renderer/public settings or logs.
- Never log Authorization, API Key, raw response body, or audio hex.
- Do not accept arbitrary endpoint URLs in the UI; region maps to fixed allowlisted endpoints.
- No automatic provider/key fallback. If MiniMax is selected and unavailable, show an actionable error instead of silently using another paid provider.
- Cache successful synthesized audio. Synthesize once at normal speed and let renderer playbackRate handle 0.75x/1.0x; do not bill twice for playback speed.
- TTS remains explicit user-click only; no auto-play.
