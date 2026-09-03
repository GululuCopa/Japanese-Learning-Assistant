# JLA MiniMax TTS — Tasks

**Status:** VERIFIED
**Mode:** IMPLEMENT
**Executor:** 右侧 Herdr Grok 4.6 xhigh
**Baseline:** `9192d1ec69de6a3bbbf4ca76e0680f8d02377650`

## Implementation steps

1. Read `context.md`, `design.md`, repository instructions, and verify baseline/dirty state. Stop if scope/design conflicts.
2. Extend shared types, defaults, schemas, and any preload-facing contracts for provider/configuration and optional preview gender.
3. Extend `SettingsService` with legacy-safe defaults and encrypted/session-only MiniMax Key handling; keep public settings secret-free.
4. Implement `src/main/tts/minimax.ts` with fixed region endpoints, request validation, timeout, error mapping, safe hex decode, atomic cache, and injectable fetch.
5. Route `AppServices` between system and MiniMax providers; ensure `voiceGender` override is honored only for the current speak request.
6. Update Settings UI and test helper for conditional MiniMax controls, saved-key state, save/test flow, and current gender preview.
7. Add tests for provider request/body/voice mapping/cache/speed reuse/errors, settings secret persistence/public redaction/legacy defaults, app routing/override, and renderer conditional UI.
8. Run formatting, lint, typecheck, full tests, build, and package:dir. Record exact commands/results/deviations in `docs/changes/jla-minimax-tts/execution.md`.

## Expected files/modules

Likely affected:

- `src/shared/types.ts`
- `src/shared/constants.ts`
- `src/shared/schemas.ts`
- `src/shared/errors.ts` only if a new error category is genuinely required
- `src/main/settings/service.ts`
- `src/main/app-services.ts`
- `src/main/tts/minimax.ts` (new)
- `src/renderer/pages/SettingsPage.tsx`
- `src/renderer/styles/app.css` if needed
- `tests/helpers/app.ts`
- `tests/helpers/fake-api.ts`
- relevant existing/new tests under `tests/`

Do not modify `docs/PRD.md`, `.DS_Store`, `.omx/`, or unrelated feature files.

## Acceptance criteria

- Selecting 男声 then previewing before saving sends `voiceGender: 'male'` and uses male voice; selecting 女声 analogously works.
- Normal analysis-card playback continues to use persisted gender.
- Default provider remains system; legacy settings load without MiniMax fields.
- MiniMax settings are visible only when MiniMax is selected and include domestic default, model, female/male Japanese voices, API Key saved marker, and no-fallback warning.
- MiniMax key never appears in `PublicSettings`, renderer payloads, database plaintext, logs, or errors.
- MiniMax request uses fixed endpoint, bearer key, Japanese language boost, normal synthesis speed, configured model/voice, and MP3/hex output.
- Valid hex audio decodes and caches; cache hit avoids a second network request; 0.75x does not create a second synthesis.
- Auth, rate-limit, quota, balance, invalid input/response, network, and timeout failures are actionable and do not silently switch providers.
- Existing test suite and build remain green; no Kokoro is reintroduced.

## Verification commands

```bash
npm run format:write
npm run format
npm run lint
npm run typecheck
npm test -- --run
npm run build
npm run package:dir
```

Also inspect:

```bash
git diff --check
git diff --stat 9192d1e
```

## Failure/rollback considerations

- Never use a real user API key in tests or logs.
- Network-dependent MiniMax tests must use an injected mock `fetchImpl`.
- If official API response shape cannot be validated from source/tests, stop and report rather than inventing a fallback contract.
- If native Windows verification is unavailable, record that packaging is verified but native Windows playback remains a release-validation item.
