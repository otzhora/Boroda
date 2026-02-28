import type { Project, Ticket } from "../../lib/types";
import type { TicketFormState } from "../../features/tickets/form";
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
    <section className="panel ticket-detail-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Ticket editor</p>
          <h3>{ticket ? `${ticket.key} ${ticket.title}` : "Select a ticket"}</h3>
        </div>
        {ticketId !== null ? (
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>

      {ticketId === null ? (
        <p className="empty-state">Pick a board card to edit ticket details, work contexts, and linked projects.</p>
      ) : isLoading ? (
        <p className="empty-state">Loading ticket…</p>
      ) : isError || !ticket ? (
        <p className="empty-state">Ticket details could not be loaded. Select it again or refresh the board.</p>
      ) : (
        <div className="stack">
          <TicketForm
            form={form}
            projects={projects}
            submitLabel="Save ticket"
            submittingLabel="Saving..."
            isSubmitting={isSaving}
            onChange={onChange}
            onSubmit={onSave}
            secondaryAction={{
              label: "Delete ticket",
              pendingLabel: "Deleting...",
              isPending: isDeleting,
              onClick: onDelete,
              className: "danger-button"
            }}
          />

          <div className="ticket-sidebar-grid">
            <WorkContextEditor ticketId={ticket.id} contexts={ticket.workContexts} />

            <section className="subform">
              <div className="folders-header">
                <h4>Linked project folders</h4>
              </div>
              {ticket.projectLinks.length ? (
                ticket.projectLinks.map((link) => (
                  <div className="folder-card" key={link.id}>
                    <div className="folder-card-body">
                      <div>
                        <p className="folder-title">
                          {link.project.name} <span>{link.relationship}</span>
                        </p>
                        <p>{link.project.description || "No project description."}</p>
                      </div>
                    </div>
                    <div className="stack">
                      {link.project.folders.length ? (
                        link.project.folders.map((folder) => (
                          <div key={folder.id}>
                            <strong>{folder.label}</strong>
                            <p className="folder-path">{folder.path}</p>
                          </div>
                        ))
                      ) : (
                        <p className="empty-state">No folders attached to this project.</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="empty-state">No projects linked to this ticket.</p>
              )}
            </section>

            <section className="subform">
              <div className="folders-header">
                <h4>Activity</h4>
              </div>
              {ticket.activities.length ? (
                ticket.activities.map((activity) => (
                  <div className="activity-item" key={activity.id}>
                    <p>{activity.message}</p>
                    <span>{new Date(activity.createdAt).toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <p className="empty-state">No activity yet.</p>
              )}
            </section>
          </div>
        </div>
      )}
    </section>
  );
}
