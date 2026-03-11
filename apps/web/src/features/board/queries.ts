import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import type { BoardColumnsResponse, BoardResponse } from "../../lib/types";

export interface BoardFilters {
  projectId?: number;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  q?: string;
}

export function boardQueryKey(filters: BoardFilters) {
  return ["board", filters] as const;
}

export function boardColumnsQueryKey() {
  return ["board-columns"] as const;
}

function toBoardSearchParams(filters: BoardFilters) {
  const searchParams = new URLSearchParams();

  if (filters.projectId) {
    searchParams.set("projectId", String(filters.projectId));
  }

  if (filters.priority) {
    searchParams.set("priority", filters.priority);
  }

  const query = filters.q?.trim();
  if (query) {
    searchParams.set("q", query);
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export function useBoardQuery(filters: BoardFilters) {
  return useQuery({
    queryKey: boardQueryKey(filters),
    queryFn: () => apiClient<BoardResponse>(`/api/board${toBoardSearchParams(filters)}`),
    gcTime: 60 * 1000,
    placeholderData: (previousData) => previousData
  });
}

export function useBoardColumnsQuery() {
  return useQuery({
    queryKey: boardColumnsQueryKey(),
    queryFn: () => apiClient<BoardColumnsResponse>("/api/board-columns"),
    gcTime: 60 * 1000,
    placeholderData: (previousData) => previousData
  });
}
