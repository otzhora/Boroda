import type { OpenInMode } from "../../lib/types";

export function getClosestScrollContainer(element: HTMLElement | null) {
  let current = element?.parentElement ?? null;

  while (current) {
    const styles = window.getComputedStyle(current);
    const overflowY = styles.overflowY;
    const isScrollable = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";

    if (isScrollable) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

export function getOpenInErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Could not open the selected app.";
}

export function getOpenInModeLabel(mode: OpenInMode) {
  return mode === "folder" ? "folder" : "worktree";
}
