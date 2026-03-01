import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkContext } from "../../lib/types";

const mocks = vi.hoisted(() => ({
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  deleteMutate: vi.fn(),
  markdownRenders: new Map<string, number>()
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

vi.mock("./markdown-description", () => ({
  MarkdownDescription: ({ value }: { value: string }) => {
    mocks.markdownRenders.set(value, (mocks.markdownRenders.get(value) ?? 0) + 1);

    return <div data-testid={`markdown-${value}`}>{value}</div>;
  }
}));

vi.mock("./ticket-form", () => ({
  TicketDescriptionField: ({
    label,
    value,
    onChange
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <label>
      <span>{label}</span>
      <textarea aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
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

describe("WorkContextEditor rendering", () => {
  beforeEach(() => {
    mocks.createMutate.mockReset();
    mocks.updateMutate.mockReset();
    mocks.deleteMutate.mockReset();
    mocks.markdownRenders.clear();
  });

  it("does not re-render unrelated markdown note rows while editing another context", async () => {
    const user = userEvent.setup();

    renderEditor([
      {
        id: 1,
        ticketId: 7,
        type: "NOTE",
        label: "Screenshot note",
        value: "![diagram](/uploads/diagram.png)",
        metaJson: "{}",
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-01T10:00:00.000Z"
      },
      {
        id: 2,
        ticketId: 7,
        type: "LINK",
        label: "Build log",
        value: "https://example.test/build",
        metaJson: "{}",
        createdAt: "2026-03-01T09:00:00.000Z",
        updatedAt: "2026-03-01T09:00:00.000Z"
      }
    ]);

    await user.dblClick(screen.getByText("Build log"));

    const baselineRenderCount = mocks.markdownRenders.get("![diagram](/uploads/diagram.png)");
    const existingContextForm = screen.getByRole("button", { name: "Save changes" }).closest("form");

    expect(existingContextForm).not.toBeNull();

    await user.type(within(existingContextForm!).getByLabelText("Label"), " updated");

    expect(mocks.markdownRenders.get("![diagram](/uploads/diagram.png)")).toBe(baselineRenderCount);
  });
});
