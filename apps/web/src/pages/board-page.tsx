import { useDeferredValue, useEffect, useEffectEvent, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { BoardView } from "../components/board/board-view";
import {
  createEmptyQuickTicketForm,
  QuickTicketForm,
  type QuickTicketFormState
} from "../components/board/quick-ticket-form";
import { ArchiveWorktreeDialog, extractDirtyWorktrees, type DirtyWorktreeDescriptor } from "../components/ticket/archive-worktree-dialog";
import { TicketDrawer } from "../components/ticket/ticket-drawer";
import { SectionedFilterDropdown } from "../components/ui/sectioned-filter-dropdown";
import { ModalDialog } from "../components/ui/modal-dialog";
import { useAppHeader } from "../app/router";
import { BoardFilterDropdown, hasBoardFilters, toQuickCreatePayload } from "../features/board/board-page-helpers";
import {
  useCreateBoardColumnMutation,
  useDeleteBoardColumnMutation,
  useRenameBoardColumnMutation
} from "../features/board/mutations";
import { useBoardColumnsQuery, useBoardQuery, type BoardFilters } from "../features/board/queries";
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
import { DEFAULT_BOARD_STATUS, TICKET_PRIORITIES } from "../lib/constants";
import { ApiError } from "../lib/api-client";
import { getStoredAutoRunWorktreeSetup } from "../lib/user-preferences";
import { isSearchFocused, isTypingTarget, parseTicketId } from "../features/tickets/url-state";

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

export function BoardPage() {
  const { setActions, setRightActions, hasHost } = useAppHeader();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [boardFilters, setBoardFilters] = useState<BoardFilters>(EMPTY_BOARD_FILTERS);
  const [quickCreateForm, setQuickCreateForm] = useState<QuickTicketFormState>(createEmptyQuickTicketForm());
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [columnDialogState, setColumnDialogState] = useState<
    | { mode: "create"; relativeToStatus: string; placement: "before" | "after" }
    | { mode: "rename"; status: string; label: string }
    | null
  >(null);
  const [newColumnLabel, setNewColumnLabel] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(() => parseTicketId(searchParams.get("ticketId")));
  const [editForm, setEditForm] = useState<TicketFormState>(createEmptyTicketForm());
  const [ticketSaveSuccessCount, setTicketSaveSuccessCount] = useState(0);
  const [dirtyWorktreesToConfirm, setDirtyWorktreesToConfirm] = useState<DirtyWorktreeDescriptor[]>([]);
  const [filterHotkeySignal, setFilterHotkeySignal] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickCreateTitleRef = useRef<HTMLInputElement>(null);
  const deferredBoardFilters = useDeferredValue(boardFilters);

  const boardQuery = useBoardQuery(deferredBoardFilters);
  const boardColumnsQuery = useBoardColumnsQuery();
  const projectsQuery = useProjectsQuery();
  const selectedTicketQuery = useTicketQuery(selectedTicketId);
  const createBoardColumnMutation = useCreateBoardColumnMutation();
  const deleteBoardColumnMutation = useDeleteBoardColumnMutation();
  const renameBoardColumnMutation = useRenameBoardColumnMutation();
  const boardColumns = boardColumnsQuery.data?.columns ?? boardQuery.data?.columns.map((column) => ({
    id: 0,
    status: column.status,
    label: column.label,
    position: 0,
    createdAt: "",
    updatedAt: ""
  })) ?? [];
  const defaultBoardStatus = boardColumns[0]?.status ?? DEFAULT_BOARD_STATUS;

  useEffect(() => {
    document.title = "Boroda";
  }, []);

  useEffect(() => {
    if (selectedTicketQuery.data) {
      setEditForm(toTicketForm(selectedTicketQuery.data));
    }
  }, [selectedTicketQuery.data]);

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
      setQuickCreateForm(createEmptyQuickTicketForm(defaultBoardStatus));
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
    createBoardColumnMutation.error?.message ??
    renameBoardColumnMutation.error?.message ??
    deleteBoardColumnMutation.error?.message ??
    createTicketMutation.error?.message ??
    updateTicketMutation.error?.message ??
    deleteTicketMutation.error?.message ??
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
    const renderSearchControl = () => (
      <label className="shrink-0">
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
    );

    const renderHeaderActions = () => (
      <div className="flex min-w-0 items-center justify-center gap-2">
        {renderSearchControl()}
        <BoardFilterDropdown
          filters={boardFilters}
          projects={projects}
          inputClassName={inputClassName}
          primaryButtonClassName={primaryButtonClassName}
          secondaryButtonClassName={secondaryButtonClassName}
          onUpdateFilters={setBoardFilters}
          onClearFilters={() => {
            setBoardFilters(EMPTY_BOARD_FILTERS);
          }}
          hotkeySignal={filterHotkeySignal}
        />
        <button
          type="button"
          className={primaryButtonClassName}
          onClick={() => {
            setIsQuickCreateOpen(true);
          }}
        >
          Create
        </button>
      </div>
    );

    setActions(
      renderHeaderActions()
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
    filterHotkeySignal,
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
          <label className="shrink-0">
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
          <div className="flex items-center gap-2">
            <BoardFilterDropdown
              filters={boardFilters}
              projects={projects}
              inputClassName={inputClassName}
              primaryButtonClassName={primaryButtonClassName}
              secondaryButtonClassName={secondaryButtonClassName}
              onUpdateFilters={setBoardFilters}
              onClearFilters={() => {
                setBoardFilters(EMPTY_BOARD_FILTERS);
              }}
              hotkeySignal={filterHotkeySignal}
            />
            <button
              type="button"
              className={primaryButtonClassName}
              onClick={() => {
                setIsQuickCreateOpen(true);
              }}
            >
              Create
            </button>
          </div>
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
                : "Create a ticket from the dialog, add a board column, or load the sample seed data for local testing."}
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
              {columns[0] ? (
                <button
                  className={secondaryButtonClassName}
                  type="button"
                  onClick={() => {
                    setColumnDialogState({
                      mode: "create",
                      relativeToStatus: columns[0].status,
                      placement: "before"
                    });
                  }}
                >
                  Add column
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {!boardQuery.isLoading && !boardQuery.isError && columns.length > 0 ? (
          <BoardView
            columns={columns}
            selectedTicketId={selectedTicketId}
            onSelectTicket={setSelectedTicketId}
            onMoveTicket={(ticketId, status) => {
              moveTicketStatusMutation.mutate({ ticketId, status });
            }}
            onAddColumn={(relativeToStatus, placement) => {
              setColumnDialogState({ mode: "create", relativeToStatus, placement });
              setNewColumnLabel("");
            }}
            onRenameColumn={(status, label) => {
              setColumnDialogState({ mode: "rename", status, label });
              setNewColumnLabel(label);
            }}
            onDeleteColumn={(status) => {
              deleteBoardColumnMutation.mutate(status);
            }}
            isColumnMutationPending={
              createBoardColumnMutation.isPending || renameBoardColumnMutation.isPending || deleteBoardColumnMutation.isPending
            }
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
          statuses={boardColumns}
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

      <ModalDialog
        open={columnDialogState !== null}
        title={columnDialogState?.mode === "rename" ? "Rename board column" : "Add board column"}
        onClose={() => {
          if (createBoardColumnMutation.isPending || renameBoardColumnMutation.isPending) {
            return;
          }

          setColumnDialogState(null);
          setNewColumnLabel("");
        }}
        variant="flat"
        showHeader={false}
        showCloseButton={false}
      >
        <div className="grid gap-4 px-5 py-4 sm:px-6 sm:py-5">
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();

              if (!columnDialogState) {
                return;
              }

              if (columnDialogState.mode === "rename") {
                renameBoardColumnMutation.mutate(
                  {
                    status: columnDialogState.status,
                    label: newColumnLabel.trim()
                  },
                  {
                    onSuccess: () => {
                      setColumnDialogState(null);
                      setNewColumnLabel("");
                    }
                  }
                );
                return;
              }

              createBoardColumnMutation.mutate(
                {
                  relativeToStatus: columnDialogState.relativeToStatus,
                  placement: columnDialogState.placement,
                  label: newColumnLabel.trim()
                },
                {
                  onSuccess: () => {
                    setColumnDialogState(null);
                    setNewColumnLabel("");
                  }
                }
              );
            }}
          >
            <input
              aria-label="Column name"
              className={inputClassName}
              value={newColumnLabel}
              onChange={(event) => {
                setNewColumnLabel(event.target.value);
              }}
              placeholder="Needs QA…"
              autoFocus
              required
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => {
                  setColumnDialogState(null);
                  setNewColumnLabel("");
                }}
                disabled={createBoardColumnMutation.isPending || renameBoardColumnMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={primaryButtonClassName}
                disabled={
                  createBoardColumnMutation.isPending ||
                  renameBoardColumnMutation.isPending ||
                  newColumnLabel.trim().length === 0
                }
              >
                {createBoardColumnMutation.isPending
                  ? "Adding…"
                  : renameBoardColumnMutation.isPending
                    ? "Saving…"
                    : columnDialogState?.mode === "rename"
                      ? "Save"
                      : "Add column"}
              </button>
            </div>
          </form>
        </div>
      </ModalDialog>

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
        isRestoring={false}
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
        onRestore={() => {}}
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
