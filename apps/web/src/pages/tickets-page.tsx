import { useDeferredValue, useEffect, useEffectEvent, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArchiveWorktreeDialog, extractDirtyWorktrees, type DirtyWorktreeDescriptor } from "../components/ticket/archive-worktree-dialog";
import { TicketDrawer } from "../components/ticket/ticket-drawer";
import { AppHeaderActions, AppHeaderRightActions, useAppHeader } from "../app/router";
import { TICKET_PRIORITIES, formatStatusLabel } from "../lib/constants";
import { useBoardColumnsQuery, type BoardFilters } from "../features/board/queries";
import { useProjectsQuery } from "../features/projects/queries";
import {
  createEmptyTicketForm,
  toTicketForm,
  toTicketPayload,
  type TicketFormState
} from "../features/tickets/form";
import {
  useDeleteTicketMutation,
  useOpenTicketInAppMutation,
  useRefreshTicketJiraLinksMutation,
  useUnarchiveTicketMutation,
  useUpdateTicketMutation
} from "../features/tickets/mutations";
import {
  useTicketQuery,
  useTicketListQuery,
  type TicketSortField
} from "../features/tickets/queries";
import {
  ColumnHeader,
  ProjectChip,
  TicketFilterDropdown,
  formatLastChange,
  formatStandupWindowLabel,
  getDefaultStandupWindowStart,
  hasTicketFilters,
  parseSortDirection,
  parseSortField,
  parseTicketFilters,
  scopeLabel,
  updateSearchParam,
  wasUpdatedSinceStandup
} from "../features/tickets/tickets-page-helpers";
import {
  getStoredAutoRunWorktreeSetup,
  getStoredLastStandupCompletedAt,
  setStoredLastStandupCompletedAt
} from "../lib/user-preferences";
import { ApiError } from "../lib/api-client";
import { isSearchFocused, isTypingTarget, parseTicketId } from "../features/tickets/url-state";

const EMPTY_BOARD_FILTERS: BoardFilters = {};
const panelClassName = "grid gap-4 rounded-[10px] border border-white/8 bg-canvas-925 px-5 py-5";
const softPanelClassName = "grid gap-3 rounded-[10px] border border-white/8 bg-canvas-925 px-4 py-4";
const listClassName = "overflow-hidden rounded-[10px] border border-white/8 bg-canvas-925";
const inputClassName =
  "min-h-10 rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2.5 text-sm text-ink-50 placeholder:text-ink-300";
const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 bg-canvas-950 px-3.5 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-canvas-900 disabled:cursor-progress disabled:opacity-70";
const primaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-accent-500/40 bg-accent-500 px-3.5 py-2 text-sm font-medium text-canvas-975 transition-colors hover:bg-accent-300 disabled:cursor-progress disabled:opacity-70";
const chipClassName = "inline-flex min-h-6 items-center rounded-[8px] border px-2 py-0.5 text-xs";
const filterButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 bg-canvas-950 px-3.5 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-canvas-900";

export function TicketsPage() {
  const { hasHost } = useAppHeader();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(() => parseTicketId(searchParams.get("ticketId")));
  const [editForm, setEditForm] = useState<TicketFormState>(createEmptyTicketForm());
  const [ticketSaveSuccessCount, setTicketSaveSuccessCount] = useState(0);
  const [filterHotkeySignal, setFilterHotkeySignal] = useState(0);
  const [dirtyWorktreesToConfirm, setDirtyWorktreesToConfirm] = useState<DirtyWorktreeDescriptor[]>([]);
  const [standupOnly, setStandupOnly] = useState(false);
  const [{ lastCompletedAt, standupWindowStart }, setStandupWindow] = useState(() => {
    const storedStandup = getStoredLastStandupCompletedAt();

    return {
      lastCompletedAt: storedStandup,
      standupWindowStart: storedStandup ?? getDefaultStandupWindowStart()
    };
  });
  const searchInputRef = useRef<HTMLInputElement>(null);

  const parsedFilters = parseTicketFilters(searchParams);
  const sortField = parseSortField(searchParams.get("sort"));
  const sortDirection = parseSortDirection(searchParams.get("dir"));
  const hasSavedStandup = lastCompletedAt !== null;
  const [searchInputValue, setSearchInputValue] = useState(parsedFilters.q ?? "");
  const deferredFilters = useDeferredValue({
    ...parsedFilters,
    q: searchInputValue.trim() || undefined
  });

  const boardColumnsQuery = useBoardColumnsQuery();
  const ticketsQuery = useTicketListQuery({
    ...deferredFilters,
    sort: sortField ?? undefined,
    dir: sortField ? sortDirection : undefined
  });
  const projectsQuery = useProjectsQuery();
  const selectedTicketQuery = useTicketQuery(selectedTicketId);
  const boardColumns = boardColumnsQuery.data?.columns ?? [];

  useEffect(() => {
    document.title = "Tickets · Boroda";
  }, []);

  useEffect(() => {
    if (selectedTicketQuery.data) {
      setEditForm(toTicketForm(selectedTicketQuery.data));
    }
  }, [selectedTicketQuery.data]);

  useEffect(() => {
    const nextSelectedTicketId = parseTicketId(searchParams.get("ticketId"));
    setSelectedTicketId((current) => (current === nextSelectedTicketId ? current : nextSelectedTicketId));
  }, [searchParams]);

  useEffect(() => {
    setSearchInputValue((current) => (current === (parsedFilters.q ?? "") ? current : parsedFilters.q ?? ""));
  }, [parsedFilters.q]);

  useEffect(() => {
    const currentTicketId = parseTicketId(searchParams.get("ticketId"));

    if (currentTicketId === selectedTicketId) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);

    if (selectedTicketId === null) {
      nextSearchParams.delete("ticketId");
    } else {
      nextSearchParams.set("ticketId", String(selectedTicketId));
    }

    setSearchParams(nextSearchParams, { replace: true });
  }, [searchParams, selectedTicketId, setSearchParams]);

  const projects = projectsQuery.data ?? [];
  const tickets = standupOnly
    ? (ticketsQuery.data?.items ?? []).filter((ticket) => wasUpdatedSinceStandup(ticket, standupWindowStart))
    : (ticketsQuery.data?.items ?? []);
  const boardJiraIssues = ticketsQuery.data?.meta.jiraIssues ?? [];
  const ticketFiltersApplied = hasTicketFilters(parsedFilters);
  const statusFilterKey = parsedFilters.status?.join(",") ?? "";
  const priorityFilterKey = parsedFilters.priority?.join(",") ?? "";
  const projectFilterKey = parsedFilters.projectId?.join(",") ?? "";
  const jiraFilterKey = parsedFilters.jiraIssue?.join(",") ?? "";
  const boardJiraIssuesKey = boardJiraIssues.join(",");
  const projectOptionsKey = projects.map((project) => `${project.id}:${project.name}`).join("|");

  const updateTicketMutation = useUpdateTicketMutation({
    ticketId: selectedTicketId,
    boardFilters: EMPTY_BOARD_FILTERS,
    onUpdated: (ticket) => {
      setEditForm(ticket);
      setTicketSaveSuccessCount((current) => current + 1);
    }
  });

  const deleteTicketMutation = useDeleteTicketMutation({
    ticketId: selectedTicketId,
    boardFilters: EMPTY_BOARD_FILTERS,
    onDeleted: () => {
      setSelectedTicketId(null);
    },
    onReset: (form) => {
      setEditForm(form);
    }
  });
  const unarchiveTicketMutation = useUnarchiveTicketMutation({
    ticketId: selectedTicketId,
    boardFilters: EMPTY_BOARD_FILTERS,
    onRestored: () => {
      setSelectedTicketId(null);
    }
  });

  const openTicketInAppMutation = useOpenTicketInAppMutation(selectedTicketId);
  const refreshTicketJiraLinksMutation = useRefreshTicketJiraLinksMutation(selectedTicketId);

  const actionError =
    updateTicketMutation.error?.message ??
    deleteTicketMutation.error?.message ??
    unarchiveTicketMutation.error?.message ??
    refreshTicketJiraLinksMutation.error?.message;

  const handleKeyboardShortcuts = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      return;
    }

    if (!isTypingTarget(event.target) && event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      setFilterHotkeySignal((current) => current + 1);
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();

      if (isSearchFocused(searchInputRef)) {
        searchInputRef.current?.blur();
        return;
      }

      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      return;
    }

    if (event.key === "Escape" && isSearchFocused(searchInputRef)) {
      event.preventDefault();
      searchInputRef.current?.blur();
      return;
    }

    if (isTypingTarget(event.target)) {
      return;
    }

    if (event.key === "/") {
      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      return;
    }

    if (event.key === "Escape" && selectedTicketId !== null) {
      event.preventDefault();
      setSelectedTicketId(null);
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboardShortcuts);
    return () => {
      window.removeEventListener("keydown", handleKeyboardShortcuts);
    };
  }, []);

  const updateFilters = (updater: (nextSearchParams: URLSearchParams) => void) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    updater(nextSearchParams);
    setSearchParams(nextSearchParams, { replace: true });
  };

  const clearTicketFilters = () => {
    updateFilters((nextSearchParams) => {
      nextSearchParams.delete("q");
      nextSearchParams.delete("status");
      nextSearchParams.delete("projectId");
      nextSearchParams.delete("priority");
      nextSearchParams.delete("jiraIssue");
      nextSearchParams.delete("scope");
    });
    setSearchInputValue("");
  };

  const clearFilters = () => {
    clearTicketFilters();
    setStandupOnly(false);
  };

  const handleSort = (field: TicketSortField) => {
    updateFilters((nextSearchParams) => {
      if (sortField !== field) {
        nextSearchParams.set("sort", field);
        nextSearchParams.set("dir", "asc");
        return;
      }

      if (sortDirection === "asc") {
        nextSearchParams.set("sort", field);
        nextSearchParams.set("dir", "desc");
        return;
      }

      nextSearchParams.delete("sort");
      nextSearchParams.delete("dir");
    });
  };

  const handleMarkStandupDone = useEffectEvent(() => {
    const completedAt = new Date().toISOString();
    setStoredLastStandupCompletedAt(completedAt);
    setStandupWindow({
      lastCompletedAt: completedAt,
      standupWindowStart: completedAt
    });
  });

  const renderSearchControl = () => (
    <label className="shrink-0">
      <span className="sr-only">Search</span>
      <input
        ref={searchInputRef}
        type="search"
        inputMode="search"
        name="ticketSearch"
        autoComplete="off"
        spellCheck={false}
        className={`${inputClassName} w-[18rem] transition-[width] duration-200 ease-out focus:w-[32rem] motion-reduce:transition-none`}
        placeholder="Search…"
        value={searchInputValue}
        onChange={(event) => {
          const value = event.target.value;
          setSearchInputValue(value);
          updateFilters((nextSearchParams) => {
            updateSearchParam(nextSearchParams, "q", value.trim() || undefined);
          });
        }}
      />
    </label>
  );

  const renderFilterControls = () => (
    <div className="flex shrink-0 items-center">
      <TicketFilterDropdown
        filters={parsedFilters}
        projects={projects}
        statuses={boardColumns}
        jiraIssues={boardJiraIssues}
        inputClassName={inputClassName}
        primaryButtonClassName={primaryButtonClassName}
        filterButtonClassName={filterButtonClassName}
        onUpdateFilters={updateFilters}
        onClearFilters={clearTicketFilters}
        hotkeySignal={filterHotkeySignal}
      />
    </div>
  );

  const renderHeaderActions = () => (
    <div className="flex min-w-0 items-center justify-center gap-2">
      {renderSearchControl()}
      {renderFilterControls()}
    </div>
  );

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col gap-4">
      <AppHeaderActions>{renderHeaderActions()}</AppHeaderActions>
      <AppHeaderRightActions>
        <>
          {standupOnly ? (
            <button type="button" className={primaryButtonClassName} onClick={handleMarkStandupDone}>
              Standup done
            </button>
          ) : null}
          <Link to="/settings" className={secondaryButtonClassName}>
            Settings
          </Link>
        </>
      </AppHeaderRightActions>

      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/8 pb-3">
        <div className="grid gap-1">
          <h1 className="m-0 text-base font-semibold text-ink-50">Tickets</h1>
          <p className="m-0 text-sm text-ink-300">
            {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"} in {scopeLabel(parsedFilters.scope ?? "active").toLowerCase()}
            {standupOnly ? ` · ${formatStandupWindowLabel(standupWindowStart, hasSavedStandup)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Ticket scope">
          {(["active", "archived", "all"] as const).map((scope) => (
            <button
              key={scope}
              type="button"
              role="tab"
              aria-selected={(parsedFilters.scope ?? "active") === scope}
              className={(parsedFilters.scope ?? "active") === scope ? primaryButtonClassName : secondaryButtonClassName}
              onClick={() => {
                updateFilters((nextSearchParams) => {
                  updateSearchParam(nextSearchParams, "scope", scope, "active");
                });
              }}
            >
              {scopeLabel(scope)}
            </button>
          ))}
          <button
            type="button"
            className={standupOnly ? primaryButtonClassName : secondaryButtonClassName}
            aria-pressed={standupOnly}
            onClick={() => {
              setStandupOnly((current) => !current);
            }}
          >
            For standup
          </button>
        </div>
      </div>

      {actionError ? (
        <p className={`${softPanelClassName} m-0 text-sm text-danger-400`} role="alert">
          {actionError}
        </p>
      ) : null}

      {!hasHost ? (
        <section className={`${softPanelClassName} grid-cols-[minmax(0,1fr)_auto] items-center gap-3`}>
          {renderSearchControl()}
          {renderFilterControls()}
        </section>
      ) : null}

      {ticketsQuery.isLoading && ticketsQuery.data === undefined ? (
        <p className={`${softPanelClassName} m-0 text-sm text-ink-50`}>Loading tickets…</p>
      ) : null}
      {ticketsQuery.isError ? (
        <section className={`${panelClassName} h-full content-start`} aria-live="polite">
          <h2 className="m-0 text-lg font-semibold text-ink-50">Tickets request failed</h2>
          <p className="m-0 max-w-[48rem] text-sm text-ink-200">
            The ticket list could not be loaded. Retry the request or inspect the local API logs.
          </p>
          <div className="flex flex-wrap gap-3">
            <button className={primaryButtonClassName} type="button" onClick={() => void ticketsQuery.refetch()}>
              Retry tickets
            </button>
          </div>
        </section>
      ) : null}

      {!ticketsQuery.isLoading && !ticketsQuery.isError && tickets.length === 0 ? (
        <section className={`${panelClassName} h-full content-start`} aria-live="polite">
          <h2 className="m-0 text-lg font-semibold text-ink-50">
            {ticketFiltersApplied ? "No tickets match these filters" : standupOnly ? "No tickets updated for standup" : "No tickets available"}
          </h2>
          <p className="m-0 max-w-[44rem] text-sm text-ink-200">
            {ticketFiltersApplied
              ? "Clear the current filters or switch scope to review a different slice of work."
              : standupOnly
                ? "Turn off standup mode or switch scope to review a different slice of work."
              : "Create a ticket from the board or import your local sample data to populate the list."}
          </p>
          {ticketFiltersApplied ? (
            <div className="flex flex-wrap gap-3">
              <button type="button" className={secondaryButtonClassName} onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {!ticketsQuery.isLoading && !ticketsQuery.isError && tickets.length > 0 ? (
        <section className={`${listClassName} min-h-0 min-w-0 flex-1 overflow-auto`}>
          <div className="grid min-w-[72rem] grid-cols-[minmax(0,2.3fr)_minmax(0,1.1fr)_10rem_9rem_minmax(0,1.6fr)_10rem] gap-3 border-b border-white/8 px-4 py-3 text-xs text-ink-300">
            <ColumnHeader
              label="Ticket"
              sortField="ticket"
              currentSortField={sortField}
              currentSortDirection={sortDirection}
              onSort={handleSort}
            />
            <ColumnHeader
              label="Jira"
              sortField="jira"
              currentSortField={sortField}
              currentSortDirection={sortDirection}
              onSort={handleSort}
            />
            <ColumnHeader
              label="Status"
              sortField="status"
              currentSortField={sortField}
              currentSortDirection={sortDirection}
              onSort={handleSort}
            />
            <ColumnHeader
              label="Priority"
              sortField="priority"
              currentSortField={sortField}
              currentSortDirection={sortDirection}
              onSort={handleSort}
            />
            <ColumnHeader
              label="Projects"
              sortField="projects"
              currentSortField={sortField}
              currentSortDirection={sortDirection}
              onSort={handleSort}
            />
            <ColumnHeader
              label="Last change"
              sortField="updated"
              currentSortField={sortField}
              currentSortDirection={sortDirection}
              onSort={handleSort}
            />
          </div>
          <ul className="m-0 min-w-[72rem] list-none p-0">
            {tickets.map((ticket) => {
              const selected = ticket.id === selectedTicketId;

              return (
                <li key={ticket.id} className="border-t border-white/8 first:border-t-0">
                  <button
                    type="button"
                    className={`grid w-full min-w-[72rem] grid-cols-[minmax(0,2.3fr)_minmax(0,1.1fr)_10rem_9rem_minmax(0,1.6fr)_10rem] gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink-50 ${selected ? "bg-white/[0.03]" : ""}`}
                    aria-pressed={selected}
                    aria-label={`Open ticket ${ticket.key} ${ticket.title}`}
                    onClick={() => {
                      setSelectedTicketId(ticket.id);
                    }}
                  >
                    <div className="min-w-0 grid gap-1">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="shrink-0 font-mono text-sm tabular-nums text-ink-200">{ticket.key}</span>
                        <span className="truncate text-sm font-medium text-ink-50">{ticket.title}</span>
                      </div>
                      <div className="text-xs text-ink-300">{ticket.archivedAt ? "Archived ticket" : "Current ticket"}</div>
                    </div>
                    <div className="min-w-0 text-sm text-ink-200">
                      <span className="block truncate">
                        {ticket.jiraIssues.length
                          ? ticket.jiraIssues.map((issue) => issue.key).join(", ")
                          : "No Jira links"}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className={`${chipClassName} border-white/10 text-ink-200`}>
                        {boardColumns.find((column) => column.status === ticket.status)?.label ?? formatStatusLabel(ticket.status)}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className={`${chipClassName} border-white/10 text-ink-200`}>{ticket.priority}</span>
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-2">
                      {ticket.projectBadges.length ? (
                        ticket.projectBadges.map((project) => <ProjectChip key={project.id} project={project} />)
                      ) : (
                        <span className="text-sm text-ink-300">No projects</span>
                      )}
                    </div>
                    <div className="text-sm text-ink-300">{formatLastChange(ticket)}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <TicketDrawer
        ticketId={selectedTicketId}
        ticket={selectedTicketQuery.data}
        statuses={boardColumns}
        isLoading={selectedTicketQuery.isLoading}
        isError={selectedTicketQuery.isError}
        form={editForm}
        projects={projects}
        isSaving={updateTicketMutation.isPending}
        saveSuccessCount={ticketSaveSuccessCount}
        isArchiving={deleteTicketMutation.isPending}
        isRestoring={unarchiveTicketMutation.isPending}
        isOpeningInApp={openTicketInAppMutation.isPending}
        isRefreshingJira={refreshTicketJiraLinksMutation.isPending}
        onChange={(updater) => {
          setEditForm((current) => updater(current));
        }}
        onSave={() => {
          updateTicketMutation.mutate(toTicketPayload(editForm));
        }}
        onArchive={() => {
          void (async () => {
            try {
              await deleteTicketMutation.mutateAsync(undefined);
            } catch (error) {
              if (!(error instanceof ApiError) || error.code !== "TICKET_ARCHIVE_DIRTY_WORKTREES") {
                return;
              }

              const dirtyWorktrees = extractDirtyWorktrees(error.details);
              if (!dirtyWorktrees.length) {
                return;
              }

              setDirtyWorktreesToConfirm(dirtyWorktrees);
            }
          })();
        }}
        onRestore={() => {
          unarchiveTicketMutation.mutate();
        }}
        onOpenInApp={async (target, mode, folderId, workspaceId) => {
          const runSetup = getStoredAutoRunWorktreeSetup();
          await openTicketInAppMutation.mutateAsync(
            folderId === undefined
              ? { target, mode, runSetup }
              : workspaceId === undefined
                ? { target, mode, folderId, runSetup }
                : { target, mode, folderId, workspaceId, runSetup }
          );
        }}
        onRefreshJira={() => {
          refreshTicketJiraLinksMutation.mutate();
        }}
        onClose={() => {
          setSelectedTicketId(null);
        }}
      />

      <ArchiveWorktreeDialog
        open={dirtyWorktreesToConfirm.length > 0}
        worktrees={dirtyWorktreesToConfirm}
        isDeleting={deleteTicketMutation.isPending}
        onCancel={() => {
          if (deleteTicketMutation.isPending) {
            return;
          }

          setDirtyWorktreesToConfirm([]);
        }}
        onConfirm={() => {
          void (async () => {
            await deleteTicketMutation.mutateAsync({ force: true });
            setDirtyWorktreesToConfirm([]);
          })();
        }}
      />
    </section>
  );
}
