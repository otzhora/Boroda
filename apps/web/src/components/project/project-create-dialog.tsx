import type { RefObject } from "react";
import { ModalDialog } from "../ui/modal-dialog";
import {
  fieldClassName,
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  textareaClassName,
  type ProjectFormState
} from "../../features/projects/page-helpers";

interface ProjectCreateDialogProps {
  open: boolean;
  projectForm: ProjectFormState;
  isPending: boolean;
  error?: string;
  initialFocusRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onFieldChange: <Key extends keyof ProjectFormState>(
    key: Key,
    value: ProjectFormState[Key]
  ) => void;
  onSlugChange: (value: string) => void;
}

export function ProjectCreateDialog(props: ProjectCreateDialogProps) {
  return (
    <ModalDialog
      open={props.open}
      title="New project"
      description="Create a project record."
      onClose={() => {
        if (props.isPending) {
          return;
        }

        props.onClose();
      }}
      initialFocusRef={props.initialFocusRef}
      variant="flat"
    >
      <form className="grid gap-4 px-4 py-4 sm:px-5" onSubmit={props.onSubmit}>
        <div className="grid gap-3">
          <label className={fieldClassName}>
            <span className={labelClassName}>Name</span>
            <input
              ref={props.initialFocusRef}
              className={inputClassName}
              name="projectName"
              autoComplete="off"
              value={props.projectForm.name}
              onChange={(event) => props.onFieldChange("name", event.target.value)}
              placeholder="payments-backend"
              required
            />
          </label>
          <label className={fieldClassName}>
            <span className={labelClassName}>Slug</span>
            <input
              className={inputClassName}
              name="projectSlug"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={props.projectForm.slug}
              onChange={(event) => props.onSlugChange(event.target.value)}
              placeholder="payments-backend"
              required
            />
          </label>
          <label className={fieldClassName}>
            <span className={labelClassName}>Color</span>
            <input
              className={inputClassName}
              name="projectColor"
              autoComplete="off"
              spellCheck={false}
              value={props.projectForm.color}
              onChange={(event) => props.onFieldChange("color", event.target.value)}
              placeholder="#355c7d"
            />
          </label>
          <label className={fieldClassName}>
            <span className={labelClassName}>Description</span>
            <textarea
              className={textareaClassName}
              name="projectDescription"
              value={props.projectForm.description}
              onChange={(event) => props.onFieldChange("description", event.target.value)}
              rows={5}
              placeholder="Main backend system"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className={primaryButtonClassName} type="submit" disabled={props.isPending}>
            {props.isPending ? "Creating…" : "Create project"}
          </button>
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={props.isPending}
            onClick={props.onClose}
          >
            Cancel
          </button>
          {props.error ? (
            <p className="m-0 text-sm text-danger-400" aria-live="polite">
              {props.error}
            </p>
          ) : null}
        </div>
      </form>
    </ModalDialog>
  );
}
