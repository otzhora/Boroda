import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useJiraSettingsQuery: vi.fn(),
  useAssignedJiraIssueLinksQuery: vi.fn(),
  useProjectsQuery: vi.fn(),
  createMutate: vi.fn()
}));

vi.mock("../features/jira/queries", () => ({
  useJiraSettingsQuery: mocks.useJiraSettingsQuery,
  useAssignedJiraIssueLinksQuery: mocks.useAssignedJiraIssueLinksQuery
}));

vi.mock("../features/projects/queries", () => ({
  useProjectsQuery: mocks.useProjectsQuery
}));

vi.mock("../features/tickets/mutations", () => ({
  useCreateTicketMutation: vi.fn(() => ({
    mutate: mocks.createMutate,
    isPending: false,
    error: null,
    variables: undefined
  }))
}));

import { JiraPage } from "./jira-page";

function renderJiraPage() {
  const queryClient = new QueryClient();

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <JiraPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("JiraPage", () => {
  beforeEach(() => {
    mocks.useJiraSettingsQuery.mockReset();
    mocks.useAssignedJiraIssueLinksQuery.mockReset();
    mocks.useProjectsQuery.mockReset();
    mocks.createMutate.mockReset();

    mocks.useJiraSettingsQuery.mockReturnValue({
      data: {
        baseUrl: "https://jira.example.test",
        email: "me@example.test",
        hasApiToken: true
      }
    });

    mocks.useAssignedJiraIssueLinksQuery.mockReturnValue({
      data: {
        total: 2,
        linked: 1,
        unlinked: 1,
        issues: [
          {
            key: "PAY-128",
            summary: "Backend refactor",
            borodaTickets: [
              {
                id: 12,
                key: "BRD-12",
                title: "Refactor backend service",
                status: "IN_PROGRESS",
                priority: "HIGH",
                updatedAt: "2026-03-06T10:00:00.000Z"
              }
            ]
          },
          {
            key: "OPS-42",
            summary: "Ops cleanup",
            borodaTickets: []
          }
        ]
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn()
    });

    mocks.useProjectsQuery.mockReturnValue({
      data: [
        {
          id: 1,
          name: "Payments Backend",
          slug: "payments-backend",
          description: "",
          color: "#355c7d",
          createdAt: "",
          updatedAt: "",
          folders: []
        }
      ]
    });
  });

  it("renders Jira issues beside Boroda links", () => {
    renderJiraPage();

    expect(screen.getByRole("link", { name: "Open Jira issue PAY-128" })).toHaveAttribute(
      "href",
      "https://jira.example.test/browse/PAY-128"
    );
    expect(screen.getByRole("link", { name: "Open Boroda ticket BRD-12" })).toHaveAttribute(
      "href",
      "/?ticketId=12"
    );
    expect(screen.getByText("No Boroda ticket")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New linked" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create linked" })).toBeInTheDocument();
  });

  it("opens the quick-create dialog for an unlinked Jira issue", async () => {
    const user = userEvent.setup();

    renderJiraPage();
    await user.click(screen.getByRole("button", { name: "Create linked" }));

    expect(await screen.findByRole("dialog", { name: "Create linked ticket" })).toBeInTheDocument();
    expect(screen.getByText("Linked Jira issue")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ops cleanup")).toBeInTheDocument();
  });

  it("submits a linked Boroda ticket from the quick-create dialog", async () => {
    const user = userEvent.setup();

    renderJiraPage();
    await user.click(screen.getByRole("button", { name: "Create linked" }));

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Operational cleanup follow-up");
    await user.selectOptions(screen.getByLabelText("Project"), "1");
    await user.selectOptions(screen.getByLabelText("Status"), "READY");
    await user.selectOptions(screen.getByLabelText("Priority"), "HIGH");
    await user.click(screen.getByRole("button", { name: "Create linked ticket" }));

    expect(mocks.createMutate).toHaveBeenCalledWith({
      title: "Operational cleanup follow-up",
      description: "",
      branch: null,
      jiraIssues: [{ key: "OPS-42", summary: "Ops cleanup" }],
      status: "READY",
      priority: "HIGH",
      dueAt: null,
      projectLinks: [
        {
          projectId: 1,
          relationship: "PRIMARY"
        }
      ]
    });
  });
});
