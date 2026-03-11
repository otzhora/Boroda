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
  TICKET_PRIORITIES,
  formatStatusLabel
} from "../../lib/constants";
import { useUploadTicketImageMutation } from "../../features/tickets/mutations";
import type { BoardColumnDefinition, Project, TicketPriority, TicketStatus } from "../../lib/types";
import { ProjectLinkEditor } from "./project-link-editor";
import { MarkdownDescription } from "./markdown-description";
import type { TicketFormState, TicketWorkspaceFormState } from "../../features/tickets/form";
import { JiraIssueSelector } from "./jira-issue-selector";

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
  label?: string;
  modeLabel?: string;
  uploadAriaLabel?: string;
  emptyPreviewText?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  compact?: boolean;
  rows?: number;
  showImageUploadButton?: boolean;
  showModeTabs?: boolean;
}

interface TicketMetaFieldsProps {
  form: TicketFormState;
  projects: Project[];
  statuses?: BoardColumnDefinition[];
  onChange: (updater: (current: TicketFormState) => TicketFormState) => void;
}

interface TicketProjectLinksFieldProps {
  value: TicketFormState["projectLinks"];
  projects: Project[];
  onChange: (projectLinks: TicketFormState["projectLinks"]) => void;
}

interface TicketWorkspaceFieldProps {
  value: TicketWorkspaceFormState[];
  projects: Project[];
  projectLinks: TicketFormState["projectLinks"];
  onChange: (workspaces: TicketWorkspaceFormState[]) => void;
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

export function TicketDescriptionField({
  ticketId,
  value,
  onChange,
  onSubmit,
  label = "Description",
  modeLabel = "Description editor mode",
  uploadAriaLabel = "Upload ticket image",
  emptyPreviewText = "Nothing to preview yet. Start writing Markdown in the editor.",
  textareaRef: externalTextareaRef,
  compact = false,
  rows = 10,
  showImageUploadButton = true,
  showModeTabs = true
}: TicketDescriptionFieldProps) {
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalTextareaRef ?? internalTextareaRef;
  const tabListId = useId();
  const textareaId = useId();
  const uploadImageMutation = useUploadTicketImageMutation(ticketId);
  const showToolbar = showImageUploadButton || showModeTabs;
  const isPreviewMode = showModeTabs && activeTab === "preview";

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
      {showToolbar ? (
        <div className={`flex flex-wrap items-center justify-between gap-2 ${compact ? "" : "gap-3"}`}>
          <label className={compact ? "sr-only" : labelClassName} htmlFor={textareaId}>
            {label}
          </label>
          {showImageUploadButton ? (
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
          ) : null}
          {showModeTabs ? (
            <div
              className="inline-flex min-h-10 rounded-[12px] border border-white/8 bg-black/40 p-1"
              role="tablist"
              aria-label={modeLabel}
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
          ) : null}
        </div>
      ) : (
        <label className="sr-only" htmlFor={textareaId}>
          {label}
        </label>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label={uploadAriaLabel}
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
        id={showModeTabs ? `${tabListId}-${activeTab}-panel` : undefined}
        role={showModeTabs ? "tabpanel" : undefined}
        aria-labelledby={showModeTabs ? `${tabListId}-${activeTab}-tab` : undefined}
        className={`min-w-0 rounded-xl border p-3 transition-colors ${
          isDraggingImage
            ? "border-ink-50 bg-white/[0.06]"
            : "border-white/8 bg-black/10"
        }`}
        onDragOver={!isPreviewMode ? handleDragOver : undefined}
        onDragLeave={!isPreviewMode ? handleDragLeave : undefined}
        onDrop={(event) => {
          if (isPreviewMode) {
            return;
          }

          void handleDrop(event);
        }}
      >
        {!isPreviewMode ? (
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
              rows={rows}
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
          <p className="m-0 text-sm text-ink-300">{emptyPreviewText}</p>
        )}
      </div>
    </div>
  );
}

function createWorkspaceDraft(): TicketWorkspaceFormState {
  return {
    projectFolderId: "",
    branchName: "",
    baseBranch: "",
    role: "primary"
  };
}

function getWorkspaceFolderOptions(projects: Project[], projectLinks: TicketFormState["projectLinks"]) {
  const linkedProjectIds = new Set(
    projectLinks
      .map((link) => Number(link.projectId))
      .filter((projectId) => Number.isInteger(projectId) && projectId > 0)
  );

  return projects
    .filter((project) => linkedProjectIds.has(project.id))
    .flatMap((project) =>
      project.folders.map((folder) => ({
        id: String(folder.id),
        label: `${project.name} · ${folder.label}`,
        hint: folder.defaultBranch ? `Default: ${folder.defaultBranch}` : "Default branch not set"
      }))
    );
}

export function TicketWorkspaceFields({ value, projects, projectLinks, onChange }: TicketWorkspaceFieldProps) {
  const folderOptions = getWorkspaceFolderOptions(projects, projectLinks);

  return (
    <div className="grid gap-3">
      {value.length ? (
        <div className="overflow-hidden rounded-lg border border-white/8">
          {value.map((workspace, index) => (
            <div key={workspace.id ?? `${workspace.projectFolderId}-${index}`} className="grid gap-3 border-b border-white/8 px-3 py-3 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-ink-50">Workspace {index + 1}</span>
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center justify-center rounded-md border border-white/10 px-3 py-1.5 text-sm font-medium text-ink-100 transition-colors hover:bg-white/[0.05]"
                  onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-3">
                <label className="grid gap-2">
                  <span className={labelClassName}>Folder</span>
                  <select
                    className={inputClassName}
                    value={workspace.projectFolderId}
                    onChange={(event) =>
                      onChange(
                        value.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, projectFolderId: event.target.value } : item
                        )
                      )
                    }
                  >
                    <option value="">Choose folder…</option>
                    {folderOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <label className="grid gap-2">
                  <span className={labelClassName}>Branch</span>
                  <input
                    className={inputClassName}
                    value={workspace.branchName}
                    onChange={(event) =>
                      onChange(value.map((item, itemIndex) => (itemIndex === index ? { ...item, branchName: event.target.value } : item)))
                    }
                    placeholder="feature/ticket-context…"
                  />
                </label>
                <label className="grid gap-2">
                  <span className={labelClassName}>Base branch</span>
                  <input
                    className={inputClassName}
                    value={workspace.baseBranch}
                    onChange={(event) =>
                      onChange(value.map((item, itemIndex) => (itemIndex === index ? { ...item, baseBranch: event.target.value } : item)))
                    }
                    placeholder="Uses folder default branch"
                  />
                </label>
              </div>
              {workspace.projectFolderId ? (
                <p className="m-0 text-sm text-ink-300">
                  {folderOptions.find((option) => option.id === workspace.projectFolderId)?.hint ?? "Folder not available"}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 text-sm text-ink-300">No workspaces yet.</p>
      )}
      <div>
        <button type="button" className={secondaryButtonClassName} onClick={() => onChange([...value, createWorkspaceDraft()])}>
          Add workspace
        </button>
      </div>
    </div>
  );
}

export function TicketMetaFields({ form, projects, statuses = [], onChange }: TicketMetaFieldsProps) {
  const availableStatuses =
    statuses.length > 0
      ? statuses
      : [
          {
            id: 0,
            status: form.status,
            label: formatStatusLabel(form.status),
            position: 0,
            createdAt: "",
            updatedAt: ""
          }
        ];

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <span className={labelClassName}>Workspaces</span>
        <TicketWorkspaceFields
          value={form.workspaces}
          projects={projects}
          projectLinks={form.projectLinks}
          onChange={(workspaces) =>
            onChange((current) => ({
              ...current,
              workspaces,
              branch: workspaces[0]?.branchName ?? current.branch
            }))
          }
        />
      </div>

      <div className="grid gap-2">
        <span className={labelClassName}>Jira issues</span>
        <JiraIssueSelector
          value={form.jiraIssues}
          onChange={(jiraIssues) =>
            onChange((current) => ({
              ...current,
              jiraIssues
            }))
          }
        />
      </div>

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
          {availableStatuses.map((status) => (
            <option key={status.status} value={status.status}>
              {status.label || formatStatusLabel(status.status)}
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
