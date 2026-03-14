import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import type { Project } from "../../lib/types";
import type { ProjectScope } from "./page-helpers";

export const PROJECTS_QUERY_KEY = ["projects"] as const;

export function projectsQueryKey(scope: ProjectScope = "active") {
  return [...PROJECTS_QUERY_KEY, { scope }] as const;
}

export function useProjectsQuery(scope: ProjectScope = "active") {
  return useQuery({
    queryKey: projectsQueryKey(scope),
    queryFn: () => apiClient<Project[]>(`/api/projects?scope=${scope}`)
  });
}
