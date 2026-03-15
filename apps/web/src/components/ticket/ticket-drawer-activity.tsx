import { getActivityProvenanceLabel, getActivitySessionRef, parseActivityMeta } from "../../features/tickets/activity";
import type { Ticket } from "../../lib/types";

export function TicketActivityDetails(props: { activity: Ticket["activities"][number] }) {
  const meta = parseActivityMeta(props.activity.metaJson);
  const provenanceLabel = getActivityProvenanceLabel(meta);
  const sessionRef = getActivitySessionRef(meta);

  if (!meta && !provenanceLabel && !sessionRef) {
    return null;
  }

  const provenanceBlock =
    provenanceLabel || sessionRef ? (
      <div className="grid gap-1">
        {provenanceLabel ? <p className="m-0 text-[0.8rem] text-ink-300">By {provenanceLabel}</p> : null}
        {sessionRef ? (
          <p className="m-0 text-[0.8rem] text-ink-300">
            Session: <span className="break-all font-mono text-ink-200">{sessionRef}</span>
          </p>
        ) : null}
      </div>
    ) : null;

  if (!meta) {
    return provenanceBlock;
  }

  if (props.activity.type === "ticket.workspace_setup_ran") {
    const steps = Array.isArray(meta.steps) ? meta.steps.filter((value): value is string => typeof value === "string") : [];

    if (!steps.length) {
      return provenanceBlock;
    }

    return (
      <div className="grid gap-1">
        {provenanceBlock}
        <p className="m-0 text-[0.8rem] text-ink-300">Steps: {steps.join(", ")}</p>
      </div>
    );
  }

  if (props.activity.type === "ticket.workspace_setup_failed") {
    const errorCode = typeof meta.errorCode === "string" ? meta.errorCode : null;
    const stderr = typeof meta.stderr === "string" && meta.stderr.trim() ? meta.stderr.trim() : null;

    return (
      <div className="grid gap-1">
        {provenanceBlock}
        {errorCode ? <p className="m-0 text-[0.8rem] text-ink-300">Error: {errorCode}</p> : null}
        {stderr ? <p className="m-0 break-words text-[0.8rem] text-red-100">{stderr}</p> : null}
      </div>
    );
  }

  return provenanceBlock;
}
