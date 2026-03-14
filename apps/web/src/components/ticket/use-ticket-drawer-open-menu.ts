import { useEffect, type FocusEvent, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject, type RefObject } from "react";
import type { OpenInTarget } from "../../lib/types";
import { getClosestScrollContainer } from "./ticket-drawer-open-in-utils";

interface UseTicketDrawerOpenMenuOptions {
  isOpen: boolean;
  openInMenuRef: RefObject<HTMLDivElement | null>;
  openInActionButtonRef: RefObject<HTMLButtonElement | null>;
  openInToggleButtonRef: RefObject<HTMLButtonElement | null>;
  openInAppButtonRefs: MutableRefObject<Record<OpenInTarget, HTMLButtonElement | null>>;
  onOpenDirectionChange: (side: "top" | "bottom") => void;
  onOpenMaxHeightChange: (height: number) => void;
  onCloseMenu: (restoreFocus?: boolean) => void;
}

export function useTicketDrawerOpenMenu(options: UseTicketDrawerOpenMenuOptions) {
  const {
    isOpen,
    openInMenuRef,
    openInActionButtonRef,
    openInToggleButtonRef,
    openInAppButtonRefs,
    onOpenDirectionChange,
    onOpenMaxHeightChange,
    onCloseMenu
  } = options;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const viewportPadding = 16;
    const menuGap = 8;
    const minimumMenuHeight = 96;
    const preferredMenuHeight = 220;

    const updateOpenInMenuLayout = () => {
      const toggleButton = openInToggleButtonRef.current;
      if (!toggleButton) {
        return;
      }

      const toggleRect = toggleButton.getBoundingClientRect();
      const scrollContainer = getClosestScrollContainer(toggleButton);
      const scrollContainerRect = scrollContainer?.getBoundingClientRect();
      const visibleTop = Math.max(viewportPadding, (scrollContainerRect?.top ?? viewportPadding) + viewportPadding);
      const visibleBottom = Math.min(
        window.innerHeight - viewportPadding,
        (scrollContainerRect?.bottom ?? window.innerHeight - viewportPadding) - viewportPadding
      );
      const spaceBelow = visibleBottom - toggleRect.bottom - menuGap;
      const spaceAbove = toggleRect.top - visibleTop - menuGap;
      const shouldOpenUpward = spaceBelow < preferredMenuHeight && spaceAbove > spaceBelow;

      onOpenDirectionChange(shouldOpenUpward ? "top" : "bottom");
      onOpenMaxHeightChange(Math.max(minimumMenuHeight, Math.floor(shouldOpenUpward ? spaceAbove : spaceBelow)));
    };

    updateOpenInMenuLayout();

    window.addEventListener("resize", updateOpenInMenuLayout);
    document.addEventListener("scroll", updateOpenInMenuLayout, true);

    return () => {
      window.removeEventListener("resize", updateOpenInMenuLayout);
      document.removeEventListener("scroll", updateOpenInMenuLayout, true);
    };
  }, [isOpen, onOpenDirectionChange, onOpenMaxHeightChange, openInToggleButtonRef]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusFirstTarget = () => {
      openInAppButtonRefs.current.vscode?.focus();
    };

    focusFirstTarget();
    const timeoutId = window.setTimeout(focusFirstTarget, 0);

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (
        openInMenuRef.current?.contains(target) ||
        openInActionButtonRef.current?.contains(target) ||
        openInToggleButtonRef.current?.contains(target)
      ) {
        return;
      }

      onCloseMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onCloseMenu(true);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onCloseMenu, openInActionButtonRef, openInAppButtonRefs, openInMenuRef, openInToggleButtonRef]);

  const handleOpenInMenuBlur = (event: FocusEvent<HTMLDivElement>) => {
    const nextFocused = event.relatedTarget;
    if (!(nextFocused instanceof Node)) {
      return;
    }

    if (
      openInMenuRef.current?.contains(nextFocused) ||
      openInToggleButtonRef.current?.contains(nextFocused) ||
      openInActionButtonRef.current?.contains(nextFocused)
    ) {
      return;
    }

    onCloseMenu();
  };

  const handleOpenInMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const focusableButtons = openInMenuRef.current
      ? Array.from(openInMenuRef.current.querySelectorAll<HTMLButtonElement>("button:not([disabled])"))
      : [];
    const currentIndex = focusableButtons.findIndex((button) => button === document.activeElement);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!focusableButtons.length) {
        return;
      }

      const nextIndex =
        currentIndex === -1
          ? 0
          : event.key === "ArrowDown"
            ? (currentIndex + 1) % focusableButtons.length
            : (currentIndex - 1 + focusableButtons.length) % focusableButtons.length;

      focusableButtons[nextIndex]?.focus();
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusableButtons[0]?.focus();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusableButtons[focusableButtons.length - 1]?.focus();
    }
  };

  return {
    handleOpenInMenuBlur,
    handleOpenInMenuKeyDown
  };
}
