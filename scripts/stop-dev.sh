#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
RUN_DIR="$REPO_ROOT/.boroda/run"
LOCK_DIR="$RUN_DIR/ensure-dev.lock"
PID_FILE="$RUN_DIR/boroda-dev.pid"
LOG_FILE="$RUN_DIR/boroda-dev.log"
STOP_TIMEOUT=${BORODA_DEV_STOP_TIMEOUT:-10}

collect_descendants() {
  parent_pid="$1"
  children=$(ps -o pid= --ppid "$parent_pid" 2>/dev/null | tr -s '[:space:]' '\n')

  for child_pid in $children; do
    [ -n "$child_pid" ] || continue
    collect_descendants "$child_pid"
    printf '%s\n' "$child_pid"
  done
}

is_running() {
  target_pid="$1"
  [ -n "$target_pid" ] && kill -0 "$target_pid" 2>/dev/null
}

if [ ! -f "$PID_FILE" ]; then
  printf '%s\n' "Boroda detached dev stack is not running."
  exit 0
fi

ROOT_PID=$(cat "$PID_FILE" 2>/dev/null || true)
if [ -z "$ROOT_PID" ]; then
  rm -f "$PID_FILE"
  printf '%s\n' "Removed empty Boroda PID file."
  exit 0
fi

if ! is_running "$ROOT_PID"; then
  rm -f "$PID_FILE"
  printf '%s\n' "Removed stale Boroda PID file for process $ROOT_PID."
  exit 0
fi

PIDS_TO_STOP=$(collect_descendants "$ROOT_PID")
PIDS_TO_STOP="${PIDS_TO_STOP}
$ROOT_PID"

printf '%s\n' "Stopping Boroda detached dev stack rooted at PID $ROOT_PID."

for target_pid in $PIDS_TO_STOP; do
  is_running "$target_pid" && kill "$target_pid" 2>/dev/null || true
done

SECONDS_WAITED=0
while [ "$SECONDS_WAITED" -lt "$STOP_TIMEOUT" ]; do
  STILL_RUNNING=0

  for target_pid in $PIDS_TO_STOP; do
    if is_running "$target_pid"; then
      STILL_RUNNING=1
      break
    fi
  done

  if [ "$STILL_RUNNING" -eq 0 ]; then
    break
  fi

  sleep 1
  SECONDS_WAITED=$((SECONDS_WAITED + 1))
done

for target_pid in $PIDS_TO_STOP; do
  if is_running "$target_pid"; then
    kill -9 "$target_pid" 2>/dev/null || true
  fi
done

rm -f "$PID_FILE"
rmdir "$LOCK_DIR" 2>/dev/null || true

printf '%s\n' "Boroda detached dev stack stopped. Logs remain at $LOG_FILE."
