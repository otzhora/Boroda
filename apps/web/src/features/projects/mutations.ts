import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import type {
  PathInfo,
  Project,
  ProjectFolder,
  ProjectFolderWithPathInfo
} from "../../lib/types";
import {
  createFolderFormState,
  nowIso,
  sortFolders,
  sortProjects,
  type FolderFormState,
  type ProjectFormState,
  type ProjectScope
} from "./page-helpers";
import { PROJECTS_QUERY_KEY, projectsQueryKey } from "./queries";

interface MutationContext {
  previousProjects?: Array<[readonly unknown[], Project[] | undefined]>;
}

interface ProjectsPageMutationOptions {
  projectScope: ProjectScope;
  onProjectCreated: (project: Project) => void;
  onProjectUpdated: (projectId: number) => void;
  onFolderCreated: (projectId: number) => void;
  onFolderUpdated: (folderId: number, pathInfo: PathInfo | null) => void;
}

function updateProjectList(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  updater: (projects: Project[]) => Project[]
) {
  queryClient.setQueryData<Project[]>(queryKey, (current) => updater(current ?? []));
}

function rollbackProjects(queryClient: QueryClient, context?: MutationContext) {
  if (!context?.previousProjects) {
    return;
  }

  for (const [queryKey, projects] of context.previousProjects) {
    queryClient.setQueryData(queryKey, projects);
  }
}

export function useProjectsPageMutations(options: ProjectsPageMutationOptions) {
  const queryClient = useQueryClient();
  const scopedProjectsQueryKey = projectsQueryKey(options.projectScope);

  const createProjectMutation = useMutation<Project, Error, ProjectFormState, MutationContext>({
    mutationFn: (payload) =>
      apiClient<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: scopedProjectsQueryKey });
      const previousProjects = queryClient.getQueryData<Project[]>(scopedProjectsQueryKey);
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

      updateProjectList(queryClient, scopedProjectsQueryKey, (projects) =>
        options.projectScope === "archived" ? projects : sortProjects([optimisticProject, ...projects])
      );

      return {
        previousProjects: [[scopedProjectsQueryKey, previousProjects]]
      };
    },
    onError: (_error, _payload, context) => {
      rollbackProjects(queryClient, context);
    },
    onSuccess: (project, payload) => {
      updateProjectList(queryClient, scopedProjectsQueryKey, (projects) =>
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
      options.onProjectCreated(project);
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
      await queryClient.cancelQueries({ queryKey: scopedProjectsQueryKey });
      const previousProjects = queryClient.getQueryData<Project[]>(scopedProjectsQueryKey);

      updateProjectList(queryClient, scopedProjectsQueryKey, (projects) =>
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
        previousProjects: [[scopedProjectsQueryKey, previousProjects]]
      };
    },
    onError: (_error, _variables, context) => {
      rollbackProjects(queryClient, context);
    },
    onSuccess: (project, variables) => {
      updateProjectList(queryClient, scopedProjectsQueryKey, (projects) =>
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
      options.onProjectUpdated(variables.projectId);
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
      await queryClient.cancelQueries({ queryKey: scopedProjectsQueryKey });
      const previousProjects = queryClient.getQueryData<Project[]>(scopedProjectsQueryKey);
      const archivedAt = nowIso();

      updateProjectList(queryClient, scopedProjectsQueryKey, (projects) => {
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

        if (options.projectScope === "all" || options.projectScope === "archived") {
          return sortProjects([archivedProject, ...remainingProjects]);
        }

        return remainingProjects;
      });

      return { previousProjects: [[scopedProjectsQueryKey, previousProjects]] };
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
      await queryClient.cancelQueries({ queryKey: scopedProjectsQueryKey });
      const previousProjects = queryClient.getQueryData<Project[]>(scopedProjectsQueryKey);
      const restoredAt = nowIso();

      updateProjectList(queryClient, scopedProjectsQueryKey, (projects) => {
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

        if (options.projectScope === "active" || options.projectScope === "all") {
          return sortProjects([restoredProject, ...remainingProjects]);
        }

        return remainingProjects;
      });

      return { previousProjects: [[scopedProjectsQueryKey, previousProjects]] };
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
      await queryClient.cancelQueries({ queryKey: scopedProjectsQueryKey });
      const previousProjects = queryClient.getQueryData<Project[]>(scopedProjectsQueryKey);
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

      updateProjectList(queryClient, scopedProjectsQueryKey, (projects) =>
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
        previousProjects: [[scopedProjectsQueryKey, previousProjects]]
      };
    },
    onError: (_error, _variables, context) => {
      rollbackProjects(queryClient, context);
    },
    onSuccess: (folder, variables) => {
      updateProjectList(queryClient, scopedProjectsQueryKey, (projects) =>
        sortProjects(
          projects.map((project) => {
            if (project.id !== variables.projectId) {
              return project;
            }

            const withoutOptimistic = project.folders.filter(
              (item) =>
                !(item.id < 0 && item.path === variables.payload.path && item.label === variables.payload.label)
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
      options.onFolderCreated(variables.projectId);
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
      await queryClient.cancelQueries({ queryKey: scopedProjectsQueryKey });
      const previousProjects = queryClient.getQueryData<Project[]>(scopedProjectsQueryKey);
      const timestamp = nowIso();

      updateProjectList(queryClient, scopedProjectsQueryKey, (projects) =>
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
        previousProjects: [[scopedProjectsQueryKey, previousProjects]]
      };
    },
    onError: (_error, _variables, context) => {
      rollbackProjects(queryClient, context);
    },
    onSuccess: (folder, variables) => {
      updateProjectList(queryClient, scopedProjectsQueryKey, (projects) =>
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
      options.onFolderUpdated(variables.folderId, folder.pathInfo);
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
      await queryClient.cancelQueries({ queryKey: scopedProjectsQueryKey });
      const previousProjects = queryClient.getQueryData<Project[]>(scopedProjectsQueryKey);
      const timestamp = nowIso();

      updateProjectList(queryClient, scopedProjectsQueryKey, (projects) =>
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
        previousProjects: [[scopedProjectsQueryKey, previousProjects]]
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
      if (variables.existingFolderId && pathInfo.exists) {
        updateProjectList(queryClient, scopedProjectsQueryKey, (projects) =>
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
      updateProjectList(queryClient, scopedProjectsQueryKey, (projects) =>
        sortProjects(
          projects.map((project) =>
            project.id === variables.projectId
              ? {
                  ...project,
                  updatedAt: folder.updatedAt,
                  folders: sortFolders(
                    project.folders.map((item) => (item.id === folder.id ? { ...item, ...folder } : item))
                  )
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

  return {
    createProjectMutation,
    updateProjectMutation,
    archiveProjectMutation,
    unarchiveProjectMutation,
    createFolderMutation,
    updateFolderMutation,
    deleteFolderMutation,
    validatePathMutation,
    scaffoldWorktreeSetupMutation
  };
}

export function createEmptyFolderForm() {
  return createFolderFormState();
}
