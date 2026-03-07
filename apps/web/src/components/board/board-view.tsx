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
      aria-label={statusLabelMap[status]}
      className={`flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border transition-colors ${
        isOver ? "border-accent-500/45 bg-canvas-900" : "border-white/8 bg-canvas-925"
      }`}
    >
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <h3 className="m-0 text-sm font-semibold text-ink-50">{statusLabelMap[status]}</h3>
        <span className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-md border border-white/8 bg-canvas-950 px-1.5 text-xs font-medium text-ink-200">
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
        <div className="grid h-full min-h-0 w-full grid-cols-7 gap-3">
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
