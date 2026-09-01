# Local Kokoro runtime (not bundled)

This folder is a **launcher hook**. The Git repository and npm package do **not** include Kokoro model weights, a Python virtualenv, or a FastAPI checkout.

Place a Kokoro-FastAPI-compatible runtime here (development) or in:

- Packaged extra resource: `resources/kokoro` next to the app
- User-managed runtime: `%APPDATA%\Japanese Learning Assistant\kokoro-runtime\` (Windows) or the equivalent `userData/kokoro-runtime` directory

Accepted entrypoints (first match wins):

- Windows: `launch.ps1` (this file), `start-cpu.ps1`, or `kokoro-fastapi.exe`
- macOS/Linux: `launch.sh` (this file), `start-cpu.sh`, or `kokoro-fastapi`

The app starts the process, probes `GET /health` or `GET /v1/models`, then calls `POST /v1/audio/speech` with `model=kokoro`.

Developer-only environment overrides (never taken from the renderer):

```text
JLA_KOKORO_BIN=/absolute/path/to/executable
JLA_KOKORO_ARGS=["--flag"]
JLA_KOKORO_RUNTIME=/absolute/path/to/runtime-dir
JLA_KOKORO_PORT=8880
```
