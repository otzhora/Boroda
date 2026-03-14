import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAppHeader } from "../app/router";
import { ModalDialog } from "../components/ui/modal-dialog";
import { apiClient } from "../lib/api-client";
import { getProjectBadgeStyle } from "../lib/project-colors";
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
  previousProjects?: Array<[readonly unknown[], Project[] | undefined]>;
}

const PROJECTS_QUERY_KEY = ["projects"] as const;
const panelClassName = "grid gap-4 rounded-[10px] border border-white/8 bg-canvas-925 px-4 py-4";
const insetPanelClassName = "grid gap-4 border-t border-white/8 pt-4";
const projectListClassName =
  "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[10px] border border-white/8 bg-canvas-925";
const projectArticleClassName =
  "grid gap-0 border-t border-white/8 px-4 transition-colors first:border-t-0";
const projectRowClassName = "grid gap-4 py-4";
const projectBodyClassName = "grid gap-4 border-t border-white/8 pb-4 pt-4";
const sectionTitleClassName = "m-0 text-sm font-semibold text-ink-100";
const labelClassName = "m-0 text-sm font-medium text-ink-100";
const fieldClassName = "grid gap-1.5";
const fieldWideClassName = "grid gap-1.5 md:col-span-full";
const compactFieldClassName = "grid min-w-0 gap-1.5";
const compactCheckboxLabelClassName =
  "flex min-h-10 min-w-[11rem] items-center gap-3 self-end rounded-[10px] border border-white/8 bg-canvas-950 px-3 py-2 text-sm text-ink-50";
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
const projectToggleButtonClassName =
  "grid w-full min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[8px] px-1 py-1 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";
const spinnerClassName = "h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent";

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

function scopeLabel(scope: "active" | "archived" | "all") {
  if (scope === "archived") {
    return "Archived";
  }

  if (scope === "all") {
    return "All";
  }

  return "Active";
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
  queryKey: readonly unknown[],
  updater: (projects: Project[]) => Project[]
) {
  queryClient.setQueryData<Project[]>(queryKey, (current) => updater(current ?? []));
}

function rollbackProjects(queryClient: QueryClient, context?: MutationContext) {
  if (context?.previousProjects) {
    for (const [queryKey, projects] of context.previousProjects) {
      queryClient.setQueryData(queryKey, projects);
    }
  }
}

function getFolderStatusClassName(existsOnDisk: boolean) {
  return `${chipClassName} ${
    existsOnDisk
      ? "border-emerald-400/24 bg-emerald-400/10 text-emerald-100"
      : "border-amber-300/24 bg-amber-300/10 text-amber-100"
  }`;
}

function getWorktreeSetupStatusClassName(hasWorktreeSetup: boolean) {
  return `${chipClassName} ${
    hasWorktreeSetup
      ? "border-sky-400/24 bg-sky-400/10 text-sky-100"
      : "border-white/12 bg-white/[0.04] text-ink-200"
  }`;
}

function hasWorktreeSetup(folder: ProjectFolder) {
  return folder.setupInfo?.hasWorktreeSetup === true;
}

function getProjectStatusClassName(folderCount: number) {
  return `${chipClassName} ${
    folderCount > 0
      ? "border-emerald-400/24 bg-emerald-400/10 text-emerald-100"
      : "border-amber-300/24 bg-amber-300/10 text-amber-100"
  }`;
}

export function ProjectsPage() {
  const { setActions, setRightActions } = useAppHeader();
  const queryClient = useQueryClient();
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

  const scopeParam = searchParams.get("scope");
  const projectScope =
    scopeParam === "archived" || scopeParam === "all" ? scopeParam : "active";
  const projectsQueryKey = [...PROJECTS_QUERY_KEY, { scope: projectScope }] as const;

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
    queryKey: projectsQueryKey,
    queryFn: () => apiClient<Project[]>(`/api/projects?scope=${projectScope}`)
  });

  const createProjectMutation = useMutation<Project, Error, ProjectFormState, MutationContext>({
    mutationFn: (payload) =>
      apiClient<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: projectsQueryKey });
      const previousProjects = queryClient.getQueryData<Project[]>(projectsQueryKey);
      const timestamp = nowIso();
      const optimisticProject: Project = {
        id: -Date.now(),
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        color: payload.color,
        createdAt: timestamp,
        updatedAt: timestamp,
        archivedAt: null,
        folders: []
      };

      updateProjectList(queryClient, projectsQueryKey, (projects) =>
        projectScope === "archived" ? projects : sortProjects([optimisticProject, ...projects])
      );

      return {
        previousProjects: [[projectsQueryKey, previousProjects]]
      };
    },
    onError: (_error, _payload, context) => {
      rollbackProjects(queryClient, context);
    },
    onSuccess: (project, payload) => {
      updateProjectList(queryClient, projectsQueryKey, (projects) =>
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
      await queryClient.cancelQueries({ queryKey: projectsQueryKey });
      const previousProjects = queryClient.getQueryData<Project[]>(projectsQueryKey);

      updateProjectList(queryClient, projectsQueryKey, (projects) =>
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

      return {
        previousProjects: [[projectsQueryKey, previousProjects]]
      };
    },
    onError: (_error, _variables, context) => {
      rollbackProjects(queryClient, context);
    },
    onSuccess: (project, variables) => {
      updateProjectList(queryClient, projectsQueryKey, (projects) =>
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

  const archiveProjectMutation = useMutation<{ ok: true }, Error, number, MutationContext>({
    mutationFn: (projectId) =>
      apiClient<{ ok: true }>(`/api/projects/${projectId}`, {
        method: "DELETE"
      }),
    onMutate: async (projectId) => {
      await queryClient.cancelQueries({ queryKey: projectsQueryKey });
      const previousProjects = queryClient.getQueryData<Project[]>(projectsQueryKey);
      const archivedAt = nowIso();

      updateProjectList(queryClient, projectsQueryKey, (projects) => {
        const target = projects.find((project) => project.id === projectId);

        if (!target) {
          return projects;
        }

        const archivedProject = {
          ...target,
          archivedAt,
          updatedAt: archivedAt
        };
        const remainingProjects = projects.filter((project) => project.id !== projectId);

        if (projectScope === "all" || projectScope === "archived") {
          return sortProjects([archivedProject, ...remainingProjects]);
        }

        return remainingProjects;
      });

      return { previousProjects: [[projectsQueryKey, previousProjects]] };
    },
    onError: (_error, _projectId, context) => {
      rollbackProjects(queryClient, context);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
    }
  });

  const unarchiveProjectMutation = useMutation<{ ok: true }, Error, number, MutationContext>({
    mutationFn: (projectId) =>
      apiClient<{ ok: true }>(`/api/projects/${projectId}/unarchive`, {
        method: "POST"
      }),
    onMutate: async (projectId) => {
      await queryClient.cancelQueries({ queryKey: projectsQueryKey });
      const previousProjects = queryClient.getQueryData<Project[]>(projectsQueryKey);
      const restoredAt = nowIso();

      updateProjectList(queryClient, projectsQueryKey, (projects) => {
        const target = projects.find((project) => project.id === projectId);

        if (!target) {
          return projects;
        }

        const restoredProject = {
          ...target,
          archivedAt: null,
          updatedAt: restoredAt
        };
        const remainingProjects = projects.filter((project) => project.id !== projectId);

        if (projectScope === "active" || projectScope === "all") {
          return sortProjects([restoredProject, ...remainingProjects]);
        }

        return remainingProjects;
      });

      return { previousProjects: [[projectsQueryKey, previousProjects]] };
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
      await queryClient.cancelQueries({ queryKey: projectsQueryKey });
      const previousProjects = queryClient.getQueryData<Project[]>(projectsQueryKey);
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
        setupInfo: {
          hasWorktreeSetup: false,
          configPath: null
        },
        createdAt: timestamp,
        updatedAt: timestamp
      };

      updateProjectList(queryClient, projectsQueryKey, (projects) =>
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

      return {
        previousProjects: [[projectsQueryKey, previousProjects]]
      };
    },
    onError: (_error, _variables, context) => {
      rollbackProjects(queryClient, context);
    },
    onSuccess: (folder, variables) => {
      updateProjectList(queryClient, projectsQueryKey, (projects) =>
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
      await queryClient.cancelQueries({ queryKey: projectsQueryKey });
      const previousProjects = queryClient.getQueryData<Project[]>(projectsQueryKey);
      const timestamp = nowIso();

      updateProjectList(queryClient, projectsQueryKey, (projects) =>
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

      return {
        previousProjects: [[projectsQueryKey, previousProjects]]
      };
    },
    onError: (_error, _variables, context) => {
      rollbackProjects(queryClient, context);
    },
    onSuccess: (folder, variables) => {
      updateProjectList(queryClient, projectsQueryKey, (projects) =>
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
      await queryClient.cancelQueries({ queryKey: projectsQueryKey });
      const previousProjects = queryClient.getQueryData<Project[]>(projectsQueryKey);
      const timestamp = nowIso();

      updateProjectList(queryClient, projectsQueryKey, (projects) =>
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

      return {
        previousProjects: [[projectsQueryKey, previousProjects]]
      };
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
        updateProjectList(queryClient, projectsQueryKey, (projects) =>
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

  const scaffoldWorktreeSetupMutation = useMutation<
    ProjectFolder,
    Error,
    { projectId: number; folderId: number }
  >({
    mutationFn: ({ folderId }) =>
      apiClient<ProjectFolder>(`/api/project-folders/${folderId}/worktree-setup/scaffold`, {
        method: "POST"
      }),
    onSuccess: (folder, variables) => {
      updateProjectList(queryClient, projectsQueryKey, (projects) =>
        sortProjects(
          projects.map((project) =>
            project.id === variables.projectId
              ? {
                  ...project,
                  updatedAt: folder.updatedAt,
                  folders: sortFolders(project.folders.map((item) => (item.id === folder.id ? { ...item, ...folder } : item)))
                }
              : project
          )
        )
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
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
              <span>{sortedProjects.length} {scopeLabel(projectScope).toLowerCase()} projects</span>
              <span aria-hidden="true">/</span>
              <span>
                {sortedProjects.reduce((count, project) => count + project.folders.length, 0)} folders
              </span>
            </div>
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={() => {
                void projectsQuery.refetch();
              }}
              disabled={projectsQuery.isFetching}
            >
              {projectsQuery.isFetching ? <span className={spinnerClassName} aria-hidden="true" /> : null}
              <span>{projectsQuery.isFetching ? "Refreshing…" : "Refresh"}</span>
            </button>
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Project scope">
              {(["active", "archived", "all"] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  role="tab"
                  aria-selected={projectScope === scope}
                  className={projectScope === scope ? primaryButtonClassName : secondaryButtonClassName}
                  onClick={() => {
                    const nextSearchParams = new URLSearchParams(searchParams);

                    if (scope === "active") {
                      nextSearchParams.delete("scope");
                    } else {
                      nextSearchParams.set("scope", scope);
                    }

                    setSearchParams(nextSearchParams, { replace: true });
                  }}
                >
                  {scopeLabel(scope)}
                </button>
              ))}
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
              const folderCountLabel = formatFolderCount(project.folders.length);
              const hasFolders = project.folders.length > 0;

              return (
                <article className={projectArticleClassName} key={project.id}>
                  <div className={projectRowClassName}>
                    <button
                      type="button"
                      className={`${projectToggleButtonClassName} ${isExpandedProject ? "bg-white/[0.03]" : ""}`}
                      aria-expanded={isExpandedProject}
                      aria-controls={`project-panel-${project.id}`}
                      aria-label={`${isExpandedProject ? "Hide details" : "Show details"} for ${project.name}`}
                      onClick={() => toggleProjectExpansion(project.id)}
                    >
                      <span
                        className="flex h-4 w-4 items-center justify-center text-sm leading-none text-ink-300"
                        aria-hidden="true"
                      >
                        <span className={isExpandedProject ? "-translate-y-px" : ""}>
                          {isExpandedProject ? "⌄" : "›"}
                        </span>
                      </span>
                      <div
                        className="h-3 w-3 shrink-0 rounded-[3px]"
                        style={{ backgroundColor: project.color || "#445" }}
                      />
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-3">
                          <span
                            className="shrink-0 rounded-[8px] border px-2 py-0.5 font-mono text-xs"
                            style={getProjectBadgeStyle(project.color)}
                          >
                            {project.slug}
                          </span>
                          <h3 className="m-0 min-w-0 truncate text-[0.95rem] font-medium leading-6 text-ink-100">
                            {project.name}
                          </h3>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <span className={getProjectStatusClassName(project.folders.length)}>
                          {hasFolders ? "Configured" : "Needs folder"}
                        </span>
                        <span className={`${chipClassName} border-white/10 bg-white/[0.04] text-ink-200`}>
                          {folderCountLabel}
                        </span>
                      </div>
                    </button>
                  </div>

                  {isExpandedProject ? (
                    <div
                      id={`project-panel-${project.id}`}
                      className={projectBodyClassName}
                      role="region"
                      aria-label={`Project details for ${project.name}`}
                    >
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                        <div className="min-w-0 space-y-1">
                          <p className="m-0 text-sm text-ink-300">Updated {formatDateTime(project.updatedAt)}</p>
                          <p className="m-0 break-words text-sm leading-6 text-ink-100">
                            {project.description || "No description"}
                          </p>
                        </div>
                        {!isEditingProject ? (
                          <div className="flex flex-wrap items-center gap-2 md:justify-end">
                            <button
                              type="button"
                              className={secondaryButtonClassName}
                              onClick={() => beginProjectEdit(project)}
                            >
                              Edit project
                            </button>
                            {project.archivedAt ? (
                              <button
                                type="button"
                                className={secondaryButtonClassName}
                                disabled={unarchiveProjectMutation.isPending}
                                onClick={() => handleRestoreProject(project)}
                              >
                                Restore
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={dangerButtonClassName}
                                disabled={archiveProjectMutation.isPending}
                                onClick={() => handleDeleteProject(project)}
                              >
                                Archive
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {isEditingProject ? (
                        <form
                          className={insetPanelClassName}
                          onSubmit={(event) => void handleUpdateProject(event, project.id)}
                        >
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
                            <button
                              className={primaryButtonClassName}
                              type="submit"
                              disabled={updateProjectMutation.isPending}
                            >
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
                          <span className="text-sm text-ink-300">{folderCountLabel}</span>
                        </div>

                        {project.folders.length ? (
                          <ul
                            className="m-0 list-none rounded-[10px] border border-white/8 bg-canvas-950 p-0"
                            role="list"
                          >
                            {sortFolders(project.folders).map((folder) => {
                              const isEditingFolder = editingFolderIds[folder.id] ?? false;
                              const folderEditForm =
                                folderEditForms[folder.id] ?? createFolderFormState(folder);
                              const folderValidation = pathValidation[`folder-${folder.id}`];

                              return (
                                <li
                                  className="border-t border-white/8 px-3 py-3 first:border-t-0"
                                  key={folder.id}
                                >
                                  <div className="grid gap-3">
                                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                                      <div className="min-w-0 space-y-1.5">
                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                          <p className="m-0 min-w-0 text-sm font-medium text-ink-50">
                                            {folder.label}
                                          </p>
                                          {folder.isPrimary ? (
                                            <span
                                              className={`${chipClassName} border-white/12 bg-white/[0.04] text-ink-100`}
                                            >
                                              Primary
                                            </span>
                                          ) : null}
                                          <span className={getFolderStatusClassName(folder.existsOnDisk)}>
                                            {folder.existsOnDisk ? "On disk" : "Missing"}
                                          </span>
                                          <span className={getWorktreeSetupStatusClassName(hasWorktreeSetup(folder))}>
                                            {hasWorktreeSetup(folder) ? "Worktree setup" : "No setup"}
                                          </span>
                                        </div>
                                        <p className="m-0 break-words font-mono text-[0.84rem] text-ink-200">
                                          {folder.path}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-300">
                                          <span>Default branch: {folder.defaultBranch || "Not set"}</span>
                                          <span>Updated {formatDateTime(folder.updatedAt)}</span>
                                        </div>
                                        <p className="m-0 text-sm text-ink-300">
                                          {hasWorktreeSetup(folder)
                                            ? "Fresh Boroda worktrees can run repo-local setup from .boroda/worktree.setup.json."
                                            : "No repo-local worktree setup yet. Scaffold a starter config to copy common env files into fresh worktrees."}
                                        </p>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                                        <button
                                          type="button"
                                          className={secondaryButtonClassName}
                                          disabled={scaffoldWorktreeSetupMutation.isPending || !folder.existsOnDisk}
                                          onClick={() => {
                                            scaffoldWorktreeSetupMutation.mutate({
                                              projectId: project.id,
                                              folderId: folder.id
                                            });
                                          }}
                                        >
                                          {scaffoldWorktreeSetupMutation.isPending
                                            ? "Scaffolding…"
                                            : hasWorktreeSetup(folder)
                                              ? "Re-scaffold setup"
                                              : "Scaffold setup"}
                                        </button>
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
                                        className="grid gap-3 border-t border-white/8 pt-3"
                                        onSubmit={(event) =>
                                          void handleUpdateFolder(event, project.id, folder.id)
                                        }
                                      >
                                        <div className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.8fr)_minmax(0,1fr)_auto]">
                                          <label className={compactFieldClassName}>
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
                                          <label className={compactFieldClassName}>
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
                                          <label className={compactFieldClassName}>
                                            <span className={labelClassName}>Default branch</span>
                                            <input
                                              className={inputClassName}
                                              name={`folderDefaultBranch-${folder.id}`}
                                              autoComplete="off"
                                              spellCheck={false}
                                              value={folderEditForm.defaultBranch}
                                              onChange={(event) =>
                                                updateFolderEditForm(folder, {
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
                                          <button
                                            className={primaryButtonClassName}
                                            type="submit"
                                            disabled={updateFolderMutation.isPending}
                                          >
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
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="m-0 text-sm text-ink-300">No folders yet.</p>
                        )}
                      </section>

                      <form
                        className="grid gap-3 rounded-[10px] border border-white/8 bg-canvas-950 px-3 py-3"
                        onSubmit={(event) => void handleCreateFolder(event, project.id)}
                        aria-label={`Add folder to ${project.name}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <h4 className={sectionTitleClassName}>Add folder</h4>
                        </div>

                        <div className="grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.8fr)_minmax(0,1fr)_auto]">
                          <label className={compactFieldClassName}>
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
                          <label className={compactFieldClassName}>
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
                          <label className={compactFieldClassName}>
                            <span className={labelClassName}>Default branch</span>
                            <input
                              className={inputClassName}
                              name={`newFolderDefaultBranch-${project.id}`}
                              autoComplete="off"
                              spellCheck={false}
                              value={folderCreateForm.defaultBranch}
                              onChange={(event) =>
                                updateFolderCreateForm(project.id, {
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
                          <button
                            className={primaryButtonClassName}
                            type="submit"
                            disabled={createFolderMutation.isPending}
                          >
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
