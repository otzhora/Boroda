import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import type { BoardColumnsResponse } from "../../lib/types";
import { ticketItemsQueryKey, ticketListQueryKey } from "../tickets/queries";
import { boardColumnsQueryKey } from "./queries";

function invalidateTicketListQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ticketItemsQueryKey() });
  void queryClient.invalidateQueries({ queryKey: ticketListQueryKey() });
}

export function useCreateBoardColumnMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { label: string; relativeToStatus: string; placement: "before" | "after" }) =>
      apiClient<BoardColumnsResponse>("/api/board-columns", {
        method: "POST",
        body: JSON.stringify(input)
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["board"] });
      void queryClient.invalidateQueries({ queryKey: boardColumnsQueryKey() });
      invalidateTicketListQueries(queryClient);
    }
  });
}

export function useDeleteBoardColumnMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (status: string) =>
      apiClient<BoardColumnsResponse>(`/api/board-columns/${encodeURIComponent(status)}`, {
        method: "DELETE"
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["board"] });
      void queryClient.invalidateQueries({ queryKey: boardColumnsQueryKey() });
      invalidateTicketListQueries(queryClient);
    }
  });
}

export function useRenameBoardColumnMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { status: string; label: string }) =>
      apiClient<BoardColumnsResponse>(`/api/board-columns/${encodeURIComponent(input.status)}`, {
        method: "PATCH",
        body: JSON.stringify({ label: input.label })
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["board"] });
      void queryClient.invalidateQueries({ queryKey: boardColumnsQueryKey() });
      invalidateTicketListQueries(queryClient);
    }
  });
}
