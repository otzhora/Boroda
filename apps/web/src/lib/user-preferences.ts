import type { OpenInMode } from "./types";

const OPEN_IN_DEFAULT_MODE_KEY = "boroda.openInDefaultMode";
const AUTO_RUN_WORKTREE_SETUP_KEY = "boroda.autoRunWorktreeSetup";
const LAST_STANDUP_COMPLETED_AT_KEY = "boroda.lastStandupCompletedAt";

export function getStoredDefaultOpenInMode(): OpenInMode {
  if (typeof window === "undefined") {
    return "folder";
  }

  const value = window.localStorage.getItem(OPEN_IN_DEFAULT_MODE_KEY);
  return value === "worktree" ? "worktree" : "folder";
}

export function setStoredDefaultOpenInMode(mode: OpenInMode) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(OPEN_IN_DEFAULT_MODE_KEY, mode);
}

export function getStoredAutoRunWorktreeSetup(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(AUTO_RUN_WORKTREE_SETUP_KEY) !== "false";
}

export function setStoredAutoRunWorktreeSetup(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTO_RUN_WORKTREE_SETUP_KEY, String(value));
}

export function getStoredLastStandupCompletedAt(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(LAST_STANDUP_COMPLETED_AT_KEY);
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

export function setStoredLastStandupCompletedAt(value: string) {
  if (typeof window === "undefined") {
    return;
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return;
  }

  window.localStorage.setItem(LAST_STANDUP_COMPLETED_AT_KEY, new Date(timestamp).toISOString());
}
