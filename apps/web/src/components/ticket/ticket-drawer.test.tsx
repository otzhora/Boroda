import * as React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toTicketForm } from "../../features/tickets/form";
import { setStoredDefaultOpenInMode } from "../../lib/user-preferences";
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
  workspaces: [],
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

function createDeferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<void>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

describe("TicketDrawer", () => {
  it("uses folder as the default open mode", () => {
    setStoredDefaultOpenInMode("folder");

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
                    defaultBranch: null,
                    kind: "APP",
                    isPrimary: true,
                    existsOnDisk: true,
                    createdAt: "2026-02-28T12:00:00.000Z",
                    updatedAt: "2026-02-28T12:00:00.000Z"
                  }
                ]
              }
            }
          ],
          workspaces: [
            {
              id: 91,
              ticketId: ticket.id,
              projectFolderId: 42,
              branchName: "feature/open-flow",
              baseBranch: null,
              role: "primary",
              worktreePath: "/tmp/worktree",
              createdByBoroda: true,
              lastOpenedAt: null,
              createdAt: "2026-02-28T12:00:00.000Z",
              updatedAt: "2026-02-28T12:00:00.000Z",
              projectFolder: {
                id: 42,
                projectId: project.id,
                label: "workspace",
                path: "/home/otzhora/projects/payments",
                defaultBranch: null,
                kind: "APP",
                isPrimary: true,
                existsOnDisk: true,
                createdAt: "2026-02-28T12:00:00.000Z",
                updatedAt: "2026-02-28T12:00:00.000Z",
                project
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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInApp={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Folder" })).toHaveAttribute("aria-pressed", "true");
  });

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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInApp={vi.fn()}
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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInApp={vi.fn()}
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
                    defaultBranch: null,
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
                    defaultBranch: null,
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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInApp={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Jira issues")).toBeInTheDocument();
    expect(screen.getByText("Follow-up issue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh linked issues" })).toBeInTheDocument();
    expect(screen.queryByText("Core payment services")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit ticket workspaces" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit ticket workspaces" }));

    expect(screen.getByRole("dialog", { name: "Code setup" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand linked projects" }));
    expect(screen.getByRole("button", { name: "Collapse linked projects" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Payments Backend")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Collapse Jira issues" }));
    expect(screen.queryByRole("button", { name: "Refresh linked issues" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close dialog" }));

    expect(screen.queryByText("Follow-up issue")).not.toBeInTheDocument();
    expect(screen.queryByText("Core payment services")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand Jira issues" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Edit ticket workspaces" })).toBeInTheDocument();
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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={handleChange}
        onSave={handleSave}
        onDelete={vi.fn()}
        onOpenInApp={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Edit ticket title" }));
    expect(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={handleChange}
        onSave={handleSave}
        onDelete={vi.fn()}
        onOpenInApp={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit ticket title" })).toBeInTheDocument();
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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={handleSave}
        onDelete={vi.fn()}
        onOpenInApp={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={handleClose}
      />
    );

    await user.click(screen.getByRole("button", { name: "Edit ticket title" }));
    expect(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(handleClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
  });

  it("saves the active editor when clicking into another editable section", async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();

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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={handleSave}
        onDelete={vi.fn()}
        onOpenInApp={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Edit ticket title" }));
    expect(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit ticket description" }));

    expect(handleSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("textbox", { name: "Title" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("edits sidebar fields one at a time", async () => {
    const user = userEvent.setup();

    render(
      <TicketDrawer
        ticketId={ticket.id}
        ticket={{
          ...ticket,
          branch: "feature/existing-branch",
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
                    label: "api",
                    path: "/home/otzhora/projects/payments-backend",
                    defaultBranch: "main",
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
          branch: "feature/existing-branch",
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
                    label: "api",
                    path: "/home/otzhora/projects/payments-backend",
                    defaultBranch: "main",
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
        projects={[
          {
            ...project,
            folders: [
              {
                id: 42,
                projectId: project.id,
                label: "api",
                path: "/home/otzhora/projects/payments-backend",
                defaultBranch: "main",
                kind: "APP",
                isPrimary: true,
                existsOnDisk: true,
                createdAt: "2026-02-28T12:00:00.000Z",
                updatedAt: "2026-02-28T12:00:00.000Z"
              }
            ]
          }
        ]}
        isSaving={false}
        saveSuccessCount={0}
        isDeleting={false}
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInApp={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit ticket workspaces" }));

    expect(screen.getByRole("dialog", { name: "Code setup" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("feature/existing-branch")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand linked projects" }));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit ticket status" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit ticket priority" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit ticket due date" })).toBeInTheDocument();
  });

  it("shows the open-in action when a linked project has an available folder", () => {
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
                    defaultBranch: null,
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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInApp={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Choose open-in app" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in VS Code" })).toBeInTheDocument();
  });

  it("lets the user choose an app first, then choose which linked project path to open in", async () => {
    const user = userEvent.setup();
    const handleOpenInApp = vi.fn();

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
                    defaultBranch: null,
                    kind: "APP",
                    isPrimary: true,
                    existsOnDisk: true,
                    createdAt: "2026-02-28T12:00:00.000Z",
                    updatedAt: "2026-02-28T12:00:00.000Z"
                  }
                ]
              }
            },
            {
              id: 2,
              ticketId: ticket.id,
              projectId: 2,
              relationship: "RELATED",
              createdAt: "2026-02-28T12:00:00.000Z",
              project: {
                ...project,
                id: 2,
                name: "Admin Dashboard",
                slug: "admin-dashboard",
                folders: [
                  {
                    id: 77,
                    projectId: 2,
                    label: "frontend",
                    path: "/home/otzhora/projects/admin",
                    defaultBranch: null,
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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInApp={handleOpenInApp}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Choose open-in app" }));
    const appPicker = screen.getByRole("dialog", { name: "Open in" });
    expect(appPicker).toBeInTheDocument();

    await user.click(within(appPicker).getByRole("button", { name: /File Explorer/ }));

    expect(screen.getByRole("button", { name: "Open in File Explorer" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open in File Explorer" }));

    const folderPicker = screen.getByRole("dialog", { name: "Choose folder" });

    const adminOptionLabel = within(folderPicker).getByText("Admin Dashboard", { selector: "span" });
    const adminOptionButton = adminOptionLabel.closest("button");

    expect(folderPicker).toContainElement(adminOptionButton);
    expect(adminOptionButton).not.toBeNull();

    await user.click(adminOptionButton!);

    expect(handleOpenInApp).toHaveBeenCalledWith("explorer", "folder", 77, undefined);
  });

  it("animates the open-in button through opening and success before resetting", async () => {
    vi.useFakeTimers();

    try {
      const deferred = createDeferred();
      const handleOpenInApp = vi.fn(() => deferred.promise);

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
                      defaultBranch: null,
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
          isOpeningInApp={false}
          isRefreshingJira={false}
          onChange={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
          onOpenInApp={handleOpenInApp}
          onRefreshJira={vi.fn()}
          onClose={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Open in VS Code" }));

      expect(handleOpenInApp).toHaveBeenCalledWith("vscode", "folder", 42, undefined);
      expect(screen.getByRole("button", { name: "Opening" })).toBeDisabled();
      expect(screen.getByText("Opening folder in VS Code…")).toBeInTheDocument();

      await act(async () => {
        deferred.resolve();
        await deferred.promise;
      });

      expect(screen.getByRole("button", { name: "Opened" })).toBeInTheDocument();
      expect(screen.getByText("Opened folder in VS Code.")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1600);
      });

      expect(screen.getByRole("button", { name: "Open in VS Code" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows open-in errors inline on the ticket action", async () => {
    const user = userEvent.setup();
    const handleOpenInApp = vi.fn(async () => {
      throw new Error("VS Code CLI is not available.");
    });

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
                    defaultBranch: null,
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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInApp={handleOpenInApp}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Open in VS Code" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open failed" })).toBeInTheDocument();
    });
    expect(screen.getByText("VS Code CLI is not available.")).toBeInTheDocument();
  });

  it("lets the user switch to worktree mode before opening", async () => {
    const user = userEvent.setup();
    const handleOpenInApp = vi.fn();

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
                    defaultBranch: null,
                    kind: "APP",
                    isPrimary: true,
                    existsOnDisk: true,
                    createdAt: "2026-02-28T12:00:00.000Z",
                    updatedAt: "2026-02-28T12:00:00.000Z"
                  }
                ]
              }
            }
          ],
          workspaces: [
            {
              id: 91,
              ticketId: ticket.id,
              projectFolderId: 42,
              branchName: "feature/open-flow",
              baseBranch: null,
              role: "primary",
              worktreePath: "/tmp/worktree",
              createdByBoroda: true,
              lastOpenedAt: null,
              createdAt: "2026-02-28T12:00:00.000Z",
              updatedAt: "2026-02-28T12:00:00.000Z",
              projectFolder: {
                id: 42,
                projectId: project.id,
                label: "workspace",
                path: "/home/otzhora/projects/payments",
                defaultBranch: null,
                kind: "APP",
                isPrimary: true,
                existsOnDisk: true,
                createdAt: "2026-02-28T12:00:00.000Z",
                updatedAt: "2026-02-28T12:00:00.000Z",
                project
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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInApp={handleOpenInApp}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Worktree" }));
    await user.click(screen.getByRole("button", { name: "Open in VS Code" }));

    expect(handleOpenInApp).toHaveBeenCalledWith("vscode", "worktree", 42, 91);
  });

  it("opens the app picker upward when the trigger is near the viewport bottom", async () => {
    const user = userEvent.setup();

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
                    defaultBranch: null,
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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInApp={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const toggleButton = screen.getByRole("button", { name: "Choose open-in app" });
    const originalGetBoundingClientRect = toggleButton.getBoundingClientRect.bind(toggleButton);
    const originalInnerHeight = window.innerHeight;
    const originalGetComputedStyle = window.getComputedStyle.bind(window);
    let scrollContainer: HTMLElement | null = toggleButton.parentElement;

    while (scrollContainer && !String(scrollContainer.className).includes("overflow-y-auto")) {
      scrollContainer = scrollContainer.parentElement;
    }

    vi.spyOn(toggleButton, "getBoundingClientRect").mockImplementation(
      () =>
        ({
          ...originalGetBoundingClientRect(),
          top: 720,
          bottom: 760,
          left: 0,
          right: 44,
          width: 44,
          height: 40,
          x: 0,
          y: 720,
          toJSON: () => ({})
        }) as DOMRect
    );

    if (scrollContainer) {
      vi.spyOn(scrollContainer, "getBoundingClientRect").mockImplementation(
        () =>
          ({
            top: 80,
            bottom: 776,
            left: 0,
            right: 900,
            width: 900,
            height: 696,
            x: 0,
            y: 80,
            toJSON: () => ({})
          }) as DOMRect
      );
    }

    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      if (scrollContainer && element === scrollContainer) {
        return {
          ...originalGetComputedStyle(element),
          overflowY: "auto"
        } as CSSStyleDeclaration;
      }

      return originalGetComputedStyle(element);
    });

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 800
    });

    await user.click(toggleButton);

    const appPicker = screen.getByRole("dialog", { name: "Open in" });

    expect(appPicker).toHaveAttribute("data-side", "top");
    expect(appPicker).toHaveStyle({ maxHeight: "616px" });

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: originalInnerHeight
    });
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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={handleChange}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInApp={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Edit ticket description" }));

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
          isOpeningInApp={false}
          isRefreshingJira={false}
          onChange={(updater) => {
            setForm((current) => updater(current));
          }}
          onSave={vi.fn()}
          onDelete={vi.fn()}
          onOpenInApp={vi.fn()}
          onRefreshJira={vi.fn()}
          onClose={vi.fn()}
        />
      );
    }

    render(<DrawerHarness />);

    await user.click(screen.getByRole("button", { name: "Edit ticket description" }));

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
          isOpeningInApp={false}
          isRefreshingJira={false}
          onChange={(updater) => {
            setForm((current) => updater(current));
          }}
          onSave={vi.fn()}
          onDelete={vi.fn()}
          onOpenInApp={vi.fn()}
          onRefreshJira={vi.fn()}
          onClose={vi.fn()}
        />
      );
    }

    render(<DrawerHarness />);

    await user.click(screen.getByRole("button", { name: "Edit ticket description" }));

    const descriptionField = screen.getByLabelText("Description");
    const dropZone = screen.getByRole("tabpanel", { name: "Write" });
    const droppedImage = new File(["image-data"], "dropped-image.png", { type: "image/png" });

    await user.click(descriptionField);

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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInApp={vi.fn()}
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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInApp={vi.fn()}
        onRefreshJira={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const layout = container.querySelector("div.grid.w-full.items-start");
    const additionalDetailsSection = screen.getByRole("heading", { name: "Additional details" }).closest("section");
    const linkedProjectsAside = screen.getByRole("button", { name: "Edit ticket workspaces" }).closest("aside");

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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInApp={vi.fn()}
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
        isOpeningInApp={false}
        isRefreshingJira={false}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInApp={vi.fn()}
        onRefreshJira={handleRefreshJira}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Refresh linked issues" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh linked issues" }));

    expect(handleRefreshJira).toHaveBeenCalledTimes(1);
  });
});
