import {
  DndContext,
  DragOverlay,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { useState } from "react";
import { formatStatusLabel } from "../../lib/constants";
import type { BoardColumn, TicketStatus } from "../../lib/types";
import { TicketCard } from "./ticket-card";
import { OverflowMenu } from "../ui/overflow-menu";

interface BoardViewProps {
  columns: BoardColumn[];
  selectedTicketId: number | null;
  onSelectTicket: (ticketId: number) => void;
  onMoveTicket: (ticketId: number, status: TicketStatus) => void;
  onAddColumn: (relativeToStatus: string, placement: "before" | "after") => void;
  onRenameColumn: (status: string, label: string) => void;
  onDeleteColumn: (status: string) => void;
  isColumnMutationPending: boolean;
}

interface ColumnSectionProps {
  column: BoardColumn;
  draggedTicketId: number | null;
  selectedTicketId: number | null;
  onSelectTicket: (ticketId: number) => void;
  onAddColumn: (relativeToStatus: string, placement: "before" | "after") => void;
  onRenameColumn: (status: string, label: string) => void;
  onDeleteColumn: (status: string) => void;
  isColumnMutationPending: boolean;
}

function ColumnSection({
  column,
  draggedTicketId,
  selectedTicketId,
  onSelectTicket,
  onAddColumn,
  onRenameColumn,
  onDeleteColumn,
  isColumnMutationPending
}: ColumnSectionProps) {
  const status = column.status;
  const label = column.label || formatStatusLabel(column.status);
  const { isOver, setNodeRef } = useDroppable({
    id: `column-${status}`,
    data: {
      type: "column",
      status
    }
  });

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={`flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border transition-colors ${
        isOver ? "border-accent-500/45 bg-canvas-900" : "border-white/8 bg-canvas-925"
      }`}
    >
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="m-0 truncate text-sm font-semibold text-ink-50">{label}</h3>
          <span className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-md border border-white/8 bg-canvas-950 px-1.5 text-xs font-medium text-ink-200">
            {column.tickets.length}
          </span>
        </div>
        <OverflowMenu
          buttonLabel={`${label} column actions`}
          buttonClassName="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[8px] border border-white/8 bg-canvas-950 px-2 text-sm font-medium text-ink-200 transition-colors hover:border-white/16 hover:bg-canvas-900 disabled:cursor-progress disabled:opacity-70"
          menuClassName="absolute right-0 top-[calc(100%+0.5rem)] z-30 grid min-w-[12rem] gap-1 rounded-[10px] border border-white/8 bg-canvas-925 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.24)]"
          buttonContent={
            <span aria-hidden="true" className="inline-flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-current" />
              <span className="h-1 w-1 rounded-full bg-current" />
              <span className="h-1 w-1 rounded-full bg-current" />
            </span>
          }
        >
          <button
            type="button"
            role="menuitem"
            className="min-h-10 rounded-[8px] px-3 text-left text-sm text-ink-100 transition-colors hover:bg-white/[0.03] disabled:cursor-progress disabled:opacity-60"
            disabled={isColumnMutationPending}
            onClick={() => onRenameColumn(status, label)}
          >
            Rename column
          </button>
          <button
            type="button"
            role="menuitem"
            className="min-h-10 rounded-[8px] px-3 text-left text-sm text-ink-100 transition-colors hover:bg-white/[0.03] disabled:cursor-progress disabled:opacity-60"
            disabled={isColumnMutationPending}
            onClick={() => onAddColumn(status, "before")}
          >
            Add column before
          </button>
          <button
            type="button"
            role="menuitem"
            className="min-h-10 rounded-[8px] px-3 text-left text-sm text-ink-100 transition-colors hover:bg-white/[0.03] disabled:cursor-progress disabled:opacity-60"
            disabled={isColumnMutationPending}
            onClick={() => onAddColumn(status, "after")}
          >
            Add column after
          </button>
          <button
            type="button"
            role="menuitem"
            className="min-h-10 rounded-[8px] px-3 text-left text-sm text-red-100 transition-colors hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isColumnMutationPending || column.tickets.length > 0}
            onClick={() => onDeleteColumn(status)}
          >
            Delete empty column
          </button>
        </OverflowMenu>
      </header>
      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-3">
        {column.tickets.length ? (
          column.tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              isSelected={selectedTicketId === ticket.id}
              isDragging={draggedTicketId === ticket.id}
              onSelect={onSelectTicket}
            />
          ))
        ) : null}
      </div>
    </section>
  );
}

export function BoardView({
  columns,
  selectedTicketId,
  onSelectTicket,
  onMoveTicket,
  onAddColumn,
  onRenameColumn,
  onDeleteColumn,
  isColumnMutationPending
}: BoardViewProps) {
  const [draggedTicketId, setDraggedTicketId] = useState<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const draggedTicket =
    draggedTicketId === null
      ? null
      : columns.flatMap((column) => column.tickets).find((ticket) => ticket.id === draggedTicketId) ?? null;

  function handleDragStart(event: DragStartEvent) {
    const ticketId = event.active.data.current?.ticketId;
    setDraggedTicketId(typeof ticketId === "number" ? ticketId : null);
  }

  function clearDragState() {
    setDraggedTicketId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const ticketId = event.active.data.current?.ticketId;
    const sourceStatus = event.active.data.current?.status as TicketStatus | undefined;
    const targetStatus = event.over?.data.current?.status as TicketStatus | undefined;

    if (typeof ticketId !== "number" || !sourceStatus || !targetStatus || sourceStatus === targetStatus) {
      clearDragState();
      return;
    }

    onMoveTicket(ticketId, targetStatus);
    clearDragState();
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={clearDragState}
    >
      <div className="h-full min-h-0 w-full overflow-hidden pb-2">
        <div
          className="grid h-full min-h-0 w-full gap-3"
          style={{ gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(16rem, 1fr))` }}
        >
          {columns.map((column) => (
            <ColumnSection
              key={column.status}
              column={column}
              draggedTicketId={draggedTicketId}
              selectedTicketId={selectedTicketId}
              onSelectTicket={onSelectTicket}
              onAddColumn={onAddColumn}
              onRenameColumn={onRenameColumn}
              onDeleteColumn={onDeleteColumn}
              isColumnMutationPending={isColumnMutationPending}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null} zIndex={999}>
        {draggedTicket ? (
          <div className="w-[min(100vw-2rem,24rem)] touch-none select-none">
            <TicketCard
              ticket={draggedTicket}
              isSelected={selectedTicketId === draggedTicket.id}
              isDragging={false}
              onSelect={onSelectTicket}
              interactive={false}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
