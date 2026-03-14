import { useDeferredValue, useEffect, useEffectEvent, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArchiveWorktreeDialog, extractDirtyWorktrees, type DirtyWorktreeDescriptor } from "../components/ticket/archive-worktree-dialog";
import { TicketDrawer } from "../components/ticket/ticket-drawer";
import { TicketList } from "../components/ticket/ticket-list";
import { TicketListEmptyState, TicketListErrorState, TicketListLoadingState } from "../components/ticket/ticket-list-states";
import { PageCommandBar } from "../components/ui/page-command-bar";
import { PageSearchInput } from "../components/ui/page-search-input";
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
  TicketFilterDropdown,
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
import { parseTicketId, usePageSearchHotkeys } from "../features/tickets/url-state";

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

  usePageSearchHotkeys({
    searchInputRef,
    onOpenFilters: () => {
      setFilterHotkeySignal((current) => current + 1);
    },
    onEscape: () => {
      if (selectedTicketId !== null) {
        setSelectedTicketId(null);
      }
    }
  });

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

  const searchControl = (
    <PageSearchInput
      inputRef={searchInputRef}
      inputClassName={inputClassName}
      name="ticketSearch"
      value={searchInputValue}
      onChange={(value) => {
        setSearchInputValue(value);
        updateFilters((nextSearchParams) => {
          updateSearchParam(nextSearchParams, "q", value.trim() || undefined);
        });
      }}
    />
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
      {searchControl}
      {renderFilterControls()}
    </div>
  );

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col gap-4">
      <PageCommandBar
        actions={renderHeaderActions()}
        rightActions={
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
        }
        fallback={
          <section className={`${softPanelClassName} grid-cols-[minmax(0,1fr)_auto] items-center gap-3`}>
            {searchControl}
            {renderFilterControls()}
          </section>
        }
      />

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

      {ticketsQuery.isLoading && ticketsQuery.data === undefined ? (
        <TicketListLoadingState className={softPanelClassName} />
      ) : null}
      {ticketsQuery.isError ? (
        <TicketListErrorState
          className={panelClassName}
          primaryButtonClassName={primaryButtonClassName}
          onRetry={() => {
            void ticketsQuery.refetch();
          }}
        />
      ) : null}

      {!ticketsQuery.isLoading && !ticketsQuery.isError && tickets.length === 0 ? (
        <TicketListEmptyState
          className={panelClassName}
          ticketFiltersApplied={ticketFiltersApplied}
          standupOnly={standupOnly}
          secondaryButtonClassName={secondaryButtonClassName}
          onClearFilters={clearFilters}
        />
      ) : null}

      {!ticketsQuery.isLoading && !ticketsQuery.isError && tickets.length > 0 ? (
        <TicketList
          tickets={tickets}
          selectedTicketId={selectedTicketId}
          sortField={sortField}
          sortDirection={sortDirection}
          boardColumns={boardColumns}
          listClassName={listClassName}
          chipClassName={chipClassName}
          onSort={handleSort}
          onSelectTicket={setSelectedTicketId}
        />
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
