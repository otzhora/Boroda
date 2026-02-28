import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import type { WorkContext, WorkContextType } from "../../lib/types";
import { ticketQueryKey } from "./queries";

interface WorkContextPayload {
  type: WorkContextType;
  label: string;
  value: string;
  meta?: Record<string, unknown>;
}

function invalidateTicketContextQueries(queryClient: ReturnType<typeof useQueryClient>, ticketId: number) {
  void queryClient.invalidateQueries({ queryKey: ["board"] });
  void queryClient.invalidateQueries({ queryKey: ticketQueryKey(ticketId) });
}

export function useCreateWorkContextMutation(ticketId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: WorkContextPayload) => {
      if (ticketId === null) {
        throw new Error("No ticket selected");
      }

      return apiClient<WorkContext>(`/api/tickets/${ticketId}/contexts`, {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          meta: payload.meta ?? {}
        })
      });
    },
    onSuccess: () => {
      if (ticketId !== null) {
        invalidateTicketContextQueries(queryClient, ticketId);
      }
    }
  });
}

export function useUpdateWorkContextMutation(ticketId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }: WorkContextPayload & { id: number }) =>
      apiClient<WorkContext>(`/api/work-contexts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...payload,
          meta: payload.meta ?? {}
        })
      }),
    onSuccess: () => {
      if (ticketId !== null) {
        invalidateTicketContextQueries(queryClient, ticketId);
      }
    }
  });
}

export function useDeleteWorkContextMutation(ticketId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      apiClient<{ ok: true }>(`/api/work-contexts/${id}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      if (ticketId !== null) {
        invalidateTicketContextQueries(queryClient, ticketId);
      }
    }
  });
}
