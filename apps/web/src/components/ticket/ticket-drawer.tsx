import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode
} from "react";
import { TICKET_PRIORITIES, formatStatusLabel } from "../../lib/constants";
import type { BoardColumnDefinition, OpenInMode, OpenInTarget, Project, Ticket } from "../../lib/types";
import type { TicketFormState } from "../../features/tickets/form";
import { useJiraSettingsQuery } from "../../features/jira/queries";
import { getStoredDefaultOpenInMode } from "../../lib/user-preferences";
import { ModalDialog } from "../ui/modal-dialog";
import {
  TicketDescriptionField,
  TicketTitleField,
  inputClassName,
  labelClassName
} from "./ticket-form";
import { JiraIssueSelector } from "./jira-issue-selector";
import { MarkdownDescription } from "./markdown-description";
import { TicketWorkspaceDrawer } from "./ticket-workspace-drawer";
import { WorkContextEditor } from "./work-context-editor";

interface TicketDrawerProps {
  ticketId: number | null;
  ticket: Ticket | undefined;
  statuses?: BoardColumnDefinition[];
  isLoading: boolean;
  isError: boolean;
  form: TicketFormState;
  projects: Project[];
  isSaving: boolean;
  saveSuccessCount: number;
  isDeleting: boolean;
  isOpeningInApp: boolean;
  isRefreshingJira: boolean;
  onChange: (updater: (current: TicketFormState) => TicketFormState) => void;
  onSave: () => void;
  onDelete: () => void;
  onOpenInApp: (target: OpenInTarget, mode: OpenInMode, folderId?: number, workspaceId?: number) => void | Promise<void>;
  onRefreshJira: () => void;
  onClose: () => void;
}

const sectionClassName = "grid gap-3 border-b border-white/8 pb-4";
const railSectionClassName = "grid min-w-0 gap-3 border-b border-white/8 pb-5 last:border-b-0 last:pb-0";
const detailTabClassName =
  "inline-flex min-h-10 items-center justify-center border-b-2 border-transparent px-1 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";

const detailTabs = [
  { id: "contexts", label: "Work contexts" },
  { id: "activity", label: "Activity" }
] as const;

type DetailTabId = (typeof detailTabs)[number]["id"];
type EditableSectionId = "title" | "description" | "jiraIssues" | "status" | "priority" | "dueAt";

type OpenInFeedbackState =
  | { phase: "idle" }
  | { phase: "opening"; appLabel: string; modeLabel: string }
  | { phase: "success"; appLabel: string; modeLabel: string }
  | { phase: "error"; appLabel: string; modeLabel: string; message: string };

const editableReadRegionClassName =
  "grid min-w-0 gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-white/8 hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";
const nestedInteractiveSelector = "a, button, input, select, textarea, [role='button'], [role='tab']";
const disclosureRowClassName =
  "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-transparent px-1 py-1.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";

function formatDateTime(value: string | null) {
  if (!value) {
    return "No due date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getClosestScrollContainer(element: HTMLElement | null) {
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Could not open the selected app.";
}

function getOpenInModeLabel(mode: OpenInMode) {
  return mode === "folder" ? "folder" : "worktree";
}

function MetaRow(props: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-white/8 pb-2.5 last:border-b-0 last:pb-0">
      <span className="text-sm text-ink-300">{props.label}</span>
      <span className="text-sm font-medium text-ink-50">{props.value}</span>
    </div>
  );
}

function MetaFieldEditor(props: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <span className={labelClassName}>{props.label}</span>
      {props.children}
    </div>
  );
}

function EditableReadRegion(props: {
  label: string;
  onActivate: () => void;
  className?: string;
  children: ReactNode;
}) {
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const interactiveTarget = event.target instanceof Element ? event.target.closest(nestedInteractiveSelector) : null;
    if (interactiveTarget && interactiveTarget !== event.currentTarget) {
      return;
    }

    props.onActivate();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    props.onActivate();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={props.label}
      className={`${editableReadRegionClassName} ${props.className ?? ""}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {props.children}
    </div>
  );
}

function DisclosureRow(props: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  description?: string;
  className?: string;
  labelClassName?: string;
  descriptionClassName?: string;
  chevronClassName?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={props.expanded}
      aria-label={`${props.expanded ? "Collapse" : "Expand"} ${props.label}`}
      className={`${disclosureRowClassName} ${props.className ?? ""}`}
      onClick={() => {
        props.onToggle();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        props.onToggle();
      }}
    >
      <div className="min-w-0">
        <p className={`m-0 text-sm font-semibold text-ink-50 ${props.labelClassName ?? ""}`}>{props.label}</p>
        {props.description ? (
          <p className={`m-0 mt-0.5 text-sm text-ink-300 ${props.descriptionClassName ?? ""}`}>{props.description}</p>
        ) : null}
      </div>
      <ChevronIcon
        className={`h-4 w-4 shrink-0 text-ink-300 transition-transform ${props.expanded ? "" : "-rotate-90"} ${props.chevronClassName ?? ""}`}
      />
    </div>
  );
}

function ChevronIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={props.className} aria-hidden="true">
      <path d="M5 13.2 9.2 17 19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={props.className} aria-hidden="true">
      <path d="M12 7.5v5.5" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
      <path d="M12 3.75 21 19.25H3L12 3.75Z" strokeLinejoin="round" />
    </svg>
  );
}

function AppWindowIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="16" rx="3.5" className="fill-white/6 stroke-current" strokeWidth="1.4" />
      <path d="M3.5 8h17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7" cy="6.1" r="0.9" className="fill-current" />
      <circle cx="10.2" cy="6.1" r="0.9" className="fill-current opacity-80" />
    </svg>
  );
}

function FolderIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden="true">
      <path
        d="M3.5 7.5a2 2 0 0 1 2-2H9l1.8 2H18.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"
        className="fill-white/6 stroke-current"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getOpenInTargetIcon(target: OpenInTarget) {
  if (target === "explorer") {
    return <FolderIcon className="h-4 w-4 shrink-0 text-amber-200" />;
  }

  return <AppWindowIcon className="h-4 w-4 shrink-0 text-sky-200" />;
}

function getPreferredProjectFolder(ticket: Ticket | undefined) {
  if (!ticket) {
    return null;
  }

  const sortedLinks = [...ticket.projectLinks].sort((left, right) => {
    if (left.relationship === right.relationship) {
      return left.projectId - right.projectId;
    }

    if (left.relationship === "PRIMARY") {
      return -1;
    }

    if (right.relationship === "PRIMARY") {
      return 1;
    }

    return left.projectId - right.projectId;
  });

  for (const link of sortedLinks) {
    const primaryFolder = link.project.folders.find((folder) => folder.isPrimary);
    if (primaryFolder?.existsOnDisk) {
      return primaryFolder;
    }

    const firstExistingFolder = link.project.folders.find((folder) => folder.existsOnDisk);
    if (firstExistingFolder) {
      return firstExistingFolder;
    }
  }

  return null;
}

interface TerminalFolderOption {
  folderId: number;
  projectId: number;
  projectName: string;
  relationship: string;
  folderLabel: string;
  path: string;
  isPrimaryFolder: boolean;
}

interface WorkspaceOption {
  id: number;
  folderId: number;
  branchName: string;
  role: string;
  projectName: string;
  folderLabel: string;
}

interface WorkspaceSummaryItem {
  key: string;
  projectName: string;
  projectColor: string;
  branchName: string;
  hasWorktreeSetup: boolean;
}

const openInTargets: Array<{
  id: OpenInTarget;
  label: string;
  description: string;
}> = [
  {
    id: "vscode",
    label: "VS Code",
    description: "Open the linked folder in Visual Studio Code."
  },
  {
    id: "cursor",
    label: "Cursor",
    description: "Open the linked folder in Cursor."
  },
  {
    id: "explorer",
    label: "File Explorer",
    description: "Open the linked folder in Explorer."
  },
  {
    id: "terminal",
    label: "Terminal",
    description: "Open the linked folder in Terminal."
  }
];

function getAvailableTerminalFolders(ticket: Ticket | undefined): TerminalFolderOption[] {
  if (!ticket) {
    return [];
  }

  return [...ticket.projectLinks]
    .sort((left, right) => {
      if (left.relationship === right.relationship) {
        return left.projectId - right.projectId;
      }

      if (left.relationship === "PRIMARY") {
        return -1;
      }

      if (right.relationship === "PRIMARY") {
        return 1;
      }

      return left.projectId - right.projectId;
    })
    .flatMap((link) =>
      link.project.folders
        .filter((folder) => folder.existsOnDisk)
        .sort((left, right) => {
          if (left.isPrimary === right.isPrimary) {
            return left.id - right.id;
          }

          return left.isPrimary ? -1 : 1;
        })
        .map((folder) => ({
          folderId: folder.id,
          projectId: link.projectId,
          projectName: link.project.name,
          relationship: link.relationship,
          folderLabel: folder.label,
          path: folder.path,
          isPrimaryFolder: folder.isPrimary
        }))
    );
}

function getWorkspaceOptions(ticket: Ticket | undefined, folderId: number | null): WorkspaceOption[] {
  if (!ticket || folderId === null) {
    return [];
  }

  return ticket.workspaces
    .filter((workspace) => workspace.projectFolderId === folderId)
    .map((workspace) => ({
      id: workspace.id,
      folderId,
      branchName: workspace.branchName,
      role: workspace.role,
      projectName: workspace.projectFolder.project.name,
      folderLabel: workspace.projectFolder.label
    }));
}

function normalizeHexColor(color: string) {
  const value = color.trim();

  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    return null;
  }

  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }

  return value;
}

function hexToRgb(color: string) {
  const normalized = normalizeHexColor(color);

  if (!normalized) {
    return null;
  }

  const value = normalized.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function mixChannel(base: number, target: number, ratio: number) {
  return Math.round(base * (1 - ratio) + target * ratio);
}

function getProjectBadgeStyle(color: string): CSSProperties | undefined {
  const rgb = hexToRgb(color);

  if (!rgb) {
    return undefined;
  }

  const textColor = `rgb(${mixChannel(rgb.r, 255, 0.74)} ${mixChannel(rgb.g, 255, 0.74)} ${mixChannel(rgb.b, 255, 0.74)})`;

  return {
    backgroundColor: `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0.12)`,
    borderColor: `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0.3)`,
    color: textColor
  };
}

function getWorkspaceSummaries(
  ticket: Ticket | undefined,
  form: TicketFormState,
  projects: Project[]
): WorkspaceSummaryItem[] {
  if (!form.workspaces.length) {
    return [];
  }

  const folderLookup = new Map<string, { projectName: string; projectColor: string; hasWorktreeSetup: boolean }>();

  for (const project of projects) {
    for (const folder of project.folders) {
      folderLookup.set(String(folder.id), {
        projectName: project.name,
        projectColor: project.color,
        hasWorktreeSetup: folder.setupInfo?.hasWorktreeSetup === true
      });
    }
  }

  return form.workspaces.map((workspace, index) => {
    const ticketWorkspace = ticket?.workspaces.find((item) => item.id === workspace.id);
    const folderInfo =
      folderLookup.get(workspace.projectFolderId) ??
      (ticketWorkspace
        ? {
            projectName: ticketWorkspace.projectFolder.project.name,
            projectColor: ticketWorkspace.projectFolder.project.color,
            hasWorktreeSetup: false
          }
        : null);

    return {
      key: String(workspace.id ?? `${workspace.projectFolderId}-${index}`),
      projectName: folderInfo?.projectName ?? "Unlinked project",
      projectColor: folderInfo?.projectColor ?? "#6b7280",
      branchName: workspace.branchName.trim() || "No branch",
      hasWorktreeSetup: folderInfo?.hasWorktreeSetup ?? false
    };
  });
}

function WorkspaceSummaryList(props: { items: WorkspaceSummaryItem[] }) {
  if (!props.items.length) {
    return <p className="m-0 text-sm text-ink-300">No workspaces yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/8">
      {props.items.map((workspace) => (
        <div key={workspace.key} className="grid gap-1 border-b border-white/8 px-3 py-2.5 last:border-b-0">
          <div className="flex items-center justify-between gap-3">
            <span
              className="inline-flex min-h-7 items-center rounded-md border border-white/8 bg-canvas-950 px-2.5 text-sm text-ink-200"
              style={getProjectBadgeStyle(workspace.projectColor)}
            >
              {workspace.projectName}
            </span>
            <span className="min-w-0 truncate text-sm text-ink-200">{workspace.branchName}</span>
          </div>
          <p className="m-0 text-[0.8rem] text-ink-300">
            {workspace.hasWorktreeSetup
              ? "Fresh worktrees for this folder can run repo-local setup."
              : "No repo-local worktree setup configured for this folder."}
          </p>
        </div>
      ))}
    </div>
  );
}

function parseActivityMeta(metaJson: string) {
  try {
    return JSON.parse(metaJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getStatusActivityKey(activity: Ticket["activities"][number], meta: Record<string, unknown> | null) {
  if (typeof meta?.status === "string" && meta.status.trim()) {
    return meta.status.trim();
  }

  const match = activity.message.match(/^Status changed to (.+)$/);
  return match?.[1]?.trim() || null;
}

function getActivityMessage(activity: Ticket["activities"][number], statuses: BoardColumnDefinition[]) {
  const meta = parseActivityMeta(activity.metaJson);

  if (activity.type === "ticket.status.changed") {
    const statusKey = getStatusActivityKey(activity, meta);

    if (statusKey) {
      const label = statuses.find((status) => status.status === statusKey)?.label ?? formatStatusLabel(statusKey);
      return `Status changed to ${label}`;
    }
  }

  return activity.message;
}

function TicketActivityDetails(props: { activity: Ticket["activities"][number] }) {
  const meta = parseActivityMeta(props.activity.metaJson);

  if (!meta) {
    return null;
  }

  if (props.activity.type === "ticket.workspace_setup_ran") {
    const steps = Array.isArray(meta.steps) ? meta.steps.filter((value): value is string => typeof value === "string") : [];

    if (!steps.length) {
      return null;
    }

    return <p className="m-0 text-[0.8rem] text-ink-300">Steps: {steps.join(", ")}</p>;
  }

  if (props.activity.type === "ticket.workspace_setup_failed") {
    const errorCode = typeof meta.errorCode === "string" ? meta.errorCode : null;
    const stderr = typeof meta.stderr === "string" && meta.stderr.trim() ? meta.stderr.trim() : null;

    return (
      <div className="grid gap-1">
        {errorCode ? <p className="m-0 text-[0.8rem] text-ink-300">Error: {errorCode}</p> : null}
        {stderr ? <p className="m-0 break-words text-[0.8rem] text-red-100">{stderr}</p> : null}
      </div>
    );
  }

  return null;
}

function countWorkspaceBaseBranchErrors(form: TicketFormState, projects: Project[]) {
  const folderLookup = new Map<string, { defaultBranch: string | null }>();

  for (const project of projects) {
    for (const folder of project.folders) {
      folderLookup.set(String(folder.id), { defaultBranch: folder.defaultBranch });
    }
  }

  return form.workspaces.filter((workspace) => {
    if (!workspace.branchName.trim()) {
      return false;
    }

    return !folderLookup.get(workspace.projectFolderId)?.defaultBranch?.trim();
  }).length;
}

export function TicketDrawer(props: TicketDrawerProps) {
  const {
    ticketId,
    ticket,
    statuses = [],
    isLoading,
    isError,
    form,
    projects,
    isSaving,
    saveSuccessCount,
    isDeleting,
    isOpeningInApp,
    isRefreshingJira,
    onChange,
    onSave,
    onDelete,
    onOpenInApp,
    onRefreshJira,
    onClose
  } = props;
  const [activeEditor, setActiveEditor] = useState<EditableSectionId | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTabId>("contexts");
  const [isJiraSectionExpanded, setIsJiraSectionExpanded] = useState(true);
  const [isWorkspaceDrawerOpen, setIsWorkspaceDrawerOpen] = useState(false);
  const [isOpenInMenuOpen, setIsOpenInMenuOpen] = useState(false);
  const [openInMenuSide, setOpenInMenuSide] = useState<"top" | "bottom">("bottom");
  const [openInMenuMaxHeight, setOpenInMenuMaxHeight] = useState<number>(320);
  const [selectedOpenTarget, setSelectedOpenTarget] = useState<OpenInTarget>("vscode");
  const [selectedOpenMode, setSelectedOpenMode] = useState<OpenInMode>(() => getStoredDefaultOpenInMode());
  const [openInFeedback, setOpenInFeedback] = useState<OpenInFeedbackState>({ phase: "idle" });
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [workspacePickerFolderId, setWorkspacePickerFolderId] = useState<number | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const detailTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const editorRootRefs = useRef<Partial<Record<EditableSectionId, HTMLElement | null>>>({});
  const activityMessages = useMemo(
    () =>
      new Map(
        (ticket?.activities ?? []).map((activity) => [activity.id, getActivityMessage(activity, statuses)])
      ),
    [statuses, ticket?.activities]
  );
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
  const detailTabsId = useId();
  const jiraSectionId = useId();
  const openInMenuId = useId();
  const preferredProjectFolder = getPreferredProjectFolder(ticket);
  const availableTerminalFolders = useMemo(() => getAvailableTerminalFolders(ticket), [ticket]);
  const availableWorkspaceOptions = useMemo(
    () => getWorkspaceOptions(ticket, workspacePickerFolderId),
    [ticket, workspacePickerFolderId]
  );
  const jiraSettingsQuery = useJiraSettingsQuery();
  const jiraBaseUrl = jiraSettingsQuery.data?.baseUrl ? trimTrailingSlash(jiraSettingsQuery.data.baseUrl) : "";
  const workspaceSummaries = useMemo(() => getWorkspaceSummaries(ticket, form, projects), [ticket, form, projects]);
  const workspaceBaseBranchErrorCount = useMemo(() => countWorkspaceBaseBranchErrors(form, projects), [form, projects]);

  useEffect(() => {
    setActiveEditor(null);
    setActiveDetailTab("contexts");
    setIsJiraSectionExpanded(true);
    setIsWorkspaceDrawerOpen(false);
    setIsOpenInMenuOpen(false);
    setSelectedOpenTarget("vscode");
    setSelectedOpenMode(getStoredDefaultOpenInMode());
    setIsFolderPickerOpen(false);
    setWorkspacePickerFolderId(null);
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
    if (!availableTerminalFolders.length) {
      setIsOpenInMenuOpen(false);
      setIsFolderPickerOpen(false);
      setWorkspacePickerFolderId(null);
    }
  }, [availableTerminalFolders.length]);

  useEffect(() => {
    if (!isOpenInMenuOpen) {
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

      setOpenInMenuSide((current) => (current === (shouldOpenUpward ? "top" : "bottom") ? current : shouldOpenUpward ? "top" : "bottom"));
      setOpenInMenuMaxHeight((current) => {
        const availableSpace = shouldOpenUpward ? spaceAbove : spaceBelow;
        const nextValue = Math.max(minimumMenuHeight, Math.floor(availableSpace));
        return current === nextValue ? current : nextValue;
      });
    };

    updateOpenInMenuLayout();

    window.addEventListener("resize", updateOpenInMenuLayout);
    document.addEventListener("scroll", updateOpenInMenuLayout, true);

    return () => {
      window.removeEventListener("resize", updateOpenInMenuLayout);
      document.removeEventListener("scroll", updateOpenInMenuLayout, true);
    };
  }, [isOpenInMenuOpen]);

  const selectedOpenTargetLabel =
    openInTargets.find((target) => target.id === selectedOpenTarget)?.label ?? "selected app";
  const openInButtonLabel = `Open in ${selectedOpenTargetLabel}`;
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
  const openInStatusTone =
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

  const handleOpenInTarget = (target: OpenInTarget) => {
    setSelectedOpenTarget(target);
    setIsOpenInMenuOpen(false);
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
        message: getErrorMessage(error)
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

  useEffect(() => {
    if (!isOpenInMenuOpen) {
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

      closeOpenInMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      closeOpenInMenu(true);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpenInMenuOpen]);

  const metadata = useMemo(
    () => ({
      status: statuses.find((column) => column.status === form.status)?.label ?? formatStatusLabel(form.status),
      priority: form.priority,
      dueAt: formatDateTime(ticket?.dueAt ?? null)
    }),
    [form.priority, form.status, statuses, ticket?.dueAt]
  );
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

  const handleDetailTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const lastIndex = detailTabs.length - 1;
    let nextIndex = index;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = index === lastIndex ? 0 : index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = index === 0 ? lastIndex : index - 1;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = lastIndex;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTab = detailTabs[nextIndex];
    setActiveDetailTab(nextTab.id);
    detailTabRefs.current[nextIndex]?.focus();
  };

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

    closeOpenInMenu();
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

  return (
    <ModalDialog
      open={ticketId !== null}
      title={ticket ? `${ticket.key} ${form.title || "Untitled ticket"}` : "Ticket details"}
      header={
        ticket ? (
          <div className="min-w-0">
            <p className="m-0 text-sm font-semibold uppercase tracking-[0.12em] text-ink-300">{ticket.key}</p>
            {activeEditor === "title" ? (
              <div
                ref={(element) => {
                  editorRootRefs.current.title = element;
                }}
                className="mt-2 max-w-3xl"
              >
                <TicketTitleField
                  value={form.title}
                  onChange={(value) =>
                    onChange((current) => ({
                      ...current,
                      title: value
                    }))
                  }
                  inputRef={titleInputRef}
                  hideLabel
                />
              </div>
            ) : (
              <EditableReadRegion
                label="Edit ticket title"
                className="mt-1 max-w-3xl p-0"
                onActivate={() => {
                  openEditor("title");
                }}
              >
                <h2 className="m-0 min-w-0 break-words text-[1.8rem] font-semibold tracking-[-0.03em] text-ink-50">
                  {form.title || "Untitled ticket"}
                </h2>
              </EditableReadRegion>
            )}
          </div>
        ) : undefined
      }
      description={undefined}
      onEscapeKeyDown={() => {
        if (isWorkspaceDrawerOpen || isFolderPickerOpen || workspacePickerFolderId !== null) {
          return false;
        }

        if (!activeEditor) {
          return;
        }

        saveAndCloseEditor();
        return false;
      }}
      onClose={() => {
        if (activeEditor) {
          saveAndCloseEditor();
          return;
        }

        onClose();
      }}
      size="wide"
      showCloseButton={false}
      initialFocusRef={activeEditor === "title" ? titleInputRef : undefined}
    >
      {isLoading ? (
        <p className="m-0 text-sm text-ink-200">Loading ticket…</p>
      ) : isError || !ticket ? (
        <p className="m-0 text-sm text-ink-200">
          Ticket details could not be loaded. Select it again or refresh the board.
        </p>
      ) : (
        <div className="grid w-full items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(17rem,20rem)] xl:gap-8">
          <div className="grid min-w-0 content-start gap-6">
            <section
              className={sectionClassName}
            >
              {activeEditor === "description" ? (
                <div
                  ref={(element) => {
                    editorRootRefs.current.description = element;
                  }}
                >
                  <TicketDescriptionField
                    ticketId={ticket.id}
                    value={form.description}
                    onChange={(value) =>
                      onChange((current) => ({
                        ...current,
                        description: value
                      }))
                    }
                    onSubmit={onSave}
                    textareaRef={descriptionTextareaRef}
                  />
                </div>
              ) : (
                <EditableReadRegion
                  label="Edit ticket description"
                  onActivate={() => {
                    openEditor("description");
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="m-0 text-base font-semibold text-ink-50">Description</h4>
                  </div>
                  {form.description ? (
                    <div
                      className="min-w-0 rounded-lg border border-white/8 bg-white/[0.02] p-3"
                      role="region"
                      aria-label="Ticket description"
                    >
                      <MarkdownDescription value={form.description} />
                    </div>
                  ) : (
                    <p className="m-0 text-sm text-ink-300">No description yet. Click to add one.</p>
                  )}
                </EditableReadRegion>
              )}
            </section>

            <section className="grid content-start gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-3">
                <h4 className="m-0 text-base font-semibold text-ink-50">Additional details</h4>
                <div className="inline-flex min-h-10 flex-wrap gap-4 border-b border-white/8" role="tablist" aria-label="Ticket detail sections">
                  {detailTabs.map((tab, index) => {
                    const isActive = activeDetailTab === tab.id;

                    return (
                      <button
                        key={tab.id}
                        ref={(element) => {
                          detailTabRefs.current[index] = element;
                        }}
                        id={`${detailTabsId}-${tab.id}-tab`}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`${detailTabsId}-${tab.id}-panel`}
                        tabIndex={isActive ? 0 : -1}
                        className={`${detailTabClassName} ${
                          isActive ? "border-white text-ink-50" : "text-ink-300 hover:text-ink-100"
                        }`}
                        onClick={() => {
                          setActiveDetailTab(tab.id);
                        }}
                        onKeyDown={(event) => {
                          handleDetailTabKeyDown(event, index);
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                id={`${detailTabsId}-${activeDetailTab}-panel`}
                role="tabpanel"
                aria-labelledby={`${detailTabsId}-${activeDetailTab}-tab`}
                className={
                  activeDetailTab === "contexts"
                    ? "min-w-0"
                    : "min-w-0 rounded-lg border border-white/8 bg-white/[0.02] p-3 pb-4"
                }
                tabIndex={0}
              >
                {activeDetailTab === "contexts" ? (
                  <WorkContextEditor ticketId={ticket.id} contexts={ticket.workContexts} embedded />
                ) : ticket.activities.length ? (
                  <div className="grid gap-3">
                    {ticket.activities.map((activity) => (
                      <div className="grid gap-1 border-b border-white/8 pb-3 last:border-b-0 last:pb-0" key={activity.id}>
                        <p className="m-0 text-sm text-ink-50">{activityMessages.get(activity.id) ?? activity.message}</p>
                        <TicketActivityDetails activity={activity} />
                        <span className="text-[0.8rem] text-ink-300">{formatDateTime(activity.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="m-0 text-sm text-ink-200">No activity yet.</p>
                )}
              </div>
            </section>
          </div>

          <aside className="grid min-w-0 content-start xl:border-l xl:border-white/8 xl:pl-6">
            <div className="grid min-w-0 gap-4">
              {availableTerminalFolders.length ? (
                <section className={railSectionClassName}>
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="m-0 text-base font-semibold text-ink-50">Open</h4>
                    <div className="inline-flex min-h-9 flex-wrap border border-white/8">
                      {(["folder", "worktree"] as const).map((mode) => {
                        const isSelected = selectedOpenMode === mode;
                        const isDisabled = mode === "worktree" && !hasAnyWorktree;

                        return (
                          <button
                            key={mode}
                            type="button"
                            className={`inline-flex min-h-8 min-w-20 items-center justify-center border-r border-white/8 px-2.5 py-1.5 text-sm transition-colors last:border-r-0 ${
                              isSelected ? "bg-white text-canvas-975" : "text-ink-200 hover:bg-white/[0.05] hover:text-ink-50"
                            } disabled:cursor-not-allowed disabled:opacity-45`}
                            aria-pressed={isSelected}
                            onClick={() => {
                              setSelectedOpenMode(mode);
                              setOpenInFeedback({ phase: "idle" });
                            }}
                            disabled={isDisabled || isOpenInPending}
                          >
                            {mode === "folder" ? "Folder" : "Worktree"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="relative min-w-0">
                    <div className="flex min-w-0">
                      <button
                        ref={openInActionButtonRef}
                        type="button"
                        className={`inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-l-md border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color,opacity] duration-200 ease-out motion-reduce:transition-none disabled:cursor-progress ${
                          openInFeedback.phase === "success"
                            ? "border-accent-500/50 bg-accent-500/18 text-accent-700 motion-safe:animate-[open-in-success-flash_720ms_ease-out]"
                            : openInFeedback.phase === "error"
                              ? "border-danger-400/45 bg-danger-700/30 text-danger-400 motion-safe:animate-[open-in-error-nudge_360ms_ease-out]"
                              : "border-white/10 bg-white/[0.10] text-ink-50 hover:bg-white/[0.14]"
                        } ${isOpenInPending ? "opacity-90" : ""}`}
                        onClick={() => {
                          if (hasMultipleOpenFolders) {
                            setIsFolderPickerOpen(true);
                            return;
                          }

                          handleOpenInSelection(preferredProjectFolder?.id);
                        }}
                        disabled={isOpenInPending}
                        aria-label={
                          openInFeedback.phase === "opening"
                            ? "Opening"
                            : openInFeedback.phase === "success"
                              ? "Opened"
                              : openInFeedback.phase === "error"
                                ? "Open failed"
                                : openInButtonLabel
                        }
                      >
                        {openInFeedback.phase === "opening" ? (
                          <span
                            className="inline-block h-[0.85rem] w-[0.85rem] animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        ) : openInFeedback.phase === "success" ? (
                          <CheckIcon className="h-4 w-4" />
                        ) : openInFeedback.phase === "error" ? (
                          <AlertIcon className="h-4 w-4" />
                        ) : (
                          getOpenInTargetIcon(selectedOpenTarget)
                        )}
                        <span className="truncate">
                          {openInFeedback.phase === "opening"
                            ? "Opening…"
                            : openInFeedback.phase === "success"
                              ? "Opened"
                              : openInFeedback.phase === "error"
                                ? "Open failed"
                                : openInButtonLabel}
                        </span>
                      </button>
                      <button
                        ref={openInToggleButtonRef}
                        type="button"
                        className="inline-flex min-h-10 min-w-11 items-center justify-center rounded-r-md border border-l-0 border-white/10 bg-white/[0.10] px-3 py-2 text-ink-100 transition-colors hover:bg-white/[0.14] disabled:cursor-progress disabled:opacity-70"
                        aria-label="Choose open-in app"
                        aria-haspopup="dialog"
                        aria-expanded={isOpenInMenuOpen}
                        aria-controls={isOpenInMenuOpen ? openInMenuId : undefined}
                        onClick={() => {
                          setIsOpenInMenuOpen((current) => {
                            return !current;
                          });
                        }}
                        disabled={isOpenInPending}
                      >
                        <ChevronIcon className={`h-4 w-4 transition-transform ${isOpenInMenuOpen ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                    {openInStatusMessage ? (
                      <p
                        className={`m-0 mt-2 min-h-5 text-sm ${
                          openInStatusTone === "success"
                            ? "text-accent-700"
                            : openInStatusTone === "error"
                              ? "text-danger-400"
                              : "text-ink-300"
                        }`}
                        aria-live="polite"
                        role={openInStatusTone === "error" ? "alert" : "status"}
                      >
                        {openInStatusMessage}
                      </p>
                    ) : null}

                    {isOpenInMenuOpen ? (
                      <div
                        id={openInMenuId}
                        ref={openInMenuRef}
                        data-side={openInMenuSide}
                        className={`absolute right-0 z-20 grid w-[min(23rem,calc(100vw-4rem))] gap-1 overflow-y-auto rounded-lg border border-white/10 bg-canvas-900 p-2 shadow-[0_12px_28px_rgba(0,0,0,0.28)] ${
                          openInMenuSide === "top" ? "bottom-[calc(100%+0.45rem)]" : "top-[calc(100%+0.45rem)]"
                        }`}
                        role="dialog"
                        aria-label="Open in"
                        style={{ maxHeight: `${openInMenuMaxHeight}px` }}
                        onBlur={handleOpenInMenuBlur}
                        onKeyDown={handleOpenInMenuKeyDown}
                      >
                        <div className="px-2 pb-1 pt-1">
                          <p className="m-0 text-sm font-medium text-ink-300">Choose app</p>
                        </div>
                        {openInTargets.map((target) => {
                          return (
                            <div key={target.id} className="grid gap-1 border border-transparent p-1">
                              <button
                                ref={(element) => {
                                  openInAppButtonRefs.current[target.id] = element;
                                }}
                                type="button"
                                className="grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
                                aria-pressed={selectedOpenTarget === target.id}
                                onClick={() => {
                                  handleOpenInTarget(target.id);
                                }}
                              >
                                {getOpenInTargetIcon(target.id)}
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-ink-50">{target.label}</span>
                                  <span className="block truncate text-[0.82rem] text-ink-300">{target.description}</span>
                                </span>
                                <span className="text-[0.8rem] font-medium text-ink-400">
                                  {selectedOpenTarget === target.id ? "Selected" : "Use"}
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section className={railSectionClassName}>
                <div className="flex min-w-0 items-center justify-between gap-4">
                  <h4 className="m-0 text-base font-semibold text-ink-50">Details</h4>
                </div>

                <button
                  type="button"
                  className="rounded-lg border border-white/8 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
                  onClick={() => {
                    setIsWorkspaceDrawerOpen(true);
                  }}
                  aria-label="Edit ticket workspaces"
                >
                  <WorkspaceSummaryList items={workspaceSummaries} />
                </button>
                {workspaceBaseBranchErrorCount ? (
                  <p className="m-0 text-sm text-red-100">
                    {workspaceBaseBranchErrorCount} workspace{workspaceBaseBranchErrorCount === 1 ? "" : "s"} missing a folder default branch.
                  </p>
                ) : null}

                {activeEditor === "status" ? (
                  <div
                    ref={(element) => {
                      editorRootRefs.current.status = element;
                    }}
                  >
                    <MetaFieldEditor label="Status">
                      <select
                        className={inputClassName}
                        value={form.status}
                        onChange={(event) =>
                          onChange((current) => ({
                            ...current,
                            status: event.target.value as Ticket["status"]
                          }))
                        }
                      >
                        {availableStatuses.map((status) => (
                          <option key={status.status} value={status.status}>
                            {status.label || formatStatusLabel(status.status)}
                          </option>
                        ))}
                      </select>
                    </MetaFieldEditor>
                  </div>
                ) : (
                  <EditableReadRegion label="Edit ticket status" onActivate={() => openEditor("status")} className="p-0">
                    <MetaRow label="Status" value={metadata.status} />
                  </EditableReadRegion>
                )}

                {activeEditor === "priority" ? (
                  <div
                    ref={(element) => {
                      editorRootRefs.current.priority = element;
                    }}
                  >
                    <MetaFieldEditor label="Priority">
                      <select
                        className={inputClassName}
                        value={form.priority}
                        onChange={(event) =>
                          onChange((current) => ({
                            ...current,
                            priority: event.target.value as Ticket["priority"]
                          }))
                        }
                      >
                        {TICKET_PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </MetaFieldEditor>
                  </div>
                ) : (
                  <EditableReadRegion label="Edit ticket priority" onActivate={() => openEditor("priority")} className="p-0">
                    <MetaRow label="Priority" value={metadata.priority} />
                  </EditableReadRegion>
                )}

                {activeEditor === "dueAt" ? (
                  <div
                    ref={(element) => {
                      editorRootRefs.current.dueAt = element;
                    }}
                  >
                    <MetaFieldEditor label="Due at">
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
                    </MetaFieldEditor>
                  </div>
                ) : (
                  <EditableReadRegion label="Edit ticket due date" onActivate={() => openEditor("dueAt")} className="p-0">
                    <MetaRow label="Due at" value={metadata.dueAt} />
                  </EditableReadRegion>
                )}

                <div className="grid gap-2 border-b border-white/8 pb-4 last:border-b-0 last:pb-0">
                  <DisclosureRow
                    label="Jira issues"
                    description={
                      ticket.jiraIssues.length
                        ? `${ticket.jiraIssues.length} linked issue${ticket.jiraIssues.length === 1 ? "" : "s"}`
                        : "No Jira issues linked"
                    }
                    expanded={isJiraSectionExpanded}
                    onToggle={() => {
                      setIsJiraSectionExpanded((current) => !current);
                    }}
                    className="border border-transparent px-0 py-1 hover:bg-transparent"
                  />
                  {isJiraSectionExpanded ? (
                    activeEditor === "jiraIssues" ? (
                      <div
                        id={jiraSectionId}
                        ref={(element) => {
                          editorRootRefs.current.jiraIssues = element;
                        }}
                      >
                        <MetaFieldEditor label="Jira issues">
                          <JiraIssueSelector
                            value={form.jiraIssues}
                            onChange={(jiraIssues) =>
                              onChange((current) => ({
                                ...current,
                                jiraIssues
                              }))
                            }
                          />
                        </MetaFieldEditor>
                      </div>
                    ) : (
                      <EditableReadRegion
                        label="Edit ticket Jira issues"
                        onActivate={() => openEditor("jiraIssues")}
                        className="p-0"
                      >
                        <div id={jiraSectionId}>
                          {ticket.jiraIssues.length ? (
                            <div className="grid gap-2">
                              {ticket.jiraIssues.map((issue) => {
                                const href = jiraBaseUrl ? `${jiraBaseUrl}/browse/${issue.key}` : null;

                                return (
                                  <div
                                    key={issue.id}
                                    className="min-w-0 rounded-md border border-white/8 px-3 py-2.5"
                                  >
                                    {href ? (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm font-semibold text-ink-50 no-underline hover:text-white"
                                      >
                                        {issue.key}
                                      </a>
                                    ) : (
                                      <span className="text-sm font-semibold text-ink-50">{issue.key}</span>
                                    )}
                                    <p className="m-0 mt-1 min-w-0 break-words text-sm text-ink-200">
                                      {issue.summary || "No Jira summary cached."}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-sm font-medium text-ink-50">No Jira issues</span>
                          )}
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              className="text-sm font-medium text-ink-300 transition-colors hover:text-ink-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
                              onClick={onRefreshJira}
                              disabled={isRefreshingJira}
                              aria-label={isRefreshingJira ? "Refreshing linked issues" : "Refresh linked issues"}
                            >
                              {isRefreshingJira ? "Refreshing…" : "Refresh linked issues"}
                            </button>
                          </div>
                        </div>
                      </EditableReadRegion>
                    )
                  ) : null}
                </div>
              </section>

              <section className={railSectionClassName}>
                <button
                  type="button"
                  className="inline-flex min-h-9 w-full max-w-full items-center justify-center rounded-lg border border-red-400/20 bg-red-950/28 px-3 py-1.5 text-sm font-medium text-red-100 transition-colors hover:border-red-300/30 hover:bg-red-950/40 disabled:cursor-progress disabled:opacity-70"
                  onClick={onDelete}
                  disabled={isDeleting}
                  aria-label={isDeleting ? "Moving ticket to history" : "Move ticket to history"}
                >
                  {isDeleting ? (
                    <span
                      className="mr-2 inline-block h-[0.85rem] w-[0.85rem] animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : null}
                  {isDeleting ? "Moving to history…" : "Move to history"}
                </button>
              </section>
            </div>
          </aside>
        </div>
      )}

      <TicketWorkspaceDrawer
        open={isWorkspaceDrawerOpen}
        form={form}
        projects={projects}
        isSaving={isSaving}
        onChange={onChange}
        onSave={onSave}
        onClose={() => {
          setIsWorkspaceDrawerOpen(false);
        }}
      />

      <ModalDialog
        open={isFolderPickerOpen}
        title="Choose folder"
        description={`Pick which linked project folder to open in ${selectedOpenTargetLabel}.`}
        onClose={() => {
          setIsFolderPickerOpen(false);
        }}
        initialFocusRef={firstFolderOptionRef}
      >
        <div className="grid min-w-0 gap-2">
          {availableTerminalFolders.map((folder, index) => (
            <button
              key={folder.folderId}
              ref={index === 0 ? firstFolderOptionRef : undefined}
              type="button"
              className="grid min-w-0 gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition-colors hover:border-white/16 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
              onClick={() => {
                setIsFolderPickerOpen(false);
                handleOpenInSelection(folder.folderId);
              }}
            >
              <span className="min-w-0 text-sm font-semibold text-ink-50">
                {folder.projectName}
                <span className="ml-2 text-[0.82rem] font-medium text-ink-300">{folder.relationship}</span>
                {folder.isPrimaryFolder ? (
                  <span className="ml-2 text-[0.82rem] font-medium text-amber-200">Primary folder</span>
                ) : null}
              </span>
              <span className="text-sm text-ink-200">{folder.folderLabel}</span>
              <span className="min-w-0 break-all font-mono text-[0.88rem] text-ink-300">{folder.path}</span>
            </button>
          ))}
        </div>
      </ModalDialog>

      <ModalDialog
        open={workspacePickerFolderId !== null}
        title="Choose workspace"
        description={`Pick which ticket workspace to open in ${selectedOpenTargetLabel}.`}
        onClose={() => {
          setWorkspacePickerFolderId(null);
        }}
        initialFocusRef={firstWorkspaceOptionRef}
      >
        <div className="grid min-w-0 gap-2">
          {availableWorkspaceOptions.map((workspace, index) => (
            <button
              key={workspace.id}
              ref={index === 0 ? firstWorkspaceOptionRef : undefined}
              type="button"
              className="grid min-w-0 gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition-colors hover:border-white/16 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
              onClick={() => {
                setWorkspacePickerFolderId(null);
                void runOpenInAction(workspace.folderId, workspace.id);
              }}
            >
              <span className="min-w-0 text-sm font-semibold text-ink-50">
                {workspace.projectName}
                <span className="ml-2 text-[0.82rem] font-medium text-ink-300">{workspace.folderLabel}</span>
              </span>
              <span className="text-sm text-ink-200">{workspace.branchName}</span>
              <span className="text-[0.82rem] text-ink-300">{workspace.role}</span>
            </button>
          ))}
        </div>
      </ModalDialog>

    </ModalDialog>
  );
}
