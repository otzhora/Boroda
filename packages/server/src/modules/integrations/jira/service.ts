import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { jiraSettings, ticketJiraIssueLinks, tickets } from "../../../db/schema";
import { AppError } from "../../../shared/errors";
import { logServerEvent, withServerSpan } from "../../../shared/observability";
import { buildJiraIssueMeta, buildTicketListItems, loadTicketListDecorations } from "../../tickets/service/shared";
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

const JIRA_SETTINGS_SINGLETON_ID = 1;
const JIRA_REQUEST_TIMEOUT_MS = 10_000;
const JIRA_SEARCH_PAGE_SIZE = 100;
const JIRA_LINKABLE_TICKET_LIMIT = 20;

function sanitizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeIssueKey(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

async function getStoredJiraSettings(app: FastifyInstance) {
  const record = await app.db.query.jiraSettings.findFirst();

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
  return withServerSpan(
    app,
    "jira.settings.upsert",
    {
      baseUrl: sanitizeBaseUrl(input.baseUrl),
      email: input.email.trim(),
      providedApiToken: Boolean(input.apiToken?.trim())
    },
    async () => {
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
          .where(eq(jiraSettings.id, JIRA_SETTINGS_SINGLETON_ID));
      } else {
        await app.db.insert(jiraSettings).values({
          id: JIRA_SETTINGS_SINGLETON_ID,
          ...payload
        });
      }

      return {
        ok: true as const,
        hasApiToken: true
      };
    }
  );
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

async function getRequiredJiraSettings(app: FastifyInstance) {
  const settings = await getStoredJiraSettings(app);

  if (!settings) {
    throw new AppError(400, "JIRA_SETTINGS_MISSING", "Configure Jira settings before loading issues");
  }

  return settings;
}

async function runJiraSearch(
  app: FastifyInstance,
  input: {
    jql: string;
    maxResults?: number;
    pageSize?: number;
  }
) {
  return withServerSpan(
    app,
    "jira.search",
    {
      maxResults: input.maxResults ?? null,
      pageSize: input.pageSize ?? JIRA_SEARCH_PAGE_SIZE,
      jqlPreview: input.jql.slice(0, 120)
    },
    async () => {
      const settings = await getRequiredJiraSettings(app);
      const pageSize = Math.max(1, input.pageSize ?? JIRA_SEARCH_PAGE_SIZE);
      const limit = input.maxResults ?? Number.POSITIVE_INFINITY;
      const issues: Array<{ key: string; summary: string }> = [];
      let total = 0;
      let fetchedPages = 0;
      let startAt = 0;

      while (issues.length < limit) {
        const remaining = Number.isFinite(limit) ? Math.max(limit - issues.length, 0) : pageSize;
        const maxResults = Math.min(pageSize, remaining || pageSize);
        const searchParams = new URLSearchParams({
          jql: input.jql,
          fields: "summary",
          startAt: String(startAt),
          maxResults: String(maxResults)
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, JIRA_REQUEST_TIMEOUT_MS);

        let response: Response;

        try {
          response = await fetch(`${sanitizeBaseUrl(settings.baseUrl)}/rest/api/3/search/jql?${searchParams.toString()}`, {
            headers: {
              authorization: toJiraAuthorizationHeader(settings.email, settings.apiToken),
              accept: "application/json"
            },
            signal: controller.signal
          });
        } catch (error) {
          clearTimeout(timeoutId);

          if (error instanceof Error && error.name === "AbortError") {
            throw new AppError(
              504,
              "JIRA_REQUEST_TIMEOUT",
              `Jira request timed out after ${Math.round(JIRA_REQUEST_TIMEOUT_MS / 1000)} seconds`
            );
          }

          throw new AppError(502, "JIRA_REQUEST_FAILED", "Jira request failed", {
            cause: error instanceof Error ? error.message : String(error)
          });
        }

        let body: unknown = null;

        try {
          body = await response.json();
        } catch {
          body = null;
        } finally {
          clearTimeout(timeoutId);
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
        const pageIssues = Array.isArray(payload.issues) ? payload.issues : [];
        const normalizedIssues = pageIssues
          .map((issue) => {
            if (!issue.key || !issue.fields?.summary) {
              return null;
            }

            return {
              key: issue.key,
              summary: issue.fields.summary
            };
          })
          .filter((issue): issue is { key: string; summary: string } => issue !== null);

        issues.push(...normalizedIssues);
        total = typeof payload.total === "number" ? payload.total : issues.length;
        fetchedPages += 1;

        if (pageIssues.length === 0 || issues.length >= total || normalizedIssues.length < maxResults) {
          break;
        }

        startAt += pageIssues.length;
      }

      const result = {
        issues: Number.isFinite(limit) ? issues.slice(0, input.maxResults) : issues,
        total
      };

      logServerEvent(app, "info", "jira.search.result", {
        maxResults: input.maxResults ?? null,
        pageSize,
        fetchedPages,
        returnedIssueCount: result.issues.length,
        total: result.total
      });

      return result;
    }
  );
}

export async function listAssignedJiraIssues(app: FastifyInstance) {
  return runJiraSearch(app, {
    jql: "assignee = currentUser() ORDER BY updated DESC"
  });
}

export async function listAssignedJiraIssuesWithLinks(app: FastifyInstance) {
  const assignedIssues = await listAssignedJiraIssues(app);
  const normalizedIssueKeys = assignedIssues.issues.map((issue) => normalizeIssueKey(issue.key));

  const linkedBorodaTickets = normalizedIssueKeys.length
    ? app.db
        .select({
          issueKey: ticketJiraIssueLinks.issueKey,
          id: tickets.id,
          key: tickets.key,
          title: tickets.title,
          status: tickets.status,
          priority: tickets.priority,
          updatedAt: tickets.updatedAt
        })
        .from(ticketJiraIssueLinks)
        .innerJoin(tickets, eq(ticketJiraIssueLinks.ticketId, tickets.id))
        .where(and(inArray(ticketJiraIssueLinks.issueKey, normalizedIssueKeys), isNull(tickets.archivedAt)))
        .orderBy(desc(tickets.updatedAt), desc(tickets.id))
        .all()
    : [];

  const borodaTicketsByIssueKey = new Map<
    string,
    Array<{
      id: number;
      key: string;
      title: string;
      status: string;
      priority: string;
      updatedAt: string;
    }>
  >();

  for (const ticket of linkedBorodaTickets) {
    const existing = borodaTicketsByIssueKey.get(ticket.issueKey) ?? [];
    existing.push({
      id: ticket.id,
      key: ticket.key,
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      updatedAt: ticket.updatedAt
    });
    borodaTicketsByIssueKey.set(ticket.issueKey, existing);
  }

  const issues = assignedIssues.issues.map((issue) => ({
    key: issue.key,
    summary: issue.summary,
    borodaTickets: borodaTicketsByIssueKey.get(normalizeIssueKey(issue.key)) ?? []
  }));

  return {
    issues,
    total: assignedIssues.total,
    linked: issues.filter((issue) => issue.borodaTickets.length > 0).length,
    unlinked: issues.filter((issue) => issue.borodaTickets.length === 0).length
  };
}

export async function listJiraLinkableTickets(
  app: FastifyInstance,
  input: {
    issueKey: string;
    q?: string;
  }
) {
  const normalizedIssueKey = normalizeIssueKey(input.issueKey);
  const normalizedSearch = input.q?.trim() ?? "";

  if (!normalizedSearch) {
    return {
      items: [],
      meta: {
        jiraIssues: []
      }
    };
  }
  const ticketRows = app.db
    .select()
    .from(tickets)
    .where(
      and(
        isNull(tickets.archivedAt),
        sql`(
          ${tickets.key} like ${`%${normalizedSearch}%`}
          or
          ${tickets.title} like ${`%${normalizedSearch}%`}
          or
          ${tickets.description} like ${`%${normalizedSearch}%`}
          or exists (
            select 1
            from ${ticketJiraIssueLinks}
            where ${ticketJiraIssueLinks.ticketId} = ${tickets.id}
              and (
                ${ticketJiraIssueLinks.issueKey} like ${`%${normalizedSearch}%`}
                or ${ticketJiraIssueLinks.issueSummary} like ${`%${normalizedSearch}%`}
              )
          )
        )`,
        sql`not exists (
          select 1
          from ${ticketJiraIssueLinks}
          where ${ticketJiraIssueLinks.ticketId} = ${tickets.id}
            and ${ticketJiraIssueLinks.issueKey} = ${normalizedIssueKey}
        )`
      )
    )
    .orderBy(desc(tickets.updatedAt), desc(tickets.id))
    .limit(JIRA_LINKABLE_TICKET_LIMIT)
    .all();

  const decorations = await loadTicketListDecorations(
    app.db,
    ticketRows.map((ticket) => ticket.id)
  );

  return {
    items: buildTicketListItems(ticketRows, decorations),
    meta: buildJiraIssueMeta(ticketRows, decorations.jiraIssuesByTicketId)
  };
}

export async function getJiraIssuesByKeys(app: FastifyInstance, issueKeys: string[]) {
  const uniqueIssueKeys = [...new Set(issueKeys.map((issueKey) => issueKey.trim()).filter(Boolean))];

  if (!uniqueIssueKeys.length) {
    return [];
  }

  const quotedIssueKeys = uniqueIssueKeys.map((issueKey) => `"${issueKey.replace(/"/g, '\\"')}"`).join(",");
  const result = await runJiraSearch(app, {
    jql: `issuekey in (${quotedIssueKeys}) ORDER BY updated DESC`,
    maxResults: uniqueIssueKeys.length
  });

  return result.issues;
}
