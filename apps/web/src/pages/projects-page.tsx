import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiClient } from "../lib/api-client";
import { PROJECT_FOLDER_KINDS } from "../lib/constants";
import type {
  PathInfo,
  Project,
  ProjectFolder,
  ProjectFolderKind,
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
  kind: ProjectFolderKind;
  isPrimary: boolean;
}

interface MutationContext {
  previousProjects?: Project[];
}

const PROJECTS_QUERY_KEY = ["projects"] as const;
const panelClassName =
  "grid gap-5 rounded-[20px] border border-white/8 bg-canvas-900 px-5 py-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)]";
const insetPanelClassName = "grid gap-4 rounded-[18px] border border-white/8 bg-canvas-850 px-4 py-4";
const cardClassName = "rounded-[16px] border border-white/6 bg-canvas-850 px-4 py-4";
const headingRowClassName = "flex flex-col items-start justify-between gap-4 md:flex-row md:items-center";
const eyebrowClassName = "m-0 text-[0.72rem] uppercase tracking-[0.2em] text-ink-300";
const pageTitleClassName = "m-0 text-[1.7rem] font-semibold tracking-[-0.03em] text-ink-50";
const sectionTitleClassName = "m-0 text-base font-semibold text-ink-50";
const fieldClassName = "grid gap-2";
const fieldWideClassName = "grid gap-2 md:col-span-full";
const labelClassName = "m-0 text-sm font-medium text-ink-50";
const inputClassName =
  "min-h-11 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3 text-ink-50 placeholder:text-ink-300";
const textareaClassName =
  "rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3 text-ink-50 placeholder:text-ink-300";
const primaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-ink-50 px-4 py-2.5 text-sm font-medium text-canvas-975 transition-opacity disabled:cursor-progress disabled:opacity-70";
const secondaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-white/[0.06] disabled:cursor-progress disabled:opacity-70";
const dangerButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-red-400/20 bg-red-950/50 px-4 py-2.5 text-sm font-medium text-red-100 transition-colors hover:border-red-300/30 hover:bg-red-950/70 disabled:cursor-progress disabled:opacity-70";
const checkboxLabelClassName =
  "flex min-h-11 items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-3 text-sm text-ink-50";

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
      kind: "APP",
      isPrimary: false
    };
  }

  return {
    label: folder.label,
    path: folder.path,
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

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [projectForm, setProjectForm] = useState<ProjectFormState>(createProjectFormState());
  const [slugTouched, setSlugTouched] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [projectEditForms, setProjectEditForms] = useState<Record<number, ProjectFormState>>({});
  const [folderCreateForms, setFolderCreateForms] = useState<Record<number, FolderFormState>>({});
  const [editingFolderIds, setEditingFolderIds] = useState<Record<number, boolean>>({});
  const [folderEditForms, setFolderEditForms] = useState<Record<number, FolderFormState>>({});
  const [pathValidation, setPathValidation] = useState<Record<string, PathInfo | null>>({});

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

  function updateProjectEditForm(
    projectId: number,
    update: Partial<ProjectFormState>
  ) {
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
    setEditingProjectId(project.id);
    setProjectEditForms((current) => ({
      ...current,
      [project.id]: createProjectFormState(project)
    }));
  }

  function cancelProjectEdit(projectId: number) {
    setEditingProjectId((current) => (current === projectId ? null : current));
    setProjectEditForms((current) => {
      const next = { ...current };
      delete next[projectId];
      return next;
    });
  }

  function beginFolderEdit(folder: ProjectFolder) {
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

  return (
    <section className="grid gap-4 pb-2">
      <div className={headingRowClassName}>
        <div>
          <p className={eyebrowClassName}>Projects</p>
          <h2 className={pageTitleClassName}>Workspace map</h2>
        </div>
      </div>
      <form className={panelClassName} onSubmit={handleCreateProject}>
        <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          <label className={fieldClassName}>
            <span className={labelClassName}>Name</span>
            <input
              className={inputClassName}
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
              value={projectForm.slug}
              onChange={(event) => {
                setSlugTouched(true);
                updateProjectField("slug", event.target.value);
              }}
              placeholder="payments-backend"
              required
            />
          </label>
          <label className={fieldWideClassName}>
            <span className={labelClassName}>Description</span>
            <textarea
              className={textareaClassName}
              value={projectForm.description}
              onChange={(event) => updateProjectField("description", event.target.value)}
              placeholder="Main backend system"
              rows={3}
            />
          </label>
          <label className={fieldClassName}>
            <span className={labelClassName}>Color</span>
            <input
              className={inputClassName}
              value={projectForm.color}
              onChange={(event) => updateProjectField("color", event.target.value)}
              placeholder="#355c7d"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className={primaryButtonClassName} type="submit" disabled={createProjectMutation.isPending}>
            {createProjectMutation.isPending ? "Creating…" : "Create project"}
          </button>
          {projectError ? <p className="m-0 text-sm text-danger-400">{projectError}</p> : null}
        </div>
      </form>
      {projectsQuery.isLoading ? <p className={`${panelClassName} m-0 text-sm text-ink-50`}>Loading projects…</p> : null}
      {projectsQuery.isError ? <p className={`${panelClassName} m-0 text-sm text-danger-400`}>Projects request failed.</p> : null}
      <div className="grid gap-4">
        {sortedProjects.map((project) => {
          const isEditingProject = editingProjectId === project.id;
          const projectEditForm =
            projectEditForms[project.id] ?? createProjectFormState(project);
          const folderCreateForm =
            folderCreateForms[project.id] ?? createFolderFormState();
          const projectValidation = pathValidation[`project-${project.id}`];

          return (
            <article className={panelClassName} key={project.id}>
              <div className="flex flex-col items-start justify-between gap-4 xl:flex-row">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-4 shrink-0 rounded-full" style={{ backgroundColor: project.color || "#445" }} />
                  <div>
                    <h3 className="m-0 text-xl font-semibold text-ink-50">{project.name}</h3>
                    <p className="m-0 mt-1 flex flex-wrap gap-3 text-[0.82rem] text-ink-300">
                      <span>{project.slug}</span>
                      <span>{project.folders.length} folders</span>
                    </p>
                    <p className="m-0 mt-2 text-sm text-ink-300">{project.description || "No description yet."}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    onClick={() =>
                      isEditingProject ? cancelProjectEdit(project.id) : beginProjectEdit(project)
                    }
                  >
                    {isEditingProject ? "Close editor" : "Edit project"}
                  </button>
                  <button
                    type="button"
                    className={dangerButtonClassName}
                    disabled={deleteProjectMutation.isPending}
                    onClick={() => deleteProjectMutation.mutate(project.id)}
                  >
                    Delete project
                  </button>
                </div>
              </div>

              {isEditingProject ? (
                <form className={insetPanelClassName} onSubmit={(event) => void handleUpdateProject(event, project.id)}>
                  <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                    <label className={fieldClassName}>
                      <span className={labelClassName}>Name</span>
                      <input
                        className={inputClassName}
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
                        value={projectEditForm.slug}
                        onChange={(event) =>
                          updateProjectEditForm(project.id, { slug: event.target.value })
                        }
                        required
                      />
                    </label>
                    <label className={fieldWideClassName}>
                      <span className={labelClassName}>Description</span>
                      <textarea
                        className={textareaClassName}
                        value={projectEditForm.description}
                        onChange={(event) =>
                          updateProjectEditForm(project.id, { description: event.target.value })
                        }
                        rows={3}
                      />
                    </label>
                    <label className={fieldClassName}>
                      <span className={labelClassName}>Color</span>
                      <input
                        className={inputClassName}
                        value={projectEditForm.color}
                        onChange={(event) =>
                          updateProjectEditForm(project.id, { color: event.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button className={primaryButtonClassName} type="submit" disabled={updateProjectMutation.isPending}>
                      {updateProjectMutation.isPending ? "Saving…" : "Save project"}
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

              <div className="grid gap-4">
                <div className="flex items-center justify-between gap-4">
                  <h4 className={sectionTitleClassName}>Attached folders</h4>
                </div>
                {project.folders.length ? (
                  <div className="grid gap-4">
                    {sortFolders(project.folders).map((folder) => {
                      const isEditingFolder = editingFolderIds[folder.id] ?? false;
                      const folderEditForm =
                        folderEditForms[folder.id] ?? createFolderFormState(folder);
                      const folderValidation = pathValidation[`folder-${folder.id}`];

                      return (
                        <div className={`${cardClassName} grid gap-4`} key={folder.id}>
                          <div className="flex min-w-0 flex-col items-start justify-between gap-4 xl:flex-row">
                            <div>
                              <p className="m-0 text-sm font-medium text-ink-50">
                                {folder.label} <span className="ml-2 text-[0.82rem] text-ink-300">{folder.kind}</span>
                              </p>
                              <p className="m-0 mt-1 break-words font-mono text-[0.88rem] text-ink-300">
                                {folder.path}
                              </p>
                              <p className="m-0 mt-2 flex flex-wrap gap-3 text-[0.82rem] text-ink-300">
                                <span>{folder.isPrimary ? "Primary" : "Secondary"}</span>
                                <span>{folder.existsOnDisk ? "On disk" : "Missing"}</span>
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                className={secondaryButtonClassName}
                                onClick={() =>
                                  isEditingFolder ? cancelFolderEdit(folder.id) : beginFolderEdit(folder)
                                }
                              >
                                {isEditingFolder ? "Close editor" : "Edit folder"}
                              </button>
                              <button
                                type="button"
                                className={secondaryButtonClassName}
                                disabled={deleteFolderMutation.isPending}
                                onClick={() =>
                                  deleteFolderMutation.mutate({
                                    projectId: project.id,
                                    folderId: folder.id
                                  })
                                }
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
                              <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                                <label className={fieldClassName}>
                                  <span className={labelClassName}>Label</span>
                                  <input
                                    className={inputClassName}
                                    value={folderEditForm.label}
                                    onChange={(event) =>
                                      updateFolderEditForm(folder, { label: event.target.value })
                                    }
                                    required
                                  />
                                </label>
                                <label className={fieldClassName}>
                                  <span className={labelClassName}>Kind</span>
                                  <select
                                    className={inputClassName}
                                    value={folderEditForm.kind}
                                    onChange={(event) =>
                                      updateFolderEditForm(folder, {
                                        kind: event.target.value as ProjectFolderKind
                                      })
                                    }
                                  >
                                    {PROJECT_FOLDER_KINDS.map((kind) => (
                                      <option key={kind} value={kind}>
                                        {kind}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className={fieldWideClassName}>
                                  <span className={labelClassName}>WSL path</span>
                                  <input
                                    className={inputClassName}
                                    value={folderEditForm.path}
                                    onChange={(event) =>
                                      updateFolderEditForm(folder, { path: event.target.value })
                                    }
                                    required
                                  />
                                </label>
                                <label className={checkboxLabelClassName}>
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
                                  <span className="m-0">Primary folder</span>
                                </label>
                              </div>
                              <div className="flex flex-wrap gap-3">
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
                                  {validatePathMutation.isPending ? "Validating…" : "Validate path"}
                                </button>
                                <button className={primaryButtonClassName} type="submit" disabled={updateFolderMutation.isPending}>
                                  {updateFolderMutation.isPending ? "Saving…" : "Save folder"}
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
                                <p className="m-0 text-sm text-ink-300">
                                  {folderValidation.exists
                                    ? folderValidation.isDirectory
                                      ? `Valid directory: ${folderValidation.resolvedPath}`
                                      : `Path exists but is not a directory: ${folderValidation.resolvedPath}`
                                    : `Path not found yet. Normalized to ${folderValidation.resolvedPath}`}
                                </p>
                              ) : null}
                            </form>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="m-0 text-sm text-ink-200">No folders attached yet.</p>
                )}
              </div>

              <form className={insetPanelClassName} onSubmit={(event) => void handleCreateFolder(event, project.id)}>
                <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
                  <label className={fieldClassName}>
                    <span className={labelClassName}>Label</span>
                    <input
                      className={inputClassName}
                      value={folderCreateForm.label}
                      onChange={(event) =>
                        updateFolderCreateForm(project.id, { label: event.target.value })
                      }
                      placeholder="terraform"
                      required
                    />
                  </label>
                  <label className={fieldClassName}>
                    <span className={labelClassName}>Kind</span>
                    <select
                      className={inputClassName}
                      value={folderCreateForm.kind}
                      onChange={(event) =>
                        updateFolderCreateForm(project.id, {
                          kind: event.target.value as ProjectFolderKind
                        })
                      }
                    >
                      {PROJECT_FOLDER_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={fieldWideClassName}>
                    <span className={labelClassName}>WSL path</span>
                    <input
                      className={inputClassName}
                      value={folderCreateForm.path}
                      onChange={(event) =>
                        updateFolderCreateForm(project.id, { path: event.target.value })
                      }
                      placeholder="/home/otzhora/projects/payments-terraform"
                      required
                    />
                  </label>
                  <label className={checkboxLabelClassName}>
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
                    <span className="m-0">Primary folder</span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    disabled={validatePathMutation.isPending}
                    onClick={() =>
                      void handleValidatePath(`project-${project.id}`, folderCreateForm.path)
                    }
                  >
                    {validatePathMutation.isPending ? "Validating…" : "Validate path"}
                  </button>
                  <button className={primaryButtonClassName} type="submit" disabled={createFolderMutation.isPending}>
                    {createFolderMutation.isPending ? "Adding…" : "Add folder"}
                  </button>
                </div>
                {projectValidation ? (
                  <p className="m-0 text-sm text-ink-300">
                    {projectValidation.exists
                      ? projectValidation.isDirectory
                        ? `Valid directory: ${projectValidation.resolvedPath}`
                        : `Path exists but is not a directory: ${projectValidation.resolvedPath}`
                      : `Path not found yet. Normalized to ${projectValidation.resolvedPath}`}
                  </p>
                ) : null}
              </form>
            </article>
          );
        })}
        {folderError || validateError || deleteError ? (
          <p className={`${panelClassName} m-0 text-sm text-danger-400`}>
            {folderError ?? validateError ?? deleteError}
          </p>
        ) : null}
        {!sortedProjects.length && !projectsQuery.isLoading ? (
          <p className={`${panelClassName} m-0 text-sm text-ink-50`}>No projects yet.</p>
        ) : null}
      </div>
    </section>
  );
}
