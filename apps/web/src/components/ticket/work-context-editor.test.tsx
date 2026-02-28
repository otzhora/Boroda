import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkContext } from "../../lib/types";

const mocks = vi.hoisted(() => ({
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  deleteMutate: vi.fn()
}));

vi.mock("../../features/tickets/work-context-mutations", () => ({
  useCreateWorkContextMutation: vi.fn(() => ({
    mutate: mocks.createMutate,
    isPending: false,
    error: null
  })),
  useUpdateWorkContextMutation: vi.fn(() => ({
    mutate: mocks.updateMutate,
    isPending: false,
    error: null,
    variables: undefined
  })),
  useDeleteWorkContextMutation: vi.fn(() => ({
    mutate: mocks.deleteMutate,
    isPending: false,
    error: null,
    variables: undefined
  }))
}));

import { WorkContextEditor } from "./work-context-editor";

function renderEditor(contexts: WorkContext[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      },
      mutations: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkContextEditor ticketId={7} contexts={contexts} />
    </QueryClientProvider>
  );
}

describe("WorkContextEditor", () => {
  beforeEach(() => {
    mocks.createMutate.mockReset();
    mocks.updateMutate.mockReset();
    mocks.deleteMutate.mockReset();
  });

  it("creates PR references from the add form", async () => {
    const user = userEvent.setup();

    renderEditor([]);

    await user.type(screen.getByLabelText("Label"), "Backend PR");
    await user.type(screen.getByLabelText("PR URL or branch"), "https://example.test/pr/42");
    await user.click(screen.getByRole("button", { name: "Add context" }));

    expect(mocks.createMutate).toHaveBeenCalledWith({
      type: "PR",
      label: "Backend PR",
      value: "https://example.test/pr/42"
    });
  });

  it("updates existing contexts and can switch to manual UI references", async () => {
    const user = userEvent.setup();

    renderEditor([
      {
        id: 3,
        ticketId: 7,
        type: "CODEX_SESSION",
        label: "Session",
        value: "session-123",
        metaJson: "{}",
        createdAt: "",
        updatedAt: ""
      }
    ]);

    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    await user.dblClick(screen.getByText("Session"));

    const existingContextForm = screen.getByRole("button", { name: "Save changes" }).closest("form");
    expect(existingContextForm).not.toBeNull();
    await user.selectOptions(within(existingContextForm!).getByLabelText("Type"), "MANUAL_UI");
    await user.clear(within(existingContextForm!).getByLabelText("Label"));
    await user.type(within(existingContextForm!).getByLabelText("Label"), "Manual QA pass");
    await user.clear(within(existingContextForm!).getByLabelText("Flow, environment, or notes"));
    await user.type(
      within(existingContextForm!).getByLabelText("Flow, environment, or notes"),
      "Windows browser smoke test"
    );
    await user.click(within(existingContextForm!).getByRole("button", { name: "Save changes" }));

    expect(mocks.updateMutate).toHaveBeenCalledWith({
      id: 3,
      type: "MANUAL_UI",
      label: "Manual QA pass",
      value: "Windows browser smoke test"
    });
  });

  it("exits edit mode with escape and restores the view state", async () => {
    const user = userEvent.setup();

    renderEditor([
      {
        id: 9,
        ticketId: 7,
        type: "LINK",
        label: "Release notes",
        value: "https://example.test/release",
        metaJson: "{}",
        createdAt: "",
        updatedAt: ""
      }
    ]);

    await user.dblClick(screen.getByText("Release notes"));
    const existingContextForm = screen.getByRole("button", { name: "Save changes" }).closest("form");
    expect(existingContextForm).not.toBeNull();

    await user.clear(within(existingContextForm!).getByLabelText("Label"));
    await user.type(within(existingContextForm!).getByLabelText("Label"), "Changed");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.getByText("Release notes")).toBeInTheDocument();
    expect(mocks.updateMutate).not.toHaveBeenCalled();
  });
});
