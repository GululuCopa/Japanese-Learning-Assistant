$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Orchestrator = Join-Path $ScriptDir 'deploy-install.mjs'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error '未找到 Node.js。请先安装 Node.js 22 或更高版本，并确保 node 命令可用。'
  exit 1
}
& node $Orchestrator @args
exit $LASTEXITCODE
