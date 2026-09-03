# JLA MiniMax TTS — Execution Evidence

**Executor:** right-side implementation writer (Grok 4.6)
**Date:** 2026-09-03
**Mode:** IMPLEMENT + FIX_REVIEW
**Host:** macOS darwin arm64
**Baseline:** `9192d1ec69de6a3bbbf4ca76e0680f8d02377650`
**Git operations:** none

## Summary

- Settings preview now persists current form values and calls `tts.speak` with `voiceGender` override. Analysis-card playback still uses persisted gender.
- Default provider remains system TTS. MiniMax is an explicit setting. Region maps only to `https://api.minimaxi.com/v1/t2a_v2` and `https://api.minimax.io/v1/t2a_v2`.
- MiniMax T2A v2 requests use bearer auth, `language_boost: Japanese`, hex MP3, synthesis speed 1, and cache by region/model/voice/text.
- MiniMax API Key uses the existing safeStorage/session-secret path and never appears in `PublicSettings` or database plaintext.
- MiniMax failures stay actionable and do not fall back to system or another paid provider.

## FIX_REVIEW F-001 (2026-09-03)

Non-2xx HTTP is now rejected before MiniMax JSON is trusted. `speak()` throws on `!response.ok`: 401/403 → authentication, 429 → rate_limit, other HTTP → unknown retryable. `base_resp.status_code` mapping runs only after a 2xx response. Regression: HTTP 500 with `status_code: 0` and hex audio rejects and does not cache.

Focused re-run: `npx vitest run tests/minimax-tts.test.ts tests/settings-minimax.test.ts` → **15 passed / 0 failed** (was 14 provider+settings cases plus the new HTTP 500 case). `npm run format:write`, `npm run format`, `npm run lint`, `npm run typecheck`: all exit **0**.

## Verification

Commands run on 2026-09-03 in this IMPLEMENT session.

### `npm run format:write`

Exit **0**.

### `npm run format`

Exit **0**. `All matched files use Prettier code style!`

### `npm run lint`

Exit **0**. `ESLint: No issues found`

### `npm run typecheck`

Exit **0**.

### `npm test -- --run`

Exit **0**.

```text
 Test Files  25 passed (25)
      Tests  93 passed (93)
```

New/updated coverage: `tests/minimax-tts.test.ts` (10), `tests/settings-minimax.test.ts` (5), `tests/renderer/settings-tts.test.tsx` (4).

### `npm run build`

Exit **0**. main `84.92 kB`, renderer `index-CZvCOEbl.js` `279.16 kB`.

### `npm run package:dir`

Exit **0**. `electron-builder 26.15.3` packaged `platform=darwin arch=arm64 electron=44.1.0` to `release/mac-arm64`.

### `npm run package:win`

Exit **0**. Windows x64 NSIS installer and unpacked directory were produced.

### `git diff --check`

Exit **0**.

### `git diff --stat 9192d1e`

17 tracked files, plus untracked `src/main/tts/minimax.ts`, `tests/minimax-tts.test.ts`, `tests/settings-minimax.test.ts`, and this packet.

## Deviations

- `requireMinimaxTtsConfig()` returns both female and male voice IDs so a single speak override can select the unsaved/current gender without reconstructing settings.
- Test pronunciation always saves first for both system and MiniMax, matching the approved “保存并测试发音” behavior.
- Japanese voice allowlist is the official MiniMax Japanese system-voice set, split by documented female/male defaults `Japanese_CalmLady` / `Japanese_GentleButler`.
- Tests use `testSettings()` to keep legacy save call sites typed after `SettingsUpdate` gained MiniMax fields.

## Failures

None of the listed verification commands failed after the SettingsPage string-state type fix. An intermediate typecheck failed because `useState(DEFAULT_MINIMAX_MODEL)` inferred a literal; states are now `string`.

## Unverified areas

- Live MiniMax T2A v2 call with a real API key.
- Native Windows 10/11 x64 MiniMax or system playback; packaging was verified with `package:win`, but native playback was not run.
- Manual GUI: MiniMax save/test and analysis-card 0.75x/1.0x in the packaged app.

## Changed files

```text
src/shared/types.ts
src/shared/constants.ts
src/shared/schemas.ts
src/shared/tts.ts
src/main/settings/service.ts
src/main/app-services.ts
src/main/tts/minimax.ts                          new
src/renderer/pages/SettingsPage.tsx
src/renderer/styles/app.css
tests/helpers/app.ts
tests/helpers/fake-api.ts
tests/minimax-tts.test.ts                        new
tests/settings-minimax.test.ts                   new
tests/renderer/settings-tts.test.tsx
tests/renderer/app.test.tsx
tests/renderer/chat-history.test.tsx
tests/settings-secrets.test.ts
tests/settings-voice.test.ts
tests/prd-cases.test.ts
tests/obsidian-export.test.ts
docs/changes/jla-minimax-tts/execution.md
```

`docs/PRD.md`, `.DS_Store`, and `.omx/` were not modified. Kokoro was not reintroduced. No Git commit was created.
