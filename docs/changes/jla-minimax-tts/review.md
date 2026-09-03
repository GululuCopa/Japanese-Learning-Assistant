# JLA MiniMax TTS — Review

**Status:** VERIFIED
**Master:** Codex
**Date:** 2026-09-03
**Baseline:** `9192d1ec69de6a3bbbf4ca76e0680f8d02377650`

## Result

No unresolved findings. The implementation matches the approved design after one bounded fix: non-2xx MiniMax HTTP responses are now rejected before parsing a successful-looking JSON payload, and the regression test confirms that such a response is not cached.

## Acceptance review

- Settings preview saves current form values and sends the current `voiceGender` override, so unsaved male/female selection is honored.
- Normal analysis-card playback remains persisted-setting driven.
- System TTS remains the default; legacy settings receive safe MiniMax defaults.
- MiniMax UI is conditional, exposes provider/region/model/female voice/male voice/key state, and explicitly warns about Token Plan credentials and no automatic fallback.
- MiniMax Key uses safeStorage or session-only memory and is absent from public settings/database plaintext/error messages.
- MiniMax request uses fixed region endpoints, bearer auth, Japanese boost, hex MP3 response, normal synthesis speed, and cache reuse across playback speeds.
- Error handling covers auth, rate limiting, balance/quota, invalid parameters, malformed response, network, timeout, and non-2xx HTTP responses.
- Kokoro/runtime/container behavior was not reintroduced.

## Scope review

Changes are limited to shared TTS/settings contracts, settings persistence/routing, MiniMax provider, Settings UI, targeted test helpers/tests, and this task packet. `docs/PRD.md`, `.DS_Store`, `.omx/`, and unrelated runtime features were preserved. No Git commit or destructive Git operation was performed.

## Verification evidence

- `npm run format` — exit 0
- `npm run lint` — exit 0
- `npm run typecheck` — exit 0
- `npm test -- --run` — exit 0, 25 files / 93 tests
- `npm run build` — exit 0
- `npm run package:dir` — exit 0, macOS arm64 directory package
- `npm run package:win` — exit 0, Windows x64 NSIS installer and unpacked directory
- `git diff --check` — exit 0

## Remaining release validation

- No live MiniMax request was made; the real user API Key was not used.
- Native Windows playback and installed Japanese voice behavior still require validation on a Windows 10/11 x64 host.
- Manual packaged-app GUI verification remains a release smoke-test item.
