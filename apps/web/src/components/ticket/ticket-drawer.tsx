import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { statusLabelMap } from "../../lib/constants";
import type { Project, Ticket } from "../../lib/types";
import { toTicketForm, type TicketFormState } from "../../features/tickets/form";
import { useJiraSettingsQuery } from "../../features/jira/queries";
import { ModalDialog } from "../ui/modal-dialog";
import {
  TicketActionBar,
  TicketDescriptionField,
  TicketMetaFields,
  TicketProjectLinksField,
  TicketTitleField
} from "./ticket-form";
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
  onOpenInTerminal: () => void;
  onRefreshJira: () => void;
  onClose: () => void;
}

const sectionClassName = "grid gap-3 border-b border-white/8 pb-4";
const railSectionClassName = "grid min-w-0 gap-3 border-b border-white/8 pb-4 last:border-b-0 last:pb-0";
const detailTabClassName =
  "inline-flex min-h-10 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";
const sectionToggleButtonClassName =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";

const detailTabs = [
  { id: "contexts", label: "Work contexts" },
  { id: "activity", label: "Activity" }
] as const;

type DetailTabId = (typeof detailTabs)[number]["id"];

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

function RefreshIcon(props: { className?: string }) {
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
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
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
  const [isEditing, setIsEditing] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTabId>("contexts");
  const [isJiraSectionExpanded, setIsJiraSectionExpanded] = useState(true);
  const [isLinkedProjectsSectionExpanded, setIsLinkedProjectsSectionExpanded] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const detailTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const detailTabsId = useId();
  const jiraSectionId = useId();
  const linkedProjectsSectionId = useId();
  const preferredProjectFolder = getPreferredProjectFolder(ticket);
  const jiraSettingsQuery = useJiraSettingsQuery();
  const jiraBaseUrl = jiraSettingsQuery.data?.baseUrl ? trimTrailingSlash(jiraSettingsQuery.data.baseUrl) : "";

  useEffect(() => {
    setIsEditing(false);
    setActiveDetailTab("contexts");
    setIsJiraSectionExpanded(true);
    setIsLinkedProjectsSectionExpanded(false);
  }, [ticketId]);

  useEffect(() => {
    if (isEditing) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setIsEditing(false);
  }, [saveSuccessCount]);

  const metadata = useMemo(
    () => [
      { label: "Branch", value: form.branch.trim() || "No branch" },
      { label: "Status", value: statusLabelMap[form.status] },
      { label: "Priority", value: form.priority },
      { label: "Due at", value: formatDateTime(ticket?.dueAt ?? null) }
    ],
    [form.branch, form.priority, form.status, ticket?.dueAt]
  );

  const handleCancelEdit = () => {
    if (ticket) {
      const nextForm = toTicketForm(ticket);
      onChange(() => nextForm);
    }

    setIsEditing(false);
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
            {isEditing ? (
              <div className="mt-2 max-w-3xl">
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
              <h2 className="m-0 mt-1 min-w-0 break-words text-[1.8rem] font-semibold tracking-[-0.03em] text-ink-50">
                {form.title || "Untitled ticket"}
              </h2>
            )}
          </div>
        ) : undefined
      }
      description={undefined}
      onEscapeKeyDown={() => {
        if (!isEditing) {
          return;
        }

        if (!isSaving) {
          onSave();
        }

        return false;
      }}
      onClose={onClose}
      size="wide"
      showCloseButton={false}
      initialFocusRef={isEditing ? titleInputRef : undefined}
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
              onDoubleClick={() => {
                setIsEditing(true);
              }}
            >
              {isEditing ? (
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
                />
              ) : (
                <div className="grid gap-3">
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
                    <p className="m-0 text-sm text-ink-300">No description yet. Double-click to add one.</p>
                  )}
                </div>
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
                className="min-w-0 rounded-xl border border-white/8 bg-black/10 p-3 pb-4"
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

                {isEditing ? (
                  <TicketMetaFields form={form} onChange={onChange} />
                ) : (
                  <div className="grid min-w-0 gap-2">
                    {metadata.map((item) => (
                      <MetaRow key={item.label} label={item.label} value={item.value} />
                    ))}
                    <div className="grid gap-2 border-b border-white/8 pb-2.5 last:border-b-0 last:pb-0">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[0.8rem] font-medium uppercase tracking-[0.12em] text-ink-300">Jira issues</span>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            className={sectionToggleButtonClassName}
                            aria-expanded={isJiraSectionExpanded}
                            aria-controls={jiraSectionId}
                            aria-label={`${isJiraSectionExpanded ? "Hide" : "Show"} Jira issues`}
                            onClick={() => {
                              setIsJiraSectionExpanded((current) => !current);
                            }}
                          >
                            <span>{isJiraSectionExpanded ? "Hide" : "Show"}</span>
                            <ChevronIcon
                              className={`ml-1.5 h-4 w-4 transition-transform ${
                                isJiraSectionExpanded ? "" : "-rotate-90"
                              }`}
                            />
                          </button>
                          {ticket.jiraIssues.length ? (
                            <button
                              type="button"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-ink-100 transition-colors hover:border-white/16 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50 disabled:cursor-progress disabled:opacity-70"
                              onClick={onRefreshJira}
                              disabled={isRefreshingJira}
                              aria-label={isRefreshingJira ? "Refreshing Jira links" : "Refresh Jira links"}
                              title={isRefreshingJira ? "Refreshing Jira links" : "Refresh Jira links"}
                            >
                              <RefreshIcon
                                className={`h-4 w-4 ${isRefreshingJira ? "animate-spin motion-reduce:animate-none" : ""}`}
                              />
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {isJiraSectionExpanded ? (
                        <div id={jiraSectionId}>
                          {ticket.jiraIssues.length ? (
                            <div className="grid gap-2">
                              {ticket.jiraIssues.map((issue) => {
                                const href = jiraBaseUrl ? `${jiraBaseUrl}/browse/${issue.key}` : null;

                                return (
                                  <div
                                    key={issue.id}
                                    className="min-w-0 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2"
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
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>

              <section className={railSectionClassName}>
                <div className="flex items-center justify-between gap-4">
                  <h4 className="m-0 text-base font-semibold text-ink-50">Linked projects</h4>
                  <button
                    type="button"
                    className={sectionToggleButtonClassName}
                    aria-expanded={isLinkedProjectsSectionExpanded}
                    aria-controls={linkedProjectsSectionId}
                    aria-label={`${isLinkedProjectsSectionExpanded ? "Hide" : "Show"} linked projects`}
                    onClick={() => {
                      setIsLinkedProjectsSectionExpanded((current) => !current);
                    }}
                  >
                    <span>{isLinkedProjectsSectionExpanded ? "Hide" : "Show"}</span>
                    <ChevronIcon
                      className={`ml-1.5 h-4 w-4 transition-transform ${
                        isLinkedProjectsSectionExpanded ? "" : "-rotate-90"
                      }`}
                    />
                  </button>
                </div>

                {isLinkedProjectsSectionExpanded ? (
                  <div id={linkedProjectsSectionId}>
                    {isEditing ? (
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
                    ) : ticket.projectLinks.length ? (
                      <div className="grid min-w-0 gap-3">
                        {ticket.projectLinks.map((link) => (
                          <div className="grid min-w-0 gap-2 border-b border-white/8 pb-3 last:border-b-0 last:pb-0" key={link.id}>
                            <div className="min-w-0">
                              <p className="m-0 text-sm font-medium text-ink-50">
                                {link.project.name} <span className="ml-2 text-[0.82rem] text-ink-300">{link.relationship}</span>
                              </p>
                              <p className="m-0 mt-1 text-sm text-ink-300">
                                {link.project.description || "No project description."}
                              </p>
                            </div>
                            <div className="grid min-w-0 gap-2">
                              {link.project.folders.length ? (
                                link.project.folders.map((folder) => (
                                  <div className="min-w-0" key={folder.id}>
                                    <strong className="text-sm font-semibold text-ink-50">{folder.label}</strong>
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
                      </div>
                    ) : (
                      <p className="m-0 text-sm text-ink-200">No projects linked to this ticket.</p>
                    )}
                  </div>
                ) : null}
              </section>

              {isEditing ? (
                <section className={railSectionClassName}>
                  <h4 className="m-0 text-base font-semibold text-ink-50">Actions</h4>
                  <TicketActionBar
                    isSubmitting={isSaving}
                    submitLabel="Save ticket"
                    submittingLabel="Saving…"
                    onSubmit={onSave}
                    onCancel={handleCancelEdit}
                    secondaryAction={{
                      label: "Delete ticket",
                      pendingLabel: "Deleting…",
                      isPending: isDeleting,
                      onClick: onDelete,
                      variant: "danger"
                    }}
                  />
                </section>
              ) : (
                <section className={railSectionClassName}>
                  <h4 className="m-0 text-base font-semibold text-ink-50">Actions</h4>
                  <div className="grid min-w-0 gap-2.5">
                    {preferredProjectFolder ? (
                      <button
                        type="button"
                        className="inline-flex min-h-9 w-full max-w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.10] px-3 py-1.5 text-sm font-medium text-ink-50 transition-colors hover:bg-white/[0.14] disabled:cursor-progress disabled:opacity-70"
                        onClick={onOpenInTerminal}
                        disabled={isOpeningInTerminal}
                        aria-label={isOpeningInTerminal ? "Opening terminal" : "Open in Terminal"}
                      >
                        {isOpeningInTerminal ? (
                          <span
                            className="mr-2 inline-block h-[0.85rem] w-[0.85rem] animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
                            aria-hidden="true"
                          />
                        ) : null}
                        Open in Terminal
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="inline-flex min-h-9 w-full max-w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.10] px-3 py-1.5 text-sm font-medium text-ink-50 transition-colors hover:bg-white/[0.14]"
                      onClick={() => {
                        setIsEditing(true);
                      }}
                    >
                      Edit ticket
                    </button>
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
              )}
            </div>
          </aside>
        </div>
      )}
    </ModalDialog>
  );
}
