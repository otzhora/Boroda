import { useDraggable } from "@dnd-kit/core";
import type { BoardTicket } from "../../lib/types";

interface TicketCardProps {
  ticket: BoardTicket;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: (ticketId: number) => void;
}

function toTransformStyle(transform: { x: number; y: number } | null) {
  if (!transform) {
    return undefined;
  }

  return `translate3d(${transform.x}px, ${transform.y}px, 0)`;
}

export function TicketCard({ ticket, isSelected, isDragging, onSelect }: TicketCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `ticket-${ticket.id}`,
    data: {
      type: "ticket",
      ticketId: ticket.id,
      status: ticket.status
    }
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      className={`ticket-card ticket-card-button${isSelected ? " ticket-card-selected" : ""}${
        isDragging ? " ticket-card-dragging" : ""
      }`}
      style={{
        transform: toTransformStyle(transform),
        zIndex: isDragging ? 2 : undefined
      }}
      onClick={() => onSelect(ticket.id)}
      {...listeners}
      {...attributes}
    >
      <div className="ticket-topline">
        <span>{ticket.key}</span>
        <span className={`priority priority-${ticket.priority.toLowerCase()}`}>{ticket.priority}</span>
      </div>
      <h4>{ticket.title}</h4>
      <p>{ticket.type}</p>
      {ticket.projectBadges.length ? (
        <div className="ticket-badge-row">
          {ticket.projectBadges.map((badge) => (
            <span className="ticket-badge" key={`${ticket.id}-${badge.id}-${badge.relationship}`}>
              {badge.name}
            </span>
          ))}
        </div>
      ) : null}
      <p>{ticket.contextsCount} work contexts</p>
    </button>
  );
}
