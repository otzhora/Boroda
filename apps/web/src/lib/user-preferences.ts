import type { OpenInMode } from "./types";

const OPEN_IN_DEFAULT_MODE_KEY = "boroda.openInDefaultMode";

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
