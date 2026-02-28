import {
  BOARD_STATUS_ORDER,
  statusLabelMap,
  TICKET_PRIORITIES,
  TICKET_TYPES
} from "../../lib/constants";
import type { Project, TicketPriority, TicketStatus, TicketType } from "../../lib/types";
import { ProjectLinkEditor } from "./project-link-editor";
import type { TicketFormState } from "../../features/tickets/form";

interface TicketFormProps {
  form: TicketFormState;
  projects: Project[];
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  onChange: (updater: (current: TicketFormState) => TicketFormState) => void;
  onSubmit: () => void;
  secondaryAction?: {
    label: string;
    pendingLabel: string;
    isPending: boolean;
    onClick: () => void;
    className?: string;
  };
}

export function TicketForm(props: TicketFormProps) {
  const {
    form,
    projects,
    submitLabel,
    submittingLabel,
    isSubmitting,
    onChange,
    onSubmit,
    secondaryAction
  } = props;

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="field field-wide">
        <span>Title</span>
        <input
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
      <label className="field field-wide">
        <span>Description</span>
        <textarea
          rows={5}
          value={form.description}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              description: event.target.value
            }))
          }
        />
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
      <label className="field">
        <span>Due at</span>
        <input
          type="datetime-local"
          value={form.dueAt}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              dueAt: event.target.value
            }))
          }
        />
      </label>

      <ProjectLinkEditor
        value={form.projectLinks}
        projects={projects}
        onChange={(projectLinks) =>
          onChange((current) => ({
            ...current,
            projectLinks
          }))
        }
      />

      <div className="form-actions field-wide">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
        {secondaryAction ? (
          <button
            type="button"
            className={secondaryAction.className}
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.isPending}
          >
            {secondaryAction.isPending ? secondaryAction.pendingLabel : secondaryAction.label}
          </button>
        ) : null}
      </div>
    </form>
  );
}
