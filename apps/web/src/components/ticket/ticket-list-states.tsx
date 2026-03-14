interface TicketListStateProps {
  className: string;
}

export function TicketListLoadingState({ className }: TicketListStateProps) {
  return (
    <p className={`${className} m-0 text-sm text-ink-50`} aria-live="polite">
      Loading tickets…
    </p>
  );
}

export function TicketListErrorState(props: TicketListStateProps & { onRetry: () => void; primaryButtonClassName: string }) {
  return (
    <section className={`${props.className} h-full content-start`} aria-live="polite">
      <h2 className="m-0 text-lg font-semibold text-ink-50">Tickets request failed</h2>
      <p className="m-0 max-w-[48rem] text-sm text-ink-200">
        The ticket list could not be loaded. Retry the request or inspect the local API logs.
      </p>
      <div className="flex flex-wrap gap-3">
        <button className={props.primaryButtonClassName} type="button" onClick={props.onRetry}>
          Retry tickets
        </button>
      </div>
    </section>
  );
}

export function TicketListEmptyState(
  props: TicketListStateProps & {
    ticketFiltersApplied: boolean;
    standupOnly: boolean;
    secondaryButtonClassName: string;
    onClearFilters: () => void;
  }
) {
  return (
    <section className={`${props.className} h-full content-start`} aria-live="polite">
      <h2 className="m-0 text-lg font-semibold text-ink-50">
        {props.ticketFiltersApplied
          ? "No tickets match these filters"
          : props.standupOnly
            ? "No tickets updated for standup"
            : "No tickets available"}
      </h2>
      <p className="m-0 max-w-[44rem] text-sm text-ink-200">
        {props.ticketFiltersApplied
          ? "Clear the current filters or switch scope to review a different slice of work."
          : props.standupOnly
            ? "Turn off standup mode or switch scope to review a different slice of work."
            : "Create a ticket from the board or import your local sample data to populate the list."}
      </p>
      {props.ticketFiltersApplied ? (
        <div className="flex flex-wrap gap-3">
          <button type="button" className={props.secondaryButtonClassName} onClick={props.onClearFilters}>
            Clear filters
          </button>
        </div>
      ) : null}
    </section>
  );
}
