import { useEffect, useEffectEvent, type RefObject } from "react";

export function parseTicketId(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function isSearchFocused(searchInputRef: RefObject<HTMLInputElement | null>) {
  return document.activeElement === searchInputRef.current;
}

interface UsePageSearchHotkeysOptions {
  searchInputRef: RefObject<HTMLInputElement | null>;
  onOpenFilters?: () => void;
  onCreate?: () => void;
  onEscape?: () => void;
}

export function usePageSearchHotkeys({
  searchInputRef,
  onOpenFilters,
  onCreate,
  onEscape
}: UsePageSearchHotkeysOptions) {
  const handleKeyboardShortcuts = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      return;
    }

    if (!isTypingTarget(event.target) && onOpenFilters && event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      onOpenFilters();
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();

      if (isSearchFocused(searchInputRef)) {
        searchInputRef.current?.blur();
        return;
      }

      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      return;
    }

    if (event.key === "Escape" && isSearchFocused(searchInputRef)) {
      event.preventDefault();
      searchInputRef.current?.blur();
      return;
    }

    if (isTypingTarget(event.target)) {
      return;
    }

    if (event.key === "/") {
      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      return;
    }

    if (onCreate && event.key.toLowerCase() === "c") {
      event.preventDefault();
      onCreate();
      return;
    }

    if (event.key === "Escape" && onEscape) {
      event.preventDefault();
      onEscape();
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboardShortcuts);
    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcuts);
    };
  }, []);
}
