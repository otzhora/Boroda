#!/bin/sh
set -eu

copy_if_present() {
  source_path="$1"
  target_path="$2"

  if [ -f "$source_path" ] && [ ! -e "$target_path" ]; then
    cp "$source_path" "$target_path"
  fi
}

copy_if_present "$BORODA_REPO_PATH/.env" "$BORODA_WORKTREE_PATH/.env"
copy_if_present "$BORODA_REPO_PATH/.env.local" "$BORODA_WORKTREE_PATH/.env.local"
copy_if_present "$BORODA_REPO_PATH/.env.development" "$BORODA_WORKTREE_PATH/.env.development"
copy_if_present "$BORODA_REPO_PATH/.env.test" "$BORODA_WORKTREE_PATH/.env.test"
copy_if_present "$BORODA_REPO_PATH/.env.staging" "$BORODA_WORKTREE_PATH/.env.staging"
copy_if_present "$BORODA_REPO_PATH/appsettings.json" "$BORODA_WORKTREE_PATH/appsettings.json"
copy_if_present "$BORODA_REPO_PATH/appsettings.Development.json" "$BORODA_WORKTREE_PATH/appsettings.Development.json"
