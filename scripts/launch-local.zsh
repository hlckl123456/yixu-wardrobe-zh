#!/bin/zsh
set -eu
project_dir="${0:A:h:h}"
node_bin=""
for candidate in "${YIXU_NODE_BIN:-}" /opt/homebrew/bin/node /usr/local/bin/node "$(command -v node || true)" "${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"; do
  if [[ -n "$candidate" && -x "$candidate" ]] && "$candidate" -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1); require("node:sqlite")' 2>/dev/null; then
    node_bin="$candidate"
    break
  fi
done
if [[ -z "$node_bin" ]]; then
  print '未找到支持 SQLite 的 Node.js。请安装 Node.js 24+，或通过 YIXU_NODE_BIN 指定已有运行时。'
  exit 1
fi
exec "$node_bin" "$project_dir/scripts/local.mjs" "${1:-start}"
