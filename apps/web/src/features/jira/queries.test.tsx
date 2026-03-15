import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTicketListItem } from "../../test/fixtures/models";
import { createTestQueryClient } from "../../test/query-client";

const mocks = vi.hoisted(() => ({
  apiClient: vi.fn()
}));

vi.mock("../../lib/api-client", () => ({
  apiClient: mocks.apiClient
}));

import { useJiraLinkableTicketsQuery } from "./queries";

describe("useJiraLinkableTicketsQuery", () => {
  afterEach(() => {
    mocks.apiClient.mockReset();
  });

  it("loads Jira linkable tickets from the dedicated Jira endpoint", async () => {
    mocks.apiClient.mockResolvedValue({
      items: [
        createTicketListItem({
          id: 21,
          key: "BRD-21",
          title: "Operational cleanup ticket",
          status: "READY",
          priority: "MEDIUM",
          createdAt: "",
          updatedAt: ""
        })
      ],
      meta: {
        jiraIssues: []
      }
    });

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useJiraLinkableTicketsQuery("OPS-42", "BRD-21"), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    expect(mocks.apiClient).toHaveBeenCalledWith(
      "/api/integrations/jira/issues/OPS-42/linkable-tickets?q=BRD-21"
    );
  });
});
