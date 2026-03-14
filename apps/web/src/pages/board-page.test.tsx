import { useEffect } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api-client";
import { boardColumnsFixture, defaultEditableBoardColumn, doneBoardColumn } from "../test/fixtures/board-columns";
import { createBoardColumn, createBoardTicket, createProject } from "../test/fixtures/models";
import { renderWithProviders } from "../test/render-with-providers";

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

const editableColumn = defaultEditableBoardColumn;
const targetMoveStatus = doneBoardColumn.status;

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
      <button type="button" onClick={() => onMoveTicket(12, targetMoveStatus)}>
        Trigger move
      </button>
      <button type="button" onClick={() => onSelectTicket(12)}>
        Select ticket
      </button>
      <button type="button" onClick={() => onAddColumn(editableColumn.status, "after")}>
        Trigger add column
      </button>
      <button type="button" onClick={() => onRenameColumn(editableColumn.status, editableColumn.label)}>
        Trigger rename column
      </button>
      <button type="button" onClick={() => onDeleteColumn(editableColumn.status)}>
        Trigger delete column
      </button>
    </>
  )
}));

import { BoardPage } from "./board-page";

describe("BoardPage", () => {
  beforeEach(() => {
    document.title = "Tickets · Boroda";
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
        columns: boardColumnsFixture
      }
    });

    mocks.useProjectsQuery.mockReturnValue({
      data: [
        createProject({ createdAt: "", updatedAt: "" }),
        createProject({
          id: 2,
          name: "Infra",
          slug: "infra",
          color: "#223344",
          createdAt: "",
          updatedAt: ""
        })
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

    renderWithProviders(<BoardPage />);

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

    renderWithProviders(<BoardPage />);

    await user.keyboard("c");

    const dialog = await screen.findByRole("dialog", { name: "Create ticket" });

    await user.type(within(dialog).getByLabelText("Title"), "Wire board filters");
    await user.selectOptions(within(dialog).getByLabelText("Project"), "1");
    await user.selectOptions(within(dialog).getByLabelText("Status"), editableColumn.status);
    await user.selectOptions(within(dialog).getByLabelText("Priority"), "HIGH");
    await user.click(within(dialog).getAllByRole("button", { name: "Create ticket" })[0]);

    expect(mocks.createMutate).toHaveBeenCalledWith({
      title: "Wire board filters",
      description: "",
      branch: null,
      workspaces: [],
      jiraIssues: [],
      status: editableColumn.status,
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
          createBoardColumn({
            tickets: [
              createBoardTicket({
                title: "Trigger card",
                updatedAt: ""
              })
            ]
          })
        ]
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetchBoard
    });

    renderWithProviders(<BoardPage />);
    await user.click(screen.getByRole("button", { name: "Trigger move" }));

    expect(mocks.moveMutate).toHaveBeenCalledWith({
      ticketId: 12,
      status: targetMoveStatus
    });
  });

  it("supports keyboard shortcuts for search and quick create", async () => {
    const user = userEvent.setup();

    renderWithProviders(<BoardPage />);

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
        columns: [createBoardColumn({ status: editableColumn.status, label: editableColumn.label })]
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetchBoard
    });

    renderWithProviders(<BoardPage />);

    await user.click(screen.getByRole("button", { name: "Trigger add column" }));
    const dialog = await screen.findByRole("dialog", { name: "Add board column" });
    await user.type(within(dialog).getByLabelText("Column name"), "Needs QA");
    await user.click(within(dialog).getByRole("button", { name: "Add column" }));

    expect(mocks.createBoardColumnMutate).toHaveBeenCalledWith(
      {
        relativeToStatus: editableColumn.status,
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
        columns: [createBoardColumn({ status: editableColumn.status, label: editableColumn.label })]
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetchBoard
    });

    renderWithProviders(<BoardPage />);

    await user.click(screen.getByRole("button", { name: "Trigger rename column" }));
    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByLabelText("Column name");
    await user.clear(input);
    await user.type(input, "Needs QA");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(mocks.renameBoardColumnMutate).toHaveBeenCalledWith(
      {
        status: editableColumn.status,
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
          createBoardColumn({
            tickets: [
              createBoardTicket({
                title: "Trigger card",
                updatedAt: ""
              })
            ]
          })
        ]
      },
      isLoading: false,
      isError: false,
      refetch: mocks.refetchBoard
    });

    renderWithProviders(<BoardPage />);

    await user.click(screen.getByRole("button", { name: "Select ticket" }));
    expect(screen.getByTestId("ticket-drawer")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.getByTestId("ticket-drawer")).toBeInTheDocument();
  });

  it("opens the deep-linked ticket from the search params", () => {
    renderWithProviders(<BoardPage />, { initialEntries: ["/?ticketId=12"] });

    expect(mocks.useTicketQuery).toHaveBeenLastCalledWith(12);
    expect(screen.getByTestId("ticket-drawer")).toBeInTheDocument();
  });

  it("resets the document title for the board route", () => {
    renderWithProviders(<BoardPage />);

    expect(document.title).toBe("Boroda");
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

    renderWithProviders(<BoardPage />, { initialEntries: ["/?ticketId=12"] });

    await user.click(screen.getByRole("button", { name: "Archive ticket" }));

    expect(await screen.findByRole("dialog", { name: "Delete dirty worktrees" })).toBeInTheDocument();
    expect(screen.getByText("feature/archive-fixture")).toBeInTheDocument();
    expect(screen.getByText("/tmp/managed/feature/archive-fixture")).toBeInTheDocument();
    expect(mocks.deleteMutateAsync).toHaveBeenNthCalledWith(1, undefined);

    await user.click(screen.getByRole("button", { name: "Delete and archive" }));

    expect(mocks.deleteMutateAsync).toHaveBeenNthCalledWith(2, { force: true });
  });
});
