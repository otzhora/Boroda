import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";

export interface JiraSettings {
  baseUrl: string;
  email: string;
  hasApiToken: boolean;
}

export interface AssignedJiraIssue {
  key: string;
  summary: string;
}

export interface AssignedJiraIssuesResponse {
  issues: AssignedJiraIssue[];
  total: number;
}

export interface UpdateJiraSettingsPayload {
  baseUrl: string;
  email: string;
  apiToken?: string;
}

export function jiraSettingsQueryKey() {
  return ["jira", "settings"] as const;
}

export function assignedJiraIssuesQueryKey() {
  return ["jira", "issues", "assigned"] as const;
}

export function useJiraSettingsQuery() {
  return useQuery({
    queryKey: jiraSettingsQueryKey(),
    queryFn: () => apiClient<JiraSettings>("/api/integrations/jira/settings")
  });
}

export function useAssignedJiraIssuesQuery() {
  return useQuery({
    queryKey: assignedJiraIssuesQueryKey(),
    queryFn: () => apiClient<AssignedJiraIssuesResponse>("/api/integrations/jira/issues/assigned")
  });
}

export function useUpdateJiraSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateJiraSettingsPayload) =>
      apiClient<{ ok: true; hasApiToken: boolean }>("/api/integrations/jira/settings", {
        method: "PUT",
        body: JSON.stringify(payload)
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: jiraSettingsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: assignedJiraIssuesQueryKey() })
      ]);
    }
  });
}
