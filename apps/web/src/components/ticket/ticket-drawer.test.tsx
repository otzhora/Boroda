import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { toTicketForm } from "../../features/tickets/form";
import type { Project, Ticket } from "../../lib/types";

vi.mock("./work-context-editor", () => ({
  WorkContextEditor: () => <div>Work contexts</div>
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
  status: "INBOX",
  priority: "HIGH",
  type: "BUG",
  dueAt: null,
  createdAt: "2026-02-28T12:00:00.000Z",
  updatedAt: "2026-02-28T12:00:00.000Z",
  archivedAt: null,
  projectLinks: [],
  workContexts: [],
  activities: []
};

describe("TicketDrawer", () => {
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
        onChange={handleChange}
        onSave={handleSave}
        onDelete={vi.fn()}
        onOpenInTerminal={vi.fn()}
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
        onChange={handleChange}
        onSave={handleSave}
        onDelete={vi.fn()}
        onOpenInTerminal={vi.fn()}
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
        onChange={vi.fn()}
        onSave={handleSave}
        onDelete={vi.fn()}
        onOpenInTerminal={vi.fn()}
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
        onChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onOpenInTerminal={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Open in Terminal" })).toBeInTheDocument();
  });
});
