import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import type { Project } from "../../lib/types";

export const PROJECTS_QUERY_KEY = ["projects"] as const;

export function useProjectsQuery() {
  return useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: () => apiClient<Project[]>("/api/projects")
  });
}
