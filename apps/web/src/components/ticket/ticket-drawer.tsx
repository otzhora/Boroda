import type { Project, Ticket } from "../../lib/types";
import type { TicketFormState } from "../../features/tickets/form";
import { ModalDialog } from "../ui/modal-dialog";
import { TicketForm } from "./ticket-form";
import { WorkContextEditor } from "./work-context-editor";

interface TicketDrawerProps {
  ticketId: number | null;
  ticket: Ticket | undefined;
  isLoading: boolean;
  isError: boolean;
  form: TicketFormState;
  projects: Project[];
  isSaving: boolean;
  isDeleting: boolean;
  onChange: (updater: (current: TicketFormState) => TicketFormState) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function TicketDrawer(props: TicketDrawerProps) {
  const {
    ticketId,
    ticket,
    isLoading,
    isError,
    form,
    projects,
    isSaving,
    isDeleting,
    onChange,
    onSave,
    onDelete,
    onClose
  } = props;

  return (
    <ModalDialog
      open={ticketId !== null}
      title={ticket ? `${ticket.key} ${ticket.title}` : "Ticket editor"}
      description="Edit ticket details, work contexts, linked folders, and recent activity."
      onClose={onClose}
      size="wide"
    >
      {isLoading ? (
        <p className="m-0 text-sm text-ink-200">Loading ticket…</p>
      ) : isError || !ticket ? (
        <p className="m-0 text-sm text-ink-200">
          Ticket details could not be loaded. Select it again or refresh the board.
        </p>
      ) : (
        <div className="grid gap-4">
          <TicketForm
            form={form}
            projects={projects}
            submitLabel="Save ticket"
            submittingLabel="Saving…"
            isSubmitting={isSaving}
            onChange={onChange}
            onSubmit={onSave}
            secondaryAction={{
              label: "Delete ticket",
              pendingLabel: "Deleting…",
              isPending: isDeleting,
              onClick: onDelete,
              variant: "danger"
            }}
          />

          <div className="grid gap-4 xl:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
            <WorkContextEditor ticketId={ticket.id} contexts={ticket.workContexts} />

            <section className="grid gap-4 rounded-[18px] border border-white/8 bg-canvas-850 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <h4 className="m-0 text-base font-semibold text-ink-50">Linked project folders</h4>
              </div>
              {ticket.projectLinks.length ? (
                ticket.projectLinks.map((link) => (
                  <div
                    className="flex min-w-0 flex-col gap-4 rounded-[16px] border border-white/6 bg-canvas-900 px-4 py-4 md:flex-row md:items-start md:justify-between"
                    key={link.id}
                  >
                    <div className="min-w-0">
                      <div>
                        <p className="m-0 text-sm font-medium text-ink-50">
                          {link.project.name}{" "}
                          <span className="ml-2 text-[0.82rem] text-ink-300">{link.relationship}</span>
                        </p>
                        <p className="m-0 mt-1 text-sm text-ink-300">
                          {link.project.description || "No project description."}
                        </p>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      {link.project.folders.length ? (
                        link.project.folders.map((folder) => (
                          <div key={folder.id}>
                            <strong className="text-sm font-semibold text-ink-50">{folder.label}</strong>
                            <p className="m-0 mt-1 break-words font-mono text-[0.88rem] text-ink-300">
                              {folder.path}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="m-0 text-sm text-ink-200">No folders attached to this project.</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="m-0 text-sm text-ink-200">No projects linked to this ticket.</p>
              )}
            </section>

            <section className="grid gap-4 rounded-[18px] border border-white/8 bg-canvas-850 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <h4 className="m-0 text-base font-semibold text-ink-50">Activity</h4>
              </div>
              {ticket.activities.length ? (
                ticket.activities.map((activity) => (
                  <div className="flex flex-col gap-2 rounded-[16px] border border-white/6 bg-canvas-900 px-4 py-3" key={activity.id}>
                    <p className="m-0 text-sm text-ink-50">{activity.message}</p>
                    <span className="text-[0.8rem] text-ink-300">
                      {new Date(activity.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="m-0 text-sm text-ink-200">No activity yet.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </ModalDialog>
  );
}
