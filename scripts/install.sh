#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请先安装 Node.js 22 或更高版本，并确保 node 命令可用。" >&2
  exit 1
fi
exec node "$SCRIPT_DIR/deploy-install.mjs" "$@"
