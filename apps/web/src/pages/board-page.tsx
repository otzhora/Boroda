import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BoardView } from "../components/board/board-view";
import {
  createEmptyQuickTicketForm,
  QuickTicketForm,
  type QuickTicketFormState
} from "../components/board/quick-ticket-form";
import { TicketDrawer } from "../components/ticket/ticket-drawer";
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
const headingRowClassName = "flex flex-col items-start justify-between gap-4 md:flex-row md:items-center";
const eyebrowClassName = "m-0 text-[0.72rem] uppercase tracking-[0.16em] text-accent-500";
const sectionTitleClassName = "m-0 text-2xl font-semibold tracking-tight text-ink-50";
const subheadingClassName = "m-0 text-xl font-semibold tracking-tight text-ink-50";
const fieldClassName = "grid gap-2";
const searchFieldClassName = "grid gap-2 md:col-span-2";
const labelClassName = "m-0 text-sm font-medium text-ink-50";
const inputClassName =
  "min-h-11 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-ink-50 placeholder:text-ink-200/65";
const secondaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-ink-50 transition-colors hover:border-white/20 hover:bg-white/10 disabled:cursor-progress disabled:opacity-70";
const primaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-accent-700 px-4 py-2.5 text-sm font-medium text-canvas-950 transition-opacity disabled:cursor-progress disabled:opacity-70";

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
  const queryClient = useQueryClient();
  const [boardFilters, setBoardFilters] = useState<BoardFilters>(EMPTY_BOARD_FILTERS);
  const [quickCreateForm, setQuickCreateForm] = useState<QuickTicketFormState>(createEmptyQuickTicketForm());
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
      quickCreateTitleRef.current?.focus();
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

  return (
    <section className="grid gap-4">
      <div className={headingRowClassName}>
        <div>
          <p className={eyebrowClassName}>Board overview</p>
          <h2 className={sectionTitleClassName}>Current work</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => {
              importInputRef.current?.click();
            }}
            disabled={isImporting}
          >
            {isImporting ? "Importing…" : "Import backup…"}
          </button>
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => void exportBoardData()}
            disabled={isExporting}
          >
            {isExporting ? "Exporting…" : "Export backup"}
          </button>
        </div>
      </div>

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

      <section className={panelClassName}>
        <div className={headingRowClassName}>
          <div>
            <p className={eyebrowClassName}>Filters</p>
            <h3 className={subheadingClassName}>Focus the board</h3>
          </div>
          <p className="m-0 text-sm text-accent-500">
            Shortcuts: `/` search, `C` quick create, `Esc` close ticket
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          <label className={searchFieldClassName}>
            <span className={labelClassName}>Search</span>
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
          <label className={fieldClassName}>
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
          <label className={fieldClassName}>
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
          <div className="flex flex-wrap items-end justify-end gap-3">
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => {
                setBoardFilters(EMPTY_BOARD_FILTERS);
              }}
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <section className={panelClassName}>
          <div className={headingRowClassName}>
            <div>
              <p className={eyebrowClassName}>Quick create</p>
              <h3 className={subheadingClassName}>Add a ticket without leaving the board</h3>
            </div>
          </div>
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
        </section>

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
      </div>

      {boardQuery.isLoading ? <p className={`${softPanelClassName} m-0 text-sm text-ink-50`}>Loading board…</p> : null}
      {boardQuery.isError ? (
        <section className={panelClassName} aria-live="polite">
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
        <section className={panelClassName} aria-live="polite">
          <h3 className="m-0 text-xl font-semibold text-ink-50">
            {boardHasFilters ? "No tickets match these filters" : "No tickets on the board yet"}
          </h3>
          <p className="m-0 text-sm text-ink-200">
            {boardHasFilters
              ? "Clear the current filters or create a ticket that matches them."
              : "Create a ticket from quick create or load the sample seed data for local testing."}
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
                quickCreateTitleRef.current?.focus();
              }}
            >
              Focus quick create
            </button>
          </div>
        </section>
      ) : null}

      {totalTickets > 0 ? (
        <BoardView
          columns={columns}
          selectedTicketId={selectedTicketId}
          onSelectTicket={setSelectedTicketId}
          onMoveTicket={(ticketId, status) => {
            moveTicketStatusMutation.mutate({ ticketId, status });
          }}
        />
      ) : null}
    </section>
  );
}
