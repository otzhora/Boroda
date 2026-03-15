import { getProjectBadgeStyle } from "../../lib/project-colors";
import {
  chipClassName,
  formatFolderCount,
  getProjectStatusClassName,
  projectArticleClassName,
  projectBodyClassName,
  projectRowClassName,
  projectToggleButtonClassName
} from "../../features/projects/page-helpers";
import type {
  ProjectListItemActions,
  ProjectListItemModel
} from "../../features/projects/use-projects-page-controller";
import { ProjectDetailsPanel } from "./project-details-panel";
import { ProjectFoldersSection } from "./project-folders-section";

interface ProjectListItemProps {
  item: ProjectListItemModel;
  actions: ProjectListItemActions;
  mutationState: {
    updateProjectPending: boolean;
    archiveProjectPending: boolean;
    unarchiveProjectPending: boolean;
    createFolderPending: boolean;
    updateFolderPending: boolean;
    deleteFolderPending: boolean;
    validatePathPending: boolean;
    scaffoldWorktreeSetupPending: boolean;
  };
}

export function ProjectListItem(props: ProjectListItemProps) {
  const { item, actions, mutationState } = props;
  const folderCountLabel = formatFolderCount(item.project.folders.length);
  const hasFolders = item.project.folders.length > 0;

  return (
    <article className={projectArticleClassName}>
      <div className={projectRowClassName}>
        <button
          type="button"
          className={`${projectToggleButtonClassName} ${item.isExpanded ? "bg-white/[0.03]" : ""}`}
          aria-expanded={item.isExpanded}
          aria-controls={`project-panel-${item.project.id}`}
          aria-label={`${item.isExpanded ? "Hide details" : "Show details"} for ${item.project.name}`}
          onClick={() => actions.toggleExpansion(item.project.id)}
        >
          <span
            className="flex h-4 w-4 items-center justify-center text-sm leading-none text-ink-300"
            aria-hidden="true"
          >
            <span className={item.isExpanded ? "-translate-y-px" : ""}>
              {item.isExpanded ? "⌄" : "›"}
            </span>
          </span>
          <div className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: item.project.color || "#445" }} />
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <span
                className="shrink-0 rounded-[8px] border px-2 py-0.5 font-mono text-xs"
                style={getProjectBadgeStyle(item.project.color)}
              >
                {item.project.slug}
              </span>
              <h3 className="m-0 min-w-0 truncate text-[0.95rem] font-medium leading-6 text-ink-100">
                {item.project.name}
              </h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <span className={getProjectStatusClassName(item.project.folders.length)}>
              {hasFolders ? "Configured" : "Needs folder"}
            </span>
            <span className={`${chipClassName} border-white/10 bg-white/[0.04] text-ink-200`}>
              {folderCountLabel}
            </span>
          </div>
        </button>
      </div>

      {item.isExpanded ? (
        <div
          id={`project-panel-${item.project.id}`}
          className={projectBodyClassName}
          role="region"
          aria-label={`Project details for ${item.project.name}`}
        >
          <ProjectDetailsPanel
            project={item.project}
            isEditingProject={item.details.isEditing}
            projectEditForm={item.details.editForm}
            updateProjectMutationPending={mutationState.updateProjectPending}
            archiveProjectMutationPending={mutationState.archiveProjectPending}
            unarchiveProjectMutationPending={mutationState.unarchiveProjectPending}
            onBeginProjectEdit={actions.beginProjectEdit}
            onCancelProjectEdit={actions.cancelProjectEdit}
            onUpdateProject={actions.updateProject}
            onUpdateProjectEditForm={actions.updateProjectEditForm}
            onHandleDeleteProject={actions.deleteProject}
            onHandleRestoreProject={actions.restoreProject}
          />

          <ProjectFoldersSection
            project={item.project}
            folderCountLabel={folderCountLabel}
            folderCreateForm={item.folders.createForm}
            projectValidation={item.folders.createValidation}
            editingFolderIds={item.folders.editingIds}
            folderEditForms={item.folders.editForms}
            pathValidation={item.folders.pathValidation}
            createFolderMutationPending={mutationState.createFolderPending}
            updateFolderMutationPending={mutationState.updateFolderPending}
            deleteFolderMutationPending={mutationState.deleteFolderPending}
            validatePathMutationPending={mutationState.validatePathPending}
            scaffoldWorktreeSetupMutationPending={mutationState.scaffoldWorktreeSetupPending}
            onBeginFolderEdit={actions.beginFolderEdit}
            onCancelFolderEdit={actions.cancelFolderEdit}
            onUpdateFolder={actions.updateFolder}
            onUpdateFolderEditForm={actions.updateFolderEditForm}
            onHandleDeleteFolder={actions.deleteFolder}
            onValidatePath={actions.validatePath}
            onScaffoldWorktreeSetup={actions.scaffoldWorktreeSetup}
            onCreateFolder={actions.createFolder}
            onUpdateFolderCreateForm={actions.updateFolderCreateForm}
          />
        </div>
      ) : null}
    </article>
  );
}
