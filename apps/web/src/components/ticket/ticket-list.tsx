import type { TicketListItem } from "../../lib/types";
import type { TicketSortDirection, TicketSortField } from "../../features/tickets/queries";
import { useVirtualTicketList } from "../../features/tickets/use-virtual-ticket-list";
import { ColumnHeader, ProjectChip, formatLastChange } from "../../features/tickets/tickets-page-helpers";
import { formatStatusLabel } from "../../lib/constants";

const GRID_COLUMNS = "grid-cols-[minmax(0,2.3fr)_minmax(0,1.1fr)_10rem_9rem_minmax(0,1.6fr)_10rem]";
const MIN_WIDTH = "min-w-[72rem]";
const ROW_ESTIMATE = 88;

export function TicketList(props: {
  tickets: TicketListItem[];
  selectedTicketId: number | null;
  sortField: TicketSortField | null;
  sortDirection: TicketSortDirection;
  boardColumns: Array<{ status: string; label: string }>;
  listClassName: string;
  chipClassName: string;
  onSort: (field: TicketSortField) => void;
  onSelectTicket: (ticketId: number) => void;
}) {
  const { scrollContainerRef, totalSize, virtualItems, measureElement } = useVirtualTicketList({
    itemCount: props.tickets.length,
    estimateSize: ROW_ESTIMATE
  });

  return (
    <section
      ref={(element) => {
        scrollContainerRef.current = element;
      }}
      className={`${props.listClassName} min-h-0 min-w-0 flex-1 overflow-auto`}
      aria-label="Ticket list"
    >
      <div className={`sticky top-0 z-10 grid ${MIN_WIDTH} ${GRID_COLUMNS} gap-3 border-b border-white/8 bg-canvas-925 px-4 py-3 text-xs text-ink-300`}>
        <ColumnHeader
          label="Ticket"
          sortField="ticket"
          currentSortField={props.sortField}
          currentSortDirection={props.sortDirection}
          onSort={props.onSort}
        />
        <ColumnHeader
          label="Jira"
          sortField="jira"
          currentSortField={props.sortField}
          currentSortDirection={props.sortDirection}
          onSort={props.onSort}
        />
        <ColumnHeader
          label="Status"
          sortField="status"
          currentSortField={props.sortField}
          currentSortDirection={props.sortDirection}
          onSort={props.onSort}
        />
        <ColumnHeader
          label="Priority"
          sortField="priority"
          currentSortField={props.sortField}
          currentSortDirection={props.sortDirection}
          onSort={props.onSort}
        />
        <ColumnHeader
          label="Projects"
          sortField="projects"
          currentSortField={props.sortField}
          currentSortDirection={props.sortDirection}
          onSort={props.onSort}
        />
        <ColumnHeader
          label="Last change"
          sortField="updated"
          currentSortField={props.sortField}
          currentSortDirection={props.sortDirection}
          onSort={props.onSort}
        />
      </div>
      <ul className={`relative m-0 ${MIN_WIDTH} list-none p-0`} style={{ height: totalSize }}>
        {virtualItems.map((virtualItem) => {
          const ticket = props.tickets[virtualItem.index];
          const selected = ticket.id === props.selectedTicketId;

          return (
            <li
              key={ticket.id}
              className="absolute left-0 right-0 border-t border-white/8 first:border-t-0"
              style={{ top: virtualItem.start }}
            >
              <button
                ref={(element) => {
                  measureElement(virtualItem.index, element);
                }}
                type="button"
                className={`grid w-full ${MIN_WIDTH} ${GRID_COLUMNS} gap-3 px-4 py-4 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink-50 ${selected ? "bg-white/[0.03]" : ""}`}
                aria-pressed={selected}
                aria-label={`Open ticket ${ticket.key} ${ticket.title}`}
                onClick={() => {
                  props.onSelectTicket(ticket.id);
                }}
              >
                <div className="min-w-0 grid gap-1">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 font-mono text-sm tabular-nums text-ink-200">{ticket.key}</span>
                    <span className="truncate text-sm font-medium text-ink-50">{ticket.title}</span>
                  </div>
                  <div className="text-xs text-ink-300">{ticket.archivedAt ? "Archived ticket" : "Current ticket"}</div>
                </div>
                <div className="min-w-0 text-sm text-ink-200">
                  <span className="block truncate">
                    {ticket.jiraIssues.length ? ticket.jiraIssues.map((issue) => issue.key).join(", ") : "No Jira links"}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className={`${props.chipClassName} border-white/10 text-ink-200`}>
                    {props.boardColumns.find((column) => column.status === ticket.status)?.label ?? formatStatusLabel(ticket.status)}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className={`${props.chipClassName} border-white/10 text-ink-200`}>{ticket.priority}</span>
                </div>
                <div className="flex min-w-0 flex-wrap gap-2">
                  {ticket.projectBadges.length ? (
                    ticket.projectBadges.map((project) => <ProjectChip key={project.id} project={project} />)
                  ) : (
                    <span className="text-sm text-ink-300">No projects</span>
                  )}
                </div>
                <div className="text-sm text-ink-300">{formatLastChange(ticket)}</div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
