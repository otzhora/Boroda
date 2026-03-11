import type { FastifyPluginAsync } from "fastify";
import {
  createProjectSchema,
  createProjectFolderSchema,
  projectFolderIdParamSchema,
  projectIdParamSchema,
  projectQuerySchema,
  updateProjectFolderSchema,
  updateProjectSchema
} from "./schemas";
import {
  createProject,
  createProjectFolder,
  deleteProject,
  deleteProjectFolder,
  getProjectOrThrow,
  listProjects,
  scaffoldProjectFolderSetup,
  unarchiveProject,
  updateProject,
  updateProjectFolder
} from "./service";

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.get("/projects", async (request) => {
    const query = projectQuerySchema.parse(request.query);
    return listProjects(app, query);
  });

  app.post("/projects", async (request) => {
    const payload = createProjectSchema.parse(request.body);
    return createProject(app, payload);
  });

  app.get("/projects/:id", async (request) => {
    const params = projectIdParamSchema.parse(request.params);
    return getProjectOrThrow(app, params.id);
  });

  app.patch("/projects/:id", async (request) => {
    const params = projectIdParamSchema.parse(request.params);
    const payload = updateProjectSchema.parse(request.body);
    return updateProject(app, params.id, payload);
  });

  app.delete("/projects/:id", async (request) => {
    const params = projectIdParamSchema.parse(request.params);
    return deleteProject(app, params.id);
  });

  app.post("/projects/:id/unarchive", async (request) => {
    const params = projectIdParamSchema.parse(request.params);
    return unarchiveProject(app, params.id);
  });

  app.post("/projects/:id/folders", async (request) => {
    const params = projectIdParamSchema.parse(request.params);
    const payload = createProjectFolderSchema.parse(request.body);
    return createProjectFolder(app, params.id, payload);
  });

  app.patch("/project-folders/:id", async (request) => {
    const params = projectFolderIdParamSchema.parse(request.params);
    const payload = updateProjectFolderSchema.parse(request.body);
    return updateProjectFolder(app, params.id, payload);
  });

  app.delete("/project-folders/:id", async (request) => {
    const params = projectFolderIdParamSchema.parse(request.params);
    return deleteProjectFolder(app, params.id);
  });

  app.post("/project-folders/:id/worktree-setup/scaffold", async (request) => {
    const params = projectFolderIdParamSchema.parse(request.params);
    return scaffoldProjectFolderSetup(app, params.id);
  });
};
