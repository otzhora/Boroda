import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
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
  useUpdateTicketMutation
} from "../features/tickets/mutations";
import { useTicketQuery } from "../features/tickets/queries";
import { apiClient, apiClientBlob } from "../lib/api-client";
import { TICKET_PRIORITIES } from "../lib/constants";

const EMPTY_BOARD_FILTERS: BoardFilters = {};
const panelClassName =
  "grid gap-5 rounded-[24px] border border-white/10 bg-white/5 px-5 py-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl";
const softPanelClassName =
  "grid gap-3 rounded-[24px] border border-white/10 bg-white/5 px-5 py-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl";
const toolbarClassName =
  "sticky top-12 z-30 grid gap-2 border-b border-white/10 bg-[rgba(22,18,15,0.94)] py-2 backdrop-blur-xl";
const fieldClassName = "grid gap-2";
const labelClassName = "m-0 text-xs font-medium uppercase tracking-[0.08em] text-ink-200";
const inputClassName =
  "min-h-10 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-ink-50 placeholder:text-ink-200/65";
const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-ink-50 transition-colors hover:border-white/20 hover:bg-white/10 disabled:cursor-progress disabled:opacity-70";
const primaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-xl bg-accent-700 px-3.5 py-2 text-sm font-medium text-canvas-950 transition-opacity disabled:cursor-progress disabled:opacity-70";

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

function toQuickCreatePayload(form: QuickTicketFormState) {
  return {
    title: form.title.trim(),
    description: "",
    status: form.status,
    priority: form.priority,
    type: form.type,
    dueAt: null,
    projectLinks: form.projectId
      ? [{ projectId: Number(form.projectId), relationship: "PRIMARY" as const }]
      : []
  };
}

export function BoardPage() {
  const { setActions } = useAppHeader();
  const queryClient = useQueryClient();
  const [boardFilters, setBoardFilters] = useState<BoardFilters>(EMPTY_BOARD_FILTERS);
  const [quickCreateForm, setQuickCreateForm] = useState<QuickTicketFormState>(createEmptyQuickTicketForm());
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TicketFormState>(createEmptyTicketForm());
  const [exportError, setExportError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const quickCreateTitleRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const boardQuery = useBoardQuery(boardFilters);
  const projectsQuery = useProjectsQuery();
  const selectedTicketQuery = useTicketQuery(selectedTicketId);

  useEffect(() => {
    if (selectedTicketQuery.data) {
      setEditForm(toTicketForm(selectedTicketQuery.data));
    }
  }, [selectedTicketQuery.data]);

  const createTicketMutation = useCreateTicketMutation({
    boardFilters,
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
    boardFilters,
    onUpdated: (ticket) => {
      setEditForm(ticket);
    }
  });

  const deleteTicketMutation = useDeleteTicketMutation({
    ticketId: selectedTicketId,
    boardFilters,
    onDeleted: () => {
      setSelectedTicketId(null);
    },
    onReset: (form) => {
      setEditForm(form);
    }
  });

  const moveTicketStatusMutation = useMoveTicketStatusMutation({
    boardFilters,
    onMoved: (ticketId, status) => {
      if (selectedTicketId === ticketId) {
        setEditForm((current) => ({
          ...current,
          status
        }));
      }
    }
  });

  const actionError =
    exportError ??
    createTicketMutation.error?.message ??
    updateTicketMutation.error?.message ??
    deleteTicketMutation.error?.message ??
    moveTicketStatusMutation.error?.message;

  const columns = boardQuery.data?.columns ?? [];
  const projects = projectsQuery.data ?? [];
  const totalTickets = columns.reduce((count, column) => count + column.tickets.length, 0);
  const boardHasFilters = hasBoardFilters(boardFilters);

  const exportBoardData = useEffectEvent(async () => {
    setExportError(null);
    setStatusMessage(null);
    setIsExporting(true);

    try {
      const blob = await apiClientBlob("/api/export");
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const dateStamp = new Date().toISOString().slice(0, 10);

      anchor.href = downloadUrl;
      anchor.download = `boroda-export-${dateStamp}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
      setStatusMessage("Backup downloaded.");
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  });

  const importBoardData = useEffectEvent(async (file: File) => {
    if (!window.confirm("Import will replace the current local workspace. Continue?")) {
      return;
    }

    setExportError(null);
    setStatusMessage(null);
    setIsImporting(true);

    try {
      const snapshot = JSON.parse(await file.text()) as unknown;
      const result = await apiClient<{
        ok: true;
        counts: {
          projects: number;
          tickets: number;
        };
      }>("/api/import", {
        method: "POST",
        body: JSON.stringify({
          replaceExisting: true,
          snapshot
        })
      });

      setSelectedTicketId(null);
      setEditForm(createEmptyTicketForm());
      setQuickCreateForm(createEmptyQuickTicketForm());
      await queryClient.invalidateQueries();
      setStatusMessage(`Imported ${result.counts.projects} projects and ${result.counts.tickets} tickets.`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        setExportError("Selected file is not valid JSON.");
      } else {
        setExportError(error instanceof Error ? error.message : "Import failed");
      }
    } finally {
      setIsImporting(false);

      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  });

  const handleKeyboardShortcuts = useEffectEvent((event: KeyboardEvent) => {
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
  }, [handleKeyboardShortcuts]);

  useEffect(() => {
    setActions(
      <>
        <button
          type="button"
          className={primaryButtonClassName}
          onClick={() => {
            setIsQuickCreateOpen(true);
          }}
        >
          Create
        </button>
        <OverflowMenu buttonLabel="Open board actions">
          <button
            type="button"
            className="inline-flex min-h-10 items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-ink-50 transition-colors hover:bg-white/8"
            onClick={() => {
              importInputRef.current?.click();
            }}
            disabled={isImporting}
            role="menuitem"
          >
            {isImporting ? "Importing…" : "Import backup…"}
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center rounded-xl px-3 py-2 text-left text-sm font-medium text-ink-50 transition-colors hover:bg-white/8"
            onClick={() => void exportBoardData()}
            disabled={isExporting}
            role="menuitem"
          >
            {isExporting ? "Exporting…" : "Export backup"}
          </button>
          <Link
            to="/projects"
            className="inline-flex min-h-10 items-center rounded-xl px-3 py-2 text-sm font-medium text-ink-50 transition-colors hover:bg-white/8"
            role="menuitem"
          >
            Projects
          </Link>
        </OverflowMenu>
      </>
    );

    return () => {
      setActions(null);
    };
  }, [exportBoardData, importInputRef, isExporting, isImporting, setActions]);

  return (
    <section className="flex min-h-full flex-col gap-2">
      <input
        ref={importInputRef}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            void importBoardData(file);
          }
        }}
      />

      {actionError ? (
        <p className={`${softPanelClassName} m-0 text-sm text-danger-400`} role="alert">
          {actionError}
        </p>
      ) : null}
      {statusMessage ? (
        <p className={`${softPanelClassName} m-0 text-sm text-ink-50`} role="status">
          {statusMessage}
        </p>
      ) : null}

      <section className={toolbarClassName}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="m-0 text-xl font-semibold tracking-tight text-ink-50">Board</h2>
            <p className="m-0 text-xs text-accent-500">`/` search, `C` create ticket, `Esc` close ticket</p>
          </div>
          {boardHasFilters ? (
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => {
                setBoardFilters(EMPTY_BOARD_FILTERS);
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-[min(100%,260px)] flex-1 gap-1.5">
            <span className="sr-only">Search</span>
            <input
              ref={searchInputRef}
              className={inputClassName}
              placeholder="Search title or description…"
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
          <label className={`${fieldClassName} min-w-[180px] flex-none gap-1.5`}>
            <span className={labelClassName}>Project</span>
            <select
              className={inputClassName}
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
          <label className={`${fieldClassName} min-w-[160px] flex-none gap-1.5`}>
            <span className={labelClassName}>Priority</span>
            <select
              className={inputClassName}
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
        </div>
      </section>

      <div className="min-h-0 flex-1">
        {boardQuery.isLoading ? <p className={`${softPanelClassName} m-0 text-sm text-ink-50`}>Loading board…</p> : null}
        {boardQuery.isError ? (
          <section className={`${panelClassName} h-full`} aria-live="polite">
            <h3 className="m-0 text-xl font-semibold text-ink-50">Board request failed</h3>
            <p className="m-0 text-sm text-ink-200">
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
          <section className={`${panelClassName} h-full`} aria-live="polite">
            <h3 className="m-0 text-xl font-semibold text-ink-50">
              {boardHasFilters ? "No tickets match these filters" : "No tickets on the board yet"}
            </h3>
            <p className="m-0 text-sm text-ink-200">
              {boardHasFilters
                ? "Clear the current filters or create a ticket that matches them."
                : "Create a ticket from the popup or load the sample seed data for local testing."}
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
        description="Capture a new ticket without leaving the board."
        onClose={() => {
          setIsQuickCreateOpen(false);
        }}
        initialFocusRef={quickCreateTitleRef}
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
        isDeleting={deleteTicketMutation.isPending}
        onChange={(updater) => {
          setEditForm((current) => updater(current));
        }}
        onSave={() => {
          updateTicketMutation.mutate(toTicketPayload(editForm));
        }}
        onDelete={() => {
          deleteTicketMutation.mutate();
        }}
        onClose={() => {
          setSelectedTicketId(null);
        }}
      />
    </section>
  );
}
