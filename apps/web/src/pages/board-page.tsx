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
    <section className="page-grid">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Board overview</p>
          <h2>Current work</h2>
        </div>
        <div className="section-heading-actions">
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
            className="ghost-button"
            onClick={() => {
              importInputRef.current?.click();
            }}
            disabled={isImporting}
          >
            {isImporting ? "Importing…" : "Import backup…"}
          </button>
          <button type="button" className="ghost-button" onClick={() => void exportBoardData()} disabled={isExporting}>
            {isExporting ? "Exporting…" : "Export backup"}
          </button>
        </div>
      </div>

      {actionError ? (
        <p className="panel error-panel" role="alert">
          {actionError}
        </p>
      ) : null}
      {statusMessage ? (
        <p className="panel" role="status">
          {statusMessage}
        </p>
      ) : null}

      <section className="panel board-toolbar">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Filters</p>
            <h3>Focus the board</h3>
          </div>
          <p className="shortcut-hint">Shortcuts: `/` search, `C` quick create, `Esc` close ticket</p>
        </div>
        <div className="board-toolbar-grid">
          <label className="field board-search-field">
            <span>Search</span>
            <input
              ref={searchInputRef}
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
          <label className="field">
            <span>Project</span>
            <select
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
          <label className="field">
            <span>Priority</span>
            <select
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
          <div className="form-actions board-filter-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setBoardFilters(EMPTY_BOARD_FILTERS);
              }}
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      <div className="ticket-workspace">
        <section className="panel form-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Quick create</p>
              <h3>Add a ticket without leaving the board</h3>
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

      {boardQuery.isLoading ? <p className="panel">Loading board…</p> : null}
      {boardQuery.isError ? (
        <section className="panel board-empty-state" aria-live="polite">
          <h3>Board request failed</h3>
          <p>The board could not be loaded. Retry the request or export the local database before troubleshooting.</p>
          <div className="form-actions">
            <button type="button" onClick={() => void boardQuery.refetch()}>
              Retry board
            </button>
          </div>
        </section>
      ) : null}
      {!boardQuery.isLoading && !boardQuery.isError && totalTickets === 0 ? (
        <section className="panel board-empty-state" aria-live="polite">
          <h3>{boardHasFilters ? "No tickets match these filters" : "No tickets on the board yet"}</h3>
          <p>
            {boardHasFilters
              ? "Clear the current filters or create a ticket that matches them."
              : "Create a ticket from quick create or load the sample seed data for local testing."}
          </p>
          <div className="form-actions">
            {boardHasFilters ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setBoardFilters(EMPTY_BOARD_FILTERS);
                }}
              >
                Clear filters
              </button>
            ) : null}
            <button
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
