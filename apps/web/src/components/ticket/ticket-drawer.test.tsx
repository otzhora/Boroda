import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toTicketForm } from "../../features/tickets/form";
import type { Project, Ticket } from "../../lib/types";

const uploadTicketImageSpy = vi.fn(async () => ({
  alt: "Pasted image",
  filename: "pasted-image.png",
  url: "/api/tickets/12/images/pasted-image.png",
  markdown: "![Pasted image](/api/tickets/12/images/pasted-image.png)"
}));

vi.mock("../../features/tickets/mutations", async () => {
  const actual = await vi.importActual<typeof import("../../features/tickets/mutations")>(
    "../../features/tickets/mutations"
  );

  return {
    ...actual,
    useUploadTicketImageMutation: () => ({
      isPending: false,
      mutateAsync: uploadTicketImageSpy
    })
  };
});

vi.mock("./work-context-editor", () => ({
  WorkContextEditor: () => <div>Work contexts</div>
}));

vi.mock("../../features/jira/queries", () => ({
  useJiraSettingsQuery: () => ({
    data: {
      baseUrl: "https://jira.example.test",
      email: "me@example.test",
      hasApiToken: true
    }
  }),
  useAssignedJiraIssuesQuery: () => ({
    data: {
      issues: [
        { key: "BRD-321", summary: "Follow-up issue" },
        { key: "BRD-322", summary: "Another linked task" }
      ],
      total: 2
    },
    isLoading: false,
    error: null
  })
}));

import { TicketDrawer } from "./ticket-drawer";

const project: Project = {
  id: 1,
  name: "Payments Backend",
  slug: "payments-backend",
  description: "Core payment services",
  color: "#355c7d",
  createdAt: "2026-02-28T12:00:00.000Z",
  updatedAt: "2026-02-28T12:00:00.000Z",
  folders: []
};

const ticket: Ticket = {
  id: 12,
  key: "BRD-12",
  title: "Fix save state in drawer",
  description: "Saving should return the ticket drawer to read mode.",
  branch: null,
  jiraIssues: [],
  status: "INBOX",
  priority: "HIGH",
  dueAt: null,
  createdAt: "2026-02-28T12:00:00.000Z",
  updatedAt: "2026-02-28T12:00:00.000Z",
  archivedAt: null,
  projectLinks: [],
  workContexts: [],
  activities: []
};

describe("TicketDrawer", () => {
  it("renders branch and linked Jira issues in read mode", () => {
    render(
      <TicketDrawer
        ticketId={ticket.id}
        ticket={{
          ...ticket,
          branch: "feature/fix-save-state",
          jiraIssues: [
            {
              id: 9,
              ticketId: ticket.id,
              key: "BRD-321",
              summary: "Follow-up issue",
              createdAt: "2026-02-28T12:00:00.000Z"
            }
          ]
        }}
        isLoading={false}
        isError={false}
        form={toTicketForm({
          ...ticket,
          branch: "feature/fix-save-state",
          jiraIssues: [
            {
              id: 9,
              ticketId: ticket.id,
              key: "BRD-321",
              summary: "Follow-up issue",
              createdAt: "2026-02-28T12:00:00.000Z"
            }
          ]
        })}
        projects={[project]}
        isSaving={false}
        saveSuccessCount={0}
        isDeleting={false}
        isOpeningInTerminal={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInTerminal={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("feature/fix-save-state")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "BRD-321" })).toHaveAttribute(
      "href",
      "https://jira.example.test/browse/BRD-321"
    );
    expect(screen.getByText("Follow-up issue")).toBeInTheDocument();
  });

  it("renders markdown descriptions in read mode", () => {
    render(
      <TicketDrawer
        ticketId={ticket.id}
        ticket={{
          ...ticket,
          description: "# Summary\n\n- [x] Added support\n\n![Architecture](/api/tickets/12/images/diagram.png)"
        }}
        isLoading={false}
        isError={false}
        form={toTicketForm({
          ...ticket,
          description: "# Summary\n\n- [x] Added support\n\n![Architecture](/api/tickets/12/images/diagram.png)"
        })}
        projects={[project]}
        isSaving={false}
        saveSuccessCount={0}
        isDeleting={false}
        isOpeningInTerminal={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInTerminal={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Architecture" })).toBeInTheDocument();
  });

  it("toggles Jira issues and linked projects in read mode", async () => {
    const user = userEvent.setup();

    render(
      <TicketDrawer
        ticketId={ticket.id}
        ticket={{
          ...ticket,
          jiraIssues: [
            {
              id: 9,
              ticketId: ticket.id,
              key: "BRD-321",
              summary: "Follow-up issue",
              createdAt: "2026-02-28T12:00:00.000Z"
            }
          ],
          projectLinks: [
            {
              id: 1,
              ticketId: ticket.id,
              projectId: project.id,
              relationship: "RELATED",
              createdAt: "2026-02-28T12:00:00.000Z",
              project: {
                ...project,
                folders: [
                  {
                    id: 42,
                    projectId: project.id,
                    label: "api",
                    path: "/home/otzhora/projects/payments-backend",
                    kind: "APP",
                    isPrimary: true,
                    existsOnDisk: true,
                    createdAt: "2026-02-28T12:00:00.000Z",
                    updatedAt: "2026-02-28T12:00:00.000Z"
                  }
                ]
              }
            }
          ]
        }}
        isLoading={false}
        isError={false}
        form={toTicketForm({
          ...ticket,
          jiraIssues: [
            {
              id: 9,
              ticketId: ticket.id,
              key: "BRD-321",
              summary: "Follow-up issue",
              createdAt: "2026-02-28T12:00:00.000Z"
            }
          ],
          projectLinks: [
            {
              id: 1,
              ticketId: ticket.id,
              projectId: project.id,
              relationship: "RELATED",
              createdAt: "2026-02-28T12:00:00.000Z",
              project: {
                ...project,
                folders: [
                  {
                    id: 42,
                    projectId: project.id,
                    label: "api",
                    path: "/home/otzhora/projects/payments-backend",
                    kind: "APP",
                    isPrimary: true,
                    existsOnDisk: true,
                    createdAt: "2026-02-28T12:00:00.000Z",
                    updatedAt: "2026-02-28T12:00:00.000Z"
                  }
                ]
              }
            }
          ]
        })}
        projects={[project]}
        isSaving={false}
        saveSuccessCount={0}
        isDeleting={false}
        isOpeningInTerminal={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInTerminal={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Jira issues" })).toBeInTheDocument();
    expect(screen.getByText("Follow-up issue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh Jira links" })).toBeInTheDocument();
    expect(screen.queryByText("Core payment services")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show linked projects" })).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: "Show linked projects" }));

    expect(screen.getByText("Core payment services")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide linked projects" })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: "Hide Jira issues" }));
    expect(screen.queryByRole("button", { name: "Refresh Jira links" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide linked projects" }));

    expect(screen.queryByText("Follow-up issue")).not.toBeInTheDocument();
    expect(screen.queryByText("Core payment services")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Jira issues" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Show linked projects" })).toHaveAttribute("aria-expanded", "false");
  });

  it("leaves edit mode after a successful save", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleSave = vi.fn();

    const { rerender } = render(
      <TicketDrawer
        ticketId={ticket.id}
        ticket={ticket}
        isLoading={false}
        isError={false}
        form={toTicketForm(ticket)}
        projects={[project]}
        isSaving={false}
        saveSuccessCount={0}
        isDeleting={false}
        isOpeningInTerminal={false}
        isRefreshingJira={false}
        onChange={handleChange}
        onSave={handleSave}
        onDelete={vi.fn()}
        onOpenInTerminal={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Edit ticket" }));
    expect(screen.getByRole("button", { name: "Save ticket" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save ticket" }));
    expect(handleSave).toHaveBeenCalledTimes(1);

    rerender(
      <TicketDrawer
        ticketId={ticket.id}
        ticket={ticket}
        isLoading={false}
        isError={false}
        form={toTicketForm(ticket)}
        projects={[project]}
        isSaving={false}
        saveSuccessCount={1}
        isDeleting={false}
        isOpeningInTerminal={false}
        isRefreshingJira={false}
        onChange={handleChange}
        onSave={handleSave}
        onDelete={vi.fn()}
        onOpenInTerminal={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Save ticket" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit ticket" })).toBeInTheDocument();
  });

  it("triggers save instead of closing when escape is pressed during edit mode", async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(
      <TicketDrawer
        ticketId={ticket.id}
        ticket={ticket}
        isLoading={false}
        isError={false}
        form={toTicketForm(ticket)}
        projects={[project]}
        isSaving={false}
        saveSuccessCount={0}
        isDeleting={false}
        isOpeningInTerminal={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={handleSave}
        onDelete={vi.fn()}
        onOpenInTerminal={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={handleClose}
      />
    );

    await user.click(screen.getByRole("button", { name: "Edit ticket" }));
    expect(screen.getByRole("button", { name: "Save ticket" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(handleClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save ticket" })).toBeInTheDocument();
  });

  it("shows the terminal action when a linked project has an available folder", () => {
    render(
      <TicketDrawer
        ticketId={ticket.id}
        ticket={{
          ...ticket,
          projectLinks: [
            {
              id: 1,
              ticketId: ticket.id,
              projectId: project.id,
              relationship: "PRIMARY",
              createdAt: "2026-02-28T12:00:00.000Z",
              project: {
                ...project,
                folders: [
                  {
                    id: 42,
                    projectId: project.id,
                    label: "workspace",
                    path: "/home/otzhora/projects/payments",
                    kind: "APP",
                    isPrimary: true,
                    existsOnDisk: true,
                    createdAt: "2026-02-28T12:00:00.000Z",
                    updatedAt: "2026-02-28T12:00:00.000Z"
                  }
                ]
              }
            }
          ]
        }}
        isLoading={false}
        isError={false}
        form={toTicketForm(ticket)}
        projects={[project]}
        isSaving={false}
        saveSuccessCount={0}
        isDeleting={false}
        isOpeningInTerminal={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInTerminal={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Open in Terminal" })).toBeInTheDocument();
  });

  it("keeps focus in the description field while typing", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <TicketDrawer
        ticketId={ticket.id}
        ticket={ticket}
        isLoading={false}
        isError={false}
        form={toTicketForm(ticket)}
        projects={[project]}
        isSaving={false}
        saveSuccessCount={0}
        isDeleting={false}
        isOpeningInTerminal={false}
        isRefreshingJira={false}
        onChange={handleChange}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInTerminal={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Edit ticket" }));

    const descriptionField = screen.getByLabelText("Description");
    await user.click(descriptionField);
    await user.keyboard("a");

    expect(descriptionField).toHaveFocus();
    expect(handleChange).toHaveBeenCalledWith(expect.any(Function));
  });

  it("uploads pasted images and inserts markdown into the description", async () => {
    uploadTicketImageSpy.mockClear();
    const user = userEvent.setup();

    function DrawerHarness() {
      const [form, setForm] = React.useState(toTicketForm(ticket));

      return (
        <TicketDrawer
          ticketId={ticket.id}
          ticket={ticket}
          isLoading={false}
          isError={false}
          form={form}
          projects={[project]}
          isSaving={false}
          saveSuccessCount={0}
          isDeleting={false}
          isOpeningInTerminal={false}
          isRefreshingJira={false}
          onChange={(updater) => {
            setForm((current) => updater(current));
          }}
          onSave={vi.fn()}
          onDelete={vi.fn()}
          onOpenInTerminal={vi.fn()}
          onRefreshJira={vi.fn()}
          onClose={vi.fn()}
        />
      );
    }

    render(<DrawerHarness />);

    await user.click(screen.getByRole("button", { name: "Edit ticket" }));

    const descriptionField = screen.getByLabelText("Description");
    const pastedImage = new File(["image-data"], "pasted-image.png", { type: "image/png" });

    await user.click(descriptionField);
    fireEvent.paste(descriptionField, {
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
      expect(uploadTicketImageSpy).toHaveBeenCalledTimes(1);
      expect(descriptionField).toHaveValue(
        `${ticket.description}\n\n![Pasted image](/api/tickets/12/images/pasted-image.png)`
      );
    });
  });

  it("uploads dropped images and inserts markdown into the description", async () => {
    uploadTicketImageSpy.mockClear();
    const user = userEvent.setup();

    function DrawerHarness() {
      const [form, setForm] = React.useState(toTicketForm(ticket));

      return (
        <TicketDrawer
          ticketId={ticket.id}
          ticket={ticket}
          isLoading={false}
          isError={false}
          form={form}
          projects={[project]}
          isSaving={false}
          saveSuccessCount={0}
          isDeleting={false}
          isOpeningInTerminal={false}
          isRefreshingJira={false}
          onChange={(updater) => {
            setForm((current) => updater(current));
          }}
          onSave={vi.fn()}
          onDelete={vi.fn()}
          onOpenInTerminal={vi.fn()}
          onRefreshJira={vi.fn()}
          onClose={vi.fn()}
        />
      );
    }

    render(<DrawerHarness />);

    await user.click(screen.getByRole("button", { name: "Edit ticket" }));

    const descriptionField = screen.getByLabelText("Description");
    const dropZone = screen.getByRole("tabpanel", { name: "Write" });
    const droppedImage = new File(["image-data"], "dropped-image.png", { type: "image/png" });

    fireEvent.dragOver(dropZone, {
      dataTransfer: {
        items: [{ kind: "file", type: droppedImage.type }]
      }
    });

    expect(screen.getByText("Drop image to upload and insert Markdown.")).toBeInTheDocument();

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [droppedImage]
      }
    });

    await waitFor(() => {
      expect(uploadTicketImageSpy).toHaveBeenCalledTimes(1);
      expect(descriptionField).toHaveValue(
        `${ticket.description}\n\n![Pasted image](/api/tickets/12/images/pasted-image.png)`
      );
    });
  });

  it("renders long read-only descriptions in the shared drawer scroll flow", () => {
    render(
      <TicketDrawer
        ticketId={ticket.id}
        ticket={{
          ...ticket,
          description: Array.from({ length: 120 }, (_, index) => `Line ${index + 1}`).join("\n")
        }}
        isLoading={false}
        isError={false}
        form={toTicketForm({
          ...ticket,
          description: Array.from({ length: 120 }, (_, index) => `Line ${index + 1}`).join("\n")
        })}
        projects={[project]}
        isSaving={false}
        saveSuccessCount={0}
        isDeleting={false}
        isOpeningInTerminal={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInTerminal={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("region", { name: "Ticket description" })).not.toHaveAttribute("tabindex");
  });

  it("keeps the drawer layout content-sized instead of stretching columns", () => {
    const { container } = render(
      <TicketDrawer
        ticketId={ticket.id}
        ticket={{
          ...ticket,
          projectLinks: [
            {
              id: 1,
              ticketId: ticket.id,
              projectId: project.id,
              relationship: "PRIMARY",
              createdAt: "2026-02-28T12:00:00.000Z",
              project
            },
            {
              id: 2,
              ticketId: ticket.id,
              projectId: project.id,
              relationship: "RELATED",
              createdAt: "2026-02-28T12:05:00.000Z",
              project
            }
          ]
        }}
        isLoading={false}
        isError={false}
        form={toTicketForm({
          ...ticket,
          projectLinks: [
            {
              id: 1,
              ticketId: ticket.id,
              projectId: project.id,
              relationship: "PRIMARY",
              createdAt: "2026-02-28T12:00:00.000Z",
              project
            },
            {
              id: 2,
              ticketId: ticket.id,
              projectId: project.id,
              relationship: "RELATED",
              createdAt: "2026-02-28T12:05:00.000Z",
              project
            }
          ]
        })}
        projects={[project]}
        isSaving={false}
        saveSuccessCount={0}
        isDeleting={false}
        isOpeningInTerminal={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInTerminal={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const layout = container.querySelector("div.grid.w-full.items-start");
    const additionalDetailsSection = screen.getByRole("heading", { name: "Additional details" }).closest("section");
    const linkedProjectsAside = screen.getByRole("heading", { name: "Linked projects" }).closest("aside");

    expect(layout).toBeInTheDocument();
    expect(layout?.firstElementChild).toHaveClass("content-start");
    expect(additionalDetailsSection).toHaveClass("content-start");
    expect(linkedProjectsAside).not.toHaveClass("xl:self-stretch");
  });

  it("keeps long activity lists in a bounded tab panel", async () => {
    const user = userEvent.setup();

    render(
      <TicketDrawer
        ticketId={ticket.id}
        ticket={{
          ...ticket,
          activities: Array.from({ length: 80 }, (_, index) => ({
            id: index + 1,
            ticketId: ticket.id,
            type: "ticket.status.changed",
            message: `Status changed to step ${index + 1}`,
            metaJson: "{}",
            createdAt: "2026-02-28T20:13:00.000Z"
          }))
        }}
        isLoading={false}
        isError={false}
        form={toTicketForm(ticket)}
        projects={[project]}
        isSaving={false}
        saveSuccessCount={0}
        isDeleting={false}
        isOpeningInTerminal={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInTerminal={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole("tab", { name: "Activity" }));

    expect(screen.getByRole("tabpanel")).toHaveAttribute("tabindex", "0");
  });

  it("shows a Jira refresh icon button and calls refresh", async () => {
    const user = userEvent.setup();
    const handleRefreshJira = vi.fn();

    render(
      <TicketDrawer
        ticketId={ticket.id}
        ticket={{
          ...ticket,
          jiraIssues: [
            {
              id: 11,
              ticketId: ticket.id,
              key: "BRD-321",
              summary: "Follow-up issue",
              createdAt: "2026-02-28T12:00:00.000Z"
            }
          ]
        }}
        isLoading={false}
        isError={false}
        form={toTicketForm({
          ...ticket,
          jiraIssues: [
            {
              id: 11,
              ticketId: ticket.id,
              key: "BRD-321",
              summary: "Follow-up issue",
              createdAt: "2026-02-28T12:00:00.000Z"
            }
          ]
        })}
        projects={[project]}
        isSaving={false}
        saveSuccessCount={0}
        isDeleting={false}
        isOpeningInTerminal={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInTerminal={vi.fn()}
        onRefreshJira={handleRefreshJira}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Refresh Jira links" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh Jira links" }));

    expect(handleRefreshJira).toHaveBeenCalledTimes(1);
  });
});
