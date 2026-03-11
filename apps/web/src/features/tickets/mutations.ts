import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import type { BoardResponse, OpenInMode, OpenInTarget, Ticket, TicketJiraIssueLink, TicketStatus } from "../../lib/types";
import { boardQueryKey, type BoardFilters } from "../board/queries";
import { assignedJiraIssueLinksQueryKey, assignedJiraIssuesQueryKey } from "../jira/queries";
import { ticketQueryKey, ticketsQueryKey } from "./queries";
import { createEmptyTicketForm, toTicketForm, type TicketFormState } from "./form";

interface TicketPayload {
  title: string;
  description: string;
  branch: string | null;
  workspaces: Array<{
    projectFolderId: number;
    branchName: string;
    baseBranch: string | null;
    role: string;
  }>;
  jiraIssues: Array<{
    key: string;
    summary: string;
  }>;
  status: string;
  priority: string;
  dueAt: string | null;
  projectLinks: Array<{
    projectId: number;
    relationship: string;
  }>;
}

interface MoveTicketStatusContext {
  previousBoard?: BoardResponse;
}

export interface UploadedTicketImage {
  alt: string;
  filename: string;
  url: string;
  markdown: string;
}

export function useCreateTicketMutation(options: {
  boardFilters: BoardFilters;
  onCreated: (ticket: Ticket) => void;
  onReset: () => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TicketPayload) =>
      apiClient<Ticket>("/api/tickets", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: (ticket) => {
      options.onReset();
      options.onCreated(ticket);
      void queryClient.invalidateQueries({ queryKey: ["board"] });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(options.boardFilters) });
      void queryClient.invalidateQueries({ queryKey: assignedJiraIssuesQueryKey() });
      void queryClient.invalidateQueries({ queryKey: assignedJiraIssueLinksQueryKey() });
      void queryClient.invalidateQueries({ queryKey: ticketQueryKey(ticket.id) });
    }
  });
}

export function useUpdateTicketMutation(options: {
  ticketId: number | null;
  boardFilters: BoardFilters;
  onUpdated: (ticket: TicketFormState) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TicketPayload) => {
      if (options.ticketId === null) {
        throw new Error("No ticket selected");
      }

      return apiClient<Ticket>(`/api/tickets/${options.ticketId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
    },
    onSuccess: (ticket) => {
      options.onUpdated(toTicketForm(ticket));
      void queryClient.invalidateQueries({ queryKey: ["board"] });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(options.boardFilters) });
      void queryClient.invalidateQueries({ queryKey: assignedJiraIssuesQueryKey() });
      void queryClient.invalidateQueries({ queryKey: assignedJiraIssueLinksQueryKey() });
      void queryClient.invalidateQueries({ queryKey: ticketQueryKey(ticket.id) });
    }
  });
}

export function useDeleteTicketMutation(options: {
  ticketId: number | null;
  boardFilters: BoardFilters;
  onDeleted: () => void;
  onReset: (form: TicketFormState) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input?: { force?: boolean }) => {
      if (options.ticketId === null) {
        throw new Error("No ticket selected");
      }

      const searchParams = new URLSearchParams();
      if (input?.force) {
        searchParams.set("force", "true");
      }

      return apiClient<{ ok: true }>(`/api/tickets/${options.ticketId}${searchParams.size ? `?${searchParams.toString()}` : ""}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      const deletedTicketId = options.ticketId;
      options.onDeleted();
      options.onReset(createEmptyTicketForm());
      void queryClient.invalidateQueries({ queryKey: ["board"] });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(options.boardFilters) });
      void queryClient.invalidateQueries({ queryKey: assignedJiraIssuesQueryKey() });
      void queryClient.invalidateQueries({ queryKey: assignedJiraIssueLinksQueryKey() });

      if (deletedTicketId !== null) {
        void queryClient.removeQueries({ queryKey: ticketQueryKey(deletedTicketId) });
      }
    }
  });
}

export function useUnarchiveTicketMutation(options: {
  ticketId: number | null;
  boardFilters: BoardFilters;
  onRestored: () => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (options.ticketId === null) {
        throw new Error("No ticket selected");
      }

      return apiClient<{ ok: true }>(`/api/tickets/${options.ticketId}/unarchive`, {
        method: "POST"
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["board"] });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(options.boardFilters) });

      if (options.ticketId !== null) {
        void queryClient.invalidateQueries({ queryKey: ticketQueryKey(options.ticketId) });
      }

      options.onRestored();
    }
  });
}

export function useMoveTicketStatusMutation(options: {
  boardFilters: BoardFilters;
  onMoved?: (ticketId: number, status: TicketStatus) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation<
    Ticket,
    Error,
    { ticketId: number; status: TicketStatus },
    MoveTicketStatusContext
  >({
    mutationFn: ({ ticketId, status }) =>
      apiClient<Ticket>(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      }),
    onMutate: async ({ ticketId, status }) => {
      const queryKey = boardQueryKey(options.boardFilters);

      await queryClient.cancelQueries({ queryKey });
      const previousBoard = queryClient.getQueryData<BoardResponse>(queryKey);

      queryClient.setQueryData<BoardResponse>(queryKey, (current) => {
        if (!current) {
          return current;
        }

        const draggedTicket = current.columns.flatMap((column) => column.tickets).find((ticket) => ticket.id === ticketId);

        if (!draggedTicket || draggedTicket.status === status) {
          return current;
        }

        const updatedTicket = {
          ...draggedTicket,
          status,
          updatedAt: new Date().toISOString()
        };

        return {
          columns: current.columns.map((column) => {
            if (column.status === status) {
              return {
                ...column,
                tickets: [updatedTicket, ...column.tickets.filter((ticket) => ticket.id !== ticketId)]
              };
            }

            return {
              ...column,
              tickets: column.tickets.filter((ticket) => ticket.id !== ticketId)
            };
          })
        };
      });

      options.onMoved?.(ticketId, status);

      return { previousBoard };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(boardQueryKey(options.boardFilters), context.previousBoard);
      }
    },
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: ["board"] });
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(options.boardFilters) });
      void queryClient.invalidateQueries({ queryKey: ticketQueryKey(ticket.id) });
    }
  });
}

export function useOpenTicketInAppMutation(ticketId: number | null) {
  return useMutation({
    mutationFn: (input: {
      target: OpenInTarget;
      mode: OpenInMode;
      folderId?: number;
      workspaceId?: number;
      runSetup: boolean;
    }) => {
      if (ticketId === null) {
        throw new Error("No ticket selected");
      }

      return apiClient<{ ok: true; directory: string; target: OpenInTarget }>(`/api/integrations/open-in/tickets/${ticketId}/open`, {
        method: "POST",
        body: JSON.stringify(input)
      });
    }
  });
}

export function useRefreshTicketJiraLinksMutation(ticketId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (ticketId === null) {
        throw new Error("No ticket selected");
      }

      return apiClient<Ticket>(`/api/tickets/${ticketId}/jira/refresh`, {
        method: "POST"
      });
    },
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: ["board"] });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: assignedJiraIssueLinksQueryKey() });
      void queryClient.invalidateQueries({ queryKey: ticketQueryKey(ticket.id) });
    }
  });
}

export function useUploadTicketImageMutation(ticketId: number | null) {
  return useMutation({
    mutationFn: (file: File) => {
      if (ticketId === null) {
        throw new Error("Save the ticket before uploading images");
      }

      const formData = new FormData();
      formData.set("image", file);

      return apiClient<UploadedTicketImage>(`/api/tickets/${ticketId}/images`, {
        method: "POST",
        body: formData
      });
    }
  });
}

export function useAddTicketJiraLinkMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { ticketId: number; key: string; summary: string }) =>
      apiClient<TicketJiraIssueLink>(`/api/tickets/${payload.ticketId}/jira-links`, {
        method: "POST",
        body: JSON.stringify({
          key: payload.key,
          summary: payload.summary
        })
      }),
    onSuccess: (_jiraLink, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["board"] });
      void queryClient.invalidateQueries({ queryKey: ticketsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: assignedJiraIssuesQueryKey() });
      void queryClient.invalidateQueries({ queryKey: assignedJiraIssueLinksQueryKey() });
      void queryClient.invalidateQueries({ queryKey: ticketQueryKey(variables.ticketId) });
    }
  });
}
