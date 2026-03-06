import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type ReactNode
} from "react";
import { BOARD_STATUS_ORDER, statusLabelMap, TICKET_PRIORITIES } from "../../lib/constants";
import type { Project, Ticket } from "../../lib/types";
import type { TicketFormState } from "../../features/tickets/form";
import { useJiraSettingsQuery } from "../../features/jira/queries";
import { ModalDialog } from "../ui/modal-dialog";
import { TicketDescriptionField, TicketProjectLinksField, TicketTitleField, inputClassName, labelClassName } from "./ticket-form";
import { JiraIssueSelector } from "./jira-issue-selector";
import { MarkdownDescription } from "./markdown-description";
import { WorkContextEditor } from "./work-context-editor";

interface TicketDrawerProps {
  ticketId: number | null;
  ticket: Ticket | undefined;
  isLoading: boolean;
  isError: boolean;
  form: TicketFormState;
  projects: Project[];
  isSaving: boolean;
  saveSuccessCount: number;
  isDeleting: boolean;
  isOpeningInTerminal: boolean;
  isRefreshingJira: boolean;
  onChange: (updater: (current: TicketFormState) => TicketFormState) => void;
  onSave: () => void;
  onDelete: () => void;
  onOpenInTerminal: (folderId?: number) => void;
  onRefreshJira: () => void;
  onClose: () => void;
}

const sectionClassName = "grid gap-3 border-b border-white/8 pb-4";
const railSectionClassName = "grid min-w-0 gap-3 border-b border-white/8 pb-4 last:border-b-0 last:pb-0";
const detailTabClassName =
  "inline-flex min-h-10 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";

const detailTabs = [
  { id: "contexts", label: "Work contexts" },
  { id: "activity", label: "Activity" }
] as const;

type DetailTabId = (typeof detailTabs)[number]["id"];
type EditableSectionId =
  | "title"
  | "description"
  | "branch"
  | "jiraIssues"
  | "status"
  | "priority"
  | "dueAt"
  | "projectLinks";

const editableReadRegionClassName =
  "grid min-w-0 gap-3 rounded-xl border border-transparent p-2.5 transition-colors hover:border-white/10 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";
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

function MetaRow(props: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-white/8 pb-2.5 last:border-b-0 last:pb-0">
      <span className="text-[0.8rem] font-medium uppercase tracking-[0.12em] text-ink-300">{props.label}</span>
      <span className="text-sm font-medium text-ink-50">{props.value}</span>
    </div>
  );
}

function MetaFieldEditor(props: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
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

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
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

export function TicketDrawer(props: TicketDrawerProps) {
  const {
    ticketId,
    ticket,
    isLoading,
    isError,
    form,
    projects,
    isSaving,
    saveSuccessCount,
    isDeleting,
    isOpeningInTerminal,
    isRefreshingJira,
    onChange,
    onSave,
    onDelete,
    onOpenInTerminal,
    onRefreshJira,
    onClose
  } = props;
  const [activeEditor, setActiveEditor] = useState<EditableSectionId | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTabId>("contexts");
  const [isJiraSectionExpanded, setIsJiraSectionExpanded] = useState(true);
  const [isLinkedProjectsSectionExpanded, setIsLinkedProjectsSectionExpanded] = useState(false);
  const [isTerminalPickerOpen, setIsTerminalPickerOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const detailTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const editorRootRefs = useRef<Partial<Record<EditableSectionId, HTMLElement | null>>>({});
  const firstTerminalOptionRef = useRef<HTMLButtonElement>(null);
  const detailTabsId = useId();
  const jiraSectionId = useId();
  const linkedProjectsSectionId = useId();
  const preferredProjectFolder = getPreferredProjectFolder(ticket);
  const availableTerminalFolders = useMemo(() => getAvailableTerminalFolders(ticket), [ticket]);
  const jiraSettingsQuery = useJiraSettingsQuery();
  const jiraBaseUrl = jiraSettingsQuery.data?.baseUrl ? trimTrailingSlash(jiraSettingsQuery.data.baseUrl) : "";

  useEffect(() => {
    setActiveEditor(null);
    setActiveDetailTab("contexts");
    setIsJiraSectionExpanded(true);
    setIsLinkedProjectsSectionExpanded(false);
    setIsTerminalPickerOpen(false);
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
      setIsTerminalPickerOpen(false);
    }
  }, [availableTerminalFolders.length]);

  const openInTerminalButtonLabel = availableTerminalFolders.length > 1 ? "Open in Terminal…" : "Open in Terminal";

  const handleOpenInTerminal = () => {
    if (availableTerminalFolders.length <= 1) {
      onOpenInTerminal(preferredProjectFolder?.id);
      return;
    }

    setIsTerminalPickerOpen(true);
  };

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

  const metadata = useMemo(
    () => ({
      branch: form.branch.trim() || "No branch",
      status: statusLabelMap[form.status],
      priority: form.priority,
      dueAt: formatDateTime(ticket?.dueAt ?? null)
    }),
    [form.branch, form.priority, form.status, ticket?.dueAt]
  );

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
                      className="min-w-0 rounded-xl border border-white/8 bg-black/10 p-3"
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
                <div
                  className="inline-flex min-h-10 flex-wrap rounded-[12px] border border-white/8 bg-black/40 p-1"
                  role="tablist"
                  aria-label="Ticket detail sections"
                >
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
                          isActive
                            ? "bg-white text-canvas-975"
                            : "text-ink-300 hover:bg-white/[0.05] hover:text-ink-100"
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
                    : "min-w-0 rounded-xl border border-white/8 bg-black/10 p-3 pb-4"
                }
                tabIndex={0}
              >
                {activeDetailTab === "contexts" ? (
                  <WorkContextEditor ticketId={ticket.id} contexts={ticket.workContexts} embedded />
                ) : ticket.activities.length ? (
                  <div className="grid gap-3">
                    {ticket.activities.map((activity) => (
                      <div className="grid gap-1 border-b border-white/8 pb-3 last:border-b-0 last:pb-0" key={activity.id}>
                        <p className="m-0 text-sm text-ink-50">{activity.message}</p>
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
              <section className={railSectionClassName}>
                <div className="flex min-w-0 items-center justify-between gap-4">
                  <h4 className="m-0 text-base font-semibold text-ink-50">Details</h4>
                </div>

                {activeEditor === "branch" ? (
                  <div
                    ref={(element) => {
                      editorRootRefs.current.branch = element;
                    }}
                  >
                    <MetaFieldEditor label="Branch">
                      <input
                        className={inputClassName}
                        type="text"
                        inputMode="text"
                        placeholder="feature/ticket-context…"
                        value={form.branch}
                        onChange={(event) =>
                          onChange((current) => ({
                            ...current,
                            branch: event.target.value
                          }))
                        }
                      />
                    </MetaFieldEditor>
                  </div>
                ) : (
                  <EditableReadRegion label="Edit ticket branch" onActivate={() => openEditor("branch")} className="p-0">
                    <MetaRow label="Branch" value={metadata.branch} />
                  </EditableReadRegion>
                )}

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
                        {BOARD_STATUS_ORDER.map((status) => (
                          <option key={status} value={status}>
                            {statusLabelMap[status]}
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
                    className="rounded-xl border border-sky-400/10 bg-sky-400/[0.05] px-3 py-2 hover:border-sky-300/16 hover:bg-sky-400/[0.08]"
                    labelClassName="text-sky-50"
                    descriptionClassName="text-sky-100/70"
                    chevronClassName="text-sky-200/70"
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
                                    className="min-w-0 rounded-xl border border-sky-400/12 bg-sky-400/[0.04] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(125,211,252,0.05)]"
                                  >
                                    {href ? (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm font-semibold text-sky-50 no-underline hover:text-white"
                                      >
                                        {issue.key}
                                      </a>
                                    ) : (
                                      <span className="text-sm font-semibold text-sky-50">{issue.key}</span>
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
                              className="text-sm font-medium text-sky-100/70 transition-colors hover:text-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
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
                <DisclosureRow
                  label="Linked projects"
                  description={
                    ticket.projectLinks.length
                      ? `${ticket.projectLinks.length} linked project${ticket.projectLinks.length === 1 ? "" : "s"}`
                      : "No linked projects"
                  }
                  expanded={isLinkedProjectsSectionExpanded}
                  onToggle={() => {
                    setIsLinkedProjectsSectionExpanded((current) => !current);
                  }}
                  className="rounded-xl border border-amber-300/10 bg-amber-200/[0.04] px-3 py-2 hover:border-amber-200/16 hover:bg-amber-200/[0.07]"
                  labelClassName="text-amber-50"
                  descriptionClassName="text-amber-100/70"
                  chevronClassName="text-amber-100/70"
                />

                {isLinkedProjectsSectionExpanded ? (
                  <div id={linkedProjectsSectionId}>
                    {activeEditor === "projectLinks" ? (
                      <div
                        ref={(element) => {
                          editorRootRefs.current.projectLinks = element;
                        }}
                      >
                        <TicketProjectLinksField
                          value={form.projectLinks}
                          projects={projects}
                          onChange={(projectLinks) =>
                            onChange((current) => ({
                              ...current,
                              projectLinks
                            }))
                          }
                        />
                      </div>
                    ) : ticket.projectLinks.length ? (
                      <EditableReadRegion
                        label="Edit linked projects"
                        onActivate={() => {
                          openEditor("projectLinks");
                        }}
                        className="grid min-w-0 gap-2 p-0"
                      >
                        {ticket.projectLinks.map((link) => (
                          <div
                            className="grid min-w-0 gap-2 rounded-xl border border-amber-300/12 bg-amber-200/[0.035] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(251,191,36,0.04)]"
                            key={link.id}
                          >
                            <div className="min-w-0">
                              <p className="m-0 text-sm font-medium text-amber-50">
                                {link.project.name} <span className="ml-2 text-[0.82rem] text-amber-100/65">{link.relationship}</span>
                              </p>
                              <p className="m-0 mt-1 text-sm text-ink-300">
                                {link.project.description || "No project description."}
                              </p>
                            </div>
                            <div className="grid min-w-0 gap-2">
                              {link.project.folders.length ? (
                                link.project.folders.map((folder) => (
                                  <div className="min-w-0" key={folder.id}>
                                    <strong className="text-sm font-semibold text-amber-50">{folder.label}</strong>
                                    <p className="m-0 mt-1 min-w-0 break-all font-mono text-[0.88rem] text-ink-300">
                                      {folder.path}
                                    </p>
                                  </div>
                                ))
                              ) : (
                                <p className="m-0 text-sm text-ink-200">No folders attached to this project.</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </EditableReadRegion>
                    ) : (
                      <EditableReadRegion
                        label="Edit linked projects"
                        onActivate={() => {
                          openEditor("projectLinks");
                        }}
                        className="rounded-xl border border-amber-300/12 bg-amber-200/[0.035]"
                      >
                        <p className="m-0 text-sm text-ink-200">No projects linked to this ticket.</p>
                      </EditableReadRegion>
                    )}
                  </div>
                ) : null}
              </section>

              <section className={railSectionClassName}>
                <h4 className="m-0 text-base font-semibold text-ink-50">Actions</h4>
                <div className="grid min-w-0 gap-2.5">
                  {availableTerminalFolders.length ? (
                    <button
                      type="button"
                      className="inline-flex min-h-9 w-full max-w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.10] px-3 py-1.5 text-sm font-medium text-ink-50 transition-colors hover:bg-white/[0.14] disabled:cursor-progress disabled:opacity-70"
                      onClick={handleOpenInTerminal}
                      disabled={isOpeningInTerminal}
                      aria-label={isOpeningInTerminal ? "Opening terminal" : openInTerminalButtonLabel}
                    >
                      {isOpeningInTerminal ? (
                        <span
                          className="mr-2 inline-block h-[0.85rem] w-[0.85rem] animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : null}
                      {isOpeningInTerminal ? "Opening…" : openInTerminalButtonLabel}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="inline-flex min-h-9 w-full max-w-full items-center justify-center rounded-lg border border-red-400/20 bg-red-950/28 px-3 py-1.5 text-sm font-medium text-red-100 transition-colors hover:border-red-300/30 hover:bg-red-950/40 disabled:cursor-progress disabled:opacity-70"
                    onClick={onDelete}
                    disabled={isDeleting}
                    aria-label={isDeleting ? "Deleting ticket" : "Delete ticket"}
                  >
                    {isDeleting ? (
                      <span
                        className="mr-2 inline-block h-[0.85rem] w-[0.85rem] animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : null}
                    Delete ticket
                  </button>
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}

      <ModalDialog
        open={isTerminalPickerOpen}
        title="Choose terminal path"
        description="Pick which linked project folder to open for this ticket."
        onClose={() => {
          setIsTerminalPickerOpen(false);
        }}
        initialFocusRef={firstTerminalOptionRef}
      >
        <div className="grid min-w-0 gap-2">
          {availableTerminalFolders.map((folder, index) => (
            <button
              key={folder.folderId}
              ref={index === 0 ? firstTerminalOptionRef : undefined}
              type="button"
              className="grid min-w-0 gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition-colors hover:border-white/16 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
              onClick={() => {
                setIsTerminalPickerOpen(false);
                onOpenInTerminal(folder.folderId);
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
    </ModalDialog>
  );
}
