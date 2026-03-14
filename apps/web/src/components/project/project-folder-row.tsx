import type { PathInfo, ProjectFolder } from "../../lib/types";
import {
  chipClassName,
  compactCheckboxLabelClassName,
  compactFieldClassName,
  createFolderFormState,
  describePathInfo,
  formatDateTime,
  getFolderStatusClassName,
  getWorktreeSetupStatusClassName,
  hasWorktreeSetup,
  inputClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  subtleDangerButtonClassName,
  type FolderFormState
} from "../../features/projects/page-helpers";

interface ProjectFolderRowProps {
  projectId: number;
  folder: ProjectFolder;
  isEditingFolder: boolean;
  folderEditForm?: FolderFormState;
  folderValidation: PathInfo | null;
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
}

export function ProjectFolderRow(props: ProjectFolderRowProps) {
  const resolvedFolderEditForm = props.folderEditForm ?? createFolderFormState(props.folder);

  return (
    <li className="border-t border-white/8 px-3 py-3 first:border-t-0">
      <div className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div className="min-w-0 space-y-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="m-0 min-w-0 text-sm font-medium text-ink-50">{props.folder.label}</p>
              {props.folder.isPrimary ? (
                <span className={`${chipClassName} border-white/12 bg-white/[0.04] text-ink-100`}>
                  Primary
                </span>
              ) : null}
              <span className={getFolderStatusClassName(props.folder.existsOnDisk)}>
                {props.folder.existsOnDisk ? "On disk" : "Missing"}
              </span>
              <span className={getWorktreeSetupStatusClassName(hasWorktreeSetup(props.folder))}>
                {hasWorktreeSetup(props.folder) ? "Worktree setup" : "No setup"}
              </span>
            </div>
            <p className="m-0 break-words font-mono text-[0.84rem] text-ink-200">{props.folder.path}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-300">
              <span>Default branch: {props.folder.defaultBranch || "Not set"}</span>
              <span>Updated {formatDateTime(props.folder.updatedAt)}</span>
            </div>
            <p className="m-0 text-sm text-ink-300">
              {hasWorktreeSetup(props.folder)
                ? "Fresh Boroda worktrees can run repo-local setup from .boroda/worktree.setup.json."
                : "No repo-local worktree setup yet. Scaffold a starter config to copy common env files into fresh worktrees."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={props.scaffoldWorktreeSetupMutationPending || !props.folder.existsOnDisk}
              onClick={() => props.onScaffoldWorktreeSetup(props.projectId, props.folder.id)}
            >
              {props.scaffoldWorktreeSetupMutationPending
                ? "Scaffolding…"
                : hasWorktreeSetup(props.folder)
                  ? "Re-scaffold setup"
                  : "Scaffold setup"}
            </button>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() =>
                props.isEditingFolder
                  ? props.onCancelFolderEdit(props.folder.id)
                  : props.onBeginFolderEdit(props.folder)
              }
            >
              {props.isEditingFolder ? "Close editor" : "Edit"}
            </button>
            <button
              type="button"
              className={subtleDangerButtonClassName}
              disabled={props.deleteFolderMutationPending}
              onClick={() => props.onHandleDeleteFolder(props.projectId, props.folder)}
            >
              Remove
            </button>
          </div>
        </div>

        {props.isEditingFolder ? (
          <form
            className="grid gap-3 border-t border-white/8 pt-3"
            onSubmit={(event) => props.onUpdateFolder(event, props.projectId, props.folder.id)}
          >
            <div className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.8fr)_minmax(0,1fr)_auto]">
              <label className={compactFieldClassName}>
                <span className={labelClassName}>Label</span>
                <input
                  className={inputClassName}
                  name={`folderLabel-${props.folder.id}`}
                  autoComplete="off"
                  value={resolvedFolderEditForm.label}
                  onChange={(event) =>
                    props.onUpdateFolderEditForm(props.folder, { label: event.target.value })
                  }
                  required
                />
              </label>
              <label className={compactFieldClassName}>
                <span className={labelClassName}>WSL path</span>
                <input
                  className={inputClassName}
                  name={`folderPath-${props.folder.id}`}
                  autoComplete="off"
                  spellCheck={false}
                  value={resolvedFolderEditForm.path}
                  onChange={(event) =>
                    props.onUpdateFolderEditForm(props.folder, { path: event.target.value })
                  }
                  required
                />
              </label>
              <label className={compactFieldClassName}>
                <span className={labelClassName}>Default branch</span>
                <input
                  className={inputClassName}
                  name={`folderDefaultBranch-${props.folder.id}`}
                  autoComplete="off"
                  spellCheck={false}
                  value={resolvedFolderEditForm.defaultBranch}
                  onChange={(event) =>
                    props.onUpdateFolderEditForm(props.folder, {
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
                  checked={resolvedFolderEditForm.isPrimary}
                  onChange={(event) =>
                    props.onUpdateFolderEditForm(props.folder, {
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
                onClick={() =>
                  props.onValidatePath(
                    `folder-${props.folder.id}`,
                    resolvedFolderEditForm.path,
                    props.folder.id
                  )
                }
              >
                {props.validatePathMutationPending ? "Checking…" : "Check path"}
              </button>
              <button
                className={primaryButtonClassName}
                type="submit"
                disabled={props.updateFolderMutationPending}
              >
                {props.updateFolderMutationPending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => props.onCancelFolderEdit(props.folder.id)}
              >
                Cancel
              </button>
            </div>

            {props.folderValidation ? (
              <p className="m-0 text-sm text-ink-300" aria-live="polite">
                {describePathInfo(props.folderValidation)}
              </p>
            ) : null}
          </form>
        ) : null}
      </div>
    </li>
  );
}
