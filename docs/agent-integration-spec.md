# Boroda Agent Integration Spec

## Purpose

This document defines the first meaningful integration between Boroda and coding agents such as Codex and Claude.

The first pass is intentionally simple:

- agents can read Boroda work
- agents can create tickets in Boroda
- agents can update tickets they are working on
- agents can attach durable context back to tickets

This pass does not require full autonomous orchestration, agent scheduling, or deep agent-specific behavior.

## Goals

- make Boroda usable from coding agents during real implementation sessions
- support generic ticket creation rather than audit-specific workflows
- keep the integration compatible with Codex and Claude
- reuse existing Boroda ticket, project, workspace, and work-context concepts
- keep Boroda as the source of truth for business logic

## Non-Goals

- automatic ticket prioritization
- agent self-assignment or multi-agent scheduling
- autonomous background agents running without a user session
- full CRUD exposure for every Boroda entity in v1
- provider-specific features that only work for one agent client
- enterprise architecture for its own sake
- cloud-only infrastructure or hosted control planes
- unnecessary abstractions that do not help a local-only single-developer project

## Engineering Principles

Implementation quality should be as high as practical while staying appropriate for Boroda’s actual operating model.

Boroda is:

- local-only
- single-developer
- not a cloud product
- not an enterprise platform

That means:

- yes to clear, maintainable, easy-to-follow code
- yes to strong separation of concerns
- yes to small focused modules
- yes to pragmatic tests and verification
- no to enterprise-style indirection without clear payoff
- no to cloud-oriented architecture that the product does not need
- no to speculative abstractions
- no to unnecessary framework or infrastructure complexity

## Code-Smell Policy

Boroda adopts a zero-tolerance code-smells policy.

Rule:

- if it smells, it needs to go

Expected standards:

- keep clear separation of concerns
- avoid god-files and god-services
- avoid modules that mix transport, persistence, OS integration, and business logic without a good reason
- avoid duplicated orchestration logic
- avoid unclear ownership between UI, route, and service layers
- keep code easy to read, easy to modify, and easy to verify

When working in code that already contains smells, use these rules:

- if the fix is small and adjacent to the change you are already making, fix it in the same step
- if the fix is not small or not adjacent, do not silently widen scope
- instead, report it explicitly so it can be handled as a separate decision

## Product Shape

The core workflow is:

1. an agent reads relevant Boroda state
2. an agent creates a ticket or updates an existing one
3. an agent attaches session links, notes, or references as work context
4. Boroda shows that activity as normal ticket history

This gives immediate value for:

- implementation ideas discovered during a coding session
- bugs found while exploring the codebase
- follow-up tasks identified during refactors
- partial progress notes while working on a ticket

## Transport Strategy

Boroda should support MCP, but MCP should not own domain logic.

The implementation should use this layering:

1. Boroda service layer implements the business rules
2. Boroda HTTP endpoints expose those rules for the web app and local automation
3. Boroda MCP server adapts a narrow set of agent-friendly tools onto the same services

This allows:

- Boroda web UI to keep using HTTP
- future CLI workflows to reuse the same API
- Codex and Claude to use Boroda via MCP without duplicating logic

## Why MCP

MCP is the best default option because it gives a standard tool interface for agents.

Benefits:

- agents can discover Boroda capabilities as tools
- no custom prompt-only integration contract is required
- multiple agent clients can share the same Boroda tool surface
- tool calls are naturally shaped around read and write actions

## Alternatives

### HTTP only

Possible, but weaker.

Pros:

- Boroda already has an HTTP API
- lowest immediate implementation cost

Cons:

- each agent environment needs custom glue
- poorer interoperability
- weaker long-term ergonomics

### CLI only

Useful as a supplement, not enough on its own.

Pros:

- easy local debugging
- good for shell-driven workflows

Cons:

- less natural for MCP-capable agent environments
- still needs argument and output conventions

### Filesystem contract only

Not sufficient as the main integration.

Pros:

- very simple to inspect

Cons:

- no transactional writes
- weak discoverability
- poor fit for ticket mutation workflows

## First-Pass Capabilities

The first pass should expose a deliberately narrow tool surface.

### Read capabilities

- list projects
- list tickets
- get ticket details

### Write capabilities

- create ticket
- update ticket
- attach work context
- append activity

These capabilities are enough for real-world use without building a full autonomous control plane.

## Tool Surface

The MCP tool names below are recommendations. Exact naming can change, but the scope should remain narrow.

### `boroda.list_projects`

Purpose:

- let agents discover valid projects and IDs before creating or updating tickets

Recommended input:

```json
{
  "scope": "active"
}
```

Recommended output:

```json
{
  "items": [
    {
      "id": 3,
      "name": "Boroda",
      "slug": "boroda",
      "archivedAt": null,
      "folders": [
        {
          "id": 7,
          "label": "main",
          "path": "/home/otzhora/projects/codex_projects/boroda",
          "isPrimary": true
        }
      ]
    }
  ]
}
```

### `boroda.list_tickets`

Purpose:

- let agents inspect current work and avoid duplicate ticket creation

Recommended input:

```json
{
  "q": "mcp",
  "scope": "active",
  "status": [],
  "priority": [],
  "projectId": []
}
```

Recommended output:

- reuse the existing ticket list response shape as much as possible

### `boroda.get_ticket`

Purpose:

- let agents load full details before updating a ticket

Recommended input:

```json
{
  "ticketId": 42
}
```

Recommended output:

- reuse the existing detailed ticket response shape

### `boroda.create_ticket`

Purpose:

- let agents create generic tickets in a single structured call

Recommended required fields:

- `title`

Recommended optional fields:

- `description`
- `status`
- `priority`
- `branch`
- `dueAt`
- `projectLinks`
- `jiraIssues`
- `workContexts`

Recommended input:

```json
{
  "title": "Add Boroda MCP server for agent ticket operations",
  "description": "Expose a narrow MCP tool surface for listing projects, listing tickets, creating tickets, updating tickets, and attaching work context.",
  "status": "INBOX",
  "priority": "HIGH",
  "branch": null,
  "dueAt": null,
  "projectLinks": [
    {
      "projectId": 3,
      "relationship": "PRIMARY"
    }
  ],
  "jiraIssues": [],
  "workContexts": [
    {
      "type": "NOTE",
      "label": "Source",
      "value": "Discovered during planning for Boroda/agent integration."
    }
  ]
}
```

Recommended behavior:

- create the ticket
- create any passed project links
- create any passed Jira issue links
- create any passed work contexts
- write a ticket activity entry indicating that the ticket was created by an agent
- include agent provenance in activity metadata when available

### `boroda.update_ticket`

Purpose:

- let agents update ticket state without needing low-level mutation primitives

Recommended input:

```json
{
  "ticketId": 42,
  "patch": {
    "status": "IN_PROGRESS",
    "priority": "MEDIUM",
    "description": "Updated description text"
  }
}
```

Recommended allowed fields in v1:

- `title`
- `description`
- `status`
- `priority`
- `branch`
- `dueAt`

Project-link replacement and Jira-link replacement should be considered separately. They can be included in v1 only if the current update semantics are already clear and safe.

### `boroda.attach_work_context`

Purpose:

- let agents attach durable references after creating or updating a ticket

Recommended input:

```json
{
  "ticketId": 42,
  "type": "CODEX_SESSION",
  "label": "Session",
  "value": "codex://session/abc123",
  "meta": {}
}
```

Recommended supported types in v1:

- `CODEX_SESSION`
- `CLAUDE_SESSION`
- `CURSOR_SESSION`
- `PR`
- `LINK`
- `NOTE`
- keep support for existing types already in Boroda

### `boroda.append_activity`

Purpose:

- let agents record meaningful progress without overloading descriptions or notes

Recommended input:

```json
{
  "ticketId": 42,
  "message": "Implementation plan drafted and stored under docs/.",
  "type": "agent.note",
  "meta": {
    "agentKind": "codex"
  }
}
```

Recommended behavior:

- create a ticket activity entry without changing ticket fields

## Boroda Data Model Impact

The first pass should minimize schema expansion.

Preferred first-pass approach:

- reuse `tickets`
- reuse `ticket_project_links`
- reuse `ticket_jira_issue_links`
- reuse `work_contexts`
- reuse `ticket_activities`

This is enough to ship agent ticket creation and updates.

## Provenance

Agent-originated changes should be visible.

At minimum, Boroda should store provenance in ticket activity metadata:

- `actorType`: `agent`
- `agentKind`: `codex` or `claude`
- `sessionRef`: optional
- `transport`: `mcp` or `http`

Boroda does not need a dedicated `agent_runs` table in the first pass.

That can be introduced later if session lifecycle tracking becomes important.

## Validation Rules

Boroda should stay permissive enough for real agent workflows.

Rules:

- only `title` is required for `create_ticket`
- `description` defaults to an empty string
- `status` defaults to the current Boroda default
- `priority` defaults to the current Boroda default
- free-text fields should be trimmed
- empty optional strings should be normalized to `null` or `""` consistently with current schema behavior
- invalid project IDs should fail clearly
- invalid work-context types should fail clearly

## Idempotency and Duplicate Control

Boroda should not block creation with heavy dedupe logic in v1.

Recommended v1 behavior:

- allow generic ticket creation
- encourage agents to call `list_tickets` first when appropriate
- optionally support a lightweight client-provided `externalRef` in metadata later

Do not add fuzzy duplicate detection in the first pass.

## Permissions and Trust Model

This is a local-only app, but agent write access still needs basic guardrails.

Recommended rules:

- MCP and HTTP agent endpoints are local-only
- the exposed tool surface stays intentionally narrow
- destructive actions are out of scope for v1
- agent writes are logged as activities

V1 should not expose:

- delete ticket
- delete project
- arbitrary filesystem mutation
- unrestricted schema-level writes

## UX Expectations

The Boroda UI should make agent-created work feel native rather than separate.

Expected UI behavior:

- ticket creation through agents produces normal tickets
- activity timeline shows agent-originated entries
- work contexts created by agents appear in the existing ticket drawer context UI
- there is no separate “agent ticket” concept in v1

## UI Requirements

Any UI added for this feature must stay aligned with Boroda’s current product language.

Requirements:

- keep the UI flat and compact
- stay visually in line with what is already implemented in Boroda
- follow the rules in `Uncodixify.md`
- prefer extending existing ticket drawer, ticket list, and page patterns over introducing new visual structures
- avoid separate “agent dashboard” surfaces in v1
- avoid decorative panels, hero sections, floating shells, oversized radii, gradient-heavy treatments, and other explicitly banned patterns from `Uncodixify.md`
- use existing spacing, borders, controls, and hierarchy before introducing any new UI styling patterns

For this feature specifically:

- agent-originated activity should appear as compact entries in the existing activity timeline
- agent-created work contexts should reuse existing context UI patterns
- any additional controls should look like normal Boroda controls rather than a distinct AI-themed layer

## Acceptance Criteria

The first pass is successful when:

- Codex or Claude can create a generic Boroda ticket through a stable tool interface
- agents can read ticket and project state before creating follow-up work
- agents can update a ticket and attach work context after doing work
- Boroda records visible provenance for agent-originated changes
- existing web behavior remains the source of truth for ticket semantics

## Deferred Follow-Ups

Explicitly defer these until after the first pass:

- dedicated `agent_runs` table
- “next best ticket” recommendation tools
- agent launch orchestration from the Boroda UI
- agent-specific prompts stored per project
- automatic branch/worktree creation on ticket creation
- duplicate suppression heuristics
- two-way session resume flows
