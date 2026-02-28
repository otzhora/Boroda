import {
  DndContext,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { useState } from "react";
import { BOARD_STATUS_ORDER, statusLabelMap } from "../../lib/constants";
import type { BoardColumn, TicketStatus } from "../../lib/types";
import { TicketCard } from "./ticket-card";

interface BoardViewProps {
  columns: BoardColumn[];
  selectedTicketId: number | null;
  onSelectTicket: (ticketId: number) => void;
  onMoveTicket: (ticketId: number, status: TicketStatus) => void;
}

interface ColumnSectionProps {
  column: BoardColumn | undefined;
  status: TicketStatus;
  draggedTicketId: number | null;
  selectedTicketId: number | null;
  onSelectTicket: (ticketId: number) => void;
}

function ColumnSection({
  column,
  status,
  draggedTicketId,
  selectedTicketId,
  onSelectTicket
}: ColumnSectionProps) {
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
      className={`flex h-full min-h-0 min-w-[320px] flex-1 basis-[320px] flex-col overflow-hidden rounded-[20px] border shadow-[0_18px_48px_rgba(0,0,0,0.2)] transition-colors ${
        isOver
          ? "border-white/20 bg-canvas-850"
          : "border-white/8 bg-canvas-900"
      }`}
    >
      <header className="sticky top-0 z-10 flex min-h-12 items-center justify-between gap-3 border-b border-white/8 bg-canvas-900 px-4 py-2">
        <h3 className="m-0 text-sm font-semibold uppercase tracking-[0.16em] text-ink-100">{statusLabelMap[status]}</h3>
        <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-ink-200">
          {column?.tickets.length ?? 0}
        </span>
      </header>
      <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-3">
        {column?.tickets.length ? (
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
  onMoveTicket
}: BoardViewProps) {
  const [draggedTicketId, setDraggedTicketId] = useState<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const columnsByStatus = new Map(columns.map((column) => [column.status, column]));

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

    clearDragState();

    if (typeof ticketId !== "number" || !sourceStatus || !targetStatus || sourceStatus === targetStatus) {
      return;
    }

    onMoveTicket(ticketId, targetStatus);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={clearDragState}
    >
      <div className="h-full min-h-0 overflow-x-auto overflow-y-hidden pb-2">
        <div className="flex h-full min-h-0 min-w-full gap-4">
          {BOARD_STATUS_ORDER.map((status) => (
            <ColumnSection
              key={status}
              column={columnsByStatus.get(status)}
              status={status}
              draggedTicketId={draggedTicketId}
              selectedTicketId={selectedTicketId}
              onSelectTicket={onSelectTicket}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
}
