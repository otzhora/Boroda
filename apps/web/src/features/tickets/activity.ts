import { formatStatusLabel } from "../../lib/constants";
import type { BoardColumnDefinition, Ticket, TicketActivityMeta } from "../../lib/types";

export function parseActivityMeta(metaJson: string) {
  try {
    const parsed = JSON.parse(metaJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as TicketActivityMeta) : null;
  } catch {
    return null;
  }
}

function toTitleCase(value: string) {
  return value
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function getActivityProvenanceLabel(meta: TicketActivityMeta | null) {
  if (meta?.actorType !== "agent") {
    return null;
  }

  const trimmedAgentKind = typeof meta.agentKind === "string" ? meta.agentKind.trim() : "";
  const agentLabel = trimmedAgentKind ? toTitleCase(trimmedAgentKind) : "Agent";
  const transportLabel =
    meta.transport === "mcp" ? "MCP" : meta.transport === "http" ? "HTTP" : null;

  return transportLabel ? `${agentLabel} via ${transportLabel}` : agentLabel;
}

export function getActivitySessionRef(meta: TicketActivityMeta | null) {
  if (meta?.actorType !== "agent") {
    return null;
  }

  return typeof meta.sessionRef === "string" && meta.sessionRef.trim() ? meta.sessionRef.trim() : null;
}

function getStatusActivityKey(activity: Ticket["activities"][number], meta: TicketActivityMeta | null) {
  if (typeof meta?.status === "string" && meta.status.trim()) {
    return meta.status.trim();
  }

  const match = activity.message.match(/^Status changed to (.+)$/);
  return match?.[1]?.trim() || null;
}

export function getActivityMessage(activity: Ticket["activities"][number], statuses: BoardColumnDefinition[]) {
  const meta = parseActivityMeta(activity.metaJson);

  if (activity.type === "ticket.status.changed") {
    const statusKey = getStatusActivityKey(activity, meta);

    if (statusKey) {
      const label = statuses.find((status) => status.status === statusKey)?.label ?? formatStatusLabel(statusKey);
      return `Status changed to ${label}`;
    }
  }

  return activity.message;
}
