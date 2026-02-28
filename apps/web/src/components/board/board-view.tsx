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
      className={`grid min-h-80 gap-4 rounded-[24px] border px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-colors ${
        isOver
          ? "border-accent-300/40 bg-accent-700/12"
          : "border-white/10 bg-white/5"
      }`}
    >
      <header className="flex items-center justify-between gap-4">
        <h3 className="m-0 text-base font-semibold text-ink-50">{statusLabelMap[status]}</h3>
        <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-sm text-accent-300">
          {column?.tickets.length ?? 0}
        </span>
      </header>
      <div className="grid gap-4">
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
        ) : (
          <p className="m-0 text-sm text-ink-200">
            No tickets in {statusLabelMap[status].toLowerCase()}.
          </p>
        )}
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
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
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
    </DndContext>
  );
}
