import { getProjectBadgeStyle } from "../../lib/project-colors";
import type { PathInfo, Project, ProjectFolder } from "../../lib/types";
import {
  chipClassName,
  formatFolderCount,
  getProjectStatusClassName,
  projectArticleClassName,
  projectBodyClassName,
  projectRowClassName,
  projectToggleButtonClassName,
  type FolderFormState,
  type ProjectFormState
} from "../../features/projects/page-helpers";
import { ProjectDetailsPanel } from "./project-details-panel";
import { ProjectFoldersSection } from "./project-folders-section";

interface ProjectListItemProps {
  project: Project;
  isExpandedProject: boolean;
  isEditingProject: boolean;
  projectEditForm: ProjectFormState;
  folderCreateForm: FolderFormState;
  projectValidation: PathInfo | null;
  editingFolderIds: Record<number, boolean>;
  folderEditForms: Record<number, FolderFormState>;
  pathValidation: Record<string, PathInfo | null>;
  updateProjectMutationPending: boolean;
  archiveProjectMutationPending: boolean;
  unarchiveProjectMutationPending: boolean;
  createFolderMutationPending: boolean;
  updateFolderMutationPending: boolean;
  deleteFolderMutationPending: boolean;
  validatePathMutationPending: boolean;
  scaffoldWorktreeSetupMutationPending: boolean;
  onToggleProjectExpansion: (projectId: number) => void;
  onBeginProjectEdit: (project: Project) => void;
  onCancelProjectEdit: (projectId: number) => void;
  onUpdateProject: (event: React.FormEvent<HTMLFormElement>, projectId: number) => void;
  onUpdateProjectEditForm: (projectId: number, update: Partial<ProjectFormState>) => void;
  onHandleDeleteProject: (project: Project) => void;
  onHandleRestoreProject: (project: Project) => void;
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

export function ProjectListItem(props: ProjectListItemProps) {
  const folderCountLabel = formatFolderCount(props.project.folders.length);
  const hasFolders = props.project.folders.length > 0;

  return (
    <article className={projectArticleClassName}>
      <div className={projectRowClassName}>
        <button
          type="button"
          className={`${projectToggleButtonClassName} ${props.isExpandedProject ? "bg-white/[0.03]" : ""}`}
          aria-expanded={props.isExpandedProject}
          aria-controls={`project-panel-${props.project.id}`}
          aria-label={`${props.isExpandedProject ? "Hide details" : "Show details"} for ${props.project.name}`}
          onClick={() => props.onToggleProjectExpansion(props.project.id)}
        >
          <span
            className="flex h-4 w-4 items-center justify-center text-sm leading-none text-ink-300"
            aria-hidden="true"
          >
            <span className={props.isExpandedProject ? "-translate-y-px" : ""}>
              {props.isExpandedProject ? "⌄" : "›"}
            </span>
          </span>
          <div className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: props.project.color || "#445" }} />
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <span
                className="shrink-0 rounded-[8px] border px-2 py-0.5 font-mono text-xs"
                style={getProjectBadgeStyle(props.project.color)}
              >
                {props.project.slug}
              </span>
              <h3 className="m-0 min-w-0 truncate text-[0.95rem] font-medium leading-6 text-ink-100">
                {props.project.name}
              </h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <span className={getProjectStatusClassName(props.project.folders.length)}>
              {hasFolders ? "Configured" : "Needs folder"}
            </span>
            <span className={`${chipClassName} border-white/10 bg-white/[0.04] text-ink-200`}>
              {folderCountLabel}
            </span>
          </div>
        </button>
      </div>

      {props.isExpandedProject ? (
        <div
          id={`project-panel-${props.project.id}`}
          className={projectBodyClassName}
          role="region"
          aria-label={`Project details for ${props.project.name}`}
        >
          <ProjectDetailsPanel
            project={props.project}
            isEditingProject={props.isEditingProject}
            projectEditForm={props.projectEditForm}
            updateProjectMutationPending={props.updateProjectMutationPending}
            archiveProjectMutationPending={props.archiveProjectMutationPending}
            unarchiveProjectMutationPending={props.unarchiveProjectMutationPending}
            onBeginProjectEdit={props.onBeginProjectEdit}
            onCancelProjectEdit={props.onCancelProjectEdit}
            onUpdateProject={props.onUpdateProject}
            onUpdateProjectEditForm={props.onUpdateProjectEditForm}
            onHandleDeleteProject={props.onHandleDeleteProject}
            onHandleRestoreProject={props.onHandleRestoreProject}
          />

          <ProjectFoldersSection
            project={props.project}
            folderCountLabel={folderCountLabel}
            folderCreateForm={props.folderCreateForm}
            projectValidation={props.projectValidation}
            editingFolderIds={props.editingFolderIds}
            folderEditForms={props.folderEditForms}
            pathValidation={props.pathValidation}
            createFolderMutationPending={props.createFolderMutationPending}
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
            onCreateFolder={props.onCreateFolder}
            onUpdateFolderCreateForm={props.onUpdateFolderCreateForm}
          />
        </div>
      ) : null}
    </article>
  );
}
