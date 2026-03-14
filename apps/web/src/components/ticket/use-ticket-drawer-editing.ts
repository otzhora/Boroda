import { useEffect, useRef, useState } from "react";
import type { EditableSectionId } from "./ticket-drawer-layout";

interface UseTicketDrawerEditingOptions {
  ticketId: number | null;
  isSaving: boolean;
  saveSuccessCount: number;
  onSave: () => void;
}

export function useTicketDrawerEditing(options: UseTicketDrawerEditingOptions) {
  const { ticketId, isSaving, saveSuccessCount, onSave } = options;
  const [activeEditor, setActiveEditor] = useState<EditableSectionId | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRootRefs = useRef<Partial<Record<EditableSectionId, HTMLElement | null>>>({});

  useEffect(() => {
    setActiveEditor(null);
  }, [ticketId]);

  useEffect(() => {
    if (!activeEditor) {
      return;
    }

    const focusTarget = () => {
      if (activeEditor === "title") {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
        return;
      }

      if (activeEditor === "description") {
        descriptionTextareaRef.current?.focus();
        return;
      }

      const root = editorRootRefs.current[activeEditor];
      const firstFocusable = root?.querySelector<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex='-1'])"
      );
      firstFocusable?.focus();
    };

    focusTarget();
    const timeoutId = window.setTimeout(focusTarget, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeEditor]);

  useEffect(() => {
    setActiveEditor(null);
  }, [saveSuccessCount]);

  useEffect(() => {
    if (!activeEditor) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const root = editorRootRefs.current[activeEditor];
      if (!root) {
        return;
      }

      if (event.target instanceof Node && root.contains(event.target)) {
        return;
      }

      if (!isSaving) {
        onSave();
      }

      setActiveEditor(null);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [activeEditor, isSaving, onSave]);

  const openEditor = (section: EditableSectionId) => {
    if (isSaving) {
      return;
    }

    setActiveEditor(section);
  };

  const saveAndCloseEditor = () => {
    if (!activeEditor) {
      return;
    }

    if (!isSaving) {
      onSave();
    }

    setActiveEditor(null);
  };

  return {
    activeEditor,
    titleInputRef,
    descriptionTextareaRef,
    editorRootRefs,
    openEditor,
    saveAndCloseEditor
  };
}
