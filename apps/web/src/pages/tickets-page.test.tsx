import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api-client";
import { boardColumnsFixture, defaultEditableBoardColumn, doneBoardColumn } from "../test/fixtures/board-columns";
import { renderWithProviders } from "../test/render-with-providers";

const mocks = vi.hoisted(() => ({
  useBoardColumnsQuery: vi.fn(),
  useProjectsQuery: vi.fn(),
  useTicketsQuery: vi.fn(),
  useTicketQuery: vi.fn(),
  refetchTickets: vi.fn(),
  updateMutate: vi.fn(),
  deleteMutate: vi.fn(),
  deleteMutateAsync: vi.fn(),
  unarchiveMutate: vi.fn(),
  openTerminalMutateAsync: vi.fn(),
  refreshJiraMutate: vi.fn()
}));

const doneColumn = doneBoardColumn;
const secondaryTicketStatus = defaultEditableBoardColumn.status;

vi.mock("../features/board/queries", () => ({
  useBoardColumnsQuery: mocks.useBoardColumnsQuery
}));

vi.mock("../features/projects/queries", () => ({
  useProjectsQuery: mocks.useProjectsQuery
}));

vi.mock("../features/tickets/queries", () => ({
  useTicketsQuery: mocks.useTicketsQuery,
  useTicketQuery: mocks.useTicketQuery
}));

vi.mock("../features/tickets/mutations", () => ({
  useUpdateTicketMutation: vi.fn(() => ({
    mutate: mocks.updateMutate,
    isPending: false,
    error: null
  })),
  useDeleteTicketMutation: vi.fn(() => ({
    mutate: mocks.deleteMutate,
    mutateAsync: mocks.deleteMutateAsync,
    isPending: false,
    error: null
  })),
  useUnarchiveTicketMutation: vi.fn(() => ({
    mutate: mocks.unarchiveMutate,
    isPending: false,
    error: null
  })),
  useOpenTicketInAppMutation: vi.fn(() => ({
    mutateAsync: mocks.openTerminalMutateAsync,
    isPending: false,
    error: null
  })),
  useRefreshTicketJiraLinksMutation: vi.fn(() => ({
    mutate: mocks.refreshJiraMutate,
    isPending: false,
    error: null
  }))
}));

vi.mock("../components/ticket/ticket-drawer", () => ({
  TicketDrawer: ({
    ticketId,
    ticket,
    onArchive,
    onRestore,
    onDelete,
    onClose
  }: {
    ticketId: number | null;
    ticket?: { archivedAt: string | null };
    onArchive?: () => void;
    onRestore?: () => void;
    onDelete?: () => void;
    onClose: () => void;
  }) => {
    useEffect(() => {
      if (ticketId === null) {
        return;
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
        }
      };

      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [ticketId]);

    if (ticketId === null) {
      return null;
    }

    return (
      <div data-testid="ticket-drawer">
        {ticket?.archivedAt ? (
          <button type="button" onClick={onRestore}>
            Restore ticket
          </button>
        ) : (
          <button type="button" onClick={onArchive ?? onDelete}>
            Archive ticket
          </button>
        )}
        <button type="button" onClick={onClose}>
          Close drawer
        </button>
      </div>
    );
  }
}));

import { TicketsPage } from "./tickets-page";

describe("TicketsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.useProjectsQuery.mockReset();
    mocks.useBoardColumnsQuery.mockReset();
    mocks.useTicketsQuery.mockReset();
    mocks.useTicketQuery.mockReset();
    mocks.refetchTickets.mockReset();
    mocks.updateMutate.mockReset();
    mocks.deleteMutate.mockReset();
    mocks.deleteMutateAsync.mockReset();
    mocks.unarchiveMutate.mockReset();
    mocks.openTerminalMutateAsync.mockReset();
    mocks.refreshJiraMutate.mockReset();

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
    mocks.useBoardColumnsQuery.mockReturnValue({
      data: {
        columns: boardColumnsFixture
      }
    });

    mocks.useTicketsQuery.mockReturnValue({
      data: [
        {
          id: 12,
          key: "BRD-12",
          title: "Fix drawer save state",
          description: "",
          branch: null,
          status: "IN_PROGRESS",
          priority: "HIGH",
          dueAt: null,
          createdAt: "",
          updatedAt: "2026-03-06T10:00:00.000Z",
          archivedAt: null,
          contextsCount: 2,
          projectBadges: [
            {
              id: 1,
              name: "Payments Backend",
              color: "#355c7d",
              relationship: "PRIMARY"
            }
          ],
          jiraIssues: [{ key: "PAY-128", summary: "Fix drawer save state" }]
        },
        {
          id: 21,
          key: "BRD-21",
          title: "Archive export mismatch",
          description: "",
          branch: null,
          status: secondaryTicketStatus,
          priority: "LOW",
          dueAt: null,
          createdAt: "",
          updatedAt: "2026-03-07T10:00:00.000Z",
          archivedAt: null,
          contextsCount: 0,
          projectBadges: [],
          jiraIssues: [{ key: "OPS-42", summary: "Archive export mismatch" }]
        }
      ],
      isLoading: false,
      isError: false,
      refetch: mocks.refetchTickets
    });

    mocks.useTicketQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false
    });
  });

  it("updates tickets filters from search, scope, and dropdown filters", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TicketsPage />, { initialEntries: ["/tickets"] });

    expect(mocks.useTicketsQuery).toHaveBeenCalledWith({ q: undefined, scope: "active" });

    await user.type(screen.getByLabelText("Search"), "drawer");
    expect(mocks.useTicketsQuery).toHaveBeenCalledWith({ q: "drawer", scope: "active" });

    await user.click(screen.getByRole("tab", { name: "Archived" }));
    expect(mocks.useTicketsQuery).toHaveBeenCalledWith({ q: "drawer", scope: "archived" });

    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.click(screen.getByLabelText(doneColumn.label));
    expect(mocks.useTicketsQuery).toHaveBeenCalledWith({
      q: "drawer",
      scope: "archived",
      status: [doneColumn.status]
    });

    await user.click(screen.getByRole("button", { name: "Jira issue" }));
    await user.type(screen.getByLabelText("Jira issue filter"), "PAY");
    await user.click(screen.getByLabelText("PAY-128"));
    expect(mocks.useTicketsQuery).toHaveBeenCalledWith({
      q: "drawer",
      jiraIssue: ["PAY-128"],
      scope: "archived",
      status: [doneColumn.status]
    });
  });

  it("cycles sort from ascending to descending to default", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TicketsPage />, { initialEntries: ["/tickets"] });

    const rowsBefore = screen.getAllByRole("button", { name: /Open ticket /i });
    expect(rowsBefore[0]).toHaveAccessibleName("Open ticket BRD-12 Fix drawer save state");

    await user.click(screen.getByRole("button", { name: "Priority, not sorted" }));
    expect(screen.getByRole("button", { name: "Priority, ascending" })).toBeInTheDocument();
    let rows = screen.getAllByRole("button", { name: /Open ticket /i });
    expect(rows[0]).toHaveAccessibleName("Open ticket BRD-21 Archive export mismatch");

    await user.click(screen.getByRole("button", { name: "Priority, ascending" }));
    expect(screen.getByRole("button", { name: "Priority, descending" })).toBeInTheDocument();
    rows = screen.getAllByRole("button", { name: /Open ticket /i });
    expect(rows[0]).toHaveAccessibleName("Open ticket BRD-12 Fix drawer save state");

    await user.click(screen.getByRole("button", { name: "Priority, descending" }));
    expect(screen.getByRole("button", { name: "Priority, not sorted" })).toBeInTheDocument();
    rows = screen.getAllByRole("button", { name: /Open ticket /i });
    expect(rows[0]).toHaveAccessibleName("Open ticket BRD-12 Fix drawer save state");
  });

  it("shows standup state in the subtitle and keeps clear all scoped to ticket filters", async () => {
    const user = userEvent.setup();

    window.localStorage.setItem("boroda.lastStandupCompletedAt", "2026-03-10T06:06:00.000Z");

    renderWithProviders(<TicketsPage />, { initialEntries: ["/tickets"] });

    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
    expect(screen.getByText("2 tickets in current")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "For standup" }));

    expect(screen.getByText(/0 tickets in current · Since last standup:/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Search"), "drawer");

    const filterButton = screen.getByRole("button", { name: "Filter" });
    expect(filterButton.className).toContain("bg-accent-500");

    await user.click(filterButton);
    await user.click(screen.getByRole("button", { name: "Clear all" }));

    expect(screen.getByText(/0 tickets in current · Since last standup:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filter" }).className).not.toContain("bg-accent-500");
  });

  it("opens the shared ticket drawer from a list row", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TicketsPage />, { initialEntries: ["/tickets"] });
    await user.click(screen.getByRole("button", { name: "Open ticket BRD-12 Fix drawer save state" }));

    expect(await screen.findByTestId("ticket-drawer")).toBeInTheDocument();
  });

  it("retries archive with force after confirming dirty worktrees", async () => {
    const user = userEvent.setup();

    mocks.deleteMutateAsync.mockRejectedValueOnce(
      new ApiError("One or more ticket worktrees have uncommitted changes", 409, "TICKET_ARCHIVE_DIRTY_WORKTREES", {
        dirtyWorktrees: [
          {
            branchName: "feature/archive-fixture",
            worktreePath: "/tmp/managed/feature/archive-fixture"
          }
        ]
      })
    );
    mocks.deleteMutateAsync.mockResolvedValueOnce({ ok: true });

    renderWithProviders(<TicketsPage />, { initialEntries: ["/tickets"] });
    await user.click(screen.getByRole("button", { name: "Open ticket BRD-12 Fix drawer save state" }));
    await user.click(screen.getByRole("button", { name: "Archive ticket" }));

    expect(await screen.findByRole("dialog", { name: "Delete dirty worktrees" })).toBeInTheDocument();
    expect(screen.getByText("feature/archive-fixture")).toBeInTheDocument();
    expect(screen.getByText("/tmp/managed/feature/archive-fixture")).toBeInTheDocument();
    expect(mocks.deleteMutateAsync).toHaveBeenNthCalledWith(1, undefined);

    await user.click(screen.getByRole("button", { name: "Delete and archive" }));

    expect(mocks.deleteMutateAsync).toHaveBeenNthCalledWith(2, { force: true });
  });

  it("restores archived tickets from the drawer", async () => {
    const user = userEvent.setup();

    mocks.useTicketsQuery.mockReturnValue({
      data: [
        {
          id: 12,
          key: "BRD-12",
          title: "Fix drawer save state",
          description: "",
          branch: null,
          status: "IN_PROGRESS",
          priority: "HIGH",
          dueAt: null,
          createdAt: "",
          updatedAt: "2026-03-06T10:00:00.000Z",
          archivedAt: "2026-03-10T10:00:00.000Z",
          contextsCount: 2,
          projectBadges: [],
          jiraIssues: []
        }
      ],
      isLoading: false,
      isError: false,
      refetch: mocks.refetchTickets
    });
    mocks.useTicketQuery.mockReturnValue({
      data: {
        id: 12,
        key: "BRD-12",
        title: "Fix drawer save state",
        description: "",
        branch: null,
        workspaces: [],
        status: "IN_PROGRESS",
        priority: "HIGH",
        dueAt: null,
        createdAt: "",
        updatedAt: "2026-03-06T10:00:00.000Z",
        archivedAt: "2026-03-10T10:00:00.000Z",
        projectLinks: [],
        jiraIssues: [],
        workContexts: [],
        activities: []
      },
      isLoading: false,
      isError: false
    });

    renderWithProviders(<TicketsPage />, { initialEntries: ["/tickets?scope=archived"] });
    await user.click(screen.getByRole("button", { name: "Open ticket BRD-12 Fix drawer save state" }));
    await user.click(screen.getByRole("button", { name: "Restore ticket" }));

    expect(mocks.unarchiveMutate).toHaveBeenCalledTimes(1);
  });

  it("focuses the search field from the board-style hotkeys", async () => {
    const user = userEvent.setup();

    renderWithProviders(<TicketsPage />, { initialEntries: ["/tickets"] });
    const searchInput = screen.getByLabelText("Search");

    expect(searchInput).not.toHaveFocus();

    await user.keyboard("/");
    expect(searchInput).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(searchInput).not.toHaveFocus();

    await user.keyboard("{Control>}k{/Control}");
    expect(searchInput).toHaveFocus();
  });
});
