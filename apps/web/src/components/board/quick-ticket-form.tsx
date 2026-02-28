import type { Ref } from "react";
import { BOARD_STATUS_ORDER, TICKET_PRIORITIES, TICKET_TYPES, statusLabelMap } from "../../lib/constants";
import type { Project, TicketPriority, TicketStatus, TicketType } from "../../lib/types";

export interface QuickTicketFormState {
  title: string;
  projectId: string;
  status: TicketStatus;
  priority: TicketPriority;
  type: TicketType;
}

interface QuickTicketFormProps {
  form: QuickTicketFormState;
  projects: Project[];
  isSubmitting: boolean;
  titleInputRef?: Ref<HTMLInputElement>;
  onChange: (updater: (current: QuickTicketFormState) => QuickTicketFormState) => void;
  onSubmit: () => void;
}

export function createEmptyQuickTicketForm(): QuickTicketFormState {
  return {
    title: "",
    projectId: "",
    status: "INBOX",
    priority: "MEDIUM",
    type: "TASK"
  };
}

export function QuickTicketForm({
  form,
  projects,
  isSubmitting,
  titleInputRef,
  onChange,
  onSubmit
}: QuickTicketFormProps) {
  return (
    <form
      className="quick-ticket-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="field quick-ticket-title">
        <span>Title</span>
        <input
          ref={titleInputRef}
          placeholder="Capture the next ticket…"
          value={form.title}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              title: event.target.value
            }))
          }
          required
        />
      </label>
      <div className="quick-ticket-controls">
        <label className="field">
          <span>Project</span>
          <select
            value={form.projectId}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                projectId: event.target.value
              }))
            }
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select
            value={form.status}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                status: event.target.value as TicketStatus
              }))
            }
          >
            {BOARD_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {statusLabelMap[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Priority</span>
          <select
            value={form.priority}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                priority: event.target.value as TicketPriority
              }))
            }
          >
            {TICKET_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Type</span>
          <select
            value={form.type}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                type: event.target.value as TicketType
              }))
            }
          >
            {TICKET_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <div className="form-actions quick-ticket-actions">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Quick create"}
          </button>
        </div>
      </div>
    </form>
  );
}
