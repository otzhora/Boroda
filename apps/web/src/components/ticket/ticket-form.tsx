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
    variant?: "default" | "danger";
  };
}

const fieldClassName = "grid gap-2";
const fieldWideClassName = "md:col-span-full grid gap-2";
const labelClassName = "m-0 text-sm font-medium text-ink-50";
const inputClassName =
  "min-h-11 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3 text-ink-50 placeholder:text-ink-300";
const textareaClassName =
  "rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3 text-ink-50 placeholder:text-ink-300";
const primaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-ink-50 px-4 py-2.5 text-sm font-medium text-canvas-975 transition-opacity disabled:cursor-progress disabled:opacity-70";
const secondaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-ink-100 transition-colors disabled:cursor-progress disabled:opacity-70 hover:border-white/16 hover:bg-white/[0.06]";
const dangerButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-red-400/20 bg-red-950/50 px-4 py-2.5 text-sm font-medium text-red-100 transition-colors disabled:cursor-progress disabled:opacity-70 hover:border-red-300/30 hover:bg-red-950/70";

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
      className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className={fieldWideClassName}>
        <span className={labelClassName}>Title</span>
        <input
          className={inputClassName}
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
      <label className={fieldWideClassName}>
        <span className={labelClassName}>Description</span>
        <textarea
          className={textareaClassName}
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
      <label className={fieldClassName}>
        <span className={labelClassName}>Status</span>
        <select
          className={inputClassName}
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
      <label className={fieldClassName}>
        <span className={labelClassName}>Priority</span>
        <select
          className={inputClassName}
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
      <label className={fieldClassName}>
        <span className={labelClassName}>Type</span>
        <select
          className={inputClassName}
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
      <label className={fieldClassName}>
        <span className={labelClassName}>Due at</span>
        <input
          className={inputClassName}
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

      <div className="flex flex-wrap gap-3 md:col-span-full">
        <button className={primaryButtonClassName} type="submit" disabled={isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
        {secondaryAction ? (
          <button
            type="button"
            className={secondaryAction.variant === "danger" ? dangerButtonClassName : secondaryButtonClassName}
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
