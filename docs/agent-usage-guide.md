# Boroda Agent Usage Guide

Boroda's first-pass agent integration is intentionally narrow. Prefer MCP when the client supports it. Use the HTTP agent routes only when MCP is not available.

For local MCP setup on a new machine, see [docs/agent-mcp-local.md](/home/otzhora/projects/codex_projects/boroda/docs/agent-mcp-local.md).

## MCP Tool Surface

Boroda currently exposes these MCP tools:

- `boroda.list_projects`
- `boroda.list_tickets`
- `boroda.get_ticket`
- `boroda.create_ticket`
- `boroda.update_ticket`
- `boroda.attach_work_context`
- `boroda.append_activity`

The matching HTTP routes are:

- `GET /api/agents/projects`
- `GET /api/agents/tickets`
- `GET /api/agents/tickets/:id`
- `POST /api/agents/tickets`
- `PATCH /api/agents/tickets/:id`
- `POST /api/agents/tickets/:id/contexts`
- `POST /api/agents/tickets/:id/activity`

## Expected Workflow

Use this loop:

1. Call `boroda.list_tickets` to look for an existing ticket.
2. If a likely match exists, call `boroda.get_ticket` before mutating it.
3. Create a new ticket only when no existing ticket fits.
4. Use `boroda.update_ticket` for core ticket fields only.
5. Use `boroda.attach_work_context` for durable references like session links, PRs, URLs, or notes.
6. Use `boroda.append_activity` for progress updates that should appear in the activity timeline without changing ticket fields.

In practice:

- create when the work is new
- update when the ticket already exists
- attach work context for durable external references
- append activity for progress notes, checkpoints, or outcomes

## Create Ticket

`boroda.create_ticket` accepts the same first-pass write contract as `POST /api/agents/tickets`.

Required:

- `title`

Optional:

- `description`
- `status`
- `priority`
- `branch`
- `dueAt`
- `projectLinks`
- `jiraIssues`
- `workContexts`
- `actor`

Defaults:

- `description: ""`
- `status: "INBOX"`
- `priority: "MEDIUM"`
- `projectLinks: []`
- `jiraIssues: []`
- `workContexts: []`

Example:

```json
{
  "title": "Add Boroda usage docs for agents",
  "description": "Document the shipped MCP and HTTP agent contract.",
  "status": "INBOX",
  "priority": "HIGH",
  "projectLinks": [
    {
      "projectId": 3,
      "relationship": "PRIMARY"
    }
  ],
  "workContexts": [
    {
      "type": "NOTE",
      "label": "Source",
      "value": "Step 7 of the implementation plan",
      "meta": {}
    }
  ],
  "actor": {
    "agentKind": "codex",
    "sessionRef": "codex://session/step-7"
  }
}
```

`projectLinks[].relationship` must be one of `PRIMARY`, `RELATED`, or `DEPENDENCY`.

`workContexts[].type` must be one of:

- `CODEX_SESSION`
- `CLAUDE_SESSION`
- `CURSOR_SESSION`
- `PR`
- `AWS_CONSOLE`
- `TERRAFORM_RUN`
- `MANUAL_UI`
- `LINK`
- `NOTE`

## Update Ticket

`boroda.update_ticket` only patches core ticket fields. It does not replace project links, Jira links, work contexts, or workspaces.

Allowed `patch` fields:

- `title`
- `description`
- `branch`
- `status`
- `priority`
- `dueAt`

Example:

```json
{
  "ticketId": 42,
  "patch": {
    "status": "IN_PROGRESS",
    "priority": "HIGH"
  },
  "actor": {
    "agentKind": "codex",
    "sessionRef": "codex://session/step-7"
  }
}
```

## Attach Session Context

Use `boroda.attach_work_context` when the data should remain as durable ticket context instead of a transient activity note.

Example:

```json
{
  "ticketId": 42,
  "type": "CODEX_SESSION",
  "label": "Session",
  "value": "codex://session/step-7",
  "meta": {},
  "actor": {
    "agentKind": "codex"
  }
}
```

Use `NOTE` when you want context stored with the ticket but it does not fit a stronger type.

## Append Activity

Use `boroda.append_activity` for progress updates that belong in the activity timeline.

Example:

```json
{
  "ticketId": 42,
  "type": "agent.note",
  "message": "Drafted the concise operator guide and aligned examples with the shipped tool contract.",
  "meta": {
    "phase": "documentation"
  },
  "actor": {
    "agentKind": "codex"
  }
}
```

## Provenance

`actor` is optional but recommended on agent writes. When present, Boroda records provenance into ticket activity metadata:

- `actorType: "agent"`
- `agentKind`
- `sessionRef` when provided
- `transport: "mcp"` or `transport: "http"`

The create, update, attach-work-context, and append-activity flows all use this same provenance contract.

## Notes

- `boroda.list_tickets` supports `q`, `scope`, `status`, `priority`, and `projectId`.
- `boroda.list_projects` supports `scope`.
- `boroda.get_ticket` takes `ticketId`.
- MCP wraps project and ticket lists in `{ "items": [...] }`. The HTTP agent routes return the normal HTTP service payloads.
- The first pass does not expose project creation, ticket deletion, or arbitrary workspace management to agents.
