import type { Project } from "../../lib/types";
import {
  dangerButtonClassName,
  fieldClassName,
  fieldWideClassName,
  formatDateTime,
  inputClassName,
  insetPanelClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  textareaClassName,
  type ProjectFormState
} from "../../features/projects/page-helpers";

interface ProjectDetailsPanelProps {
  project: Project;
  isEditingProject: boolean;
  projectEditForm: ProjectFormState;
  updateProjectMutationPending: boolean;
  archiveProjectMutationPending: boolean;
  unarchiveProjectMutationPending: boolean;
  onBeginProjectEdit: (project: Project) => void;
  onCancelProjectEdit: (projectId: number) => void;
  onUpdateProject: (event: React.FormEvent<HTMLFormElement>, projectId: number) => void;
  onUpdateProjectEditForm: (projectId: number, update: Partial<ProjectFormState>) => void;
  onHandleDeleteProject: (project: Project) => void;
  onHandleRestoreProject: (project: Project) => void;
}

export function ProjectDetailsPanel(props: ProjectDetailsPanelProps) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0 space-y-1">
          <p className="m-0 text-sm text-ink-300">Updated {formatDateTime(props.project.updatedAt)}</p>
          <p className="m-0 break-words text-sm leading-6 text-ink-100">
            {props.project.description || "No description"}
          </p>
        </div>
        {!props.isEditingProject ? (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => props.onBeginProjectEdit(props.project)}
            >
              Edit project
            </button>
            {props.project.archivedAt ? (
              <button
                type="button"
                className={secondaryButtonClassName}
                disabled={props.unarchiveProjectMutationPending}
                onClick={() => props.onHandleRestoreProject(props.project)}
              >
                Restore
              </button>
            ) : (
              <button
                type="button"
                className={dangerButtonClassName}
                disabled={props.archiveProjectMutationPending}
                onClick={() => props.onHandleDeleteProject(props.project)}
              >
                Archive
              </button>
            )}
          </div>
        ) : null}
      </div>

      {props.isEditingProject ? (
        <form className={insetPanelClassName} onSubmit={(event) => props.onUpdateProject(event, props.project.id)}>
          <div className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
            <label className={fieldClassName}>
              <span className={labelClassName}>Name</span>
              <input
                className={inputClassName}
                name={`projectName-${props.project.id}`}
                autoComplete="off"
                value={props.projectEditForm.name}
                onChange={(event) =>
                  props.onUpdateProjectEditForm(props.project.id, { name: event.target.value })
                }
                required
              />
            </label>
            <label className={fieldClassName}>
              <span className={labelClassName}>Slug</span>
              <input
                className={inputClassName}
                name={`projectSlug-${props.project.id}`}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={props.projectEditForm.slug}
                onChange={(event) =>
                  props.onUpdateProjectEditForm(props.project.id, { slug: event.target.value })
                }
                required
              />
            </label>
            <label className={fieldClassName}>
              <span className={labelClassName}>Color</span>
              <input
                className={inputClassName}
                name={`projectColor-${props.project.id}`}
                autoComplete="off"
                spellCheck={false}
                value={props.projectEditForm.color}
                onChange={(event) =>
                  props.onUpdateProjectEditForm(props.project.id, { color: event.target.value })
                }
              />
            </label>
            <label className={fieldWideClassName}>
              <span className={labelClassName}>Description</span>
              <textarea
                className={textareaClassName}
                name={`projectDescription-${props.project.id}`}
                value={props.projectEditForm.description}
                onChange={(event) =>
                  props.onUpdateProjectEditForm(props.project.id, { description: event.target.value })
                }
                rows={3}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className={primaryButtonClassName}
              type="submit"
              disabled={props.updateProjectMutationPending}
            >
              {props.updateProjectMutationPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => props.onCancelProjectEdit(props.project.id)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}
