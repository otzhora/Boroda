import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAppHeader } from "../app/router";
import { useAssignedJiraIssueLinksQuery, useJiraSettingsQuery } from "../features/jira/queries";
import { useProjectsQuery } from "../features/projects/queries";
import { useCreateTicketMutation } from "../features/tickets/mutations";
import {
  createEmptyQuickTicketForm,
  QuickTicketForm,
  type QuickTicketFormState
} from "../components/board/quick-ticket-form";
import { ModalDialog } from "../components/ui/modal-dialog";
import { useAddTicketJiraLinkMutation } from "../features/tickets/mutations";
import { useTicketsQuery } from "../features/tickets/queries";

const headerActionButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-canvas-900";
const topBarButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-canvas-900 disabled:cursor-progress disabled:opacity-70";
const createButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-accent-500/40 bg-accent-500 px-3 py-2 text-sm font-medium text-canvas-975 transition-colors hover:bg-accent-300 disabled:cursor-progress disabled:opacity-70";
const issueListClassName =
  "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[10px] border border-white/8 bg-canvas-925";
const issueArticleClassName =
  "grid gap-0 border-t border-white/8 px-4 transition-colors first:border-t-0";
const issueRowClassName = "grid gap-4 py-4";
const issueBodyClassName = "grid gap-4 border-t border-white/8 pb-4 pt-4";
const issueToggleButtonClassName =
  "grid w-full min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[8px] px-1 py-1 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";
const spinnerClassName = "h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent";
const emptyPanelClassName = "rounded-[10px] border border-white/8 bg-canvas-925 px-4 py-4";
const issueChipClassName = "inline-flex min-h-6 items-center rounded-[8px] border px-2 py-0.5 text-xs font-medium";

type JiraIssueSort = "needs-boroda" | "linked-first" | "jira-order" | "jira-key";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function createLinkedQuickTicketForm(issue: { key: string; summary: string }): QuickTicketFormState {
  return {
    ...createEmptyQuickTicketForm(),
    title: issue.summary.trim() || issue.key.trim()
  };
}

function toQuickCreatePayload(issue: { key: string; summary: string }, form: QuickTicketFormState) {
  const summary = issue.summary.trim();

  return {
    title: form.title.trim(),
    description: "",
    branch: null,
    workspaces: [],
    jiraIssues: [
      {
        key: issue.key.trim().toUpperCase(),
        summary
      }
    ],
    status: form.status,
    priority: form.priority,
    dueAt: null,
    projectLinks: form.projectId
      ? [{ projectId: Number(form.projectId), relationship: "PRIMARY" as const }]
      : []
  };
}

function parseIssueSort(value: string | null): JiraIssueSort {
  if (
    value === "needs-boroda" ||
    value === "linked-first" ||
    value === "jira-order" ||
    value === "jira-key"
  ) {
    return value;
  }

  return "needs-boroda";
}

function sortIssues<
  TIssue extends {
    key: string;
    borodaTickets: Array<unknown>;
  }
>(issues: TIssue[], sort: JiraIssueSort) {
  const indexedIssues = issues.map((issue, index) => ({ issue, index }));

  switch (sort) {
    case "linked-first":
      return indexedIssues
        .sort((left, right) => {
          const leftRank = left.issue.borodaTickets.length > 0 ? 0 : 1;
          const rightRank = right.issue.borodaTickets.length > 0 ? 0 : 1;
          return leftRank - rightRank || left.index - right.index;
        })
        .map((entry) => entry.issue);
    case "jira-key":
      return indexedIssues
        .sort((left, right) => left.issue.key.localeCompare(right.issue.key))
        .map((entry) => entry.issue);
    case "jira-order":
      return issues;
    case "needs-boroda":
    default:
      return indexedIssues
        .sort((left, right) => {
          const leftRank = left.issue.borodaTickets.length === 0 ? 0 : 1;
          const rightRank = right.issue.borodaTickets.length === 0 ? 0 : 1;
          return leftRank - rightRank || left.index - right.index;
        })
        .map((entry) => entry.issue);
  }
}

export function JiraPage() {
  const { setActions, setRightActions } = useAppHeader();
  const [searchParams, setSearchParams] = useSearchParams();
  const settingsQuery = useJiraSettingsQuery();
  const issuesQuery = useAssignedJiraIssueLinksQuery();
  const projectsQuery = useProjectsQuery();
  const ticketsQuery = useTicketsQuery();
  const [issueToCreateFrom, setIssueToCreateFrom] = useState<{ key: string; summary: string } | null>(null);
  const [issueToLinkToExisting, setIssueToLinkToExisting] = useState<{ key: string; summary: string } | null>(null);
  const [quickCreateForm, setQuickCreateForm] = useState<QuickTicketFormState>(createEmptyQuickTicketForm());
  const [expandedIssueKeys, setExpandedIssueKeys] = useState<string[]>([]);
  const [ticketSearch, setTicketSearch] = useState("");
  const quickCreateTitleRef = useRef<HTMLInputElement>(null);
  const linkExistingSearchRef = useRef<HTMLInputElement>(null);
  const createTicketMutation = useCreateTicketMutation({
    boardFilters: {},
    onCreated: () => {
      setIssueToCreateFrom(null);
    },
    onReset: () => {
      setQuickCreateForm(createEmptyQuickTicketForm());
    }
  });
  const addTicketJiraLinkMutation = useAddTicketJiraLinkMutation();

  useEffect(() => {
    document.title = "Jira · Boroda";
  }, []);

  useEffect(() => {
    setActions(null);
    setRightActions(
      <Link to="/settings" className={headerActionButtonClassName}>
        Settings
      </Link>
    );

    return () => {
      setActions(null);
      setRightActions(null);
    };
  }, [setActions, setRightActions]);

  const baseUrl = settingsQuery.data?.baseUrl ? trimTrailingSlash(settingsQuery.data.baseUrl) : "";
  const issueSort = parseIssueSort(searchParams.get("sort"));
  const payload = issuesQuery.data;
  const issues = sortIssues(payload?.issues ?? [], issueSort);
  const projects = projectsQuery.data ?? [];
  const tickets = ticketsQuery.data ?? [];
  const linkedIssuesCount = issues.filter((issue) => issue.borodaTickets.length > 0).length;

  const openQuickCreate = (issue: { key: string; summary: string }) => {
    setIssueToCreateFrom(issue);
    setQuickCreateForm(createLinkedQuickTicketForm(issue));
  };

  const openLinkExisting = (issue: { key: string; summary: string }) => {
    setIssueToLinkToExisting(issue);
    setTicketSearch("");
  };

  const toggleIssueExpanded = (issueKey: string) => {
    setExpandedIssueKeys((current) =>
      current.includes(issueKey) ? current.filter((key) => key !== issueKey) : [...current, issueKey]
    );
  };

  const linkableTickets = issueToLinkToExisting
    ? tickets.filter((ticket) => {
        const searchValue = ticketSearch.trim().toLowerCase();
        const matchesSearch =
          !searchValue ||
          ticket.key.toLowerCase().includes(searchValue) ||
          ticket.title.toLowerCase().includes(searchValue);
        const selectedIssue = issues.find((issue) => issue.key === issueToLinkToExisting.key);
        const alreadyLinked = selectedIssue?.borodaTickets.some((linkedTicket) => linkedTicket.id === ticket.id) ?? false;

        return matchesSearch && !alreadyLinked;
      })
    : [];

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-3">
      <div className="flex min-h-12 flex-wrap items-end justify-between gap-3 border-b border-white/8 pb-3">
        <h1 className="m-0 text-base font-semibold text-ink-50">Assigned Jira issues</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-300">
            <span>{issues.length} issues</span>
            <span aria-hidden="true">/</span>
            <span>{linkedIssuesCount} linked</span>
          </div>
          <label className="min-w-[12rem]">
            <span className="sr-only">Sort Jira issues</span>
            <select
              className="min-h-10 rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2.5 text-sm text-ink-50"
              aria-label="Sort Jira issues"
              value={issueSort}
              onChange={(event) => {
                const nextSort = event.target.value as JiraIssueSort;
                const nextSearchParams = new URLSearchParams(searchParams);

                if (nextSort === "needs-boroda") {
                  nextSearchParams.delete("sort");
                } else {
                  nextSearchParams.set("sort", nextSort);
                }

                setSearchParams(nextSearchParams, { replace: true });
              }}
            >
              <option value="needs-boroda">Needs Boroda first</option>
              <option value="linked-first">Linked first</option>
              <option value="jira-order">Jira order</option>
              <option value="jira-key">Jira key</option>
            </select>
          </label>
          <button
            type="button"
            className={topBarButtonClassName}
            onClick={() => {
              void issuesQuery.refetch();
            }}
            disabled={issuesQuery.isFetching}
          >
            {issuesQuery.isFetching ? <span className={spinnerClassName} aria-hidden="true" /> : null}
            <span>{issuesQuery.isFetching ? "Refreshing…" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {issuesQuery.error ? (
        <p className="m-0 border border-red-400/24 bg-red-950/32 px-3 py-2 text-sm text-red-100" role="alert">
          {issuesQuery.error.message}
        </p>
      ) : null}

      {createTicketMutation.error ? (
        <p className="m-0 border border-red-400/24 bg-red-950/32 px-3 py-2 text-sm text-red-100" role="alert">
          {createTicketMutation.error.message}
        </p>
      ) : null}

      {issuesQuery.isLoading && !payload ? (
        <p className={`${emptyPanelClassName} m-0 text-sm text-ink-200`}>Loading assigned issues…</p>
      ) : null}

      {!issuesQuery.isLoading && issues.length === 0 ? (
        <p className={`${emptyPanelClassName} m-0 text-sm text-ink-200`}>No assigned Jira issues found.</p>
      ) : null}

      {issues.length > 0 ? (
        <section className={issueListClassName}>
          <ul className="m-0 list-none p-0">
            {issues.map((issue) => {
              const jiraHref = baseUrl ? `${baseUrl}/browse/${issue.key}` : null;
              const isExpanded = expandedIssueKeys.includes(issue.key);
              const panelId = `jira-issue-links-${issue.key}`;
              const linkedCountLabel =
                issue.borodaTickets.length > 0
                  ? issue.borodaTickets.length === 1
                    ? "1 linked Boroda ticket"
                    : `${issue.borodaTickets.length} linked Boroda tickets`
                  : "No linked Boroda tickets";

              return (
                <li className={issueArticleClassName} key={issue.key}>
                  <div className={issueRowClassName}>
                    <button
                      type="button"
                      className={`${issueToggleButtonClassName} ${isExpanded ? "bg-white/[0.03]" : ""}`}
                      aria-expanded={isExpanded}
                      aria-controls={panelId}
                      aria-label={`${isExpanded ? "Hide links" : "Show links"} for ${issue.key}`}
                      onClick={() => {
                        toggleIssueExpanded(issue.key);
                      }}
                    >
                      <span
                        className="flex h-4 w-4 items-center justify-center text-sm leading-none text-ink-300"
                        aria-hidden="true"
                      >
                        <span className={isExpanded ? "-translate-y-px" : ""}>{isExpanded ? "⌄" : "›"}</span>
                      </span>
                      <div
                        className={`h-3 w-3 shrink-0 rounded-[3px] ${
                          issue.borodaTickets.length > 0 ? "bg-emerald-300/70" : "bg-ink-300/45"
                        }`}
                      />
                      <div className="flex min-w-0 items-center gap-3">
                        {jiraHref ? (
                          <a
                            href={jiraHref}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 font-mono text-sm font-medium text-[#6ea8ff] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
                            aria-label={`Open Jira issue ${issue.key}`}
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            {issue.key}
                          </a>
                        ) : (
                          <span className="shrink-0 font-mono text-sm font-medium text-[#6ea8ff]">{issue.key}</span>
                        )}
                        <p className="m-0 min-w-0 truncate text-[0.95rem] leading-6 text-ink-100">{issue.summary}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <span
                          className={`${issueChipClassName} ${
                            issue.borodaTickets.length > 0
                              ? "border-emerald-400/24 bg-emerald-400/10 text-emerald-100"
                              : "border-amber-300/24 bg-amber-300/10 text-amber-100"
                          }`}
                        >
                          {issue.borodaTickets.length > 0 ? "Linked" : "Needs Boroda"}
                        </span>
                        <span className={`${issueChipClassName} border-white/10 bg-white/[0.04] text-ink-200`}>
                          {linkedCountLabel}
                        </span>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div id={panelId} className={issueBodyClassName} role="region" aria-label={`Boroda links for ${issue.key}`}>
                        <div className="grid gap-2">
                          {issue.borodaTickets.length > 0 ? (
                            <ul className="m-0 grid list-none gap-2 p-0" role="list">
                              {issue.borodaTickets.map((ticket) => (
                                <li key={ticket.id}>
                                  <Link
                                    to={`/?ticketId=${ticket.id}`}
                                    className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-[8px] border border-white/8 bg-canvas-950 px-3 py-2.5 transition-colors hover:border-white/14 hover:bg-canvas-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
                                    aria-label={`Open Boroda ticket ${ticket.key}`}
                                  >
                                    <span className="font-mono text-sm font-medium text-ink-50">{ticket.key}</span>
                                    <span className="min-w-0 truncate text-sm text-ink-100">{ticket.title}</span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="m-0 text-sm text-ink-300">No linked BRD tickets.</p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className={topBarButtonClassName}
                            disabled={addTicketJiraLinkMutation.isPending}
                            onClick={() => {
                              openLinkExisting(issue);
                            }}
                          >
                            Link existing Boroda
                          </button>
                          <button
                            type="button"
                            className={issue.borodaTickets.length > 0 ? topBarButtonClassName : createButtonClassName}
                            disabled={createTicketMutation.isPending}
                            onClick={() => {
                              openQuickCreate(issue);
                            }}
                          >
                            Create new Boroda
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <ModalDialog
        open={issueToCreateFrom !== null}
        title="Create new Boroda ticket"
        onClose={() => {
          setIssueToCreateFrom(null);
        }}
        initialFocusRef={quickCreateTitleRef}
        variant="flat"
        showHeader={false}
        showCloseButton={false}
      >
        <div className="border-b border-white/8 px-3 py-3 sm:px-4 sm:py-4">
          <p className="m-0 text-sm font-medium text-ink-100">Linked Jira issue</p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <span className="rounded-[8px] border border-white/10 bg-canvas-950 px-2 py-1 font-mono text-sm font-semibold text-ink-50">
              {issueToCreateFrom?.key}
            </span>
            <p className="m-0 min-w-0 break-words text-sm text-ink-100">{issueToCreateFrom?.summary}</p>
          </div>
        </div>
        <QuickTicketForm
          form={quickCreateForm}
          projects={projects}
          isSubmitting={createTicketMutation.isPending}
          submitLabel="Create new Boroda ticket"
          submittingLabel="Creating new Boroda ticket…"
          titleInputRef={quickCreateTitleRef}
          onChange={(updater) => {
            setQuickCreateForm((current) => updater(current));
          }}
          onSubmit={() => {
            if (!issueToCreateFrom) {
              return;
            }

            createTicketMutation.mutate(toQuickCreatePayload(issueToCreateFrom, quickCreateForm));
          }}
          onCancel={() => {
            setIssueToCreateFrom(null);
          }}
        />
      </ModalDialog>

      <ModalDialog
        open={issueToLinkToExisting !== null}
        title="Link existing Boroda ticket"
        onClose={() => {
          setIssueToLinkToExisting(null);
          setTicketSearch("");
        }}
        initialFocusRef={linkExistingSearchRef}
        variant="flat"
        showHeader={false}
        showCloseButton={false}
      >
        <div className="border-b border-white/8 px-3 py-3 sm:px-4 sm:py-4">
          <p className="m-0 text-sm font-medium text-ink-100">Link to Jira issue</p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <span className="rounded-[8px] border border-white/10 bg-canvas-950 px-2 py-1 font-mono text-sm font-medium text-ink-50">
              {issueToLinkToExisting?.key}
            </span>
            <p className="m-0 min-w-0 break-words text-sm text-ink-100">{issueToLinkToExisting?.summary}</p>
          </div>
        </div>

        <div className="grid gap-3 px-3 py-3 sm:px-4 sm:py-4">
          <label className="grid gap-2">
            <span className="m-0 text-sm font-medium text-ink-100">Search Boroda tickets</span>
            <input
              ref={linkExistingSearchRef}
              className="min-h-10 rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2.5 text-sm text-ink-50 placeholder:text-ink-300"
              value={ticketSearch}
              onChange={(event) => {
                setTicketSearch(event.target.value);
              }}
              placeholder="Search by key or title…"
            />
          </label>

          {addTicketJiraLinkMutation.error ? (
            <p className="m-0 text-sm text-danger-400" role="alert">
              {addTicketJiraLinkMutation.error.message}
            </p>
          ) : null}

          {ticketsQuery.isLoading ? <p className="m-0 text-sm text-ink-300">Loading Boroda tickets…</p> : null}

          {!ticketsQuery.isLoading ? (
            linkableTickets.length > 0 ? (
              <ul className="m-0 grid list-none gap-3 p-0" role="list">
                {linkableTickets.map((ticket) => (
                  <li className="grid gap-3 rounded-[10px] border border-white/8 bg-canvas-950 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto]" key={ticket.id}>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink-50">{ticket.key}</span>
                        <span className="inline-flex min-h-6 items-center rounded-[8px] border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-ink-200">
                          {ticket.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="m-0 mt-1.5 break-words text-sm text-ink-100">{ticket.title}</p>
                    </div>
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        className={createButtonClassName}
                        disabled={addTicketJiraLinkMutation.isPending || !issueToLinkToExisting}
                        onClick={() => {
                          if (!issueToLinkToExisting) {
                            return;
                          }

                          addTicketJiraLinkMutation.mutate(
                            {
                              ticketId: ticket.id,
                              key: issueToLinkToExisting.key,
                              summary: issueToLinkToExisting.summary
                            },
                            {
                              onSuccess: () => {
                                setIssueToLinkToExisting(null);
                                setTicketSearch("");
                              }
                            }
                          );
                        }}
                      >
                        {addTicketJiraLinkMutation.isPending ? "Linking…" : "Link ticket"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm text-ink-300">
                {ticketSearch.trim()
                  ? "No matching Boroda tickets."
                  : "No available Boroda tickets to link."}
              </p>
            )
          ) : null}
        </div>
      </ModalDialog>
    </section>
  );
}
