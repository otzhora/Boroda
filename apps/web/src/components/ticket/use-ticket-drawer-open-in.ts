import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getStoredDefaultOpenInMode } from "../../lib/user-preferences";
import type { OpenInMode, OpenInTarget, Ticket } from "../../lib/types";
import { getAvailableTerminalFolders, getWorkspaceOptions, openInTargets, usePreferredProjectFolder } from "./ticket-drawer-workspaces";
import { getOpenInErrorMessage, getOpenInModeLabel } from "./ticket-drawer-open-in-utils";
import type { OpenInFeedbackState } from "./ticket-drawer-open-types";
import { useTicketDrawerOpenMenu } from "./use-ticket-drawer-open-menu";

interface UseTicketDrawerOpenInOptions {
  ticketId: number | null;
  ticket: Ticket | undefined;
  isOpeningInApp: boolean;
  onOpenInApp: (target: OpenInTarget, mode: OpenInMode, folderId?: number, workspaceId?: number) => void | Promise<void>;
}

export function useTicketDrawerOpenIn(options: UseTicketDrawerOpenInOptions) {
  const { ticketId, ticket, isOpeningInApp, onOpenInApp } = options;
  const [isOpenInMenuOpen, setIsOpenInMenuOpen] = useState(false);
  const [openInMenuSide, setOpenInMenuSide] = useState<"top" | "bottom">("bottom");
  const [openInMenuMaxHeight, setOpenInMenuMaxHeight] = useState<number>(320);
  const [selectedOpenTarget, setSelectedOpenTarget] = useState<OpenInTarget>("vscode");
  const [selectedOpenMode, setSelectedOpenMode] = useState<OpenInMode>(() => getStoredDefaultOpenInMode());
  const [openInFeedback, setOpenInFeedback] = useState<OpenInFeedbackState>({ phase: "idle" });
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [workspacePickerFolderId, setWorkspacePickerFolderId] = useState<number | null>(null);
  const openInMenuRef = useRef<HTMLDivElement>(null);
  const openInActionButtonRef = useRef<HTMLButtonElement>(null);
  const openInToggleButtonRef = useRef<HTMLButtonElement>(null);
  const openInResetTimeoutRef = useRef<number | null>(null);
  const openInAppButtonRefs = useRef<Record<OpenInTarget, HTMLButtonElement | null>>({
    vscode: null,
    cursor: null,
    explorer: null,
    terminal: null
  });
  const firstFolderOptionRef = useRef<HTMLButtonElement>(null);
  const firstWorkspaceOptionRef = useRef<HTMLButtonElement>(null);
  const openInMenuId = useId();
  const preferredProjectFolder = usePreferredProjectFolder(ticket);
  const availableTerminalFolders = useMemo(() => getAvailableTerminalFolders(ticket), [ticket]);
  const availableWorkspaceOptions = useMemo(
    () => getWorkspaceOptions(ticket, workspacePickerFolderId),
    [ticket, workspacePickerFolderId]
  );

  useEffect(() => {
    setIsOpenInMenuOpen(false);
    setSelectedOpenTarget("vscode");
    setSelectedOpenMode(getStoredDefaultOpenInMode());
    setIsFolderPickerOpen(false);
    setWorkspacePickerFolderId(null);
  }, [ticketId]);

  useEffect(() => {
    if (!availableTerminalFolders.length) {
      setIsOpenInMenuOpen(false);
      setIsFolderPickerOpen(false);
      setWorkspacePickerFolderId(null);
    }
  }, [availableTerminalFolders.length]);

  const selectedOpenTargetLabel =
    openInTargets.find((target) => target.id === selectedOpenTarget)?.label ?? "selected app";
  const hasMultipleOpenFolders = availableTerminalFolders.length > 1;
  const hasAnyWorktree = (ticket?.workspaces.length ?? 0) > 0;
  const isOpenInPending = isOpeningInApp || openInFeedback.phase === "opening";
  const openInStatusMessage =
    openInFeedback.phase === "opening"
      ? `Opening ${openInFeedback.modeLabel} in ${openInFeedback.appLabel}…`
      : openInFeedback.phase === "success"
        ? `Opened ${openInFeedback.modeLabel} in ${openInFeedback.appLabel}.`
        : openInFeedback.phase === "error"
          ? openInFeedback.message
          : null;
  const openInStatusTone: "success" | "error" | "neutral" =
    openInFeedback.phase === "success" ? "success" : openInFeedback.phase === "error" ? "error" : "neutral";

  const clearOpenInResetTimeout = () => {
    if (openInResetTimeoutRef.current !== null) {
      window.clearTimeout(openInResetTimeoutRef.current);
      openInResetTimeoutRef.current = null;
    }
  };

  const scheduleOpenInReset = () => {
    clearOpenInResetTimeout();
    openInResetTimeoutRef.current = window.setTimeout(() => {
      setOpenInFeedback((current) => (current.phase === "success" ? { phase: "idle" } : current));
      openInResetTimeoutRef.current = null;
    }, 1600);
  };

  const closeOpenInMenu = (restoreFocus = false) => {
    setIsOpenInMenuOpen(false);

    if (!restoreFocus) {
      return;
    }

    window.setTimeout(() => {
      openInToggleButtonRef.current?.focus();
    }, 0);
  };

  const { handleOpenInMenuBlur, handleOpenInMenuKeyDown } = useTicketDrawerOpenMenu({
    isOpen: isOpenInMenuOpen,
    openInMenuRef,
    openInActionButtonRef,
    openInToggleButtonRef,
    openInAppButtonRefs,
    onOpenDirectionChange: setOpenInMenuSide,
    onOpenMaxHeightChange: setOpenInMenuMaxHeight,
    onCloseMenu: closeOpenInMenu
  });

  const runOpenInAction = async (folderId?: number, workspaceId?: number) => {
    if (isOpenInPending) {
      return;
    }

    clearOpenInResetTimeout();
    setOpenInFeedback({
      phase: "opening",
      appLabel: selectedOpenTargetLabel,
      modeLabel: getOpenInModeLabel(selectedOpenMode)
    });

    try {
      await Promise.resolve(onOpenInApp(selectedOpenTarget, selectedOpenMode, folderId, workspaceId));
      setOpenInFeedback({
        phase: "success",
        appLabel: selectedOpenTargetLabel,
        modeLabel: getOpenInModeLabel(selectedOpenMode)
      });
      scheduleOpenInReset();
    } catch (error) {
      setOpenInFeedback({
        phase: "error",
        appLabel: selectedOpenTargetLabel,
        modeLabel: getOpenInModeLabel(selectedOpenMode),
        message: getOpenInErrorMessage(error)
      });
    }
  };

  const handleOpenInSelection = (folderId?: number) => {
    const targetFolderId = folderId ?? preferredProjectFolder?.id;

    if (selectedOpenMode === "folder") {
      void runOpenInAction(targetFolderId);
      return;
    }

    const matchingWorkspaces = getWorkspaceOptions(ticket, targetFolderId ?? null);

    if (targetFolderId && matchingWorkspaces.length > 1) {
      setIsFolderPickerOpen(false);
      setWorkspacePickerFolderId(targetFolderId);
      return;
    }

    void runOpenInAction(targetFolderId, matchingWorkspaces[0]?.id);
  };

  useEffect(() => {
    clearOpenInResetTimeout();
    setOpenInFeedback({ phase: "idle" });
  }, [ticketId]);

  useEffect(() => {
    return () => {
      clearOpenInResetTimeout();
    };
  }, []);

  return {
    preferredProjectFolder,
    availableTerminalFolders,
    availableWorkspaceOptions,
    selectedOpenTarget,
    selectedOpenMode,
    selectedOpenTargetLabel,
    hasMultipleOpenFolders,
    hasAnyWorktree,
    isOpenInPending,
    openInFeedback,
    openInStatusMessage,
    openInStatusTone,
    isOpenInMenuOpen,
    openInMenuSide,
    openInMenuMaxHeight,
    isFolderPickerOpen,
    workspacePickerFolderId,
    openInMenuId,
    openInMenuRef,
    openInActionButtonRef,
    openInToggleButtonRef,
    openInAppButtonRefs,
    firstFolderOptionRef,
    firstWorkspaceOptionRef,
    setSelectedOpenMode,
    setOpenInFeedback,
    setIsOpenInMenuOpen,
    setIsFolderPickerOpen,
    setWorkspacePickerFolderId,
    handleOpenInSelection,
    handleOpenInTarget: (target: OpenInTarget) => {
      setSelectedOpenTarget(target);
      setIsOpenInMenuOpen(false);
    },
    handleOpenInMenuBlur,
    handleOpenInMenuKeyDown,
    runOpenInAction
  };
}
