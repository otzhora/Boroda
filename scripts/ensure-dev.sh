#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
RUN_DIR="$REPO_ROOT/.boroda/run"
LOCK_DIR="$RUN_DIR/ensure-dev.lock"
PID_FILE="$RUN_DIR/boroda-dev.pid"
LOG_FILE="$RUN_DIR/boroda-dev.log"
BACKEND_PORT=${BORODA_DEV_PORT:-${BORODA_SERVER_PORT:-${PORT:-3000}}}
WEB_PORT=${BORODA_WEB_PORT:-5173}
START_TIMEOUT=${BORODA_DEV_START_TIMEOUT:-45}
HEALTH_URL="http://127.0.0.1:${BACKEND_PORT}/api/health"
WEB_URL="http://127.0.0.1:${WEB_PORT}"

mkdir -p "$RUN_DIR"

cleanup_lock() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

is_url_ready() {
  curl --silent --show-error --fail --max-time 2 "$1" >/dev/null 2>&1
}

if ! command -v curl >/dev/null 2>&1; then
  printf '%s\n' "Boroda dev launcher requires curl." >&2
  exit 127
fi

if ! command -v npm >/dev/null 2>&1; then
  printf '%s\n' "Boroda dev launcher requires npm." >&2
  exit 127
fi

if mkdir "$LOCK_DIR" 2>/dev/null; then
  trap cleanup_lock EXIT INT TERM
else
  printf '%s\n' "Boroda startup check is already in progress." >&2
  exit 0
fi

if is_url_ready "$HEALTH_URL" && is_url_ready "$WEB_URL"; then
  printf '%s\n' "Boroda dev stack is already running."
  exit 0
fi

if is_url_ready "$HEALTH_URL" || is_url_ready "$WEB_URL"; then
  printf '%s\n' "Boroda looks partially started. Backing off to avoid duplicate dev processes." >&2
  printf '%s\n' "Check $LOG_FILE or stop the existing process before retrying." >&2
  exit 1
fi

if [ -f "$PID_FILE" ]; then
  EXISTING_PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$EXISTING_PID" ] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    printf '%s\n' "Boroda dev process $EXISTING_PID exists but is not healthy yet. Backing off." >&2
    printf '%s\n' "Check $LOG_FILE before retrying." >&2
    exit 1
  fi

  rm -f "$PID_FILE"
fi

printf '%s\n' "Starting Boroda dev stack on backend port $BACKEND_PORT and web port $WEB_PORT."

(
  cd "$REPO_ROOT"
  nohup env PORT="$BACKEND_PORT" BORODA_SERVER_PORT="$BACKEND_PORT" npm run dev >>"$LOG_FILE" 2>&1 &
  printf '%s\n' "$!" > "$PID_FILE"
)

SECONDS_WAITED=0
while [ "$SECONDS_WAITED" -lt "$START_TIMEOUT" ]; do
  if is_url_ready "$HEALTH_URL" && is_url_ready "$WEB_URL"; then
    printf '%s\n' "Boroda is ready at $WEB_URL."
    exit 0
  fi

  CURRENT_PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$CURRENT_PID" ] && ! kill -0 "$CURRENT_PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    printf '%s\n' "Boroda dev process exited before startup completed." >&2
    printf '%s\n' "Check $LOG_FILE for details." >&2
    exit 1
  fi

  sleep 1
  SECONDS_WAITED=$((SECONDS_WAITED + 1))
done

printf '%s\n' "Boroda did not become ready within ${START_TIMEOUT}s." >&2
printf '%s\n' "Check $LOG_FILE for details." >&2
exit 1
