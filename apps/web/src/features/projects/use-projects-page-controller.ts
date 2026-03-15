import { useProjectsPageMutations } from "./mutations";
import {
  createFolderFormState,
  createProjectFormState,
  type FolderFormState,
  type ProjectFormState
} from "./page-helpers";
import { useProjectsPageEditorState } from "./use-projects-page-editor-state";
import { useProjectsPageScope } from "./use-projects-page-scope";
import type { PathInfo, Project, ProjectFolder } from "../../lib/types";

export interface ProjectListItemModel {
  project: Project;
  isExpanded: boolean;
  details: {
    isEditing: boolean;
    editForm: ProjectFormState;
  };
  folders: {
    createForm: FolderFormState;
    createValidation: PathInfo | null;
    editingIds: Record<number, boolean>;
    editForms: Record<number, FolderFormState>;
    pathValidation: Record<string, PathInfo | null>;
  };
}

export interface ProjectListItemActions {
  toggleExpansion: (projectId: number) => void;
  beginProjectEdit: (project: Project) => void;
  cancelProjectEdit: (projectId: number) => void;
  updateProject: (event: React.FormEvent<HTMLFormElement>, projectId: number) => void;
  updateProjectEditForm: (projectId: number, update: Partial<ProjectFormState>) => void;
  deleteProject: (project: Project) => void;
  restoreProject: (project: Project) => void;
  beginFolderEdit: (folder: ProjectFolder) => void;
  cancelFolderEdit: (folderId: number) => void;
  updateFolder: (
    event: React.FormEvent<HTMLFormElement>,
    projectId: number,
    folderId: number
  ) => void;
  updateFolderEditForm: (folder: ProjectFolder, update: Partial<FolderFormState>) => void;
  deleteFolder: (projectId: number, folder: ProjectFolder) => void;
  validatePath: (targetKey: string, path: string, existingFolderId?: number) => void;
  scaffoldWorktreeSetup: (projectId: number, folderId: number) => void;
  createFolder: (event: React.FormEvent<HTMLFormElement>, projectId: number) => void;
  updateFolderCreateForm: (projectId: number, update: Partial<FolderFormState>) => void;
}

export function useProjectsPageController() {
  const { projectScope, setScope, projectsQuery, sortedProjects } = useProjectsPageScope();
  const editorState = useProjectsPageEditorState();
  const projects = projectsQuery.data ?? [];

  const {
    createProjectMutation,
    updateProjectMutation,
    archiveProjectMutation,
    unarchiveProjectMutation,
    createFolderMutation,
    updateFolderMutation,
    deleteFolderMutation,
    validatePathMutation,
    scaffoldWorktreeSetupMutation
  } = useProjectsPageMutations({
    projectScope,
    onProjectCreated: editorState.handleProjectCreated,
    onProjectUpdated: editorState.handleProjectUpdated,
    onFolderCreated: editorState.handleFolderCreated,
    onFolderUpdated: editorState.handleFolderUpdated
  });

  const projectError =
    createProjectMutation.error?.message ?? updateProjectMutation.error?.message;
  const folderError =
    createFolderMutation.error?.message ??
    updateFolderMutation.error?.message ??
    deleteFolderMutation.error?.message ??
    scaffoldWorktreeSetupMutation.error?.message;
  const validateError = validatePathMutation.error?.message;
  const deleteError = archiveProjectMutation.error?.message;

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createProjectMutation.mutateAsync(editorState.projectForm);
  }

  async function handleUpdateProject(
    event: React.FormEvent<HTMLFormElement>,
    projectId: number
  ) {
    event.preventDefault();
    const payload = editorState.projectEditForms[projectId];

    if (!payload) {
      return;
    }

    await updateProjectMutation.mutateAsync({ projectId, payload });
  }

  async function handleCreateFolder(
    event: React.FormEvent<HTMLFormElement>,
    projectId: number
  ) {
    event.preventDefault();
    await createFolderMutation.mutateAsync({
      projectId,
      payload: editorState.folderCreateForms[projectId] ?? createFolderFormState()
    });
  }

  async function handleUpdateFolder(
    event: React.FormEvent<HTMLFormElement>,
    projectId: number,
    folderId: number
  ) {
    event.preventDefault();
    const payload = editorState.folderEditForms[folderId];

    if (!payload) {
      return;
    }

    await updateFolderMutation.mutateAsync({ projectId, folderId, payload });
  }

  async function handleValidatePath(
    targetKey: string,
    path: string,
    existingFolderId?: number
  ) {
    const pathInfo = await validatePathMutation.mutateAsync({
      targetKey,
      path,
      existingFolderId
    });

    editorState.setValidatedPath(targetKey, pathInfo);
  }

  function handleDeleteProject(project: Project) {
    if (!window.confirm(editorState.getProjectDeletePrompt(project))) {
      return;
    }

    archiveProjectMutation.mutate(project.id);
    editorState.collapseProject(project.id, projects);
  }

  function handleRestoreProject(project: Project) {
    unarchiveProjectMutation.mutate(project.id);
    editorState.collapseProject(project.id, projects);
  }

  function handleDeleteFolder(projectId: number, folder: ProjectFolder) {
    if (!window.confirm(`Remove ${folder.label} from this project?`)) {
      return;
    }

    deleteFolderMutation.mutate({
      projectId,
      folderId: folder.id
    });
  }

  const projectItemActions: ProjectListItemActions = {
    toggleExpansion: (projectId) => editorState.toggleProjectExpansion(projectId, projects),
    beginProjectEdit: editorState.beginProjectEdit,
    cancelProjectEdit: (projectId) => editorState.cancelProjectEdit(projectId, projects),
    updateProject: (event, projectId) => {
      void handleUpdateProject(event, projectId);
    },
    updateProjectEditForm: (projectId, update) =>
      editorState.updateProjectEditForm(projectId, update, projects),
    deleteProject: handleDeleteProject,
    restoreProject: handleRestoreProject,
    beginFolderEdit: editorState.beginFolderEdit,
    cancelFolderEdit: editorState.cancelFolderEdit,
    updateFolder: (event, projectId, folderId) => {
      void handleUpdateFolder(event, projectId, folderId);
    },
    updateFolderEditForm: editorState.updateFolderEditForm,
    deleteFolder: handleDeleteFolder,
    validatePath: (targetKey, path, existingFolderId) => {
      void handleValidatePath(targetKey, path, existingFolderId);
    },
    scaffoldWorktreeSetup: (projectId, folderId) => {
      scaffoldWorktreeSetupMutation.mutate({ projectId, folderId });
    },
    createFolder: (event, projectId) => {
      void handleCreateFolder(event, projectId);
    },
    updateFolderCreateForm: editorState.updateFolderCreateForm
  };

  const projectItems: ProjectListItemModel[] = sortedProjects.map((project) => ({
    project,
    isExpanded: editorState.expandedProjectId === project.id,
    details: {
      isEditing: editorState.editingProjectId === project.id,
      editForm: editorState.projectEditForms[project.id] ?? createProjectFormState(project)
    },
    folders: {
      createForm: editorState.folderCreateForms[project.id] ?? createFolderFormState(),
      createValidation: editorState.pathValidation[`project-${project.id}`] ?? null,
      editingIds: editorState.editingFolderIds,
      editForms: editorState.folderEditForms,
      pathValidation: editorState.pathValidation
    }
  }));

  return {
    createProjectNameRef: editorState.createProjectNameRef,
    isCreateProjectOpen: editorState.isCreateProjectOpen,
    setIsCreateProjectOpen: editorState.setIsCreateProjectOpen,
    projectForm: editorState.projectForm,
    updateProjectField: editorState.updateProjectField,
    setSlugTouched: editorState.setSlugTouched,
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
    mutationState: {
      updateProjectPending: updateProjectMutation.isPending,
      archiveProjectPending: archiveProjectMutation.isPending,
      unarchiveProjectPending: unarchiveProjectMutation.isPending,
      createFolderPending: createFolderMutation.isPending,
      updateFolderPending: updateFolderMutation.isPending,
      deleteFolderPending: deleteFolderMutation.isPending,
      validatePathPending: validatePathMutation.isPending,
      scaffoldWorktreeSetupPending: scaffoldWorktreeSetupMutation.isPending
    },
    projectItemActions
  };
}
