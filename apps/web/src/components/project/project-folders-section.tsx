import type { PathInfo, Project, ProjectFolder } from "../../lib/types";
import {
  compactCheckboxLabelClassName,
  compactFieldClassName,
  describePathInfo,
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  sectionTitleClassName,
  secondaryButtonClassName,
  sortFolders,
  type FolderFormState
} from "../../features/projects/page-helpers";
import { ProjectFolderRow } from "./project-folder-row";

interface ProjectFoldersSectionProps {
  project: Project;
  folderCountLabel: string;
  folderCreateForm: FolderFormState;
  projectValidation: PathInfo | null;
  editingFolderIds: Record<number, boolean>;
  folderEditForms: Record<number, FolderFormState>;
  pathValidation: Record<string, PathInfo | null>;
  createFolderMutationPending: boolean;
  updateFolderMutationPending: boolean;
  deleteFolderMutationPending: boolean;
  validatePathMutationPending: boolean;
  scaffoldWorktreeSetupMutationPending: boolean;
  onBeginFolderEdit: (folder: ProjectFolder) => void;
  onCancelFolderEdit: (folderId: number) => void;
  onUpdateFolder: (
    event: React.FormEvent<HTMLFormElement>,
    projectId: number,
    folderId: number
  ) => void;
  onUpdateFolderEditForm: (folder: ProjectFolder, update: Partial<FolderFormState>) => void;
  onHandleDeleteFolder: (projectId: number, folder: ProjectFolder) => void;
  onValidatePath: (targetKey: string, path: string, existingFolderId?: number) => void;
  onScaffoldWorktreeSetup: (projectId: number, folderId: number) => void;
  onCreateFolder: (event: React.FormEvent<HTMLFormElement>, projectId: number) => void;
  onUpdateFolderCreateForm: (projectId: number, update: Partial<FolderFormState>) => void;
}

export function ProjectFoldersSection(props: ProjectFoldersSectionProps) {
  return (
    <>
      <section className="grid gap-3" aria-labelledby={`project-folders-${props.project.id}`}>
        <div className="flex items-center justify-between gap-3">
          <h4 id={`project-folders-${props.project.id}`} className={sectionTitleClassName}>
            Folders
          </h4>
          <span className="text-sm text-ink-300">{props.folderCountLabel}</span>
        </div>

        {props.project.folders.length ? (
          <ul className="m-0 list-none rounded-[10px] border border-white/8 bg-canvas-950 p-0" role="list">
            {sortFolders(props.project.folders).map((folder) => (
              <ProjectFolderRow
                key={folder.id}
                projectId={props.project.id}
                folder={folder}
                isEditingFolder={props.editingFolderIds[folder.id] ?? false}
                folderEditForm={props.folderEditForms[folder.id]}
                folderValidation={props.pathValidation[`folder-${folder.id}`] ?? null}
                updateFolderMutationPending={props.updateFolderMutationPending}
                deleteFolderMutationPending={props.deleteFolderMutationPending}
                validatePathMutationPending={props.validatePathMutationPending}
                scaffoldWorktreeSetupMutationPending={props.scaffoldWorktreeSetupMutationPending}
                onBeginFolderEdit={props.onBeginFolderEdit}
                onCancelFolderEdit={props.onCancelFolderEdit}
                onUpdateFolder={props.onUpdateFolder}
                onUpdateFolderEditForm={props.onUpdateFolderEditForm}
                onHandleDeleteFolder={props.onHandleDeleteFolder}
                onValidatePath={props.onValidatePath}
                onScaffoldWorktreeSetup={props.onScaffoldWorktreeSetup}
              />
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-ink-300">No folders yet.</p>
        )}
      </section>

      <form
        className="grid gap-3 rounded-[10px] border border-white/8 bg-canvas-950 px-3 py-3"
        onSubmit={(event) => props.onCreateFolder(event, props.project.id)}
        aria-label={`Add folder to ${props.project.name}`}
      >
        <div className="flex items-center justify-between gap-3">
          <h4 className={sectionTitleClassName}>Add folder</h4>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.8fr)_minmax(0,1fr)_auto]">
          <label className={compactFieldClassName}>
            <span className={labelClassName}>Label</span>
            <input
              className={inputClassName}
              name={`newFolderLabel-${props.project.id}`}
              autoComplete="off"
              value={props.folderCreateForm.label}
              onChange={(event) =>
                props.onUpdateFolderCreateForm(props.project.id, { label: event.target.value })
              }
              placeholder="terraform"
              required
            />
          </label>
          <label className={compactFieldClassName}>
            <span className={labelClassName}>WSL path</span>
            <input
              className={inputClassName}
              name={`newFolderPath-${props.project.id}`}
              autoComplete="off"
              spellCheck={false}
              value={props.folderCreateForm.path}
              onChange={(event) =>
                props.onUpdateFolderCreateForm(props.project.id, { path: event.target.value })
              }
              placeholder="/home/otzhora/projects/payments-terraform"
              required
            />
          </label>
          <label className={compactFieldClassName}>
            <span className={labelClassName}>Default branch</span>
            <input
              className={inputClassName}
              name={`newFolderDefaultBranch-${props.project.id}`}
              autoComplete="off"
              spellCheck={false}
              value={props.folderCreateForm.defaultBranch}
              onChange={(event) =>
                props.onUpdateFolderCreateForm(props.project.id, {
                  defaultBranch: event.target.value
                })
              }
              placeholder="main"
            />
          </label>
          <label className={compactCheckboxLabelClassName}>
            <input
              className="h-4 w-4 shrink-0 accent-ink-50"
              type="checkbox"
              checked={props.folderCreateForm.isPrimary}
              onChange={(event) =>
                props.onUpdateFolderCreateForm(props.project.id, {
                  isPrimary: event.target.checked
                })
              }
            />
            <span>Primary folder</span>
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={props.validatePathMutationPending}
            onClick={() => props.onValidatePath(`project-${props.project.id}`, props.folderCreateForm.path)}
          >
            {props.validatePathMutationPending ? "Checking…" : "Check path"}
          </button>
          <button
            className={primaryButtonClassName}
            type="submit"
            disabled={props.createFolderMutationPending}
          >
            {props.createFolderMutationPending ? "Adding…" : "Add folder"}
          </button>
        </div>

        {props.projectValidation ? (
          <p className="m-0 text-sm text-ink-300" aria-live="polite">
            {describePathInfo(props.projectValidation)}
          </p>
        ) : null}
      </form>
    </>
  );
}
