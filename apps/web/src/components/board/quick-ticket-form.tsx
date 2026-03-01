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
  submitLabel?: string;
  submittingLabel?: string;
  titleInputRef?: Ref<HTMLInputElement>;
  onChange: (updater: (current: QuickTicketFormState) => QuickTicketFormState) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}

const fieldLabelClassName = "m-0 text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-ink-300";
const fieldClassName =
  "min-h-11 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-ink-50 placeholder:text-ink-300";
const footerButtonClassName =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors disabled:cursor-progress disabled:opacity-70";
const primaryButtonClassName = `${footerButtonClassName} border-white/10 bg-ink-50 text-canvas-975 hover:bg-white`;
const secondaryButtonClassName = `${footerButtonClassName} border-white/10 bg-white/[0.02] text-ink-100 hover:border-white/16 hover:bg-white/[0.05]`;

function LoadingSpinner() {
  return (
    <span
      className="h-[0.85rem] w-[0.85rem] animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
      aria-hidden="true"
    />
  );
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
  submitLabel = "Create ticket",
  submittingLabel = "Creating…",
  titleInputRef,
  onChange,
  onSubmit,
  onCancel
}: QuickTicketFormProps) {
  return (
    <form
      className="grid gap-0"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-4 border-b border-white/8 px-3 py-3 sm:px-4 sm:py-4">
        <label className="grid min-w-0 gap-2">
          <span className={fieldLabelClassName}>Title</span>
          <input
            ref={titleInputRef}
            className={fieldClassName}
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
      </div>

      <div className="grid gap-4 px-3 py-3 sm:px-4 sm:py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2">
            <span className={fieldLabelClassName}>Project</span>
            <select
              className={fieldClassName}
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

          <label className="grid min-w-0 gap-2">
            <span className={fieldLabelClassName}>Status</span>
            <select
              className={fieldClassName}
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
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-2">
            <span className={fieldLabelClassName}>Priority</span>
            <select
              className={fieldClassName}
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

          <label className="grid min-w-0 gap-2">
            <span className={fieldLabelClassName}>Type</span>
            <select
              className={fieldClassName}
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
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/8 px-3 py-3 sm:px-4">
        {onCancel ? (
          <button type="button" className={secondaryButtonClassName} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button
          className={primaryButtonClassName}
          type="submit"
          disabled={isSubmitting}
          aria-label={isSubmitting ? submittingLabel : submitLabel}
        >
          {isSubmitting ? <LoadingSpinner /> : null}
          <span>{submitLabel}</span>
        </button>
      </div>
    </form>
  );
}
