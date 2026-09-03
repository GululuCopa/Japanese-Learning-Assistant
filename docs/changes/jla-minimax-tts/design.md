# JLA MiniMax TTS — Design

**Status:** VERIFIED
**Approved by:** Codex (MASTER)
**Date:** 2026-09-03

## Scope

### In scope

1. Add `TTSProviderKind = 'system' | 'minimax'`.
2. Extend settings persistence/public types/schema for provider, MiniMax region/model/female voice/male voice and encrypted MiniMax API Key presence.
3. Add a main-process MiniMax provider implementing the existing `TTSProvider` contract.
4. Add a single-call `voiceGender` override to `tts:speak`, used by Settings preview; ordinary analysis-card playback uses persisted settings.
5. Add conditional MiniMax configuration controls to Settings.
6. Add unit/renderer regression tests and preserve existing system TTS behavior.

### Out of scope

- Daily server-side spend caps or billing dashboards.
- Arbitrary custom voice IDs/endpoints.
- Streaming TTS.
- Automatic fallback between system and MiniMax.
- Changes to AI provider, conversation persistence, attachments, or database schema migrations.
- Reintroducing Kokoro/runtime/container behavior.

## Domain and settings model

Add to shared types:

```ts
type TTSProviderKind = 'system' | 'minimax'
type MiniMaxRegion = 'china' | 'global'
```

Extend `SettingsUpdate` with:

```ts
ttsProvider: TTSProviderKind
minimaxRegion: MiniMaxRegion
minimaxModel: string
minimaxFemaleVoice: string
minimaxMaleVoice: string
minimaxApiKey?: string
clearMinimaxApiKey?: boolean
```

Extend `PublicSettings` with the non-secret values and:

```ts
hasMinimaxApiKey: boolean
```

Extend `SpeakInput` with optional `voiceGender?: VoiceGender`.

Defaults for legacy settings and new installs:

- `ttsProvider: 'system'`
- `minimaxRegion: 'china'`
- `minimaxModel: 'speech-2.8-hd'`
- `minimaxFemaleVoice: 'Japanese_CalmLady'`
- `minimaxMaleVoice: 'Japanese_GentleButler'`

Use fixed allowlists for model/voice values. Preserve an existing valid configured value; otherwise apply defaults. Do not return the secret itself.

## Settings service and secret handling

Reuse `EncryptedSecret`, `sessionSecrets`, `applySecret`, and `readSecret` with a distinct `MINIMAX_SESSION_KEY`. Persist only encrypted MiniMax Key when safeStorage is available; when unavailable, keep it session-only and show the existing encryption warning. `resolveSecrets()` returns `minimaxApiKey` for main-process use. Add `requireMinimaxTtsConfig()` returning fixed endpoint, selected model, selected gender-mapped voice, and key or throwing a configuration `ProviderError`.

Blank API-key input preserves the saved key. Explicit clear removes both persisted and session secret. Region must map only to the two fixed official endpoints.

## Main-process provider

Create `src/main/tts/minimax.ts` with an injectable `fetchImpl`, cache directory, configuration, and optional timeout. On `speak`:

1. Trim and reject empty text.
2. Select model/voice from configuration and `options.voiceGender` if supplied; use normal synthesis speed 1 regardless of renderer playback speed.
3. Check cache keyed by provider, region, model, voice, and text (not playback speed).
4. POST JSON to the fixed region endpoint with bearer authorization and the official T2A v2 fields.
5. Validate HTTP status, JSON shape, successful `base_resp`, and safe hex audio.
6. Decode hex to MP3, atomically cache, return `{ mimeType: 'audio/mpeg', bytes, cached }`.

Use AbortController for a bounded request timeout. Map auth (HTTP 401/403 and MiniMax 1004/2049), rate limit (HTTP 429/1002), insufficient balance (1008), quota exhausted (2056), invalid parameters/model/voice/input (1026/2013), network, timeout, and malformed response to actionable `ProviderError`s. Do not include key or response audio in messages.

## App service routing

`AppServices.createTTSProvider()` returns injected override in tests; otherwise it reads settings. For `system`, construct `SystemTTSProvider`. For `minimax`, call `requireMinimaxTtsConfig()` and construct `MiniMaxTTSProvider` with the resolved config and `fetchImpl`.

`AppServices.speak()` passes `input.voiceGender ?? persisted.voiceGender` to the provider. This preserves normal playback while allowing Settings to preview unsaved gender.

## Renderer UX

Settings shows provider selector:

- 系统语音
- MiniMax

System copy explains installed OS Japanese voices and no API charge. MiniMax selection shows:

- password API Key input and `(已保存)` marker
- region selector (国内 / 海外, domestic default)
- model selector with `speech-2.8-hd` default and `speech-2.8-turbo`
- female voice and male voice selectors from fixed Japanese list
- explicit warning not to mix Token Plan and ordinary API credentials
- explicit no-auto-fallback/no-auto-switch copy

Keep gender radio. Change test action to **保存并测试发音** for MiniMax because provider/key changes must be persisted before the call; for system it may also save first for consistent behavior. The saved values must be passed to the settings save API and then `tts.speak` must receive the current `voiceGender` override. Keep loading/error state inline. Preserve blank AI key behavior.

## Compatibility and rollback

Existing JSON settings are read with defaults; no SQL migration. Existing `tts:speak` callers remain valid because `voiceGender` is optional. Existing system TTS cache and analysis-card playback remain compatible. If MiniMax implementation is disabled or misconfigured, switching back to system in Settings restores local playback without deleting cached files or secrets.
