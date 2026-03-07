import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useJiraSettingsQuery: vi.fn(),
  useAssignedJiraIssueLinksQuery: vi.fn(),
  useProjectsQuery: vi.fn(),
  useTicketsQuery: vi.fn(),
  createMutate: vi.fn(),
  addJiraLinkMutate: vi.fn()
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
  })),
  useAddTicketJiraLinkMutation: vi.fn(() => ({
    mutate: mocks.addJiraLinkMutate,
    isPending: false,
    error: null
  }))
}));

vi.mock("../features/tickets/queries", () => ({
  useTicketsQuery: mocks.useTicketsQuery
}));

import { JiraPage } from "./jira-page";

function renderJiraPage(options?: { initialEntries?: string[] }) {
  const queryClient = new QueryClient();

  return render(
    <MemoryRouter initialEntries={options?.initialEntries}>
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
    mocks.useTicketsQuery.mockReset();
    mocks.createMutate.mockReset();
    mocks.addJiraLinkMutate.mockReset();

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

    mocks.useTicketsQuery.mockReturnValue({
      data: [
        {
          id: 12,
          key: "BRD-12",
          title: "Refactor backend service",
          description: "",
          branch: null,
          status: "IN_PROGRESS",
          priority: "HIGH",
          dueAt: null,
          createdAt: "",
          updatedAt: "2026-03-06T10:00:00.000Z",
          archivedAt: null
        },
        {
          id: 21,
          key: "BRD-21",
          title: "Operational cleanup ticket",
          description: "",
          branch: null,
          status: "READY",
          priority: "MEDIUM",
          dueAt: null,
          createdAt: "",
          updatedAt: "2026-03-06T11:00:00.000Z",
          archivedAt: null
        }
      ],
      isLoading: false
    });
  });

  it("renders color-coded status chips and defaults to needs-boroda sorting", () => {
    renderJiraPage();

    expect(screen.getByRole("link", { name: "Open Jira issue PAY-128" })).toHaveAttribute(
      "href",
      "https://jira.example.test/browse/PAY-128"
    );
    expect(screen.getByLabelText("Sort Jira issues")).toHaveValue("needs-boroda");
    expect(screen.getAllByRole("button", { name: /show links for/i })).toHaveLength(2);

    expect(
      screen
        .getAllByText("Needs Boroda")
        .find((element) => element.tagName === "SPAN")
    ).toHaveClass("border-amber-300/24", "bg-amber-300/10");
    expect(
      screen
        .getAllByText("Linked")
        .find((element) => element.tagName === "SPAN")
    ).toHaveClass("border-emerald-400/24", "bg-emerald-400/10");
  });

  it("re-sorts Jira issues from the sort control", async () => {
    const user = userEvent.setup();

    renderJiraPage();
    await user.selectOptions(screen.getByLabelText("Sort Jira issues"), "linked-first");

    const jiraLinks = screen.getAllByRole("link", { name: /Open Jira issue/i });
    expect(jiraLinks[0]).toHaveAccessibleName("Open Jira issue PAY-128");
  });

  it("shows Boroda links when a Jira issue is expanded", async () => {
    const user = userEvent.setup();

    renderJiraPage();
    await user.click(screen.getByRole("button", { name: "Show links for PAY-128" }));

    expect(screen.getByRole("link", { name: "Open Boroda ticket BRD-12" })).toHaveAttribute(
      "href",
      "/?ticketId=12"
    );
    expect(screen.getByRole("button", { name: "Create new Boroda" })).toBeInTheDocument();
  });

  it("opens the quick-create dialog for an unlinked Jira issue", async () => {
    const user = userEvent.setup();

    renderJiraPage();
    await user.click(screen.getByRole("button", { name: "Show links for OPS-42" }));
    await user.click(screen.getByRole("button", { name: "Create new Boroda" }));

    expect(await screen.findByRole("dialog", { name: "Create new Boroda ticket" })).toBeInTheDocument();
    expect(screen.getByText("Linked Jira issue")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ops cleanup")).toBeInTheDocument();
  });

  it("links an existing Boroda ticket to the Jira issue", async () => {
    const user = userEvent.setup();

    renderJiraPage();
    await user.click(screen.getByRole("button", { name: "Show links for OPS-42" }));
    await user.click(screen.getByRole("button", { name: "Link existing Boroda" }));

    expect(await screen.findByRole("dialog", { name: "Link existing Boroda ticket" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search Boroda tickets"), "BRD-21");
    await user.click(screen.getByRole("button", { name: "Link ticket" }));

    expect(mocks.addJiraLinkMutate).toHaveBeenCalledWith(
      {
        ticketId: 21,
        key: "OPS-42",
        summary: "Ops cleanup"
      },
      expect.any(Object)
    );
  });

  it("submits a linked Boroda ticket from the quick-create dialog", async () => {
    const user = userEvent.setup();

    renderJiraPage();
    await user.click(screen.getByRole("button", { name: "Show links for OPS-42" }));
    await user.click(screen.getByRole("button", { name: "Create new Boroda" }));

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Operational cleanup follow-up");
    await user.selectOptions(screen.getByLabelText("Project"), "1");
    await user.selectOptions(screen.getByLabelText("Status"), "READY");
    await user.selectOptions(screen.getByLabelText("Priority"), "HIGH");
    await user.click(screen.getByRole("button", { name: "Create new Boroda ticket" }));

    expect(mocks.createMutate).toHaveBeenCalledWith({
      title: "Operational cleanup follow-up",
      description: "",
      branch: null,
      workspaces: [],
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
