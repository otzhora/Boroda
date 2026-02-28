import type { RefObject } from "react";
import {
  BOARD_STATUS_ORDER,
  statusLabelMap,
  TICKET_PRIORITIES,
  TICKET_TYPES
} from "../../lib/constants";
import type { Project, TicketPriority, TicketStatus, TicketType } from "../../lib/types";
import { ProjectLinkEditor } from "./project-link-editor";
import type { TicketFormState } from "../../features/tickets/form";

interface TicketTitleFieldProps {
  value: string;
  onChange: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  hideLabel?: boolean;
}

interface TicketDescriptionFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}

interface TicketMetaFieldsProps {
  form: TicketFormState;
  onChange: (updater: (current: TicketFormState) => TicketFormState) => void;
}

interface TicketProjectLinksFieldProps {
  value: TicketFormState["projectLinks"];
  projects: Project[];
  onChange: (projectLinks: TicketFormState["projectLinks"]) => void;
}

interface TicketActionBarProps {
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
  secondaryAction?: {
    label: string;
    pendingLabel: string;
    isPending: boolean;
    onClick: () => void;
    variant?: "default" | "danger";
  };
}

export const labelClassName = "m-0 text-sm font-medium text-ink-50";
export const inputClassName =
  "min-h-11 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-ink-50 placeholder:text-ink-300";
export const textareaClassName =
  "rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5 text-ink-50 placeholder:text-ink-300";

const primaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-ink-50 px-4 py-2 text-sm font-medium text-canvas-975 transition-opacity disabled:cursor-progress disabled:opacity-70";
const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-sm font-medium text-ink-100 transition-colors disabled:cursor-progress disabled:opacity-70 hover:border-white/16 hover:bg-white/[0.05]";
const dangerButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-lg border border-red-400/20 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-100 transition-colors disabled:cursor-progress disabled:opacity-70 hover:border-red-300/30 hover:bg-red-950/55";

function LoadingSpinner() {
  return (
    <span
      className="h-[0.85rem] w-[0.85rem] animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
      aria-hidden="true"
    />
  );
}

export function TicketTitleField({ value, onChange, inputRef, hideLabel = false }: TicketTitleFieldProps) {
  return (
    <label className="grid gap-2">
      <span className={hideLabel ? "sr-only" : labelClassName}>Title</span>
      <input
        ref={inputRef}
        className={inputClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </label>
  );
}

export function TicketDescriptionField({ value, onChange, onSubmit }: TicketDescriptionFieldProps) {
  return (
    <label className="grid gap-2">
      <span className={labelClassName}>Description</span>
      <textarea
        className={textareaClassName}
        rows={8}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onSubmit?.();
          }
        }}
      />
    </label>
  );
}

export function TicketMetaFields({ form, onChange }: TicketMetaFieldsProps) {
  return (
    <div className="grid gap-4">
      <label className="grid gap-2">
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

      <label className="grid gap-2">
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

      <label className="grid gap-2">
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

      <label className="grid gap-2">
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
    </div>
  );
}

export function TicketProjectLinksField({ value, projects, onChange }: TicketProjectLinksFieldProps) {
  return (
    <ProjectLinkEditor
      value={value}
      projects={projects}
      onChange={(projectLinks) => onChange(projectLinks)}
    />
  );
}

export function TicketActionBar(props: TicketActionBarProps) {
  const { isSubmitting, submitLabel, submittingLabel, onSubmit, onCancel, secondaryAction } = props;

  return (
    <div className="flex flex-wrap gap-3">
      <button
        className={primaryButtonClassName}
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        aria-label={isSubmitting ? submittingLabel : submitLabel}
      >
        {isSubmitting ? <LoadingSpinner /> : null}
        <span>{submitLabel}</span>
      </button>

      {onCancel ? (
        <button type="button" className={secondaryButtonClassName} onClick={onCancel}>
          Cancel
        </button>
      ) : null}

      {secondaryAction ? (
        <button
          type="button"
          className={secondaryAction.variant === "danger" ? dangerButtonClassName : secondaryButtonClassName}
          onClick={secondaryAction.onClick}
          disabled={secondaryAction.isPending}
          aria-label={secondaryAction.isPending ? secondaryAction.pendingLabel : secondaryAction.label}
        >
          {secondaryAction.isPending ? <LoadingSpinner /> : null}
          {secondaryAction.label}
        </button>
      ) : null}
    </div>
  );
}
