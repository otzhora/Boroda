import { formatStatusLabel } from "../../lib/constants";
import type { BoardColumnDefinition, Ticket } from "../../lib/types";

export function parseActivityMeta(metaJson: string) {
  try {
    return JSON.parse(metaJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getStatusActivityKey(activity: Ticket["activities"][number], meta: Record<string, unknown> | null) {
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
