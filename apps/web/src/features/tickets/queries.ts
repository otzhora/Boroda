import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import type { Ticket, TicketListItem, TicketListResponse, TicketStatus } from "../../lib/types";
import { TICKET_PRIORITIES } from "../../lib/constants";

export type TicketScope = "active" | "archived" | "all";
export type TicketSortField = "ticket" | "jira" | "status" | "priority" | "projects" | "updated";
export type TicketSortDirection = "asc" | "desc";

export interface TicketFilters {
  status?: TicketStatus[];
  priority?: Array<(typeof TICKET_PRIORITIES)[number]>;
  projectId?: number[];
  q?: string;
  jiraIssue?: string[];
  scope?: TicketScope;
  sort?: TicketSortField;
  dir?: TicketSortDirection;
}

export function ticketQueryKey(ticketId: number | null) {
  return ["ticket", ticketId] as const;
}

export function ticketsQueryKey(filters: TicketFilters = {}) {
  return ["tickets", filters] as const;
}

function toTicketSearchParams(filters: TicketFilters) {
  const searchParams = new URLSearchParams();

  for (const status of filters.status ?? []) {
    searchParams.append("status", status);
  }

  for (const priority of filters.priority ?? []) {
    searchParams.append("priority", priority);
  }

  for (const projectId of filters.projectId ?? []) {
    searchParams.append("projectId", String(projectId));
  }

  const query = filters.q?.trim();
  if (query) {
    searchParams.set("q", query);
  }

  for (const jiraIssue of filters.jiraIssue ?? []) {
    const value = jiraIssue.trim();

    if (value) {
      searchParams.append("jiraIssue", value);
    }
  }

  if (filters.scope && filters.scope !== "active") {
    searchParams.set("scope", filters.scope);
  }

  if (filters.sort) {
    searchParams.set("sort", filters.sort);
    searchParams.set("dir", filters.dir ?? "asc");
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export function useTicketQuery(ticketId: number | null) {
  return useQuery({
    queryKey: ticketQueryKey(ticketId),
    queryFn: () => apiClient<Ticket>(`/api/tickets/${ticketId}`),
    enabled: ticketId !== null,
    gcTime: 30 * 1000
  });
}

export function useTicketsQuery(filters: TicketFilters = {}) {
  return useQuery({
    queryKey: ticketsQueryKey(filters),
    queryFn: async () => {
      const response = await apiClient<TicketListResponse>(`/api/tickets${toTicketSearchParams(filters)}`);
      return response.items;
    },
    gcTime: 30 * 1000,
    placeholderData: (previousData) => previousData
  });
}

export function useTicketListQuery(filters: TicketFilters = {}) {
  return useQuery({
    queryKey: ticketsQueryKey(filters),
    queryFn: () => apiClient<TicketListResponse>(`/api/tickets${toTicketSearchParams(filters)}`),
    gcTime: 30 * 1000,
    placeholderData: (previousData) => previousData
  });
}
