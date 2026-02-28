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
  onSubmit
}: QuickTicketFormProps) {
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="grid min-w-0 gap-2">
        <span className="m-0 text-sm font-medium text-ink-50">Title</span>
        <input
          ref={titleInputRef}
          className="min-h-11 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-ink-50 placeholder:text-ink-200/65"
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
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] items-end gap-4">
        <label className="grid gap-2">
          <span className="m-0 text-sm font-medium text-ink-50">Project</span>
          <select
            className="min-h-11 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-ink-50"
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
        <label className="grid gap-2">
          <span className="m-0 text-sm font-medium text-ink-50">Status</span>
          <select
            className="min-h-11 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-ink-50"
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
        <label className="grid gap-2">
          <span className="m-0 text-sm font-medium text-ink-50">Priority</span>
          <select
            className="min-h-11 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-ink-50"
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
        <label className="grid gap-2">
          <span className="m-0 text-sm font-medium text-ink-50">Type</span>
          <select
            className="min-h-11 rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-ink-50"
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
        <div className="flex flex-wrap justify-start gap-3">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent-700 px-4 py-2.5 text-sm font-medium text-canvas-950 transition-opacity disabled:cursor-progress disabled:opacity-70"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? submittingLabel : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
