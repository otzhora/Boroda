import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { jiraSettings } from "../../../db/schema";
import { AppError } from "../../../shared/errors";
import { updateJiraSettingsSchema } from "./schemas";

type UpdateJiraSettingsInput = z.infer<typeof updateJiraSettingsSchema>;

interface JiraSearchResponse {
  issues?: Array<{
    key?: string;
    fields?: {
      summary?: string;
    };
  }>;
  total?: number;
}

function sanitizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

async function getStoredJiraSettings(app: FastifyInstance) {
  const record = await app.db.query.jiraSettings.findFirst({
    orderBy: [desc(jiraSettings.updatedAt)]
  });

  return record ?? null;
}

export async function getJiraSettings(app: FastifyInstance) {
  const record = await getStoredJiraSettings(app);

  if (!record) {
    return {
      baseUrl: "",
      email: "",
      hasApiToken: false
    };
  }

  return {
    baseUrl: record.baseUrl,
    email: record.email,
    hasApiToken: record.apiToken.length > 0
  };
}

export async function upsertJiraSettings(app: FastifyInstance, input: UpdateJiraSettingsInput) {
  const existing = await getStoredJiraSettings(app);
  const trimmedToken = input.apiToken?.trim() ?? "";
  const apiToken = trimmedToken || (existing?.apiToken ?? "");

  if (!apiToken) {
    throw new AppError(400, "JIRA_API_TOKEN_REQUIRED", "Jira API token is required");
  }

  const payload = {
    baseUrl: sanitizeBaseUrl(input.baseUrl),
    email: input.email.trim(),
    apiToken,
    updatedAt: new Date().toISOString()
  };

  if (existing) {
    await app.db
      .update(jiraSettings)
      .set(payload)
      .where(eq(jiraSettings.id, existing.id));
  } else {
    await app.db.insert(jiraSettings).values(payload);
  }

  return {
    ok: true as const,
    hasApiToken: true
  };
}

function toJiraAuthorizationHeader(email: string, apiToken: string) {
  const basic = Buffer.from(`${email}:${apiToken}`, "utf8").toString("base64");
  return `Basic ${basic}`;
}

function getJiraErrorMessage(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const payload = body as {
    errorMessages?: string[];
    errors?: Record<string, string>;
    message?: string;
  };

  if (Array.isArray(payload.errorMessages) && payload.errorMessages.length > 0) {
    return payload.errorMessages.join("; ");
  }

  if (payload.errors && typeof payload.errors === "object") {
    const values = Object.values(payload.errors).filter((value): value is string => typeof value === "string");
    if (values.length > 0) {
      return values.join("; ");
    }
  }

  if (typeof payload.message === "string" && payload.message.length > 0) {
    return payload.message;
  }

  return null;
}

export async function listAssignedJiraIssues(app: FastifyInstance) {
  const settings = await getStoredJiraSettings(app);

  if (!settings) {
    throw new AppError(400, "JIRA_SETTINGS_MISSING", "Configure Jira settings before loading issues");
  }

  const searchParams = new URLSearchParams({
    jql: "assignee = currentUser() ORDER BY updated DESC",
    fields: "summary",
    maxResults: "100"
  });

  const response = await fetch(`${sanitizeBaseUrl(settings.baseUrl)}/rest/api/3/search/jql?${searchParams.toString()}`, {
    headers: {
      authorization: toJiraAuthorizationHeader(settings.email, settings.apiToken),
      accept: "application/json"
    }
  });

  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message = getJiraErrorMessage(body);

    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        401,
        "JIRA_AUTH_FAILED",
        message ?? "Jira authentication failed. Check your email and API token"
      );
    }

    if (response.status === 404) {
      throw new AppError(400, "JIRA_URL_INVALID", message ?? "Jira URL looks invalid");
    }

    throw new AppError(502, "JIRA_REQUEST_FAILED", message ?? "Jira request failed");
  }

  const payload = (body ?? {}) as JiraSearchResponse;
  const issues = Array.isArray(payload.issues) ? payload.issues : [];

  return {
    issues: issues
      .map((issue) => {
        if (!issue.key || !issue.fields?.summary) {
          return null;
        }

        return {
          key: issue.key,
          summary: issue.fields.summary
        };
      })
      .filter((issue): issue is { key: string; summary: string } => issue !== null),
    total: typeof payload.total === "number" ? payload.total : issues.length
  };
}
