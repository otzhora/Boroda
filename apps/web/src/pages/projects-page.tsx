import { Link } from "react-router-dom";
import { AppHeaderRightActions } from "../app/router";
import { ProjectCreateDialog } from "../components/project/project-create-dialog";
import { ProjectListItem } from "../components/project/project-list-item";
import { ProjectsPageToolbar } from "../components/project/projects-page-toolbar";
import {
  createProjectFormState,
  headerActionButtonClassName,
  panelClassName,
  projectListClassName,
  createFolderFormState
} from "../features/projects/page-helpers";
import { useProjectsPageController } from "../features/projects/use-projects-page-controller";

export function ProjectsPage() {
  const {
    createProjectNameRef,
    isCreateProjectOpen,
    setIsCreateProjectOpen,
    projectForm,
    updateProjectField,
    setSlugTouched,
    projectScope,
    setScope,
    projectsQuery,
    sortedProjects,
    projectError,
    folderError,
    validateError,
    deleteError,
    expandedProjectId,
    editingProjectId,
    projectEditForms,
    folderCreateForms,
    editingFolderIds,
    folderEditForms,
    pathValidation,
    createProjectMutation,
    updateProjectMutation,
    archiveProjectMutation,
    unarchiveProjectMutation,
    createFolderMutation,
    updateFolderMutation,
    deleteFolderMutation,
    validatePathMutation,
    scaffoldWorktreeSetupMutation,
    handleCreateProject,
    handleUpdateProject,
    handleCreateFolder,
    handleUpdateFolder,
    handleValidatePath,
    handleDeleteProject,
    handleRestoreProject,
    toggleProjectExpansion,
    beginProjectEdit,
    cancelProjectEdit,
    updateProjectEditForm,
    beginFolderEdit,
    cancelFolderEdit,
    updateFolderEditForm,
    handleDeleteFolder,
    updateFolderCreateForm
  } = useProjectsPageController();

  return (
    <>
      <AppHeaderRightActions>
        <Link to="/settings" className={headerActionButtonClassName}>
          Settings
        </Link>
      </AppHeaderRightActions>

      <ProjectCreateDialog
        open={isCreateProjectOpen}
        projectForm={projectForm}
        isPending={createProjectMutation.isPending}
        error={projectError}
        initialFocusRef={createProjectNameRef}
        onClose={() => setIsCreateProjectOpen(false)}
        onSubmit={(event) => void handleCreateProject(event)}
        onFieldChange={updateProjectField}
        onSlugChange={(value) => {
          setSlugTouched(true);
          updateProjectField("slug", value);
        }}
      />

      <section className="mx-auto flex h-full w-full min-h-0 min-w-0 max-w-6xl flex-col gap-3 pb-2">
        <ProjectsPageToolbar
          projectCount={sortedProjects.length}
          folderCount={sortedProjects.reduce((count, project) => count + project.folders.length, 0)}
          projectScope={projectScope}
          isRefreshing={projectsQuery.isFetching}
          onRefresh={() => {
            void projectsQuery.refetch();
          }}
          onScopeChange={setScope}
          onCreateProject={() => setIsCreateProjectOpen(true)}
        />

        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          {projectsQuery.isLoading ? (
            <p className={`${panelClassName} m-0 text-sm text-ink-50`}>Loading projects…</p>
          ) : null}
          {projectsQuery.isError ? (
            <p className={`${panelClassName} m-0 text-sm text-danger-400`} aria-live="polite">
              Projects request failed.
            </p>
          ) : null}

          <div className={projectListClassName}>
            {sortedProjects.map((project) => (
              <ProjectListItem
                key={project.id}
                project={project}
                isExpandedProject={expandedProjectId === project.id}
                isEditingProject={editingProjectId === project.id}
                projectEditForm={projectEditForms[project.id] ?? createProjectFormState(project)}
                folderCreateForm={folderCreateForms[project.id] ?? createFolderFormState()}
                projectValidation={pathValidation[`project-${project.id}`] ?? null}
                editingFolderIds={editingFolderIds}
                folderEditForms={folderEditForms}
                pathValidation={pathValidation}
                updateProjectMutationPending={updateProjectMutation.isPending}
                archiveProjectMutationPending={archiveProjectMutation.isPending}
                unarchiveProjectMutationPending={unarchiveProjectMutation.isPending}
                createFolderMutationPending={createFolderMutation.isPending}
                updateFolderMutationPending={updateFolderMutation.isPending}
                deleteFolderMutationPending={deleteFolderMutation.isPending}
                validatePathMutationPending={validatePathMutation.isPending}
                scaffoldWorktreeSetupMutationPending={scaffoldWorktreeSetupMutation.isPending}
                onToggleProjectExpansion={toggleProjectExpansion}
                onBeginProjectEdit={beginProjectEdit}
                onCancelProjectEdit={cancelProjectEdit}
                onUpdateProject={(event, projectId) => {
                  void handleUpdateProject(event, projectId);
                }}
                onUpdateProjectEditForm={updateProjectEditForm}
                onHandleDeleteProject={handleDeleteProject}
                onHandleRestoreProject={handleRestoreProject}
                onBeginFolderEdit={beginFolderEdit}
                onCancelFolderEdit={cancelFolderEdit}
                onUpdateFolder={(event, projectId, folderId) => {
                  void handleUpdateFolder(event, projectId, folderId);
                }}
                onUpdateFolderEditForm={updateFolderEditForm}
                onHandleDeleteFolder={handleDeleteFolder}
                onValidatePath={(targetKey, path, existingFolderId) => {
                  void handleValidatePath(targetKey, path, existingFolderId);
                }}
                onScaffoldWorktreeSetup={(projectId, folderId) => {
                  scaffoldWorktreeSetupMutation.mutate({ projectId, folderId });
                }}
                onCreateFolder={(event, projectId) => {
                  void handleCreateFolder(event, projectId);
                }}
                onUpdateFolderCreateForm={updateFolderCreateForm}
              />
            ))}
          </div>

          {folderError || validateError || deleteError ? (
            <p className={`${panelClassName} m-0 text-sm text-danger-400`} aria-live="polite">
              {folderError ?? validateError ?? deleteError}
            </p>
          ) : null}

          {!sortedProjects.length && !projectsQuery.isLoading ? (
            <p className={`${panelClassName} m-0 text-sm text-ink-50`}>No projects.</p>
          ) : null}
        </div>
      </section>
    </>
  );
}
