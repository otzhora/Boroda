import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useBoardQuery: vi.fn(),
  useProjectsQuery: vi.fn(),
  useTicketQuery: vi.fn(),
  refetchBoard: vi.fn(),
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  deleteMutate: vi.fn(),
  moveMutate: vi.fn(),
  openTerminalMutate: vi.fn()
}));

vi.mock("../features/board/queries", () => ({
  useBoardQuery: mocks.useBoardQuery
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
    isPending: false,
    error: null
  })),
  useMoveTicketStatusMutation: vi.fn(() => ({
    mutate: mocks.moveMutate,
    isPending: false,
    error: null
  })),
  useOpenTicketInWindowsTerminalMutation: vi.fn(() => ({
    mutate: mocks.openTerminalMutate,
    isPending: false,
    error: null
  }))
}));

vi.mock("../components/ticket/ticket-drawer", () => ({
  TicketDrawer: () => <div data-testid="ticket-drawer" />
}));

vi.mock("../components/board/board-view", () => ({
  BoardView: ({ onMoveTicket }: { onMoveTicket: (ticketId: number, status: string) => void }) => (
    <button type="button" onClick={() => onMoveTicket(12, "DONE")}>
      Trigger move
    </button>
  )
}));

import { BoardPage } from "./board-page";

function renderBoardPage() {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <BoardPage />
    </QueryClientProvider>
  );
}

describe("BoardPage", () => {
  beforeEach(() => {
    mocks.useBoardQuery.mockReset();
    mocks.useProjectsQuery.mockReset();
    mocks.useTicketQuery.mockReset();
    mocks.refetchBoard.mockReset();
    mocks.createMutate.mockReset();
    mocks.updateMutate.mockReset();
    mocks.deleteMutate.mockReset();
    mocks.moveMutate.mockReset();
    mocks.openTerminalMutate.mockReset();

    mocks.useBoardQuery.mockReturnValue({
      data: { columns: [] },
      isLoading: false,
      isError: false,
      refetch: mocks.refetchBoard
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

    const projectFilters = screen.getAllByLabelText("Project");
    const priorityFilters = screen.getAllByLabelText("Priority");

    await user.type(screen.getByLabelText("Search"), "bug");
    expect(mocks.useBoardQuery).toHaveBeenLastCalledWith({ q: "bug" });

    await user.selectOptions(projectFilters[0], "2");
    expect(mocks.useBoardQuery).toHaveBeenLastCalledWith({ q: "bug", projectId: 2 });

    await user.selectOptions(priorityFilters[0], "HIGH");
    expect(mocks.useBoardQuery).toHaveBeenLastCalledWith({
      q: "bug",
      projectId: 2,
      priority: "HIGH"
    });

    await user.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(mocks.useBoardQuery).toHaveBeenLastCalledWith({});
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
    await user.selectOptions(within(dialog).getByLabelText("Type"), "BUG");
    await user.click(within(dialog).getAllByRole("button", { name: "Create ticket" })[0]);

    expect(mocks.createMutate).toHaveBeenCalledWith({
      title: "Wire board filters",
      description: "",
      status: "READY",
      priority: "HIGH",
      type: "BUG",
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
                type: "TASK",
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
});
