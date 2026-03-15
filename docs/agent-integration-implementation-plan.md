# Boroda Agent Integration Implementation Plan

## Purpose

This document turns the Boroda agent integration spec into an execution plan that can be handed to Codex step by step.

The implementation target is the first pass only:

- generic ticket creation by agents
- ticket reads and updates by agents
- work-context and activity writeback
- MCP exposed on top of Boroda services

## Working Rules

Use these rules during implementation:

- keep Boroda business logic in service modules, not in transport adapters
- prefer extending existing ticket and work-context flows over inventing parallel agent-only models
- keep MCP tool surface narrow
- preserve current Boroda web semantics unless a step explicitly changes them
- add tests for new behavior as it is introduced
- any UI changes must remain flat, compact, and visually consistent with existing Boroda screens
- any UI changes must follow `Uncodixify.md`
- code quality should be as high as practical while staying appropriate for a local-only single-developer app
- do not introduce enterprise patterns, cloud-oriented architecture, or unnecessary abstractions
- keep code clear, maintainable, easy to reason about, and easy to modify
- preserve strong separation of concerns
- do not create or expand god-files when a cleaner decomposition is reasonable

## Code-Smell Policy

Adopt a zero-tolerance policy for code smells during this work.

Use this rule during every step:

- if it smells, it needs to go

Specific expectations:

- keep responsibilities separated across routes, services, integrations, and UI
- avoid files that accumulate unrelated concerns
- avoid duplicated orchestration logic when a focused shared abstraction is clearer
- avoid pushing business rules into transport adapters
- avoid speculative abstractions that make a local-only app harder to understand

When you encounter smells in existing code:

- if the fix is small and adjacent to the change you are making, fix it in the same step
- if the fix is larger or not adjacent, do not silently widen scope
- instead, report it explicitly so it can be reviewed and scheduled deliberately

## Proposed Execution Order

Work through these steps in order.

## Step 1: Define agent provenance and creation semantics

### Problem

Boroda can already create tickets and work contexts, but the codebase does not yet define how agent-originated changes should be represented or logged.

### Files

- `docs/agent-integration-spec.md`
- `packages/server/src/modules/tickets/service/`
- `packages/server/src/modules/work-contexts/service.ts`
- `packages/server/src/db/schema.ts`
- `packages/server/src/shared/types.ts`

### Required change

Decide and implement the minimum provenance contract for agent writes.

Recommended first-pass shape:

- store provenance in `ticket_activities.metaJson`
- do not add a new table yet
- use metadata fields such as `actorType`, `agentKind`, `sessionRef`, and `transport`

If the current ticket creation flow cannot record agent-originated activity cleanly, refactor the service layer so it can.

### Acceptance criteria

- ticket creation can record agent provenance
- work-context creation can record agent provenance
- the approach does not require MCP-specific branching inside business logic

### Verification

Run:

```bash
npm test
npm run typecheck
```

### Codex prompt

```text
Implement Step 1 from docs/agent-integration-implementation-plan.md.

Goal:
- define the minimum provenance model for agent-originated Boroda writes
- keep provenance in existing activity metadata rather than adding a new major domain model

Constraints:
- Boroda service modules remain the source of truth
- avoid MCP-specific logic in ticket business rules
- keep changes minimal and aligned with docs/agent-integration-spec.md

Tasks:
- inspect current ticket creation and work-context creation flows
- add the minimum types/helpers needed to pass optional actor metadata into those flows
- ensure ticket activity entries can include agent provenance metadata
- add or update tests

Run the relevant tests and typecheck when done.
```

## Step 2: Extend ticket creation to support agent-friendly generic input

### Problem

Boroda already supports ticket creation over HTTP, but the contract should be explicitly suitable for agent-driven generic ticket creation, including optional project links, Jira links, and initial work contexts in one call.

### Files

- `packages/server/src/modules/tickets/schemas.ts`
- `packages/server/src/modules/tickets/routes.ts`
- `packages/server/src/modules/tickets/service/`
- `packages/server/src/shared/types.ts`
- server tests covering ticket creation

### Required change

Confirm or extend the create-ticket service so a single call can:

- create the ticket
- attach project links
- attach Jira issue links
- attach initial work contexts
- write an activity entry with provenance when actor metadata is present

If needed, add `workContexts` to the ticket creation input schema. Keep the input generic and close to the Boroda domain model.

### Acceptance criteria

- a single ticket creation request can create a generic ticket with optional related context
- only `title` is required
- defaults remain consistent with current Boroda behavior
- tests cover at least one agent-style creation case

### Verification

Run:

```bash
npm test
npm run typecheck
```

### Codex prompt

```text
Implement Step 2 from docs/agent-integration-implementation-plan.md.

Goal:
- make Boroda ticket creation suitable for generic agent-driven use
- support optional project links, Jira issue links, and initial work contexts in one creation request

Constraints:
- keep the input generic, not audit-specific
- preserve existing Boroda defaults and semantics
- reuse existing ticket/project/work-context infrastructure

Tasks:
- inspect create ticket schema, routes, and service flow
- extend the request shape only where needed
- support initial work-context creation inside the ticket creation flow
- ensure provenance-aware activity logging still works
- update tests

Run tests and typecheck when done.
```

## Step 3: Add explicit agent-oriented HTTP endpoints or wrappers

### Problem

Boroda’s core HTTP API exists, but agent use should not depend on the web app’s exact route contracts forever.

### Files

- `packages/server/src/app.ts`
- `packages/server/src/modules/agents/` (new)
- existing ticket and work-context services
- API tests

### Required change

Introduce a small agent-facing server module.

Recommended first-pass endpoints:

- `GET /api/agents/projects`
- `GET /api/agents/tickets`
- `GET /api/agents/tickets/:id`
- `POST /api/agents/tickets`
- `PATCH /api/agents/tickets/:id`
- `POST /api/agents/tickets/:id/contexts`
- `POST /api/agents/tickets/:id/activity`

These endpoints may internally delegate to existing services.

The point is to define a stable, narrow surface for agent integration without coupling MCP directly to the web routes.

### Acceptance criteria

- agent-facing routes exist and work locally
- routes delegate to shared services rather than duplicating logic
- the route contracts align with the spec
- tests cover the new routes

### Verification

Run:

```bash
npm test
npm run typecheck
```

### Codex prompt

```text
Implement Step 3 from docs/agent-integration-implementation-plan.md.

Goal:
- create a small, stable, agent-facing HTTP surface on top of existing Boroda services

Constraints:
- do not duplicate ticket business logic
- agent routes should be narrow and explicit
- route contracts should follow docs/agent-integration-spec.md

Tasks:
- add a new server module for agent-facing routes
- wire it into app registration
- delegate reads and writes to existing ticket/project/work-context services
- add route tests

Run tests and typecheck when done.
```

## Step 4: Implement MCP adapter on top of agent-facing services

### Problem

Boroda needs a standard tool interface for Codex and Claude. MCP should adapt onto Boroda services rather than introducing a second business-logic path.

### Files

- `packages/server/package.json`
- `packages/server/src/modules/integrations/mcp/` (new)
- `packages/server/src/index.ts`
- configuration files if needed
- integration tests or focused unit tests

### Required change

Add an MCP server layer exposing the first-pass tool set:

- `boroda.list_projects`
- `boroda.list_tickets`
- `boroda.get_ticket`
- `boroda.create_ticket`
- `boroda.update_ticket`
- `boroda.attach_work_context`
- `boroda.append_activity`

The MCP handlers should call shared services or the new agent-facing service layer.

Avoid:

- duplicating validation rules
- introducing different mutation semantics between HTTP and MCP

### Acceptance criteria

- Boroda can run an MCP server locally
- all first-pass tools are exposed
- MCP uses shared business logic
- at least basic tests exist for tool input/output handling

### Verification

Run:

```bash
npm test
npm run typecheck
```

If a dedicated MCP smoke test command is added, run that too.

### Codex prompt

```text
Implement Step 4 from docs/agent-integration-implementation-plan.md.

Goal:
- expose Boroda’s first-pass agent capabilities through MCP

Constraints:
- MCP is an adapter, not the owner of business logic
- keep the tool surface narrow
- match the contracts defined in docs/agent-integration-spec.md

Tasks:
- add an MCP integration module
- expose list/read/create/update/context/activity tools
- delegate validation and business rules to shared Boroda logic where practical
- add tests or a smoke-test path for MCP tool handling

Run tests and typecheck when done.
```

## Step 5: Add local configuration and developer ergonomics

### Problem

A technically correct MCP server is not enough if running it locally is awkward.

### Files

- `packages/server/src/config.ts`
- `package.json`
- `packages/server/package.json`
- docs as needed

### Required change

Add the minimum developer ergonomics required to run the integration locally.

Recommended items:

- config for enabling the MCP server
- a script for starting the MCP entry point
- clear defaults for local-only usage
- documentation for how Codex/Claude should connect

### Acceptance criteria

- a developer can tell how to run Boroda MCP locally
- scripts and config are discoverable
- default behavior remains safe for a local-only app

### Verification

Run:

```bash
npm run typecheck
```

Run any newly added local startup checks if available.

### Codex prompt

```text
Implement Step 5 from docs/agent-integration-implementation-plan.md.

Goal:
- make the new Boroda agent/MCP integration runnable and understandable locally

Constraints:
- keep configuration minimal
- preserve current Boroda developer workflow

Tasks:
- add scripts/config for starting the MCP integration
- document the local run path
- keep defaults aligned with local-only usage

Run the relevant verification when done.
```

## Step 6: Surface agent-originated activity in the Boroda UI

### Problem

If agent-created tickets and updates are invisible in the existing UI, the integration will feel incomplete.

### Files

- `apps/web/src/components/ticket/`
- `apps/web/src/lib/types.ts`
- any ticket drawer activity rendering helpers
- client tests

### Required change

Update the UI so agent-originated activity and contexts feel native.

Recommended first-pass behavior:

- show agent-originated activity entries with readable copy
- preserve accessible activity rendering
- keep work-context rendering generic
- keep the UI flat, compact, and aligned with existing Boroda patterns
- follow the rules and banned-pattern guidance in `Uncodixify.md`

Do not add a large new agent dashboard in this step.

### Acceptance criteria

- ticket drawer activity makes agent-originated writes understandable
- no regression in ticket drawer rendering
- tests cover the new rendering behavior where appropriate

### Verification

Run:

```bash
npm test
npm run typecheck
```

### Codex prompt

```text
Implement Step 6 from docs/agent-integration-implementation-plan.md.

Goal:
- make agent-originated ticket activity visible and understandable in the existing Boroda UI

Constraints:
- keep the UI integrated with existing ticket drawer patterns
- avoid introducing a separate agent dashboard in this step
- follow existing accessibility and layout rules
- keep the UI flat and compact
- follow Uncodixify.md and stay visually in line with the current Boroda implementation

Tasks:
- inspect how ticket activities are currently rendered
- surface agent provenance in a readable way
- keep work-context rendering generic
- add/update tests

Run tests and typecheck when done.
```

## Step 7: Add end-to-end usage documentation

### Problem

After implementation, the repo needs a single place explaining how an agent should use Boroda in practice.

### Files

- `docs/agent-integration-spec.md`
- additional docs file if needed

### Required change

Add usage guidance covering:

- what tools exist
- when agents should create versus update tickets
- how to attach session context
- what data should be included in generic ticket creation

### Acceptance criteria

- the repo contains a concise operator-facing usage guide
- the guidance reflects the actual implemented tool surface

### Verification

Manual review is acceptable if no code changes are made in this step.

### Codex prompt

```text
Implement Step 7 from docs/agent-integration-implementation-plan.md.

Goal:
- document how agents should use Boroda after the first-pass integration lands

Constraints:
- keep the guidance concise
- align it with the actual implemented contract, not aspirational behavior

Tasks:
- update or add docs describing the final tool surface and expected agent workflow
- ensure examples match the implemented API/MCP behavior
```

## Notes on Scope Control

Do not widen first-pass scope into:

- agent launch orchestration
- project creation by agents
- destructive ticket deletion tools
- background run management
- deduplication heuristics
- branch/worktree automation beyond what Boroda already supports

Those can be planned after the basic create/read/update/context loop is working end to end.
