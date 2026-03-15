import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JIRA_PAGE_SIZE } from "../features/jira/page-helpers";
import { boardColumnsFixture, defaultEditableBoardColumn } from "../test/fixtures/board-columns";
import { createProject, createTicketListItem } from "../test/fixtures/models";
import { renderWithProviders } from "../test/render-with-providers";

const mocks = vi.hoisted(() => ({
  useBoardColumnsQuery: vi.fn(),
  useJiraSettingsQuery: vi.fn(),
  useAssignedJiraIssueLinksQuery: vi.fn(),
  useJiraLinkableTicketsQuery: vi.fn(),
  useProjectsQuery: vi.fn(),
  createMutate: vi.fn(),
  addJiraLinkMutate: vi.fn()
}));

vi.mock("../features/board/queries", () => ({
  useBoardColumnsQuery: mocks.useBoardColumnsQuery
}));

vi.mock("../features/jira/queries", () => ({
  useJiraSettingsQuery: mocks.useJiraSettingsQuery,
  useAssignedJiraIssueLinksQuery: mocks.useAssignedJiraIssueLinksQuery,
  useJiraLinkableTicketsQuery: mocks.useJiraLinkableTicketsQuery
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

import { JiraPage } from "./jira-page";

const quickCreateStatus = defaultEditableBoardColumn.status;

describe("JiraPage", () => {
  beforeEach(() => {
    mocks.useBoardColumnsQuery.mockReset();
    mocks.useJiraSettingsQuery.mockReset();
    mocks.useAssignedJiraIssueLinksQuery.mockReset();
    mocks.useJiraLinkableTicketsQuery.mockReset();
    mocks.useProjectsQuery.mockReset();
    mocks.createMutate.mockReset();
    mocks.addJiraLinkMutate.mockReset();

    mocks.useJiraSettingsQuery.mockReturnValue({
      data: {
        baseUrl: "https://jira.example.test",
        email: "me@example.test",
        hasApiToken: true
      }
    });

    mocks.useBoardColumnsQuery.mockReturnValue({
      data: {
        columns: boardColumnsFixture
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
      data: [createProject({ createdAt: "", updatedAt: "" })]
    });

    mocks.useJiraLinkableTicketsQuery.mockReturnValue({
      data: [
        createTicketListItem({
          id: 21,
          key: "BRD-21",
          title: "Operational cleanup ticket",
          status: quickCreateStatus,
          priority: "MEDIUM",
          createdAt: "",
          updatedAt: "2026-03-06T11:00:00.000Z"
        })
      ],
      isLoading: false
    });
  });

  it("renders only the needs-boroda status chip and defaults to needs-boroda sorting", () => {
    renderWithProviders(<JiraPage />);

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
    expect(screen.queryByText("Linked")).not.toBeInTheDocument();
    expect(screen.getByText("1 Boroda ticket")).toHaveClass("w-[12.5rem]");
    expect(screen.getByText("0 Boroda tickets")).toHaveClass("w-[12.5rem]");
  });

  it("re-sorts Jira issues from the sort control", async () => {
    const user = userEvent.setup();

    renderWithProviders(<JiraPage />);
    await user.selectOptions(screen.getByLabelText("Sort Jira issues"), "linked-first");

    const jiraLinks = screen.getAllByRole("link", { name: /Open Jira issue/i });
    expect(jiraLinks[0]).toHaveAccessibleName("Open Jira issue PAY-128");
  });

  it("paginates Jira issues and moves through pages", async () => {
    const user = userEvent.setup();
    mocks.useAssignedJiraIssueLinksQuery.mockReturnValue({
      data: {
        total: JIRA_PAGE_SIZE + 1,
        linked: 0,
        unlinked: JIRA_PAGE_SIZE + 1,
        issues: Array.from({ length: JIRA_PAGE_SIZE + 1 }, (_, index) => ({
          key: `OPS-${String(index + 1).padStart(3, "0")}`,
          summary: `Issue ${index + 1}`,
          borodaTickets: []
        }))
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn()
    });

    renderWithProviders(<JiraPage />);

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Jira issue OPS-001" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Jira issue OPS-051" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Jira issue OPS-011" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Jira issue OPS-001" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2, current page" })).toBeInTheDocument();
  });

  it("resets Jira issue pagination when filtering changes the result set", async () => {
    const user = userEvent.setup();
    mocks.useAssignedJiraIssueLinksQuery.mockReturnValue({
      data: {
        total: JIRA_PAGE_SIZE + 2,
        linked: 0,
        unlinked: JIRA_PAGE_SIZE + 2,
        issues: [
          ...Array.from({ length: JIRA_PAGE_SIZE }, (_, index) => ({
            key: `PAY-${String(index + 1).padStart(3, "0")}`,
            summary: `Payments ${index + 1}`,
            borodaTickets: []
          })),
          {
            key: "OPS-777",
            summary: "Ops match",
            borodaTickets: []
          },
          {
            key: "OPS-888",
            summary: "Ops backup",
            borodaTickets: []
          }
        ]
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn()
    });

    renderWithProviders(<JiraPage />);

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search"), "ops");

    await waitFor(() => {
      expect(screen.queryByText("Page 2 of 2")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Open Jira issue OPS-777" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous page" })).not.toBeInTheDocument();
  });

  it("filters Jira issues from the search field", async () => {
    const user = userEvent.setup();

    renderWithProviders(<JiraPage />);
    await user.type(screen.getByLabelText("Search"), "ops");

    expect(screen.getByText("1 of 2 issues")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Jira issue OPS-42" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Jira issue PAY-128" })).not.toBeInTheDocument();
  });

  it("shows a filtered empty state when search has no matches", async () => {
    const user = userEvent.setup();

    renderWithProviders(<JiraPage />);
    await user.type(screen.getByLabelText("Search"), "missing");

    expect(screen.getByText("No Jira issues match this search.")).toBeInTheDocument();
  });

  it("focuses the search field from the board-style hotkeys", async () => {
    const user = userEvent.setup();

    renderWithProviders(<JiraPage />);
    const searchInput = screen.getByLabelText("Search");

    expect(searchInput).not.toHaveFocus();

    await user.keyboard("/");
    expect(searchInput).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(searchInput).not.toHaveFocus();

    await user.keyboard("{Control>}k{/Control}");
    expect(searchInput).toHaveFocus();
  });

  it("shows Boroda links when a Jira issue is expanded", async () => {
    const user = userEvent.setup();

    renderWithProviders(<JiraPage />);
    await user.click(screen.getByRole("button", { name: "Show links for PAY-128" }));

    expect(screen.getByRole("link", { name: "Open Boroda ticket BRD-12" })).toHaveAttribute(
      "href",
      "/?ticketId=12"
    );
    expect(screen.getByRole("button", { name: "Create new Boroda" })).toBeInTheDocument();
  });

  it("opens the quick-create dialog for an unlinked Jira issue", async () => {
    const user = userEvent.setup();

    renderWithProviders(<JiraPage />);
    await user.click(screen.getByRole("button", { name: "Show links for OPS-42" }));
    await user.click(screen.getByRole("button", { name: "Create new Boroda" }));

    expect(await screen.findByRole("dialog", { name: "Create new Boroda ticket" })).toBeInTheDocument();
    expect(screen.getByText("Linked Jira issue")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ops cleanup")).toBeInTheDocument();
  });

  it("links an existing Boroda ticket to the Jira issue", async () => {
    const user = userEvent.setup();

    renderWithProviders(<JiraPage />);
    await user.click(screen.getByRole("button", { name: "Show links for OPS-42" }));
    await user.click(screen.getByRole("button", { name: "Link existing Boroda" }));

    expect(await screen.findByRole("dialog", { name: "Link existing Boroda ticket" })).toBeInTheDocument();
    expect(screen.getByText("Search to find a Boroda ticket to link.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search Boroda tickets"), "BRD-21");
    expect(mocks.useJiraLinkableTicketsQuery).toHaveBeenLastCalledWith("OPS-42", "");
    await waitFor(() => {
      expect(mocks.useJiraLinkableTicketsQuery).toHaveBeenLastCalledWith("OPS-42", "BRD-21");
    });
    expect(screen.queryByText("BRD-12")).not.toBeInTheDocument();
    const targetTicketRow = screen.getByText("BRD-21").closest("li");
    expect(targetTicketRow).not.toBeNull();
    await user.click(within(targetTicketRow as HTMLLIElement).getByRole("button", { name: "Link ticket" }));

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

    renderWithProviders(<JiraPage />);
    await user.click(screen.getByRole("button", { name: "Show links for OPS-42" }));
    await user.click(screen.getByRole("button", { name: "Create new Boroda" }));

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Operational cleanup follow-up");
    await user.selectOptions(screen.getByLabelText("Project"), "1");
    await user.selectOptions(screen.getByLabelText("Status"), quickCreateStatus);
    await user.selectOptions(screen.getByLabelText("Priority"), "HIGH");
    await user.click(screen.getByRole("button", { name: "Create new Boroda ticket" }));

    expect(mocks.createMutate).toHaveBeenCalledWith({
      title: "Operational cleanup follow-up",
      description: "",
      branch: null,
      workspaces: [],
      jiraIssues: [{ key: "OPS-42", summary: "Ops cleanup" }],
      status: quickCreateStatus,
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
