import { useDraggable } from "@dnd-kit/core";
import type { BoardTicket } from "../../lib/types";

interface TicketCardProps {
  ticket: BoardTicket;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: (ticketId: number) => void;
  interactive?: boolean;
}

const priorityClassNameMap = {
  LOW: "border border-white/8 bg-white/[0.04] text-ink-100",
  MEDIUM: "border border-white/10 bg-canvas-800 text-ink-100",
  HIGH: "border border-white/14 bg-white/[0.08] text-ink-50",
  CRITICAL: "border border-red-400/20 bg-red-950/50 text-red-100"
} as const;

function toTransformStyle(transform: { x: number; y: number } | null) {
  if (!transform) {
    return undefined;
  }

  return `translate3d(${transform.x}px, ${transform.y}px, 0)`;
}

function TicketCardContent({ ticket }: { ticket: BoardTicket }) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-ink-300">
          {ticket.key}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[0.72rem] font-medium ${priorityClassNameMap[ticket.priority]}`}
        >
          {ticket.priority}
        </span>
      </div>
      <h4 className="m-0 text-[0.98rem] font-semibold leading-6 text-ink-50">{ticket.title}</h4>
      {ticket.projectBadges.length ? (
        <div className="flex flex-wrap gap-2">
          {ticket.projectBadges.map((badge) => (
            <span
              className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[0.78rem] text-ink-200"
              key={`${ticket.id}-${badge.id}-${badge.relationship}`}
            >
              {badge.name}
            </span>
          ))}
        </div>
      ) : null}
      {ticket.jiraIssues.length ? (
        <div className="flex flex-wrap gap-2">
          {ticket.jiraIssues.slice(0, 2).map((issue) => (
            <span
              className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2.5 py-1 text-[0.78rem] text-sky-100"
              key={`${ticket.id}-${issue.key}`}
              title={issue.summary ? `${issue.key} ${issue.summary}` : issue.key}
            >
              {issue.key}
            </span>
          ))}
          {ticket.jiraIssues.length > 2 ? (
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[0.78rem] text-ink-200">
              +{ticket.jiraIssues.length - 2} Jira
            </span>
          ) : null}
        </div>
      ) : null}
      <p className="m-0 text-sm text-ink-300">{ticket.contextsCount} work contexts</p>
    </>
  );
}

export function TicketCard({
  ticket,
  isSelected,
  isDragging,
  onSelect,
  interactive = true
}: TicketCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `ticket-${ticket.id}`,
    data: {
      type: "ticket",
      ticketId: ticket.id,
      status: ticket.status
    },
    disabled: !interactive
  });
  const className = `grid w-full gap-3 rounded-[16px] border bg-canvas-850 px-4 py-4 text-left text-ink-50 shadow-[0_12px_30px_rgba(0,0,0,0.16)] transition-[border-color,background-color,opacity,box-shadow] ${
    isSelected
      ? "border-white/16 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),0_12px_30px_rgba(0,0,0,0.2)]"
      : "border-white/6 hover:border-white/10 hover:bg-canvas-800"
  } ${isDragging ? "cursor-grabbing opacity-0" : interactive ? "cursor-pointer" : "cursor-grabbing"}`;
  const style = {
    transform: interactive && !isDragging ? toTransformStyle(transform) : undefined,
    zIndex: isDragging ? 2 : undefined
  };

  if (!interactive) {
    return (
      <div aria-hidden="true" className={className} style={style}>
        <TicketCardContent ticket={ticket} />
      </div>
    );
  }

  return (
    <button
      type="button"
      ref={setNodeRef}
      className={className}
      style={style}
      onClick={() => onSelect(ticket.id)}
      {...listeners}
      {...attributes}
    >
      <TicketCardContent ticket={ticket} />
    </button>
  );
}
