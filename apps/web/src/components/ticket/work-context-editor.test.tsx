import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkContext } from "../../lib/types";
import { createWorkContext } from "../../test/fixtures/models";
import { renderWithProviders } from "../../test/render-with-providers";

const mocks = vi.hoisted(() => ({
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  deleteMutate: vi.fn(),
  uploadImage: vi.fn(async () => ({
    alt: "Pasted image",
    filename: "pasted-image.png",
    url: "/api/tickets/7/images/pasted-image.png",
    markdown: "![Pasted image](/api/tickets/7/images/pasted-image.png)"
  }))
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

vi.mock("../../features/tickets/mutations", () => ({
  useUploadTicketImageMutation: vi.fn(() => ({
    isPending: false,
    mutateAsync: mocks.uploadImage
  }))
}));

import { WorkContextEditor } from "./work-context-editor";

function renderEditor(contexts: WorkContext[]) {
  return renderWithProviders(<WorkContextEditor ticketId={7} contexts={contexts} />);
}

describe("WorkContextEditor", () => {
  beforeEach(() => {
    mocks.createMutate.mockReset();
    mocks.updateMutate.mockReset();
    mocks.deleteMutate.mockReset();
    mocks.uploadImage.mockClear();
  });

  it("creates PR references from the add form", async () => {
    const user = userEvent.setup();

    renderEditor([]);

    await user.selectOptions(screen.getByLabelText("Type"), "PR");
    await user.type(screen.getByLabelText("Label"), "Backend PR");
    const valueField = screen.getByLabelText("PR URL or branch");
    await user.type(valueField, "https://example.test/pr/42");
    await user.click(screen.getByRole("button", { name: "Save context" }));

    expect(mocks.createMutate).toHaveBeenCalledWith({
      type: "PR",
      label: "Backend PR",
      value: "https://example.test/pr/42"
    });
  });

  it("creates non-note contexts without requiring a label", async () => {
    const user = userEvent.setup();

    renderEditor([]);

    await user.selectOptions(screen.getByLabelText("Type"), "PR");
    const valueField = screen.getByLabelText("PR URL or branch");
    await user.type(valueField, "https://example.test/pr/42");
    await user.click(screen.getByRole("button", { name: "Save context" }));

    expect(mocks.createMutate).toHaveBeenCalledWith({
      type: "PR",
      label: "",
      value: "https://example.test/pr/42"
    });
  });

  it("defaults new contexts to note and hides session and manual UI types from the create form", () => {
    renderEditor([]);

    expect(screen.getByLabelText("Type")).toHaveValue("NOTE");
    expect(screen.getByLabelText("Note")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Codex session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Claude session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Cursor session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Manual UI" })).not.toBeInTheDocument();
  });

  it("keeps hidden legacy types out of the edit type list unless the current context uses one", async () => {
    const user = userEvent.setup();

    renderEditor([
      createWorkContext({
        id: 3,
        type: "LINK",
        label: "Reference",
        value: "https://example.test/reference",
        createdAt: "",
        updatedAt: ""
      })
    ]);

    await user.click(screen.getByText("Reference"));

    expect(screen.queryByRole("option", { name: "Codex session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Claude session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Cursor session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Manual UI" })).not.toBeInTheDocument();
  });

  it("still renders a legacy hidden type in the edit selector for existing contexts", async () => {
    const user = userEvent.setup();

    renderEditor([
      createWorkContext({
        id: 4,
        type: "CODEX_SESSION",
        label: "Legacy session",
        value: "session-123",
        createdAt: "",
        updatedAt: ""
      })
    ]);

    await user.click(screen.getByText("Legacy session"));
    const existingContextForm = screen.getByRole("button", { name: "Save changes" }).closest("form");
    expect(existingContextForm).not.toBeNull();

    expect(within(existingContextForm!).getByLabelText("Type")).toHaveValue("CODEX_SESSION");
    expect(within(existingContextForm!).getByRole("option", { name: "Codex session" })).toBeInTheDocument();
    expect(within(existingContextForm!).queryByRole("option", { name: "Claude session" })).not.toBeInTheDocument();
    expect(within(existingContextForm!).queryByRole("option", { name: "Cursor session" })).not.toBeInTheDocument();
    expect(within(existingContextForm!).queryByRole("option", { name: "Manual UI" })).not.toBeInTheDocument();
  });

  it("updates existing contexts and can switch to manual UI references", async () => {
    const user = userEvent.setup();

    renderEditor([
      createWorkContext({
        id: 3,
        type: "AWS_CONSOLE",
        label: "Session",
        value: "session-123",
        createdAt: "",
        updatedAt: ""
      })
    ]);

    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    await user.click(screen.getByText("Session"));

    const existingContextForm = screen.getByRole("button", { name: "Save changes" }).closest("form");
    expect(existingContextForm).not.toBeNull();
    await user.selectOptions(within(existingContextForm!).getByLabelText("Type"), "LINK");
    await user.clear(within(existingContextForm!).getByLabelText("Label"));
    await user.type(within(existingContextForm!).getByLabelText("Label"), "QA checklist");
    await user.clear(within(existingContextForm!).getByLabelText("Reference value"));
    await user.type(within(existingContextForm!).getByLabelText("Reference value"), "https://example.test/checklist");
    await user.click(within(existingContextForm!).getByRole("button", { name: "Save changes" }));

    expect(mocks.updateMutate).toHaveBeenCalledWith({
      id: 3,
      type: "LINK",
      label: "QA checklist",
      value: "https://example.test/checklist"
    });
  });

  it("shows save and cancel actions for new work contexts", async () => {
    const user = userEvent.setup();

    renderEditor([]);

    const saveButton = screen.getByRole("button", { name: "Save context" });
    const cancelButton = screen.getByRole("button", { name: "Cancel" });

    expect(saveButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();

    await user.type(screen.getByLabelText("Label"), "Draft context");
    await user.type(screen.getByLabelText("Note"), "Draft value");

    expect(saveButton).toBeEnabled();
    expect(cancelButton).toBeEnabled();
  });

  it("cancels the new work context draft", async () => {
    const user = userEvent.setup();

    renderEditor([]);

    await user.type(screen.getByLabelText("Label"), "Draft context");
    await user.type(screen.getByLabelText("Note"), "Draft value");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByLabelText("Type")).toHaveValue("NOTE");
    expect(screen.getByLabelText("Label")).toHaveValue("");
    expect(screen.getByLabelText("Note")).toHaveValue("");
    expect(mocks.createMutate).not.toHaveBeenCalled();
  });

  it("saves and exits edit mode with escape", async () => {
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

    await user.click(screen.getByText("Release notes"));
    const existingContextForm = screen.getByRole("button", { name: "Save changes" }).closest("form");
    expect(existingContextForm).not.toBeNull();

    await user.clear(within(existingContextForm!).getByLabelText("Label"));
    await user.type(within(existingContextForm!).getByLabelText("Label"), "Changed");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(mocks.updateMutate).toHaveBeenCalledWith({
      id: 9,
      type: "LINK",
      label: "Changed",
      value: "https://example.test/release"
    });
  });

  it("cancels editing with the cancel button and restores the view state", async () => {
    const user = userEvent.setup();

    renderEditor([
      {
        id: 10,
        ticketId: 7,
        type: "LINK",
        label: "Release notes",
        value: "https://example.test/release",
        metaJson: "{}",
        createdAt: "",
        updatedAt: ""
      }
    ]);

    await user.click(screen.getByText("Release notes"));
    const existingContextForm = screen.getByRole("button", { name: "Save changes" }).closest("form");
    expect(existingContextForm).not.toBeNull();

    await user.clear(within(existingContextForm!).getByLabelText("Label"));
    await user.type(within(existingContextForm!).getByLabelText("Label"), "Changed");
    await user.click(within(existingContextForm!).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.getByText("Release notes")).toBeInTheDocument();
    expect(mocks.updateMutate).not.toHaveBeenCalled();
  });

  it("saves and exits edit mode when clicking outside", async () => {
    const user = userEvent.setup();

    renderEditor([
      {
        id: 13,
        ticketId: 7,
        type: "LINK",
        label: "Release notes",
        value: "https://example.test/release",
        metaJson: "{}",
        createdAt: "",
        updatedAt: ""
      }
    ]);

    await user.click(screen.getByText("Release notes"));
    const existingContextForm = screen.getByRole("button", { name: "Save changes" }).closest("form");
    expect(existingContextForm).not.toBeNull();

    await user.clear(within(existingContextForm!).getByLabelText("Label"));
    await user.type(within(existingContextForm!).getByLabelText("Label"), "Changed outside");
    await user.click(screen.getByRole("heading", { name: "Work contexts" }));

    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(mocks.updateMutate).toHaveBeenCalledWith({
      id: 13,
      type: "LINK",
      label: "Changed outside",
      value: "https://example.test/release"
    });
  });

  it("renders note work contexts as markdown in view mode", () => {
    const { container } = renderEditor([
      {
        id: 11,
        ticketId: 7,
        type: "NOTE",
        label: "Implementation notes",
        value: "* first item\n* second item",
        metaJson: "{}",
        createdAt: "",
        updatedAt: ""
      }
    ]);

    const list = container.querySelector("ul");

    expect(screen.getByText("Implementation notes")).toBeInTheDocument();
    expect(list).not.toBeNull();
    expect(list).toHaveClass("list-disc");
    expect(list).toHaveClass("pl-6");
    expect(screen.getByText("first item")).toBeInTheDocument();
    expect(screen.getByText("second item")).toBeInTheDocument();
  });

  it("renders newest contexts first", () => {
    renderEditor([
      {
        id: 1,
        ticketId: 7,
        type: "LINK",
        label: "Older context",
        value: "https://example.test/old",
        metaJson: "{}",
        createdAt: "2026-02-28T12:00:00.000Z",
        updatedAt: "2026-02-28T12:00:00.000Z"
      },
      {
        id: 2,
        ticketId: 7,
        type: "NOTE",
        label: "Newest context",
        value: "Recent note",
        metaJson: "{}",
        createdAt: "2026-03-01T12:00:00.000Z",
        updatedAt: "2026-03-01T12:00:00.000Z"
      }
    ]);

    const headings = screen.getAllByRole("heading", { level: 5 }).filter((heading) =>
      ["Newest context", "Older context"].includes(heading.textContent ?? "")
    );

    expect(headings[0]).toHaveTextContent("Newest context");
    expect(headings[1]).toHaveTextContent("Older context");
  });

  it("does not render duplicate note labels for unlabeled notes", () => {
    const { container } = renderEditor([
      {
        id: 12,
        ticketId: 7,
        type: "NOTE",
        label: "",
        value: "Plain note",
        metaJson: "{}",
        createdAt: "",
        updatedAt: ""
      }
    ]);

    const contextRow = container.querySelector("article[role='button']") as HTMLElement | null;

    expect(contextRow).not.toBeNull();
    expect(within(contextRow!).getAllByText("Note")).toHaveLength(1);
    expect(within(contextRow!).queryByRole("heading", { level: 5, name: "Note" })).not.toBeInTheDocument();
  });

  it("uses the shared markdown editor for new note contexts", async () => {
    const user = userEvent.setup();

    renderEditor([]);

    await user.selectOptions(screen.getByLabelText("Type"), "NOTE");

    expect(screen.getByLabelText("Label")).toBeInTheDocument();
    expect(screen.getByLabelText("Note")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Note"), "# Heading");
    expect(screen.queryByRole("tablist", { name: "Note editor mode" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Insert image…" })).not.toBeInTheDocument();
  });

  it("uploads pasted images into note contexts", async () => {
    const user = userEvent.setup();

    renderEditor([]);

    await user.selectOptions(screen.getByLabelText("Type"), "NOTE");

    const noteField = screen.getByLabelText("Note");
    const pastedImage = new File(["image-data"], "pasted-image.png", { type: "image/png" });

    await user.click(noteField);
    fireEvent.paste(noteField, {
      clipboardData: {
        items: [
          {
            kind: "file",
            type: pastedImage.type,
            getAsFile: () => pastedImage
          }
        ]
      }
    });

    await waitFor(() => {
      expect(mocks.uploadImage).toHaveBeenCalledTimes(1);
      expect(noteField).toHaveValue("![Pasted image](/api/tickets/7/images/pasted-image.png)");
    });
  });

  it("creates note contexts without requiring a label", async () => {
    const user = userEvent.setup();

    renderEditor([]);

    await user.selectOptions(screen.getByLabelText("Type"), "NOTE");
    const noteField = screen.getByLabelText("Note");
    await user.type(noteField, "Plain note body");
    await user.click(screen.getByRole("button", { name: "Save context" }));

    expect(mocks.createMutate).toHaveBeenCalledWith({
      type: "NOTE",
      label: "",
      value: "Plain note body"
    });
  });

  it("submits a new note with ctrl-enter", async () => {
    const user = userEvent.setup();

    renderEditor([]);

    await user.selectOptions(screen.getByLabelText("Type"), "NOTE");
    const noteField = screen.getByLabelText("Note");
    await user.click(noteField);
    await user.keyboard("Plain note body");
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(mocks.createMutate).toHaveBeenCalledWith({
      type: "NOTE",
      label: "",
      value: "Plain note body"
    });
  });
});
