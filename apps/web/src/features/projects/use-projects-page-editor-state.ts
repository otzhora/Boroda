import { useRef, useState } from "react";
import {
  createFolderFormState,
  createProjectFormState,
  formatFolderCount,
  slugifyProjectName,
  type FolderFormState,
  type ProjectFormState
} from "./page-helpers";
import type { PathInfo, Project, ProjectFolder } from "../../lib/types";

export function useProjectsPageEditorState() {
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

  function updateProjectEditForm(
    projectId: number,
    update: Partial<ProjectFormState>,
    projects: Project[]
  ) {
    setProjectEditForms((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] ??
          createProjectFormState(projects.find((project) => project.id === projectId))),
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

  function collapseProject(projectId: number, projects: Project[]) {
    setExpandedProjectId((current) => (current === projectId ? null : current));
    setEditingProjectId((current) => (current === projectId ? null : current));

    const project = projects.find((item) => item.id === projectId);
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

  function beginProjectEdit(project: Project) {
    setExpandedProjectId(project.id);
    setEditingProjectId(project.id);
    setProjectEditForms((current) => ({
      ...current,
      [project.id]: createProjectFormState(project)
    }));
  }

  function cancelProjectEdit(projectId: number, projects: Project[]) {
    collapseProject(projectId, projects);
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

  function toggleProjectExpansion(projectId: number, projects: Project[]) {
    if (expandedProjectId === projectId) {
      collapseProject(projectId, projects);
      return;
    }

    setExpandedProjectId(projectId);
  }

  function setValidatedPath(targetKey: string, pathInfo: PathInfo | null) {
    setPathValidation((current) => ({
      ...current,
      [targetKey]: pathInfo
    }));
  }

  function handleProjectCreated(project: Project) {
    setProjectForm(createProjectFormState());
    setSlugTouched(false);
    setIsCreateProjectOpen(false);
    setExpandedProjectId(project.id);
  }

  function handleProjectUpdated(projectId: number) {
    setEditingProjectId((current) => (current === projectId ? null : current));
  }

  function handleFolderCreated(projectId: number) {
    setFolderCreateForms((current) => ({
      ...current,
      [projectId]: createFolderFormState()
    }));
    setValidatedPath(`project-${projectId}`, null);
  }

  function handleFolderUpdated(folderId: number, pathInfo: PathInfo | null) {
    setEditingFolderIds((current) => ({
      ...current,
      [folderId]: false
    }));
    setValidatedPath(`folder-${folderId}`, pathInfo);
  }

  function getProjectDeletePrompt(project: Project) {
    return project.folders.length > 0
      ? `Archive ${project.name} and keep ${formatFolderCount(project.folders.length)} in history?`
      : `Archive ${project.name}?`;
  }

  return {
    createProjectNameRef,
    isCreateProjectOpen,
    setIsCreateProjectOpen,
    projectForm,
    updateProjectField,
    setSlugTouched,
    expandedProjectId,
    editingProjectId,
    projectEditForms,
    folderCreateForms,
    editingFolderIds,
    folderEditForms,
    pathValidation,
    updateProjectEditForm,
    updateFolderCreateForm,
    updateFolderEditForm,
    beginProjectEdit,
    cancelProjectEdit,
    beginFolderEdit,
    cancelFolderEdit,
    toggleProjectExpansion,
    setValidatedPath,
    collapseProject,
    handleProjectCreated,
    handleProjectUpdated,
    handleFolderCreated,
    handleFolderUpdated,
    getProjectDeletePrompt
  };
}
