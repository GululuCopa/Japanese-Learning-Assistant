# Kokoro Local TTS Integration — Review

**Status:** VERIFIED
**Reviewer:** Codex MASTER
**Baseline:** `8e465febcde349901c9cb8ba8d0e8a04d3dc1173` plus pre-existing uncommitted V0.1 implementation.

## Finding KOKORO-001 — Resolved

- **Severity:** High
- **Affected behavior:** port fallback when using the documented Kokoro-FastAPI `start-cpu.ps1` / `start-cpu.sh` entrypoint.
- **Evidence:** `src/main/tts/kokoro-runtime.ts` chooses a free fallback port and passes it to `launch.ps1`/`launch.sh`. Both wrapper scripts discard the host/port when they delegate to `start-cpu.ps1`/`start-cpu.sh`, and the spawned child inherits `process.env` without the selected port being injected. A real upstream start script can therefore still bind its default port (8880), while readiness polls the fallback port and times out.
- **Required correction:** preserve the selected host/port through the wrapper-to-start-script path (for example, set `KOKORO_HOST`/`KOKORO_PORT` in the wrapper before delegation, or pass supported explicit arguments), and add/update a focused regression test or static contract test proving the selected port is forwarded. Keep Windows and macOS behavior safe.

The correction was applied, independently verified, and the packet is now VERIFIED.
