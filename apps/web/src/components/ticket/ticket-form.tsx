import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type RefObject
} from "react";
import {
  BOARD_STATUS_ORDER,
  statusLabelMap,
  TICKET_PRIORITIES,
  TICKET_TYPES
} from "../../lib/constants";
import { useUploadTicketImageMutation } from "../../features/tickets/mutations";
import type { Project, TicketPriority, TicketStatus, TicketType } from "../../lib/types";
import { ProjectLinkEditor } from "./project-link-editor";
import { MarkdownDescription } from "./markdown-description";
import type { TicketFormState } from "../../features/tickets/form";

interface TicketTitleFieldProps {
  value: string;
  onChange: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  hideLabel?: boolean;
}

interface TicketDescriptionFieldProps {
  ticketId: number | null;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}

interface TicketMetaFieldsProps {
  form: TicketFormState;
  onChange: (updater: (current: TicketFormState) => TicketFormState) => void;
}

interface TicketProjectLinksFieldProps {
  value: TicketFormState["projectLinks"];
  projects: Project[];
  onChange: (projectLinks: TicketFormState["projectLinks"]) => void;
}

interface TicketActionBarProps {
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
  secondaryAction?: {
    label: string;
    pendingLabel: string;
    isPending: boolean;
    onClick: () => void;
    variant?: "default" | "danger";
  };
}

export const labelClassName = "m-0 text-sm font-medium text-ink-50";
export const inputClassName =
  "min-h-11 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-ink-50 placeholder:text-ink-300";
export const textareaClassName =
  "rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-ink-50 placeholder:text-ink-300";

const primaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-ink-50 px-4 py-2 text-sm font-medium text-canvas-975 transition-opacity disabled:cursor-progress disabled:opacity-70";
const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-sm font-medium text-ink-100 transition-colors disabled:cursor-progress disabled:opacity-70 hover:border-white/16 hover:bg-white/[0.05]";
const dangerButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-red-400/20 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-100 transition-colors disabled:cursor-progress disabled:opacity-70 hover:border-red-300/30 hover:bg-red-950/55";
const secondaryTabClassName =
  "inline-flex min-h-10 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";

function LoadingSpinner() {
  return (
    <span
      className="h-[0.85rem] w-[0.85rem] animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
      aria-hidden="true"
    />
  );
}

export function TicketTitleField({ value, onChange, inputRef, hideLabel = false }: TicketTitleFieldProps) {
  return (
    <label className="grid gap-2">
      <span className={hideLabel ? "sr-only" : labelClassName}>Title</span>
      <input
        ref={inputRef}
        className={inputClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </label>
  );
}

export function TicketDescriptionField({ ticketId, value, onChange, onSubmit }: TicketDescriptionFieldProps) {
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tabListId = useId();
  const textareaId = useId();
  const uploadImageMutation = useUploadTicketImageMutation(ticketId);

  const extractImageFiles = (files: File[]) => files.filter((file) => file.type.startsWith("image/"));

  const insertTextAtSelection = (snippet: string) => {
    const textarea = textareaRef.current;
    const hasActiveSelection = textarea !== null && document.activeElement === textarea;
    const selectionStart = hasActiveSelection ? (textarea.selectionStart ?? value.length) : value.length;
    const selectionEnd = hasActiveSelection ? (textarea.selectionEnd ?? value.length) : value.length;
    const prefix = selectionStart > 0 && !value.slice(0, selectionStart).endsWith("\n") ? "\n\n" : "";
    const suffix = selectionEnd < value.length && !value.slice(selectionEnd).startsWith("\n") ? "\n\n" : "";
    const nextSnippet = `${prefix}${snippet}${suffix}`;
    const nextValue = `${value.slice(0, selectionStart)}${nextSnippet}${value.slice(selectionEnd)}`;
    const nextCursorPosition = selectionStart + nextSnippet.length;

    onChange(nextValue);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const uploadImages = async (files: File[]) => {
    if (!files.length) {
      return;
    }

    setUploadError(null);

    try {
      const uploadedImages = [];

      for (const file of files) {
        uploadedImages.push(await uploadImageMutation.mutateAsync(file));
      }

      const markdown = uploadedImages.map((image) => image.markdown).join("\n\n");
      insertTextAtSelection(markdown);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Image upload failed");
    }
  };

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = extractImageFiles(Array.from(event.target.files ?? []));
    await uploadImages(files);
    event.target.value = "";
  };

  const handlePaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = extractImageFiles(
      Array.from(event.clipboardData.items)
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null)
    );

    if (!files.length) {
      return;
    }

    event.preventDefault();
    await uploadImages(files);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    const hasImageFile = Array.from(event.dataTransfer.items).some(
      (item) => item.kind === "file" && item.type.startsWith("image/")
    );

    if (!hasImageFile) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";

    if (!isDraggingImage) {
      setIsDraggingImage(true);
    }
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDraggingImage(false);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    const files = extractImageFiles(Array.from(event.dataTransfer.files));

    if (!files.length) {
      setIsDraggingImage(false);
      return;
    }

    event.preventDefault();
    setIsDraggingImage(false);
    await uploadImages(files);
  };

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className={labelClassName} htmlFor={textareaId}>
          Description
        </label>
        <div
          className="inline-flex min-h-10 rounded-[12px] border border-white/8 bg-black/40 p-1"
          role="tablist"
          aria-label="Description editor mode"
        >
          {[
            { id: "write", label: "Write" },
            { id: "preview", label: "Preview" }
          ].map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`${tabListId}-${tab.id}-tab`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`${tabListId}-${tab.id}-panel`}
                tabIndex={isActive ? 0 : -1}
                className={`${secondaryTabClassName} ${
                  isActive ? "bg-white text-canvas-975" : "text-ink-300 hover:bg-white/[0.05] hover:text-ink-100"
                }`}
                onClick={() => {
                  setActiveTab(tab.id as "write" | "preview");
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={secondaryButtonClassName}
          onClick={() => {
            fileInputRef.current?.click();
          }}
          disabled={uploadImageMutation.isPending}
        >
          {uploadImageMutation.isPending ? <LoadingSpinner /> : null}
          <span>Insert image…</span>
        </button>
        <span className="text-xs text-ink-300">Paste images directly from your clipboard or upload a local file.</span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload ticket image"
        onChange={(event) => {
          void handleFileSelection(event);
        }}
      />
      {uploadError ? (
        <p className="m-0 text-sm text-red-200" aria-live="polite">
          {uploadError}
        </p>
      ) : null}
      <div
        id={`${tabListId}-${activeTab}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabListId}-${activeTab}-tab`}
        className={`min-w-0 rounded-xl border p-3 transition-colors ${
          isDraggingImage
            ? "border-ink-50 bg-white/[0.06]"
            : "border-white/8 bg-black/10"
        }`}
        onDragOver={activeTab === "write" ? handleDragOver : undefined}
        onDragLeave={activeTab === "write" ? handleDragLeave : undefined}
        onDrop={(event) => {
          if (activeTab !== "write") {
            return;
          }

          void handleDrop(event);
        }}
      >
        {activeTab === "write" ? (
          <div className="grid gap-3">
            {isDraggingImage ? (
              <p className="m-0 text-sm text-ink-100" aria-live="polite">
                Drop image to upload and insert Markdown.
              </p>
            ) : null}
            <textarea
              id={textareaId}
              ref={textareaRef}
              className={textareaClassName}
              rows={10}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onPaste={(event) => {
                void handlePaste(event);
              }}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  onSubmit?.();
                }
              }}
            />
          </div>
        ) : value ? (
          <MarkdownDescription value={value} />
        ) : (
          <p className="m-0 text-sm text-ink-300">Nothing to preview yet. Start writing Markdown in the editor.</p>
        )}
      </div>
    </div>
  );
}

export function TicketMetaFields({ form, onChange }: TicketMetaFieldsProps) {
  return (
    <div className="grid gap-4">
      <label className="grid gap-2">
        <span className={labelClassName}>Status</span>
        <select
          className={inputClassName}
          value={form.status}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              status: event.target.value as TicketStatus
            }))
          }
        >
          {BOARD_STATUS_ORDER.map((status) => (
            <option key={status} value={status}>
              {statusLabelMap[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2">
        <span className={labelClassName}>Priority</span>
        <select
          className={inputClassName}
          value={form.priority}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              priority: event.target.value as TicketPriority
            }))
          }
        >
          {TICKET_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2">
        <span className={labelClassName}>Type</span>
        <select
          className={inputClassName}
          value={form.type}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              type: event.target.value as TicketType
            }))
          }
        >
          {TICKET_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2">
        <span className={labelClassName}>Due at</span>
        <input
          className={inputClassName}
          type="datetime-local"
          value={form.dueAt}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              dueAt: event.target.value
            }))
          }
        />
      </label>
    </div>
  );
}

export function TicketProjectLinksField({ value, projects, onChange }: TicketProjectLinksFieldProps) {
  return (
    <ProjectLinkEditor
      value={value}
      projects={projects}
      onChange={(projectLinks) => onChange(projectLinks)}
    />
  );
}

export function TicketActionBar(props: TicketActionBarProps) {
  const { isSubmitting, submitLabel, submittingLabel, onSubmit, onCancel, secondaryAction } = props;

  return (
    <div className="flex flex-wrap gap-3">
      <button
        className={primaryButtonClassName}
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        aria-label={isSubmitting ? submittingLabel : submitLabel}
      >
        {isSubmitting ? <LoadingSpinner /> : null}
        <span>{submitLabel}</span>
      </button>

      {onCancel ? (
        <button type="button" className={secondaryButtonClassName} onClick={onCancel}>
          Cancel
        </button>
      ) : null}

      {secondaryAction ? (
        <button
          type="button"
          className={secondaryAction.variant === "danger" ? dangerButtonClassName : secondaryButtonClassName}
          onClick={secondaryAction.onClick}
          disabled={secondaryAction.isPending}
          aria-label={secondaryAction.isPending ? secondaryAction.pendingLabel : secondaryAction.label}
        >
          {secondaryAction.isPending ? <LoadingSpinner /> : null}
          {secondaryAction.label}
        </button>
      ) : null}
    </div>
  );
}
