import { parseActivityMeta } from "../../features/tickets/activity";
import type { Ticket } from "../../lib/types";

export function TicketActivityDetails(props: { activity: Ticket["activities"][number] }) {
  const meta = parseActivityMeta(props.activity.metaJson);

  if (!meta) {
    return null;
  }

  if (props.activity.type === "ticket.workspace_setup_ran") {
    const steps = Array.isArray(meta.steps) ? meta.steps.filter((value): value is string => typeof value === "string") : [];

    if (!steps.length) {
      return null;
    }

    return <p className="m-0 text-[0.8rem] text-ink-300">Steps: {steps.join(", ")}</p>;
  }

  if (props.activity.type === "ticket.workspace_setup_failed") {
    const errorCode = typeof meta.errorCode === "string" ? meta.errorCode : null;
    const stderr = typeof meta.stderr === "string" && meta.stderr.trim() ? meta.stderr.trim() : null;

    return (
      <div className="grid gap-1">
        {errorCode ? <p className="m-0 text-[0.8rem] text-ink-300">Error: {errorCode}</p> : null}
        {stderr ? <p className="m-0 break-words text-[0.8rem] text-red-100">{stderr}</p> : null}
      </div>
    );
  }

  return null;
}
