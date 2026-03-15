#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
NODE_BIN=""

if [ "${BORODA_MCP_ENABLED+x}" = "" ]; then
  export BORODA_MCP_ENABLED=true
fi

if command -v node >/dev/null 2>&1; then
  NODE_BIN=$(command -v node)
elif [ -n "${HOME:-}" ]; then
  for candidate in "$HOME"/.nvm/versions/node/*/bin/node; do
    if [ -x "$candidate" ]; then
      NODE_BIN=$candidate
    fi
  done
fi

if [ -z "$NODE_BIN" ]; then
  printf '%s\n' "Boroda MCP launcher could not find a usable node binary." >&2
  exit 127
fi

cd "$REPO_ROOT"
exec "$NODE_BIN" --import tsx packages/server/src/modules/integrations/mcp/run.ts
