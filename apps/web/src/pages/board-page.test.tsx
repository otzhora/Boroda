import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "../lib/api-client";

const mocks = vi.hoisted(() => ({
  useBoardQuery: vi.fn(),
  useBoardColumnsQuery: vi.fn(),
  useProjectsQuery: vi.fn(),
  useTicketQuery: vi.fn(),
  refetchBoard: vi.fn(),
  createMutate: vi.fn(),
  createBoardColumnMutate: vi.fn(),
  renameBoardColumnMutate: vi.fn(),
  deleteBoardColumnMutate: vi.fn(),
  updateMutate: vi.fn(),
  deleteMutate: vi.fn(),
  deleteMutateAsync: vi.fn(),
  moveMutate: vi.fn(),
  openTerminalMutate: vi.fn(),
  refreshJiraMutate: vi.fn()
}));

vi.mock("../features/board/queries", () => ({
  useBoardQuery: mocks.useBoardQuery,
  useBoardColumnsQuery: mocks.useBoardColumnsQuery
}));

vi.mock("../features/board/mutations", () => ({
  useCreateBoardColumnMutation: vi.fn(() => ({
    mutate: mocks.createBoardColumnMutate,
    isPending: false,
    error: null
  })),
  useRenameBoardColumnMutation: vi.fn(() => ({
    mutate: mocks.renameBoardColumnMutate,
    isPending: false,
    error: null
  })),
  useDeleteBoardColumnMutation: vi.fn(() => ({
    mutate: mocks.deleteBoardColumnMutate,
    isPending: false,
    error: null
  }))
}));

vi.mock("../features/projects/queries", () => ({
  useProjectsQuery: mocks.useProjectsQuery
}));

vi.mock("../features/tickets/queries", () => ({
  useTicketQuery: mocks.useTicketQuery
}));

vi.mock("../features/tickets/mutations", () => ({
  useCreateTicketMutation: vi.fn(() => ({
    mutate: mocks.createMutate,
    isPending: false,
    error: null
  })),
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
  useMoveTicketStatusMutation: vi.fn(() => ({
    mutate: mocks.moveMutate,
    isPending: false,
    error: null
  })),
  useOpenTicketInAppMutation: vi.fn(() => ({
    mutate: mocks.openTerminalMutate,
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
    onArchive,
    onRestore,
    onClose
  }: {
    ticketId: number | null;
    onArchive: () => void;
    onRestore: () => void;
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
        <button type="button" onClick={onArchive}>
          Archive ticket
        </button>
        <button type="button" onClick={onClose}>
          Close drawer
        </button>
      </div>
    );
  }
}));

vi.mock("../components/board/board-view", () => ({
  BoardView: ({
    onMoveTicket,
    onSelectTicket,
    onAddColumn,
    onRenameColumn,
    onDeleteColumn
  }: {
    onMoveTicket: (ticketId: number, status: string) => void;
    onSelectTicket: (ticketId: number) => void;
    onAddColumn: (relativeToStatus: string, placement: "before" | "after") => void;
    onRenameColumn: (status: string, label: string) => void;
    onDeleteColumn: (status: string) => void;
  }) => (
    <>
      <button type="button" onClick={() => onMoveTicket(12, "DONE")}>
        Trigger move
      </button>
      <button type="button" onClick={() => onSelectTicket(12)}>
        Select ticket
      </button>
      <button type="button" onClick={() => onAddColumn("READY", "after")}>
        Trigger add column
      </button>
      <button type="button" onClick={() => onRenameColumn("READY", "Ready")}>
        Trigger rename column
      </button>
      <button type="button" onClick={() => onDeleteColumn("READY")}>
        Trigger delete column
      </button>
    </>
  )
}));

import { BoardPage } from "./board-page";

function renderBoardPage(options?: { initialEntries?: string[] }) {
  const queryClient = new QueryClient();

  return render(
    <MemoryRouter initialEntries={options?.initialEntries}>
      <QueryClientProvider client={queryClient}>
        <BoardPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("BoardPage", () => {
  beforeEach(() => {
    mocks.useBoardQuery.mockReset();
    mocks.useBoardColumnsQuery.mockReset();
    mocks.useProjectsQuery.mockReset();
    mocks.useTicketQuery.mockReset();
    mocks.refetchBoard.mockReset();
    mocks.createMutate.mockReset();
    mocks.createBoardColumnMutate.mockReset();
    mocks.renameBoardColumnMutate.mockReset();
    mocks.deleteBoardColumnMutate.mockReset();
    mocks.updateMutate.mockReset();
    mocks.deleteMutate.mockReset();
    mocks.deleteMutateAsync.mockReset();
    mocks.moveMutate.mockReset();
    mocks.openTerminalMutate.mockReset();
    mocks.refreshJiraMutate.mockReset();

    mocks.useBoardQuery.mockReturnValue({
      data: { columns: [] },
      isLoading: false,
      isError: false,
      refetch: mocks.refetchBoard
    });
    mocks.useBoardColumnsQuery.mockReturnValue({
      data: {
        columns: [
          {
            id: 1,
            status: "INBOX",
            label: "Inbox",
            position: 0,
            createdAt: "",
            updatedAt: ""
          },
          {
            id: 2,
            status: "READY",
            label: "Ready",
            position: 1,
            createdAt: "",
            updatedAt: ""
          },
          {
            id: 3,
            status: "DONE",
            label: "Done",
            position: 2,
            createdAt: "",
            updatedAt: ""
          }
        ]
      }
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
        },
        {
          id: 2,
          name: "Infra",
          slug: "infra",
          description: "",
          color: "#223344",
          createdAt: "",
          updatedAt: "",
          folders: []
        }
      ]
    });

    mocks.useTicketQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false
    });
  });

  it("updates board filters and clears them", async () => {
    const user = userEvent.setup();

    renderBoardPage();

    await user.type(screen.getByLabelText("Search"), "bug");
    expect(mocks.useBoardQuery).toHaveBeenLastCalledWith({ q: "bug" });

    const filterButton = screen.getByRole("button", { name: "Filter" });
    expect(filterButton.className).toContain("bg-accent-500");

    await user.click(filterButton);
    const dialog = screen.getByRole("dialog", { name: "Board filters" });
    await user.click(within(dialog).getByRole("button", { name: "Project" }));
    await user.click(within(dialog).getByLabelText("Infra"));
    expect(mocks.useBoardQuery).toHaveBeenLastCalledWith({ q: "bug", projectId: 2 });

    await user.click(within(dialog).getByRole("button", { name: "Priority" }));
    await user.click(within(dialog).getByLabelText("HIGH"));
    expect(mocks.useBoardQuery).toHaveBeenLastCalledWith({
      q: "bug",
      projectId: 2,
      priority: "HIGH"
    });

    await user.click(within(dialog).getByRole("button", { name: "Clear all" }));
    expect(mocks.useBoardQuery).toHaveBeenLastCalledWith({});
    expect(screen.getByRole("button", { name: "Filter" }).className).not.toContain("bg-accent-500");
  });

  it("submits quick create with a primary project link", async () => {
    const user = userEvent.setup();

    renderBoardPage();

    await user.keyboard("c");

    const dialog = await screen.findByRole("dialog", { name: "Create ticket" });

    await user.type(within(dialog).getByLabelText("Title"), "Wire board filters");
    await user.selectOptions(within(dialog).getByLabelText("Project"), "1");
    await user.selectOptions(within(dialog).getByLabelText("Status"), "READY");
    await user.selectOptions(within(dialog).getByLabelText("Priority"), "HIGH");
    await user.click(within(dialog).getAllByRole("button", { name: "Create ticket" })[0]);

    expect(mocks.createMutate).toHaveBeenCalledWith({
      title: "Wire board filters",
      description: "",
      branch: null,
      workspaces: [],
      jiraIssues: [],
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

  it("dispatches board move actions through the move mutation", async () => {
    const user = userEvent.setup();
    mocks.useBoardQuery.mockReturnValue({
      data: {
        columns: [
          {
            status: "INBOX",
            label: "Inbox",
            tickets: [
              {
                id: 12,
                key: "BRD-12",
                title: "Trigger card",
                status: "INBOX",
                priority: "MEDIUM",
                contextsCount: 0,
                updatedAt: "",
                projectBadges: [],
                jiraIssues: []
              }
            ]
          }
        ]
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetchBoard
    });

    renderBoardPage();
    await user.click(screen.getByRole("button", { name: "Trigger move" }));

    expect(mocks.moveMutate).toHaveBeenCalledWith({
      ticketId: 12,
      status: "DONE"
    });
  });

  it("supports keyboard shortcuts for search and quick create", async () => {
    const user = userEvent.setup();

    renderBoardPage();

    await user.keyboard("/");
    expect(screen.getByLabelText("Search")).toHaveFocus();

    screen.getByLabelText("Search").blur();
    await user.keyboard("c");
    expect((await screen.findByLabelText("Title")) as HTMLElement).toHaveFocus();
  });

  it("creates a board column relative to an existing column", async () => {
    const user = userEvent.setup();
    mocks.useBoardQuery.mockReturnValue({
      data: {
        columns: [
          {
            status: "READY",
            label: "Ready",
            tickets: []
          }
        ]
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetchBoard
    });

    renderBoardPage();

    await user.click(screen.getByRole("button", { name: "Trigger add column" }));
    const dialog = await screen.findByRole("dialog", { name: "Add board column" });
    await user.type(within(dialog).getByLabelText("Column name"), "Needs QA");
    await user.click(within(dialog).getByRole("button", { name: "Add column" }));

    expect(mocks.createBoardColumnMutate).toHaveBeenCalledWith(
      {
        relativeToStatus: "READY",
        placement: "after",
        label: "Needs QA"
      },
      expect.any(Object)
    );
  });

  it("renames a board column", async () => {
    const user = userEvent.setup();
    mocks.useBoardQuery.mockReturnValue({
      data: {
        columns: [
          {
            status: "READY",
            label: "Ready",
            tickets: []
          }
        ]
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetchBoard
    });

    renderBoardPage();

    await user.click(screen.getByRole("button", { name: "Trigger rename column" }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText("Column name");
    await user.clear(input);
    await user.type(input, "Needs QA");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(mocks.renameBoardColumnMutate).toHaveBeenCalledWith(
      {
        status: "READY",
        label: "Needs QA"
      },
      expect.any(Object)
    );
  });

  it("does not close the selected ticket when escape was already handled", async () => {
    const user = userEvent.setup();
    mocks.useBoardQuery.mockReturnValue({
      data: {
        columns: [
          {
            status: "INBOX",
            label: "Inbox",
            tickets: [
              {
                id: 12,
                key: "BRD-12",
                title: "Trigger card",
                status: "INBOX",
                priority: "MEDIUM",
                contextsCount: 0,
                updatedAt: "",
                projectBadges: []
              }
            ]
          }
        ]
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetchBoard
    });

    renderBoardPage();

    await user.click(screen.getByRole("button", { name: "Select ticket" }));
    expect(screen.getByTestId("ticket-drawer")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.getByTestId("ticket-drawer")).toBeInTheDocument();
  });

  it("opens the deep-linked ticket from the search params", () => {
    renderBoardPage({ initialEntries: ["/?ticketId=12"] });

    expect(mocks.useTicketQuery).toHaveBeenLastCalledWith(12);
    expect(screen.getByTestId("ticket-drawer")).toBeInTheDocument();
  });

  it("shows an in-app confirmation before forcing archive of dirty worktrees", async () => {
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

    renderBoardPage({ initialEntries: ["/?ticketId=12"] });

    await user.click(screen.getByRole("button", { name: "Archive ticket" }));

    expect(await screen.findByRole("dialog", { name: "Delete dirty worktrees" })).toBeInTheDocument();
    expect(screen.getByText("feature/archive-fixture")).toBeInTheDocument();
    expect(screen.getByText("/tmp/managed/feature/archive-fixture")).toBeInTheDocument();
    expect(mocks.deleteMutateAsync).toHaveBeenNthCalledWith(1, undefined);

    await user.click(screen.getByRole("button", { name: "Delete and archive" }));

    expect(mocks.deleteMutateAsync).toHaveBeenNthCalledWith(2, { force: true });
  });
});
