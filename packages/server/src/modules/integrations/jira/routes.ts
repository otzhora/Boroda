import type { FastifyPluginAsync } from "fastify";
import {
  listAssignedJiraIssues,
  listAssignedJiraIssuesWithLinks,
  getJiraSettings,
  upsertJiraSettings
} from "./service";
import { updateJiraSettingsSchema } from "./schemas";

export const jiraRoutes: FastifyPluginAsync = async (app) => {
  app.get("/integrations/jira/settings", async () => {
    return getJiraSettings(app);
  });

  app.put("/integrations/jira/settings", async (request) => {
    const payload = updateJiraSettingsSchema.parse(request.body);
    return upsertJiraSettings(app, payload);
  });

  app.get("/integrations/jira/issues/assigned", async () => {
    return listAssignedJiraIssues(app);
  });

  app.get("/integrations/jira/issues/assigned/links", async () => {
    return listAssignedJiraIssuesWithLinks(app);
  });
};
