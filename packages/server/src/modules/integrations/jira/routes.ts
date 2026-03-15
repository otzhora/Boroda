import type { FastifyPluginAsync } from "fastify";
import {
  listJiraLinkableTickets,
  listAssignedJiraIssues,
  listAssignedJiraIssuesWithLinks,
  getJiraSettings,
  upsertJiraSettings
} from "./service";
import {
  jiraIssueKeyParamSchema,
  jiraLinkableTicketsQuerySchema,
  updateJiraSettingsSchema
} from "./schemas";

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

  app.get("/integrations/jira/issues/:key/linkable-tickets", async (request) => {
    const params = jiraIssueKeyParamSchema.parse(request.params);
    const query = jiraLinkableTicketsQuerySchema.parse(request.query);
    return listJiraLinkableTickets(app, {
      issueKey: params.key,
      q: query.q
    });
  });
};
