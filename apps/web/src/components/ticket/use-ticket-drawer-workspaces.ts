import { useMemo } from "react";
import type { Project, Ticket } from "../../lib/types";
import type { TicketFormState } from "../../features/tickets/form";
import { getPreferredProjectFolder, getWorkspaceSummaries } from "./ticket-drawer-workspace-data";

export function usePreferredProjectFolder(ticket: Ticket | undefined) {
  return useMemo(() => getPreferredProjectFolder(ticket), [ticket]);
}

export function useWorkspaceSummaries(ticket: Ticket | undefined, form: TicketFormState, projects: Project[]) {
  return useMemo(() => getWorkspaceSummaries(ticket, form, projects), [form.workspaces, projects, ticket?.workspaces]);
}
