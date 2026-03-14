import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useProjectsPageMutations } from "./mutations";
import {
  createFolderFormState,
  createProjectFormState,
  formatFolderCount,
  slugifyProjectName,
  sortProjects,
  type FolderFormState,
  type ProjectFormState,
  type ProjectScope
} from "./page-helpers";
import { useProjectsQuery } from "./queries";
import type { PathInfo, Project, ProjectFolder } from "../../lib/types";

function getProjectScope(searchParams: URLSearchParams): ProjectScope {
  const scopeParam = searchParams.get("scope");
  return scopeParam === "archived" || scopeParam === "all" ? scopeParam : "active";
}

export function useProjectsPageController() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectForm, setProjectForm] = useState<ProjectFormState>(createProjectFormState());
  const [slugTouched, setSlugTouched] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [projectEditForms, setProjectEditForms] = useState<Record<number, ProjectFormState>>({});
  const [folderCreateForms, setFolderCreateForms] = useState<Record<number, FolderFormState>>({});
  const [editingFolderIds, setEditingFolderIds] = useState<Record<number, boolean>>({});
  const [folderEditForms, setFolderEditForms] = useState<Record<number, FolderFormState>>({});
  const [pathValidation, setPathValidation] = useState<Record<string, PathInfo | null>>({});
  const createProjectNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Projects · Boroda";
  }, []);

  const projectScope = getProjectScope(searchParams);
  const projectsQuery = useProjectsQuery(projectScope);
  const sortedProjects = useMemo(
    () => sortProjects(projectsQuery.data ?? []),
    [projectsQuery.data]
  );

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
    onProjectCreated: (project) => {
      setProjectForm(createProjectFormState());
      setSlugTouched(false);
      setIsCreateProjectOpen(false);
      setExpandedProjectId(project.id);
    },
    onProjectUpdated: (projectId) => {
      setEditingProjectId((current) => (current === projectId ? null : current));
    },
    onFolderCreated: (projectId) => {
      setFolderCreateForms((current) => ({
        ...current,
        [projectId]: createFolderFormState()
      }));
      setPathValidation((current) => ({
        ...current,
        [`project-${projectId}`]: null
      }));
    },
    onFolderUpdated: (folderId, pathInfo) => {
      setEditingFolderIds((current) => ({
        ...current,
        [folderId]: false
      }));
      setPathValidation((current) => ({
        ...current,
        [`folder-${folderId}`]: pathInfo
      }));
    }
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

  function updateProjectField<Key extends keyof ProjectFormState>(
    key: Key,
    value: ProjectFormState[Key]
  ) {
    setProjectForm((current) => {
      const next = {
        ...current,
        [key]: value
      };

      if (key === "name" && !slugTouched) {
        next.slug = slugifyProjectName(String(value));
      }

      return next;
    });
  }

  function updateProjectEditForm(projectId: number, update: Partial<ProjectFormState>) {
    setProjectEditForms((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] ??
          createProjectFormState(
            (projectsQuery.data ?? []).find((project) => project.id === projectId)
          )),
        ...update
      }
    }));
  }

  function updateFolderCreateForm(projectId: number, update: Partial<FolderFormState>) {
    setFolderCreateForms((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] ?? createFolderFormState()),
        ...update
      }
    }));
  }

  function updateFolderEditForm(folder: ProjectFolder, update: Partial<FolderFormState>) {
    setFolderEditForms((current) => ({
      ...current,
      [folder.id]: {
        ...(current[folder.id] ?? createFolderFormState(folder)),
        ...update
      }
    }));
  }

  function beginProjectEdit(project: Project) {
    setExpandedProjectId(project.id);
    setEditingProjectId(project.id);
    setProjectEditForms((current) => ({
      ...current,
      [project.id]: createProjectFormState(project)
    }));
  }

  function collapseProject(projectId: number) {
    setExpandedProjectId((current) => (current === projectId ? null : current));
    setEditingProjectId((current) => (current === projectId ? null : current));

    const project = (projectsQuery.data ?? []).find((item) => item.id === projectId);
    if (!project) {
      return;
    }

    const folderIds = new Set(project.folders.map((folder) => folder.id));

    setEditingFolderIds((current) => {
      const next = { ...current };

      for (const folderId of folderIds) {
        delete next[folderId];
      }

      return next;
    });

    setFolderEditForms((current) => {
      const next = { ...current };

      for (const folderId of folderIds) {
        delete next[folderId];
      }

      return next;
    });
  }

  function cancelProjectEdit(projectId: number) {
    collapseProject(projectId);
    setProjectEditForms((current) => {
      const next = { ...current };
      delete next[projectId];
      return next;
    });
  }

  function beginFolderEdit(folder: ProjectFolder) {
    setExpandedProjectId(folder.projectId);
    setEditingFolderIds((current) => ({
      ...current,
      [folder.id]: true
    }));
    setFolderEditForms((current) => ({
      ...current,
      [folder.id]: createFolderFormState(folder)
    }));
  }

  function cancelFolderEdit(folderId: number) {
    setEditingFolderIds((current) => ({
      ...current,
      [folderId]: false
    }));
    setFolderEditForms((current) => {
      const next = { ...current };
      delete next[folderId];
      return next;
    });
    setPathValidation((current) => ({
      ...current,
      [`folder-${folderId}`]: null
    }));
  }

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createProjectMutation.mutateAsync(projectForm);
  }

  async function handleUpdateProject(
    event: React.FormEvent<HTMLFormElement>,
    projectId: number
  ) {
    event.preventDefault();
    const payload = projectEditForms[projectId];

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
      payload: folderCreateForms[projectId] ?? createFolderFormState()
    });
  }

  async function handleUpdateFolder(
    event: React.FormEvent<HTMLFormElement>,
    projectId: number,
    folderId: number
  ) {
    event.preventDefault();
    const payload = folderEditForms[folderId];

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

    setPathValidation((current) => ({
      ...current,
      [targetKey]: pathInfo
    }));
  }

  function handleDeleteProject(project: Project) {
    const scope =
      project.folders.length > 0
        ? `Archive ${project.name} and keep ${formatFolderCount(project.folders.length)} in history?`
        : `Archive ${project.name}?`;

    if (!window.confirm(scope)) {
      return;
    }

    archiveProjectMutation.mutate(project.id);
    collapseProject(project.id);
  }

  function handleRestoreProject(project: Project) {
    unarchiveProjectMutation.mutate(project.id);
    collapseProject(project.id);
  }

  function toggleProjectExpansion(projectId: number) {
    if (expandedProjectId === projectId) {
      collapseProject(projectId);
      return;
    }

    setExpandedProjectId(projectId);
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

  function setScope(scope: ProjectScope) {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (scope === "active") {
      nextSearchParams.delete("scope");
    } else {
      nextSearchParams.set("scope", scope);
    }

    setSearchParams(nextSearchParams, { replace: true });
  }

  return {
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
  };
}
