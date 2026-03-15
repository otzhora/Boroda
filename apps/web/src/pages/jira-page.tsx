import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAppHeader } from "../app/router";
import { PageCommandBar } from "../components/ui/page-command-bar";
import { PageSearchInput } from "../components/ui/page-search-input";
import { useBoardColumnsQuery } from "../features/board/queries";
import {
  useAssignedJiraIssueLinksQuery,
  useJiraLinkableTicketsQuery,
  useJiraSettingsQuery
} from "../features/jira/queries";
import {
  buildJiraPageItems,
  JIRA_PAGE_SIZE,
  JiraIssueSort,
  normalizeIssueSearch,
  parseIssuePage,
  parseIssueSort,
  sortIssues,
  trimTrailingSlash
} from "../features/jira/page-helpers";
import { useProjectsQuery } from "../features/projects/queries";
import { useCreateTicketMutation } from "../features/tickets/mutations";
import {
  createEmptyQuickTicketForm,
  QuickTicketForm,
  type QuickTicketFormState
} from "../components/board/quick-ticket-form";
import { DEFAULT_BOARD_STATUS } from "../lib/constants";
import { ModalDialog } from "../components/ui/modal-dialog";
import { useAddTicketJiraLinkMutation } from "../features/tickets/mutations";
import { usePageSearchHotkeys } from "../features/tickets/url-state";

const headerActionButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-canvas-900";
const topBarButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-canvas-900 disabled:cursor-progress disabled:opacity-70";
const createButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-accent-500/40 bg-accent-500 px-3 py-2 text-sm font-medium text-canvas-975 transition-colors hover:bg-accent-300 disabled:cursor-progress disabled:opacity-70";
const inputClassName =
  "min-h-10 rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2.5 text-sm text-ink-50 placeholder:text-ink-300";
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
const issueCountChipClassName =
  `${issueChipClassName} w-[12.5rem] justify-center border-white/10 bg-white/[0.04] text-center text-ink-200`;
const issueKeyClassName =
  "inline-flex w-[9ch] shrink-0 font-mono text-sm font-medium tabular-nums text-[#6ea8ff]";
const paginationButtonClassName =
  "inline-flex h-10 min-w-10 items-center justify-center rounded-[10px] border border-white/8 bg-white/[0.04] px-3 text-sm font-medium text-ink-100 transition-colors hover:border-white/14 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50 disabled:text-ink-300 disabled:hover:border-white/8 disabled:hover:bg-white/[0.04]";
const activePaginationButtonClassName =
  "border-white/16 bg-canvas-950 text-ink-50";

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

export function JiraPage() {
  const { hasHost } = useAppHeader();
  const [searchParams, setSearchParams] = useSearchParams();
  const settingsQuery = useJiraSettingsQuery();
  const issuesQuery = useAssignedJiraIssueLinksQuery();
  const boardColumnsQuery = useBoardColumnsQuery();
  const projectsQuery = useProjectsQuery();
  const [issueSearchInput, setIssueSearchInput] = useState(() => normalizeIssueSearch(searchParams.get("q")));
  const [issueToCreateFrom, setIssueToCreateFrom] = useState<{ key: string; summary: string } | null>(null);
  const [issueToLinkToExisting, setIssueToLinkToExisting] = useState<{ key: string; summary: string } | null>(null);
  const [quickCreateForm, setQuickCreateForm] = useState<QuickTicketFormState>(createEmptyQuickTicketForm());
  const [expandedIssueKeys, setExpandedIssueKeys] = useState<string[]>([]);
  const [ticketSearch, setTicketSearch] = useState("");
  const [debouncedTicketSearch, setDebouncedTicketSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickCreateTitleRef = useRef<HTMLInputElement>(null);
  const linkExistingSearchRef = useRef<HTMLInputElement>(null);
  const boardColumns = boardColumnsQuery.data?.columns ?? [];
  const defaultBoardStatus = boardColumns[0]?.status ?? DEFAULT_BOARD_STATUS;
  const createTicketMutation = useCreateTicketMutation({
    boardFilters: {},
    onCreated: () => {
      setIssueToCreateFrom(null);
    },
    onReset: () => {
      setQuickCreateForm(createEmptyQuickTicketForm(defaultBoardStatus));
    }
  });
  const addTicketJiraLinkMutation = useAddTicketJiraLinkMutation();

  useEffect(() => {
    document.title = "Jira · Boroda";
  }, []);

  const baseUrl = settingsQuery.data?.baseUrl ? trimTrailingSlash(settingsQuery.data.baseUrl) : "";
  const issueSort = parseIssueSort(searchParams.get("sort"));
  const payload = issuesQuery.data;
  const issueSearch = normalizeIssueSearch(searchParams.get("q"));
  const requestedPage = parseIssuePage(searchParams.get("page"));
  const sortedIssues = sortIssues(payload?.issues ?? [], issueSort);
  const issues = sortedIssues.filter((issue) => {
    if (!issueSearchInput.trim()) {
      return true;
    }

    const searchValue = issueSearchInput.trim().toLowerCase();
    return (
      issue.key.toLowerCase().includes(searchValue) ||
      issue.summary.toLowerCase().includes(searchValue)
    );
  });
  const projects = projectsQuery.data ?? [];
  const linkableTicketsQuery = useJiraLinkableTicketsQuery(issueToLinkToExisting?.key ?? null, debouncedTicketSearch);
  const linkableTickets = linkableTicketsQuery.data ?? [];
  const linkedIssuesCount = issues.filter((issue) => issue.borodaTickets.length > 0).length;
  const hasTicketSearch = ticketSearch.trim().length > 0;
  const isTicketSearchDebouncing = hasTicketSearch && ticketSearch.trim() !== debouncedTicketSearch;
  const isLinkableTicketsLoading =
    hasTicketSearch && (isTicketSearchDebouncing || linkableTicketsQuery.isLoading || linkableTicketsQuery.isFetching);
  const totalPages = Math.max(1, Math.ceil(issues.length / JIRA_PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const paginatedIssues = issues.slice((currentPage - 1) * JIRA_PAGE_SIZE, currentPage * JIRA_PAGE_SIZE);
  const pageStart = issues.length === 0 ? 0 : (currentPage - 1) * JIRA_PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * JIRA_PAGE_SIZE, issues.length);
  const pageItems = buildJiraPageItems(totalPages, currentPage);

  useEffect(() => {
    setIssueSearchInput((current) => (current === issueSearch ? current : issueSearch));
  }, [issueSearch]);

  useEffect(() => {
    if (requestedPage === currentPage) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);

    if (currentPage <= 1) {
      nextSearchParams.delete("page");
    } else {
      nextSearchParams.set("page", String(currentPage));
    }

    setSearchParams(nextSearchParams, { replace: true });
  }, [currentPage, requestedPage, searchParams, setSearchParams]);

  useEffect(() => {
    setQuickCreateForm((current) => {
      if (boardColumns.length === 0 || boardColumns.some((column) => column.status === current.status)) {
        return current;
      }

      return {
        ...current,
        status: defaultBoardStatus
      };
    });
  }, [boardColumns, defaultBoardStatus]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedTicketSearch(ticketSearch.trim());
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [ticketSearch]);

  usePageSearchHotkeys({
    searchInputRef
  });

  const searchControl = (
    <PageSearchInput
      inputRef={searchInputRef}
      inputClassName={inputClassName}
      name="jiraIssueSearch"
      wrapperClassName="min-w-0 flex-1 basis-[18rem] max-w-[32rem]"
      value={issueSearchInput}
      onChange={(nextSearch) => {
        const nextSearchParams = new URLSearchParams(searchParams);

        setIssueSearchInput(nextSearch);

        if (nextSearch.trim()) {
          nextSearchParams.set("q", nextSearch);
        } else {
          nextSearchParams.delete("q");
        }

        setSearchParams(nextSearchParams, { replace: true });
      }}
    />
  );

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

  const setIssuePage = (nextPage: number) => {
    const boundedPage = Math.min(Math.max(nextPage, 1), totalPages);
    const nextSearchParams = new URLSearchParams(searchParams);

    if (boundedPage <= 1) {
      nextSearchParams.delete("page");
    } else {
      nextSearchParams.set("page", String(boundedPage));
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-3">
      <PageCommandBar
        actions={searchControl}
        rightActions={
          <Link to="/settings" className={headerActionButtonClassName}>
            Settings
          </Link>
        }
      />

      <div className="flex min-h-12 flex-wrap items-end justify-between gap-3 border-b border-white/8 pb-3">
        <h1 className="m-0 text-base font-semibold text-ink-50">Assigned Jira issues</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-300">
            <span>{issueSearch ? `${issues.length} of ${sortedIssues.length} issues` : `${issues.length} issues`}</span>
            <span aria-hidden="true">/</span>
            <span>{linkedIssuesCount} linked</span>
            {issues.length > 0 ? (
              <>
                <span aria-hidden="true">/</span>
                <span>{pageStart}-{pageEnd}</span>
              </>
            ) : null}
          </div>
          {!hasHost ? searchControl : null}
          <label className="min-w-[12rem]">
            <span className="sr-only">Sort Jira issues</span>
            <select
              className={inputClassName}
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

      {!issuesQuery.isLoading && sortedIssues.length === 0 ? (
        <p className={`${emptyPanelClassName} m-0 text-sm text-ink-200`}>No assigned Jira issues found.</p>
      ) : null}

      {!issuesQuery.isLoading && sortedIssues.length > 0 && issues.length === 0 ? (
        <p className={`${emptyPanelClassName} m-0 text-sm text-ink-200`}>No Jira issues match this search.</p>
      ) : null}

      {issues.length > JIRA_PAGE_SIZE ? (
        <nav
          className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-white/8 bg-canvas-925 px-3 py-2"
          aria-label="Jira issue pages"
        >
          <p className="m-0 text-sm text-ink-300">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={paginationButtonClassName}
              onClick={() => {
                setIssuePage(currentPage - 1);
              }}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <span aria-hidden="true">‹</span>
            </button>
            {pageItems.map((item, index) =>
              item === "ellipsis" ? (
                <span
                  className="inline-flex h-10 min-w-8 items-center justify-center px-1 text-lg font-medium text-ink-300"
                  aria-hidden="true"
                  key={`ellipsis-${index}`}
                >
                  …
                </span>
              ) : (
                <button
                  type="button"
                  className={`${paginationButtonClassName} ${item === currentPage ? activePaginationButtonClassName : ""}`}
                  onClick={() => {
                    setIssuePage(item);
                  }}
                  aria-label={item === currentPage ? `Page ${item}, current page` : `Go to page ${item}`}
                  aria-current={item === currentPage ? "page" : undefined}
                  key={item}
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              className={paginationButtonClassName}
              onClick={() => {
                setIssuePage(currentPage + 1);
              }}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
        </nav>
      ) : null}

      {paginatedIssues.length > 0 ? (
        <section className={issueListClassName}>
          <ul className="m-0 list-none p-0">
            {paginatedIssues.map((issue) => {
              const jiraHref = baseUrl ? `${baseUrl}/browse/${issue.key}` : null;
              const isExpanded = expandedIssueKeys.includes(issue.key);
              const panelId = `jira-issue-links-${issue.key}`;
              const linkedCountLabel = `${issue.borodaTickets.length} Boroda ticket${issue.borodaTickets.length === 1 ? "" : "s"}`;

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
                        className={`h-3.5 w-3.5 shrink-0 rounded-[4px] border shadow-[0_0_0_1px_rgba(0,0,0,0.22)] ${
                          issue.borodaTickets.length > 0
                            ? "border-emerald-300/60 bg-emerald-300/80 shadow-emerald-500/20"
                            : "border-amber-300/50 bg-amber-300/80 shadow-amber-500/20"
                        }`}
                      />
                      <div className="flex min-w-0 items-center gap-3">
                        {jiraHref ? (
                          <a
                            href={jiraHref}
                            target="_blank"
                            rel="noreferrer"
                            className={`${issueKeyClassName} underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50`}
                            aria-label={`Open Jira issue ${issue.key}`}
                            onClick={(event) => {
                              event.stopPropagation();
                            }}
                          >
                            {issue.key}
                          </a>
                        ) : (
                          <span className={issueKeyClassName}>{issue.key}</span>
                        )}
                        <p className="m-0 min-w-0 truncate text-[0.95rem] leading-6 text-ink-100">{issue.summary}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {issue.borodaTickets.length === 0 ? (
                          <span className={`${issueChipClassName} border-amber-300/24 bg-amber-300/10 text-amber-100`}>
                            Needs Boroda
                          </span>
                        ) : null}
                        <span className={issueCountChipClassName}>
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
          statuses={boardColumns}
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
              type="search"
              inputMode="search"
              name="borodaTicketSearch"
              autoComplete="off"
              spellCheck={false}
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

          {!ticketSearch.trim() ? <p className="m-0 text-sm text-ink-300">Search to find a Boroda ticket to link.</p> : null}

          {isLinkableTicketsLoading ? (
            <p className="m-0 text-sm text-ink-300">Loading Boroda tickets…</p>
          ) : null}

          {hasTicketSearch && !isLinkableTicketsLoading ? (
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
              <p className="m-0 text-sm text-ink-300">No matching Boroda tickets.</p>
            )
          ) : null}
        </div>
      </ModalDialog>
    </section>
  );
}
