import { useDeferredValue, useEffect, useEffectEvent, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { BoardView } from "../components/board/board-view";
import {
  createEmptyQuickTicketForm,
  QuickTicketForm,
  type QuickTicketFormState
} from "../components/board/quick-ticket-form";
import { TicketDrawer } from "../components/ticket/ticket-drawer";
import { ModalDialog } from "../components/ui/modal-dialog";
import { OverflowMenu } from "../components/ui/overflow-menu";
import { useAppHeader } from "../app/router";
import { useBoardQuery, type BoardFilters } from "../features/board/queries";
import { useProjectsQuery } from "../features/projects/queries";
import {
  createEmptyTicketForm,
  toTicketForm,
  toTicketPayload,
  type TicketFormState
} from "../features/tickets/form";
import {
  useCreateTicketMutation,
  useDeleteTicketMutation,
  useMoveTicketStatusMutation,
  useOpenTicketInAppMutation,
  useRefreshTicketJiraLinksMutation,
  useUpdateTicketMutation
} from "../features/tickets/mutations";
import { useTicketQuery } from "../features/tickets/queries";
import { TICKET_PRIORITIES } from "../lib/constants";

const EMPTY_BOARD_FILTERS: BoardFilters = {};
const panelClassName =
  "grid gap-4 rounded-[10px] border border-white/8 bg-canvas-925 px-5 py-5";
const softPanelClassName =
  "grid gap-3 rounded-[10px] border border-white/8 bg-canvas-925 px-4 py-4";
const inputClassName =
  "min-h-10 rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2.5 text-sm text-ink-50 placeholder:text-ink-300";
const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 bg-canvas-950 px-3.5 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-canvas-900 disabled:cursor-progress disabled:opacity-70";
const primaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-accent-500/40 bg-accent-500 px-3.5 py-2 text-sm font-medium text-canvas-975 transition-colors hover:bg-accent-300 disabled:cursor-progress disabled:opacity-70";

function hasBoardFilters(filters: BoardFilters) {
  return Boolean(filters.projectId || filters.priority || filters.q?.trim());
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function isSearchFocused(searchInputRef: React.RefObject<HTMLInputElement | null>) {
  return document.activeElement === searchInputRef.current;
}

function toQuickCreatePayload(form: QuickTicketFormState) {
  return {
    title: form.title.trim(),
    description: "",
    branch: null,
    workspaces: [],
    jiraIssues: [],
    status: form.status,
    priority: form.priority,
    dueAt: null,
    projectLinks: form.projectId
      ? [{ projectId: Number(form.projectId), relationship: "PRIMARY" as const }]
      : []
  };
}

function parseTicketId(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function BoardPage() {
  const { setActions, setRightActions, hasHost } = useAppHeader();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [boardFilters, setBoardFilters] = useState<BoardFilters>(EMPTY_BOARD_FILTERS);
  const [quickCreateForm, setQuickCreateForm] = useState<QuickTicketFormState>(createEmptyQuickTicketForm());
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(() => parseTicketId(searchParams.get("ticketId")));
  const [editForm, setEditForm] = useState<TicketFormState>(createEmptyTicketForm());
  const [ticketSaveSuccessCount, setTicketSaveSuccessCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickCreateTitleRef = useRef<HTMLInputElement>(null);
  const deferredBoardFilters = useDeferredValue(boardFilters);

  const boardQuery = useBoardQuery(deferredBoardFilters);
  const projectsQuery = useProjectsQuery();
  const selectedTicketQuery = useTicketQuery(selectedTicketId);

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

  useEffect(() => {
    queryClient.removeQueries({
      queryKey: ["board"],
      type: "inactive"
    });
  }, [deferredBoardFilters, queryClient]);

  const createTicketMutation = useCreateTicketMutation({
    boardFilters: deferredBoardFilters,
    onCreated: (ticket) => {
      setIsQuickCreateOpen(false);
      setSelectedTicketId(ticket.id);
    },
    onReset: () => {
      setQuickCreateForm(createEmptyQuickTicketForm());
    }
  });

  const updateTicketMutation = useUpdateTicketMutation({
    ticketId: selectedTicketId,
    boardFilters: deferredBoardFilters,
    onUpdated: (ticket) => {
      setEditForm(ticket);
      setTicketSaveSuccessCount((current) => current + 1);
    }
  });

  const deleteTicketMutation = useDeleteTicketMutation({
    ticketId: selectedTicketId,
    boardFilters: deferredBoardFilters,
    onDeleted: () => {
      setSelectedTicketId(null);
    },
    onReset: (form) => {
      setEditForm(form);
    }
  });

  const moveTicketStatusMutation = useMoveTicketStatusMutation({
    boardFilters: deferredBoardFilters,
    onMoved: (ticketId, status) => {
      if (selectedTicketId === ticketId) {
        setEditForm((current) => ({
          ...current,
          status
        }));
      }
    }
  });
  const openTicketInAppMutation = useOpenTicketInAppMutation(selectedTicketId);
  const refreshTicketJiraLinksMutation = useRefreshTicketJiraLinksMutation(selectedTicketId);

  const actionError =
    createTicketMutation.error?.message ??
    updateTicketMutation.error?.message ??
    deleteTicketMutation.error?.message ??
    openTicketInAppMutation.error?.message ??
    refreshTicketJiraLinksMutation.error?.message ??
    moveTicketStatusMutation.error?.message;

  const columns = boardQuery.data?.columns ?? [];
  const projects = projectsQuery.data ?? [];
  const totalTickets = columns.reduce((count, column) => count + column.tickets.length, 0);
  const boardHasFilters = hasBoardFilters(boardFilters);

  const handleKeyboardShortcuts = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented) {
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

    if (event.key.toLowerCase() === "c") {
      event.preventDefault();
      setIsQuickCreateOpen(true);
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

  useEffect(() => {
    const filtersButtonLabel = boardHasFilters ? "Filters applied" : "Filters";

    setActions(
      <>
        <label className="min-w-0 flex-1 basis-[18rem] max-w-[32rem]">
          <span className="sr-only">Search</span>
          <input
            ref={searchInputRef}
            className={`${inputClassName} w-[18rem] transition-[width] duration-200 ease-out focus:w-[32rem] motion-reduce:transition-none`}
            placeholder="Search…"
            value={boardFilters.q ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              setBoardFilters((current) => ({
                ...current,
                q: value || undefined
              }));
            }}
          />
        </label>
        <OverflowMenu
          buttonLabel={filtersButtonLabel}
          buttonText={filtersButtonLabel}
          buttonClassName={secondaryButtonClassName}
          menuClassName="absolute top-[calc(100%+0.5rem)] z-30 grid min-w-[280px] gap-3 rounded-[10px] border border-white/8 bg-canvas-925 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.24)]"
        >
          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink-100">Project</span>
            <select
              className={inputClassName}
              aria-label="Project"
              value={boardFilters.projectId ? String(boardFilters.projectId) : ""}
              onChange={(event) => {
                const value = event.target.value;
                setBoardFilters((current) => ({
                  ...current,
                  projectId: value ? Number(value) : undefined
                }));
              }}
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-ink-100">Priority</span>
            <select
              className={inputClassName}
              aria-label="Priority"
              value={boardFilters.priority ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setBoardFilters((current) => ({
                  ...current,
                  priority: value ? (value as BoardFilters["priority"]) : undefined
                }));
              }}
            >
              <option value="">All priorities</option>
              {TICKET_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          {boardHasFilters ? (
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => {
                setBoardFilters(EMPTY_BOARD_FILTERS);
              }}
            >
              Clear filters
            </button>
          ) : null}
        </OverflowMenu>
        <button
          type="button"
          className={primaryButtonClassName}
          onClick={() => {
            setIsQuickCreateOpen(true);
          }}
        >
          Create
        </button>
      </>
    );
    setRightActions(
      <Link to="/settings" className={secondaryButtonClassName}>
        Settings
      </Link>
    );

    return () => {
      setActions(null);
      setRightActions(null);
    };
  }, [
    boardFilters.priority,
    boardFilters.projectId,
    boardFilters.q,
    boardHasFilters,
    inputClassName,
    projects,
    setActions,
    setRightActions
  ]);

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col gap-4">
      {actionError ? (
        <p className={`${softPanelClassName} m-0 text-sm text-danger-400`} role="alert">
          {actionError}
        </p>
      ) : null}

      {!hasHost ? (
        <section className={`${softPanelClassName} grid-cols-[minmax(0,1fr)_auto] items-center gap-3`}>
          <label className="min-w-0">
            <span className="sr-only">Search</span>
            <input
              ref={searchInputRef}
              className={`${inputClassName} transition-[width] duration-200 ease-out focus:w-[32rem] motion-reduce:transition-none`}
              placeholder="Search…"
              value={boardFilters.q ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setBoardFilters((current) => ({
                  ...current,
                  q: value || undefined
                }));
              }}
            />
          </label>
          <OverflowMenu
            buttonLabel={boardHasFilters ? "Filters applied" : "Filters"}
            buttonText={boardHasFilters ? "Filters applied" : "Filters"}
            buttonClassName={secondaryButtonClassName}
            menuClassName="absolute top-[calc(100%+0.5rem)] right-0 z-30 grid min-w-[280px] gap-3 rounded-[10px] border border-white/8 bg-canvas-925 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.24)]"
          >
            <label className="grid gap-2">
              <span className="text-sm font-medium text-ink-100">Project</span>
              <select
                className={inputClassName}
                aria-label="Project"
                value={boardFilters.projectId ? String(boardFilters.projectId) : ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setBoardFilters((current) => ({
                    ...current,
                    projectId: value ? Number(value) : undefined
                  }));
                }}
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-ink-100">Priority</span>
              <select
                className={inputClassName}
                aria-label="Priority"
                value={boardFilters.priority ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setBoardFilters((current) => ({
                    ...current,
                    priority: value ? (value as BoardFilters["priority"]) : undefined
                  }));
                }}
              >
                <option value="">All priorities</option>
                {TICKET_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
            {boardHasFilters ? (
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  setBoardFilters(EMPTY_BOARD_FILTERS);
                }}
              >
                Clear filters
              </button>
            ) : null}
          </OverflowMenu>
        </section>
      ) : null}

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden w-full">
        {boardQuery.isLoading ? <p className={`${softPanelClassName} m-0 text-sm text-ink-50`}>Loading board…</p> : null}
        {boardQuery.isError ? (
          <section className={`${panelClassName} h-full content-start`} aria-live="polite">
            <h3 className="m-0 text-lg font-semibold text-ink-50">Board request failed</h3>
            <p className="m-0 max-w-[48rem] text-sm text-ink-200">
              The board could not be loaded. Retry the request or export the local database before troubleshooting.
            </p>
            <div className="flex flex-wrap gap-3">
              <button className={primaryButtonClassName} type="button" onClick={() => void boardQuery.refetch()}>
                Retry board
              </button>
            </div>
          </section>
        ) : null}
        {!boardQuery.isLoading && !boardQuery.isError && totalTickets === 0 ? (
          <section className={`${panelClassName} h-full content-start`} aria-live="polite">
            <h3 className="m-0 text-lg font-semibold text-ink-50">
              {boardHasFilters ? "No tickets match these filters" : "No tickets on the board yet"}
            </h3>
            <p className="m-0 max-w-[44rem] text-sm text-ink-200">
              {boardHasFilters
                ? "Clear the current filters or create a ticket that matches them."
                : "Create a ticket from the dialog or load the sample seed data for local testing."}
            </p>
            <div className="flex flex-wrap gap-3">
              {boardHasFilters ? (
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() => {
                    setBoardFilters(EMPTY_BOARD_FILTERS);
                  }}
                >
                  Clear filters
                </button>
              ) : null}
              <button
                className={primaryButtonClassName}
                type="button"
                onClick={() => {
                  setIsQuickCreateOpen(true);
                }}
              >
                Create ticket
              </button>
            </div>
          </section>
        ) : null}

        {!boardQuery.isLoading && !boardQuery.isError && totalTickets > 0 ? (
          <BoardView
            columns={columns}
            selectedTicketId={selectedTicketId}
            onSelectTicket={setSelectedTicketId}
            onMoveTicket={(ticketId, status) => {
              moveTicketStatusMutation.mutate({ ticketId, status });
            }}
          />
        ) : null}
      </div>

      <ModalDialog
        open={isQuickCreateOpen}
        title="Create ticket"
        onClose={() => {
          setIsQuickCreateOpen(false);
        }}
        initialFocusRef={quickCreateTitleRef}
        variant="flat"
        showHeader={false}
        showCloseButton={false}
      >
        <QuickTicketForm
          form={quickCreateForm}
          projects={projects}
          isSubmitting={createTicketMutation.isPending}
          titleInputRef={quickCreateTitleRef}
          onChange={(updater) => {
            setQuickCreateForm((current) => updater(current));
          }}
          onSubmit={() => {
            createTicketMutation.mutate(toQuickCreatePayload(quickCreateForm));
          }}
          onCancel={() => {
            setIsQuickCreateOpen(false);
          }}
        />
      </ModalDialog>

      <TicketDrawer
        ticketId={selectedTicketId}
        ticket={selectedTicketQuery.data}
        isLoading={selectedTicketQuery.isLoading}
        isError={selectedTicketQuery.isError}
        form={editForm}
        projects={projects}
        isSaving={updateTicketMutation.isPending}
        saveSuccessCount={ticketSaveSuccessCount}
        isDeleting={deleteTicketMutation.isPending}
        isOpeningInApp={openTicketInAppMutation.isPending}
        isRefreshingJira={refreshTicketJiraLinksMutation.isPending}
        onChange={(updater) => {
          setEditForm((current) => updater(current));
        }}
        onSave={() => {
          updateTicketMutation.mutate(toTicketPayload(editForm));
        }}
        onDelete={() => {
          deleteTicketMutation.mutate();
        }}
        onOpenInApp={(target, folderId) => {
          openTicketInAppMutation.mutate(folderId === undefined ? { target } : { target, folderId });
        }}
        onRefreshJira={() => {
          refreshTicketJiraLinksMutation.mutate();
        }}
        onClose={() => {
          setSelectedTicketId(null);
        }}
      />
    </section>
  );
}
