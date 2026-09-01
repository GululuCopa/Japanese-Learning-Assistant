param(
  [string]$HostAddress = $(if ($env:KOKORO_HOST) { $env:KOKORO_HOST } else { '127.0.0.1' }),
  [int]$Port = $(if ($env:KOKORO_PORT) { [int]$env:KOKORO_PORT } else { 8880 })
)
$ErrorActionPreference = 'Stop'
$env:KOKORO_HOST = $HostAddress
$env:KOKORO_PORT = "$Port"
$env:HOST = $HostAddress
$env:PORT = "$Port"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$startCpu = Join-Path $root 'start-cpu.ps1'
if (Test-Path $startCpu) {
  Set-Location $root
  & $startCpu
  exit $LASTEXITCODE
}
$pythonCandidates = @(
  (Join-Path $root 'python\python.exe'),
  (Join-Path $root 'venv\Scripts\python.exe'),
  (Join-Path $root '.venv\Scripts\python.exe')
)
$python = $pythonCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $python) {
  Write-Error 'Kokoro runtime not found. Place start-cpu.ps1 or a Python venv in this folder. See README.md.'
  exit 1
}
Set-Location $root
& $python -m uvicorn api.src.main:app --host $HostAddress --port $Port
