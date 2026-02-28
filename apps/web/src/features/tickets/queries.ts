import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import type { Ticket } from "../../lib/types";

export function ticketQueryKey(ticketId: number | null) {
  return ["ticket", ticketId] as const;
}

export function useTicketQuery(ticketId: number | null) {
  return useQuery({
    queryKey: ticketQueryKey(ticketId),
    queryFn: () => apiClient<Ticket>(`/api/tickets/${ticketId}`),
    enabled: ticketId !== null
  });
}
