import type { QueryClient } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAppHeader } from "../app/router";
import { ModalDialog } from "../components/ui/modal-dialog";
import { apiClient } from "../lib/api-client";
import type {
  PathInfo,
  Project,
  ProjectFolder,
  ProjectFolderWithPathInfo
} from "../lib/types";

interface ProjectFormState {
  name: string;
  slug: string;
  description: string;
  color: string;
}

interface FolderFormState {
  label: string;
  path: string;
  defaultBranch: string;
  kind: ProjectFolder["kind"];
  isPrimary: boolean;
}

interface MutationContext {
  previousProjects?: Project[];
}

const PROJECTS_QUERY_KEY = ["projects"] as const;
const panelClassName = "grid gap-4 rounded-[10px] border border-white/8 bg-canvas-925 px-4 py-4";
const insetPanelClassName = "grid gap-4 border-t border-white/8 pt-4";
const projectListClassName =
  "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[10px] border border-white/8 bg-canvas-925";
const projectArticleClassName =
  "grid gap-0 border-t border-white/8 px-4 transition-colors first:border-t-0";
const projectRowClassName = "grid items-center py-4";
const projectBodyClassName = "grid gap-4 px-4 pb-4";
const rowClassName =
  "grid gap-3 border-t border-white/8 py-3 first:border-t-0 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]";
const sectionTitleClassName = "m-0 text-sm font-semibold text-ink-100";
const labelClassName = "m-0 text-sm font-medium text-ink-100";
const fieldClassName = "grid gap-1.5";
const fieldWideClassName = "grid gap-1.5 md:col-span-full";
const compactFieldClassName = "grid min-w-0 gap-1.5";
const compactCheckboxLabelClassName =
  "flex min-h-10 min-w-[11rem] items-center gap-3 self-end rounded-[10px] border border-white/8 bg-canvas-950 px-3 py-2.5 text-sm text-ink-50";
const inputClassName =
  "min-h-10 rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2.5 text-sm text-ink-50 placeholder:text-ink-300";
const textareaClassName =
  "rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2.5 text-sm text-ink-50 placeholder:text-ink-300";
const primaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-accent-500/40 bg-accent-500 px-3 py-2 text-sm font-medium text-canvas-975 transition-colors hover:bg-accent-300 disabled:cursor-progress disabled:opacity-70";
const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-canvas-900 disabled:cursor-progress disabled:opacity-70";
const headerActionButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 bg-canvas-950 px-3 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-canvas-900 disabled:cursor-progress disabled:opacity-70";
const dangerButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-red-400/24 bg-red-950/36 px-3 py-2 text-sm font-medium text-red-100 transition-colors hover:border-red-300/32 hover:bg-red-950/52 disabled:cursor-progress disabled:opacity-70";
const subtleDangerButtonClassName =
  "inline-flex min-h-9 items-center justify-center rounded-[10px] border border-red-400/18 bg-transparent px-3 py-2 text-sm font-medium text-red-100 transition-colors hover:border-red-300/30 hover:bg-red-950/30 disabled:cursor-progress disabled:opacity-70";
const chipClassName =
  "inline-flex min-h-6 items-center rounded-[8px] border px-2 py-0.5 text-xs font-medium";
const rowToggleButtonClassName =
  "flex min-w-0 items-start gap-3 rounded-[8px] px-1 py-1 text-left transition-colors hover:bg-white/[0.02] focus-visible:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});

function slugifyProjectName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nowIso() {
  return new Date().toISOString();
}

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function normalizeHexColor(color: string) {
  const value = color.trim();

  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    return null;
  }

  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }

  return value;
}

function hexToRgb(color: string) {
  const normalized = normalizeHexColor(color);

  if (!normalized) {
    return null;
  }

  const value = normalized.slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function mixChannel(base: number, target: number, ratio: number) {
  return Math.round(base * (1 - ratio) + target * ratio);
}

function getProjectBadgeStyle(color: string): CSSProperties | undefined {
  const rgb = hexToRgb(color);

  if (!rgb) {
    return undefined;
  }

  const textColor = `rgb(${mixChannel(rgb.r, 255, 0.74)} ${mixChannel(rgb.g, 255, 0.74)} ${mixChannel(rgb.b, 255, 0.74)})`;

  return {
    backgroundColor: `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0.16)`,
    borderColor: `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0.34)`,
    color: textColor
  };
}

function describePathInfo(pathInfo: PathInfo) {
  if (pathInfo.exists && pathInfo.isDirectory) {
    return `Directory: ${pathInfo.resolvedPath}`;
  }

  if (pathInfo.exists) {
    return `Exists but not a directory: ${pathInfo.resolvedPath}`;
  }

  return `Missing: ${pathInfo.resolvedPath}`;
}

function formatFolderCount(count: number) {
  return `${count} folder${count === 1 ? "" : "s"}`;
}

function createProjectFormState(project?: Project): ProjectFormState {
  if (!project) {
    return {
      name: "",
      slug: "",
      description: "",
      color: "#355c7d"
    };
  }

  return {
    name: project.name,
    slug: project.slug,
    description: project.description,
    color: project.color
  };
}

function createFolderFormState(folder?: ProjectFolder): FolderFormState {
  if (!folder) {
    return {
      label: "",
      path: "",
      defaultBranch: "",
      kind: "APP",
      isPrimary: false
    };
  }

  return {
    label: folder.label,
    path: folder.path,
    defaultBranch: folder.defaultBranch ?? "",
    kind: folder.kind,
    isPrimary: folder.isPrimary
  };
}

function sortProjects(items: Project[]) {
  return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function sortFolders(items: ProjectFolder[]) {
  return [...items].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return Number(right.isPrimary) - Number(left.isPrimary);
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function updateProjectList(
  queryClient: QueryClient,
  updater: (projects: Project[]) => Project[]
) {
  queryClient.setQueryData<Project[]>(PROJECTS_QUERY_KEY, (current) => updater(current ?? []));
}

function rollbackProjects(queryClient: QueryClient, context?: MutationContext) {
  if (context?.previousProjects) {
    queryClient.setQueryData(PROJECTS_QUERY_KEY, context.previousProjects);
  }
}

function getFolderStatusClassName(existsOnDisk: boolean) {
  return `${chipClassName} ${
    existsOnDisk
      ? "border-emerald-400/24 bg-emerald-400/10 text-emerald-100"
      : "border-amber-300/24 bg-amber-300/10 text-amber-100"
  }`;
}

export function ProjectsPage() {
  const { setActions, setRightActions } = useAppHeader();
  const queryClient = useQueryClient();
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

  useEffect(() => {
    setActions(null);
    setRightActions(
      <Link to="/settings" className={headerActionButtonClassName}>
        Settings
      </Link>
    );

    return () => {
      setActions(null);
      setRightActions(null);
    };
  }, [setActions, setRightActions]);

  const projectsQuery = useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: () => apiClient<Project[]>("/api/projects")
  });

  const createProjectMutation = useMutation<Project, Error, ProjectFormState, MutationContext>({
    mutationFn: (payload) =>
      apiClient<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: PROJECTS_QUERY_KEY });
      const previousProjects = queryClient.getQueryData<Project[]>(PROJECTS_QUERY_KEY);
      const timestamp = nowIso();
      const optimisticProject: Project = {
        id: -Date.now(),
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        color: payload.color,
        createdAt: timestamp,
        updatedAt: timestamp,
        folders: []
      };

      updateProjectList(queryClient, (projects) => sortProjects([optimisticProject, ...projects]));

      return { previousProjects };
    },
    onError: (_error, _payload, context) => {
      rollbackProjects(queryClient, context);
    },
    onSuccess: (project, payload) => {
      updateProjectList(queryClient, (projects) =>
        sortProjects(
          projects.map((item) =>
            item.id < 0 && item.slug === payload.slug
              ? {
                  ...project,
                  folders: []
                }
              : item
          )
        )
      );
      setProjectForm(createProjectFormState());
      setSlugTouched(false);
      setIsCreateProjectOpen(false);
      setExpandedProjectId(project.id);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    }
  });

  const updateProjectMutation = useMutation<
    Omit<Project, "folders">,
    Error,
    { projectId: number; payload: ProjectFormState },
    MutationContext
  >({
    mutationFn: ({ projectId, payload }) =>
      apiClient<Omit<Project, "folders">>(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      }),
    onMutate: async ({ projectId, payload }) => {
      await queryClient.cancelQueries({ queryKey: PROJECTS_QUERY_KEY });
      const previousProjects = queryClient.getQueryData<Project[]>(PROJECTS_QUERY_KEY);

      updateProjectList(queryClient, (projects) =>
        sortProjects(
          projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  ...payload,
                  updatedAt: nowIso()
                }
              : project
          )
        )
      );

      return { previousProjects };
    },
    onError: (_error, _variables, context) => {
      rollbackProjects(queryClient, context);
    },
    onSuccess: (project, variables) => {
      updateProjectList(queryClient, (projects) =>
        sortProjects(
          projects.map((item) =>
            item.id === variables.projectId
              ? {
                  ...item,
                  ...project
                }
              : item
          )
        )
      );
      setEditingProjectId((current) => (current === variables.projectId ? null : current));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    }
  });

  const deleteProjectMutation = useMutation<{ ok: true }, Error, number, MutationContext>({
    mutationFn: (projectId) =>
      apiClient<{ ok: true }>(`/api/projects/${projectId}`, {
        method: "DELETE"
      }),
    onMutate: async (projectId) => {
      await queryClient.cancelQueries({ queryKey: PROJECTS_QUERY_KEY });
      const previousProjects = queryClient.getQueryData<Project[]>(PROJECTS_QUERY_KEY);

      updateProjectList(queryClient, (projects) =>
        projects.filter((project) => project.id !== projectId)
      );

      return { previousProjects };
    },
    onError: (_error, _projectId, context) => {
      rollbackProjects(queryClient, context);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    }
  });

  const createFolderMutation = useMutation<
    ProjectFolderWithPathInfo,
    Error,
    { projectId: number; payload: FolderFormState },
    MutationContext
  >({
    mutationFn: ({ projectId, payload }) =>
      apiClient<ProjectFolderWithPathInfo>(`/api/projects/${projectId}/folders`, {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onMutate: async ({ projectId, payload }) => {
      await queryClient.cancelQueries({ queryKey: PROJECTS_QUERY_KEY });
      const previousProjects = queryClient.getQueryData<Project[]>(PROJECTS_QUERY_KEY);
      const timestamp = nowIso();
      const optimisticFolder: ProjectFolder = {
        id: -Date.now(),
        projectId,
        label: payload.label,
        path: payload.path,
        defaultBranch: payload.defaultBranch.trim() || null,
        kind: payload.kind,
        isPrimary: payload.isPrimary,
        existsOnDisk: false,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      updateProjectList(queryClient, (projects) =>
        sortProjects(
          projects.map((project) => {
            if (project.id !== projectId) {
              return project;
            }

            const baseFolders = payload.isPrimary
              ? project.folders.map((folder) => ({
                  ...folder,
                  isPrimary: false
                }))
              : project.folders;

            return {
              ...project,
              updatedAt: timestamp,
              folders: sortFolders([...baseFolders, optimisticFolder])
            };
          })
        )
      );

      return { previousProjects };
    },
    onError: (_error, _variables, context) => {
      rollbackProjects(queryClient, context);
    },
    onSuccess: (folder, variables) => {
      updateProjectList(queryClient, (projects) =>
        sortProjects(
          projects.map((project) => {
            if (project.id !== variables.projectId) {
              return project;
            }

            const withoutOptimistic = project.folders.filter(
              (item) => !(item.id < 0 && item.path === variables.payload.path && item.label === variables.payload.label)
            );
            const normalizedFolders = folder.isPrimary
              ? withoutOptimistic.map((item) => ({
                  ...item,
                  isPrimary: false
                }))
              : withoutOptimistic;

            return {
              ...project,
              updatedAt: folder.updatedAt,
              folders: sortFolders([...normalizedFolders, { ...folder }])
            };
          })
        )
      );
      setFolderCreateForms((current) => ({
        ...current,
        [variables.projectId]: createFolderFormState()
      }));
      setPathValidation((current) => ({
        ...current,
        [`project-${variables.projectId}`]: null
      }));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    }
  });

  const updateFolderMutation = useMutation<
    ProjectFolderWithPathInfo,
    Error,
    { projectId: number; folderId: number; payload: FolderFormState },
    MutationContext
  >({
    mutationFn: ({ folderId, payload }) =>
      apiClient<ProjectFolderWithPathInfo>(`/api/project-folders/${folderId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      }),
    onMutate: async ({ projectId, folderId, payload }) => {
      await queryClient.cancelQueries({ queryKey: PROJECTS_QUERY_KEY });
      const previousProjects = queryClient.getQueryData<Project[]>(PROJECTS_QUERY_KEY);
      const timestamp = nowIso();

      updateProjectList(queryClient, (projects) =>
        sortProjects(
          projects.map((project) => {
            if (project.id !== projectId) {
              return project;
            }

            const nextFolders = project.folders.map((folder) =>
              folder.id === folderId
                ? {
                    ...folder,
                    ...payload,
                    updatedAt: timestamp
                  }
                : payload.isPrimary
                  ? {
                      ...folder,
                      isPrimary: false
                    }
                  : folder
            );

            return {
              ...project,
              updatedAt: timestamp,
              folders: sortFolders(nextFolders)
            };
          })
        )
      );

      return { previousProjects };
    },
    onError: (_error, _variables, context) => {
      rollbackProjects(queryClient, context);
    },
    onSuccess: (folder, variables) => {
      updateProjectList(queryClient, (projects) =>
        sortProjects(
          projects.map((project) => {
            if (project.id !== variables.projectId) {
              return project;
            }

            const nextFolders = project.folders.map((item) => {
              if (item.id === folder.id) {
                return { ...item, ...folder };
              }

              if (folder.isPrimary) {
                return {
                  ...item,
                  isPrimary: false
                };
              }

              return item;
            });

            return {
              ...project,
              updatedAt: folder.updatedAt,
              folders: sortFolders(nextFolders)
            };
          })
        )
      );
      setEditingFolderIds((current) => ({
        ...current,
        [variables.folderId]: false
      }));
      setPathValidation((current) => ({
        ...current,
        [`folder-${variables.folderId}`]: folder.pathInfo
      }));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    }
  });

  const deleteFolderMutation = useMutation<
    { ok: true },
    Error,
    { projectId: number; folderId: number },
    MutationContext
  >({
    mutationFn: ({ folderId }) =>
      apiClient<{ ok: true }>(`/api/project-folders/${folderId}`, {
        method: "DELETE"
      }),
    onMutate: async ({ projectId, folderId }) => {
      await queryClient.cancelQueries({ queryKey: PROJECTS_QUERY_KEY });
      const previousProjects = queryClient.getQueryData<Project[]>(PROJECTS_QUERY_KEY);
      const timestamp = nowIso();

      updateProjectList(queryClient, (projects) =>
        sortProjects(
          projects.map((project) =>
            project.id === projectId
              ? {
                  ...project,
                  updatedAt: timestamp,
                  folders: sortFolders(project.folders.filter((folder) => folder.id !== folderId))
                }
              : project
          )
        )
      );

      return { previousProjects };
    },
    onError: (_error, _variables, context) => {
      rollbackProjects(queryClient, context);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    }
  });

  const validatePathMutation = useMutation<
    PathInfo,
    Error,
    { targetKey: string; path: string; existingFolderId?: number }
  >({
    mutationFn: ({ path }) =>
      apiClient<PathInfo>("/api/fs/validate-path", {
        method: "POST",
        body: JSON.stringify({ path })
      }),
    onSuccess: (pathInfo, variables) => {
      setPathValidation((current) => ({
        ...current,
        [variables.targetKey]: pathInfo
      }));

      if (variables.existingFolderId && pathInfo.exists) {
        updateProjectList(queryClient, (projects) =>
          projects.map((project) => ({
            ...project,
            folders: project.folders.map((folder) =>
              folder.id === variables.existingFolderId
                ? {
                    ...folder,
                    existsOnDisk: pathInfo.exists
                  }
                : folder
            )
          }))
        );
      }
    }
  });

  const projectError =
    createProjectMutation.error?.message ?? updateProjectMutation.error?.message;
  const folderError =
    createFolderMutation.error?.message ??
    updateFolderMutation.error?.message ??
    deleteFolderMutation.error?.message;
  const validateError = validatePathMutation.error?.message;
  const deleteError = deleteProjectMutation.error?.message;

  const sortedProjects = useMemo(
    () => sortProjects(projectsQuery.data ?? []),
    [projectsQuery.data]
  );

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
    await validatePathMutation.mutateAsync({
      targetKey,
      path,
      existingFolderId
    });
  }

  function handleDeleteProject(project: Project) {
    const scope =
      project.folders.length > 0
        ? `Delete ${project.name} and ${formatFolderCount(project.folders.length)}?`
        : `Delete ${project.name}?`;

    if (!window.confirm(scope)) {
      return;
    }

    deleteProjectMutation.mutate(project.id);
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

  return (
    <>
      <ModalDialog
        open={isCreateProjectOpen}
        title="New project"
        description="Create a project record."
        onClose={() => {
          if (createProjectMutation.isPending) {
            return;
          }

          setIsCreateProjectOpen(false);
        }}
        initialFocusRef={createProjectNameRef}
        variant="flat"
      >
        <form className="grid gap-4 px-4 py-4 sm:px-5" onSubmit={handleCreateProject}>
          <div className="grid gap-3">
            <label className={fieldClassName}>
              <span className={labelClassName}>Name</span>
              <input
                ref={createProjectNameRef}
                className={inputClassName}
                name="projectName"
                autoComplete="off"
                value={projectForm.name}
                onChange={(event) => updateProjectField("name", event.target.value)}
                placeholder="payments-backend"
                required
              />
            </label>
            <label className={fieldClassName}>
              <span className={labelClassName}>Slug</span>
              <input
                className={inputClassName}
                name="projectSlug"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={projectForm.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  updateProjectField("slug", event.target.value);
                }}
                placeholder="payments-backend"
                required
              />
            </label>
            <label className={fieldClassName}>
              <span className={labelClassName}>Color</span>
              <input
                className={inputClassName}
                name="projectColor"
                autoComplete="off"
                spellCheck={false}
                value={projectForm.color}
                onChange={(event) => updateProjectField("color", event.target.value)}
                placeholder="#355c7d"
              />
            </label>
            <label className={fieldClassName}>
              <span className={labelClassName}>Description</span>
              <textarea
                className={textareaClassName}
                name="projectDescription"
                value={projectForm.description}
                onChange={(event) => updateProjectField("description", event.target.value)}
                rows={5}
                placeholder="Main backend system"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button className={primaryButtonClassName} type="submit" disabled={createProjectMutation.isPending}>
              {createProjectMutation.isPending ? "Creating…" : "Create project"}
            </button>
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={createProjectMutation.isPending}
              onClick={() => setIsCreateProjectOpen(false)}
            >
              Cancel
            </button>
            {projectError ? (
              <p className="m-0 text-sm text-danger-400" aria-live="polite">
                {projectError}
              </p>
            ) : null}
          </div>
        </form>
      </ModalDialog>

      <section className="mx-auto flex h-full w-full min-h-0 min-w-0 max-w-6xl flex-col gap-3 pb-2">
        <div className="flex min-h-12 flex-wrap items-end justify-between gap-3 border-b border-white/8 pb-3">
          <h1 className="m-0 text-base font-semibold text-ink-50">Projects</h1>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-300">
              <span>{sortedProjects.length} projects</span>
              <span aria-hidden="true">/</span>
              <span>
                {sortedProjects.reduce((count, project) => count + project.folders.length, 0)} folders
              </span>
            </div>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => setIsCreateProjectOpen(true)}
            >
              New project
            </button>
          </div>
        </div>

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
          {sortedProjects.map((project) => {
            const isEditingProject = editingProjectId === project.id;
            const isExpandedProject = expandedProjectId === project.id;
            const projectEditForm = projectEditForms[project.id] ?? createProjectFormState(project);
            const folderCreateForm = folderCreateForms[project.id] ?? createFolderFormState();
            const projectValidation = pathValidation[`project-${project.id}`];

            return (
              <article className={projectArticleClassName} key={project.id}>
                <div className={projectRowClassName}>
                  <button
                    type="button"
                    className={`${rowToggleButtonClassName} w-full ${isExpandedProject ? "bg-white/[0.04]" : ""}`}
                    aria-expanded={isExpandedProject}
                    onClick={() => toggleProjectExpansion(project.id)}
                  >
                    <div
                      className="mt-1 h-3 w-3 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: project.color || "#445" }}
                    />
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h3 className="m-0 text-[0.95rem] font-semibold leading-6 text-ink-100">{project.name}</h3>
                        <span className="rounded-[8px] border px-2 py-0.5 font-mono text-xs" style={getProjectBadgeStyle(project.color)}>
                          {project.slug}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-sm text-ink-300">
                        <span>{formatFolderCount(project.folders.length)}</span>
                        <span aria-hidden="true">/</span>
                        <span>Updated {formatDateTime(project.updatedAt)}</span>
                      </div>
                      <p className="m-0 mt-2 line-clamp-2 break-words text-[0.95rem] leading-6 text-ink-100">
                        {project.description || "No description"}
                      </p>
                    </div>
                  </button>
                </div>

                {isExpandedProject ? (
                  <div className={projectBodyClassName}>
                    {!isEditingProject ? (
                      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/8 pt-4">
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          onClick={() => beginProjectEdit(project)}
                        >
                          Edit project
                        </button>
                        <button
                          type="button"
                          className={dangerButtonClassName}
                          disabled={deleteProjectMutation.isPending}
                          onClick={() => handleDeleteProject(project)}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}

                    {isEditingProject ? (
                      <form className={insetPanelClassName} onSubmit={(event) => void handleUpdateProject(event, project.id)}>
                        <div className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
                          <label className={fieldClassName}>
                            <span className={labelClassName}>Name</span>
                            <input
                              className={inputClassName}
                              name={`projectName-${project.id}`}
                              autoComplete="off"
                              value={projectEditForm.name}
                              onChange={(event) =>
                                updateProjectEditForm(project.id, { name: event.target.value })
                              }
                              required
                            />
                          </label>
                          <label className={fieldClassName}>
                            <span className={labelClassName}>Slug</span>
                            <input
                              className={inputClassName}
                              name={`projectSlug-${project.id}`}
                              autoComplete="off"
                              autoCapitalize="off"
                              autoCorrect="off"
                              spellCheck={false}
                              value={projectEditForm.slug}
                              onChange={(event) =>
                                updateProjectEditForm(project.id, { slug: event.target.value })
                              }
                              required
                            />
                          </label>
                          <label className={fieldClassName}>
                            <span className={labelClassName}>Color</span>
                            <input
                              className={inputClassName}
                              name={`projectColor-${project.id}`}
                              autoComplete="off"
                              spellCheck={false}
                              value={projectEditForm.color}
                              onChange={(event) =>
                                updateProjectEditForm(project.id, { color: event.target.value })
                              }
                            />
                          </label>
                          <label className={fieldWideClassName}>
                            <span className={labelClassName}>Description</span>
                            <textarea
                              className={textareaClassName}
                              name={`projectDescription-${project.id}`}
                              value={projectEditForm.description}
                              onChange={(event) =>
                                updateProjectEditForm(project.id, { description: event.target.value })
                              }
                              rows={3}
                            />
                          </label>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button className={primaryButtonClassName} type="submit" disabled={updateProjectMutation.isPending}>
                            {updateProjectMutation.isPending ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            className={secondaryButtonClassName}
                            onClick={() => cancelProjectEdit(project.id)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : null}

                    <section className="grid gap-3" aria-labelledby={`project-folders-${project.id}`}>
                      <div className="flex items-center justify-between gap-3">
                        <h4 id={`project-folders-${project.id}`} className={sectionTitleClassName}>
                          Folders
                        </h4>
                        <span className="text-sm text-ink-300">{formatFolderCount(project.folders.length)}</span>
                      </div>

                      {project.folders.length ? (
                            <ul className="grid rounded-[10px] border border-white/8 bg-canvas-950 p-0" role="list">
                              {sortFolders(project.folders).map((folder) => {
                            const isEditingFolder = editingFolderIds[folder.id] ?? false;
                            const folderEditForm = folderEditForms[folder.id] ?? createFolderFormState(folder);
                            const folderValidation = pathValidation[`folder-${folder.id}`];

                            return (
                              <li className="grid gap-3" key={folder.id}>
                                <div className={rowClassName}>
                                  <div className="min-w-0">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                      <p className="m-0 min-w-0 text-sm font-medium text-ink-50">{folder.label}</p>
                                      {folder.isPrimary ? <span className={`${chipClassName} border-white/12 bg-white/[0.04] text-ink-100`}>Primary</span> : null}
                                      <span className={getFolderStatusClassName(folder.existsOnDisk)}>
                                        {folder.existsOnDisk ? "On disk" : "Missing"}
                                      </span>
                                    </div>
                                    <p className="m-0 mt-2 break-words font-mono text-[0.84rem] text-ink-200">
                                      {folder.path}
                                    </p>
                                    <p className="m-0 mt-1 text-sm text-ink-300">
                                      Default branch: {folder.defaultBranch || "Not set"}
                                    </p>
                                  </div>

                                  <div className="text-sm text-ink-300 md:text-right">
                                    <p className="m-0">Updated</p>
                                    <p className="m-0 mt-1">{formatDateTime(folder.updatedAt)}</p>
                                  </div>

                                  <div className="flex flex-wrap gap-2 md:justify-end md:self-start">
                                    <button
                                      type="button"
                                      className={secondaryButtonClassName}
                                      onClick={() =>
                                        isEditingFolder ? cancelFolderEdit(folder.id) : beginFolderEdit(folder)
                                      }
                                    >
                                      {isEditingFolder ? "Close editor" : "Edit"}
                                    </button>
                                    <button
                                      type="button"
                                      className={subtleDangerButtonClassName}
                                      disabled={deleteFolderMutation.isPending}
                                      onClick={() => handleDeleteFolder(project.id, folder)}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>

                                {isEditingFolder ? (
                                  <form
                                    className={insetPanelClassName}
                                    onSubmit={(event) => void handleUpdateFolder(event, project.id, folder.id)}
                                  >
                                    <div className="flex flex-wrap items-end gap-3">
                                      <label className={`${compactFieldClassName} min-w-[10rem] flex-[1_1_11rem]`}>
                                        <span className={labelClassName}>Label</span>
                                        <input
                                          className={inputClassName}
                                          name={`folderLabel-${folder.id}`}
                                          autoComplete="off"
                                          value={folderEditForm.label}
                                          onChange={(event) =>
                                            updateFolderEditForm(folder, { label: event.target.value })
                                          }
                                          required
                                        />
                                      </label>
                                      <label className={`${compactFieldClassName} min-w-[16rem] flex-[2_1_22rem]`}>
                                        <span className={labelClassName}>WSL path</span>
                                        <input
                                          className={inputClassName}
                                          name={`folderPath-${folder.id}`}
                                          autoComplete="off"
                                          spellCheck={false}
                                          value={folderEditForm.path}
                                          onChange={(event) =>
                                            updateFolderEditForm(folder, { path: event.target.value })
                                          }
                                          required
                                        />
                                      </label>
                                      <label className={`${compactFieldClassName} min-w-[11rem] flex-[1_1_12rem]`}>
                                        <span className={labelClassName}>Default branch</span>
                                        <input
                                          className={inputClassName}
                                          name={`folderDefaultBranch-${folder.id}`}
                                          autoComplete="off"
                                          spellCheck={false}
                                          value={folderEditForm.defaultBranch}
                                          onChange={(event) =>
                                            updateFolderEditForm(folder, { defaultBranch: event.target.value })
                                          }
                                          placeholder="main"
                                        />
                                      </label>
                                      <label className={compactCheckboxLabelClassName}>
                                        <input
                                          className="h-4 w-4 shrink-0 accent-ink-50"
                                          type="checkbox"
                                          checked={folderEditForm.isPrimary}
                                          onChange={(event) =>
                                            updateFolderEditForm(folder, {
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
                                        disabled={validatePathMutation.isPending}
                                        onClick={() =>
                                          void handleValidatePath(
                                            `folder-${folder.id}`,
                                            folderEditForm.path,
                                            folder.id
                                          )
                                        }
                                      >
                                        {validatePathMutation.isPending ? "Checking…" : "Check path"}
                                      </button>
                                      <button className={primaryButtonClassName} type="submit" disabled={updateFolderMutation.isPending}>
                                        {updateFolderMutation.isPending ? "Saving…" : "Save"}
                                      </button>
                                      <button
                                        type="button"
                                        className={secondaryButtonClassName}
                                        onClick={() => cancelFolderEdit(folder.id)}
                                      >
                                        Cancel
                                      </button>
                                    </div>

                                    {folderValidation ? (
                                      <p className="m-0 text-sm text-ink-300" aria-live="polite">
                                        {describePathInfo(folderValidation)}
                                      </p>
                                    ) : null}
                                  </form>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="m-0 text-sm text-ink-300">No folders.</p>
                      )}
                    </section>

                    <form
                      className={insetPanelClassName}
                      onSubmit={(event) => void handleCreateFolder(event, project.id)}
                      aria-label={`Add folder to ${project.name}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h4 className={sectionTitleClassName}>Add folder</h4>
                      </div>

                      <div className="flex flex-wrap items-end gap-3">
                        <label className={`${compactFieldClassName} min-w-[10rem] flex-[1_1_11rem]`}>
                          <span className={labelClassName}>Label</span>
                          <input
                            className={inputClassName}
                            name={`newFolderLabel-${project.id}`}
                            autoComplete="off"
                            value={folderCreateForm.label}
                            onChange={(event) =>
                              updateFolderCreateForm(project.id, { label: event.target.value })
                            }
                            placeholder="terraform"
                            required
                          />
                        </label>
                        <label className={`${compactFieldClassName} min-w-[16rem] flex-[2_1_22rem]`}>
                          <span className={labelClassName}>WSL path</span>
                          <input
                            className={inputClassName}
                            name={`newFolderPath-${project.id}`}
                            autoComplete="off"
                            spellCheck={false}
                            value={folderCreateForm.path}
                            onChange={(event) =>
                              updateFolderCreateForm(project.id, { path: event.target.value })
                            }
                            placeholder="/home/otzhora/projects/payments-terraform"
                            required
                          />
                        </label>
                        <label className={`${compactFieldClassName} min-w-[11rem] flex-[1_1_12rem]`}>
                          <span className={labelClassName}>Default branch</span>
                          <input
                            className={inputClassName}
                            name={`newFolderDefaultBranch-${project.id}`}
                            autoComplete="off"
                            spellCheck={false}
                            value={folderCreateForm.defaultBranch}
                            onChange={(event) =>
                              updateFolderCreateForm(project.id, { defaultBranch: event.target.value })
                            }
                            placeholder="main"
                          />
                        </label>
                        <label className={compactCheckboxLabelClassName}>
                          <input
                            className="h-4 w-4 shrink-0 accent-ink-50"
                            type="checkbox"
                            checked={folderCreateForm.isPrimary}
                            onChange={(event) =>
                              updateFolderCreateForm(project.id, {
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
                          disabled={validatePathMutation.isPending}
                          onClick={() =>
                            void handleValidatePath(`project-${project.id}`, folderCreateForm.path)
                          }
                        >
                          {validatePathMutation.isPending ? "Checking…" : "Check path"}
                        </button>
                        <button className={primaryButtonClassName} type="submit" disabled={createFolderMutation.isPending}>
                          {createFolderMutation.isPending ? "Adding…" : "Add folder"}
                        </button>
                      </div>

                      {projectValidation ? (
                        <p className="m-0 text-sm text-ink-300" aria-live="polite">
                          {describePathInfo(projectValidation)}
                        </p>
                      ) : null}
                    </form>
                  </div>
                ) : null}
              </article>
            );
          })}
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
