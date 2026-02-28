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
      className={`panel column${isOver ? " column-drop-target" : ""}`}
    >
      <header className="column-header">
        <h3>{statusLabelMap[status]}</h3>
        <span>{column?.tickets.length ?? 0}</span>
      </header>
      <div className="column-body">
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
          <p className="empty-state">No tickets in {statusLabelMap[status].toLowerCase()}.</p>
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
      <div className="board-grid">
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
