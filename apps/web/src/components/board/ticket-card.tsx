import { useDraggable } from "@dnd-kit/core";
import type { BoardTicket } from "../../lib/types";

interface TicketCardProps {
  ticket: BoardTicket;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: (ticketId: number) => void;
}

const priorityClassNameMap = {
  LOW: "bg-slate-600/80 text-white",
  MEDIUM: "bg-amber-700/70 text-amber-50",
  HIGH: "bg-orange-800/70 text-orange-50",
  CRITICAL: "bg-red-700/85 text-red-50"
} as const;

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
      className={`grid w-full gap-3 rounded-[18px] border bg-black/20 px-4 py-4 text-left text-ink-50 shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition-[border-color,background-color,opacity,box-shadow] ${
        isSelected
          ? "border-accent-300/40 shadow-[inset_0_0_0_1px_rgba(255,219,180,0.14),0_10px_30px_rgba(0,0,0,0.18)]"
          : "border-transparent hover:border-white/10 hover:bg-black/25"
      } ${isDragging ? "cursor-grabbing opacity-45" : "cursor-pointer"}`}
      style={{
        transform: toTransformStyle(transform),
        zIndex: isDragging ? 2 : undefined
      }}
      onClick={() => onSelect(ticket.id)}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-accent-500">
          {ticket.key}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[0.72rem] font-medium ${priorityClassNameMap[ticket.priority]}`}
        >
          {ticket.priority}
        </span>
      </div>
      <h4 className="m-0 text-base font-semibold text-ink-50">{ticket.title}</h4>
      <p className="m-0 text-sm text-ink-200">{ticket.type}</p>
      {ticket.projectBadges.length ? (
        <div className="flex flex-wrap gap-2">
          {ticket.projectBadges.map((badge) => (
            <span
              className="rounded-full bg-accent-700/18 px-2.5 py-1 text-[0.78rem] text-accent-300"
              key={`${ticket.id}-${badge.id}-${badge.relationship}`}
            >
              {badge.name}
            </span>
          ))}
        </div>
      ) : null}
      <p className="m-0 text-sm text-ink-200">{ticket.contextsCount} work contexts</p>
    </button>
  );
}
