import { Link } from "react-router-dom";
import { AppHeaderRightActions } from "../app/router";
import { ProjectCreateDialog } from "../components/project/project-create-dialog";
import { ProjectListItem } from "../components/project/project-list-item";
import { ProjectsPageToolbar } from "../components/project/projects-page-toolbar";
import { headerActionButtonClassName, panelClassName, projectListClassName } from "../features/projects/page-helpers";
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
    projectItems,
    projectError,
    folderError,
    validateError,
    deleteError,
    createProjectMutation,
    handleCreateProject,
    mutationState,
    projectItemActions
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
          projectCount={projectItems.length}
          folderCount={projectItems.reduce((count, item) => count + item.project.folders.length, 0)}
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
            {projectItems.map((item) => (
              <ProjectListItem
                key={item.project.id}
                item={item}
                actions={projectItemActions}
                mutationState={mutationState}
              />
            ))}
          </div>

          {folderError || validateError || deleteError ? (
            <p className={`${panelClassName} m-0 text-sm text-danger-400`} aria-live="polite">
              {folderError ?? validateError ?? deleteError}
            </p>
          ) : null}

          {!projectItems.length && !projectsQuery.isLoading ? (
            <p className={`${panelClassName} m-0 text-sm text-ink-50`}>No projects.</p>
          ) : null}
        </div>
      </section>
    </>
  );
}
