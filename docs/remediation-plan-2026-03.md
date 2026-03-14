# Boroda Remediation Plan

## Purpose

This document captures the remaining issues after the recent refactors and turns them into a step-by-step execution plan that can be handed to Codex.

The goals are:

- remove the remaining correctness risks
- finish the maintainability cleanup consistently
- avoid reintroducing hidden cache, state, or data-shape bugs

## Working Policy

Adopt a zero-tolerance policy for code smells.

Use this rule during every implementation step:

- if something smells, fix it
- if the fix is small and adjacent to the change being made, fix it in the same step
- if the fix is large, risky, or not meaningfully adjacent to the current change, do not silently expand scope
- instead, call it out explicitly in the final report for that step and add it back into this plan as a new follow-up item

Examples of smells that should be treated seriously:

- duplicated logic
- ambiguous naming
- shape mismatches across layers
- dead code
- unnecessary indirection
- large components or helpers growing past reasonable scope
- type-safety shortcuts
- cache key ambiguity
- repeated inline rendering or state logic that clearly wants extraction

This policy is not permission to do opportunistic rewrites.

The intended behavior is:

- clean up small adjacent smells immediately
- avoid leaving obvious mess in touched code
- keep larger unrelated refactors visible, explicit, and planned

## How Codex Should Apply This Plan

For each step in this document:

1. implement the requested change
2. inspect the touched area for adjacent smells
3. fix the small adjacent ones immediately
4. list any larger or unrelated smells discovered during the step
5. append those larger items to this plan or report them clearly for addition

Do not treat "tests pass" as sufficient if the touched code still obviously smells.

## Current Status

The repo is in materially better shape than before:

- tests pass
- typecheck passes
- ticket service is decomposed
- ticket drawer is decomposed
- board and tickets pages are smaller
- header composition is better
- runtime files are no longer tracked by git

The main remaining issues are:

1. React Query cache key collision between `useTicketsQuery` and `useTicketListQuery`
2. `projects-page.tsx` is still a large monolith
3. duplicated UI state helpers still exist in `jira-page.tsx`
4. noisy request logging still floods local test output
5. `db: any` remains in `packages/server/src/modules/board/columns.ts`
6. `api-client.ts` still has duplicated request logic and rigid JSON assumptions

## Execution Order

Work through these steps in order. Do not batch unrelated refactors together.

### Step 1: Fix the React Query cache-shape bug

#### Problem

`apps/web/src/features/tickets/queries.ts` defines:

- `useTicketsQuery`
- `useTicketListQuery`

Both currently use the same query key factory:

- `ticketsQueryKey(filters)`

But they return different shapes:

- `useTicketsQuery` returns `TicketListItem[]`
- `useTicketListQuery` returns `TicketListResponse`

That means one page can poison the cache for another page.

#### Files

- `apps/web/src/features/tickets/queries.ts`
- `apps/web/src/pages/jira-page.tsx`
- `apps/web/src/pages/tickets-page.tsx`
- any tests covering tickets or Jira page data loading

#### Required change

Split the query keys by response shape.

Recommended structure:

- `ticketListQueryKey(filters)` for `TicketListResponse`
- `ticketItemsQueryKey(filters)` for `TicketListItem[]`

Or remove `useTicketsQuery` entirely if only one shape should exist.

#### Acceptance criteria

- no two query hooks share a key while returning different shapes
- tickets page still receives `meta.jiraIssues`
- Jira page still loads its linkable ticket list
- tests pass

#### Verification

Run:

```bash
npm test
npm run typecheck
```

## Step 2: Finish helper extraction in Jira page

### Problem

`apps/web/src/pages/jira-page.tsx` still duplicates helper logic that already exists elsewhere.

Examples:

- `isTypingTarget`
- `isSearchFocused`
- local search/sort helpers that should live in feature helpers if reused

This is small debt, but it keeps the cleanup inconsistent and makes future changes drift again.

### Files

- `apps/web/src/pages/jira-page.tsx`
- `apps/web/src/features/tickets/url-state.ts`
- optionally create `apps/web/src/features/jira/page-helpers.ts`

### Required change

Move generic reusable helpers out of the page.

Use this rule:

- if logic is generic UI state logic, put it in shared helper modules
- if logic is Jira-page specific, move it into a Jira feature helper file
- keep page components focused on orchestration and rendering

### Acceptance criteria

- Jira page stops defining helpers already present in shared modules
- page size decreases
- no behavior changes

### Verification

Run:

```bash
npm test -- --runInBand
```

Or the repo equivalent:

```bash
npm test
```

## Step 3: Decompose `projects-page.tsx`

### Problem

`apps/web/src/pages/projects-page.tsx` is now the largest remaining UI monolith.

It currently mixes:

- query setup
- optimistic update behavior
- modal state
- create/edit form logic
- folder create/edit logic
- rendering of expanded project rows
- path validation presentation

This is the main remaining maintainability hotspot.

### Files

- `apps/web/src/pages/projects-page.tsx`
- new files under `apps/web/src/features/projects/`
- new files under `apps/web/src/components/project/` if needed

### Required change

Split by responsibility, not by arbitrary file size.

Recommended extraction order:

1. project page helpers
2. project query/mutation hooks
3. project and folder form state helpers
4. project list row/body components
5. project dialogs/modals

Suggested target structure:

```text
apps/web/src/features/projects/
  queries.ts
  mutations.ts
  page-helpers.ts
  optimistic-updates.ts
  forms.ts

apps/web/src/components/project/
  project-list.tsx
  project-row.tsx
  project-expanded-body.tsx
  project-create-dialog.tsx
  project-edit-section.tsx
  project-folder-list.tsx
  project-folder-form.tsx
```

Do not try to perfect the final architecture in one pass. The goal is to remove the monolith and isolate logic.

### Acceptance criteria

- `projects-page.tsx` becomes a thin orchestration page
- optimistic update logic is no longer embedded inline in the page
- project/folder row rendering moves into components
- tests still pass

### Verification

Run:

```bash
npm test
npm run typecheck
```

Add or update tests if needed for extracted behavior.

## Step 4: Remove remaining `any` from board column infrastructure

### Problem

`packages/server/src/modules/board/columns.ts` still uses `db: any` in shared helpers.

This weakens type safety in a core shared path.

### Files

- `packages/server/src/modules/board/columns.ts`
- optionally reuse types from `packages/server/src/modules/tickets/service/shared.ts`

### Required change

Replace `any` with a typed DB executor abstraction similar to the ticket service split.

Recommended pattern:

- define `AppDb`
- define `DbTransaction`
- define `DbExecutor`

Then use `DbExecutor` in:

- `listBoardColumnsFromDb`
- `ensureColumnsForStatuses`

### Acceptance criteria

- no `db: any` remains in board column helpers
- typecheck passes without casts added just to silence errors

### Verification

Run:

```bash
npm run typecheck
```

## Step 5: Gate noisy request logging by environment

### Problem

`packages/server/src/app.ts` logs request start and completion for every request.

That is useful sometimes, but it makes test output noisy and lowers signal.

### Files

- `packages/server/src/app.ts`
- `packages/server/src/config.ts`
- optionally `packages/server/src/shared/observability.ts`

### Required change

Introduce a config flag for request-level logging.

Recommended behavior:

- default to quieter logs in tests
- keep structured logs available
- allow enabling verbose request logs explicitly via env var

One acceptable approach:

- add `requestLoggingEnabled` to config
- disable the request hooks when running under test or when env disables them

Do not remove error logging.

### Acceptance criteria

- failing tests are easier to read
- successful tests do not dump every request by default
- server behavior is unchanged apart from log volume

### Verification

Run:

```bash
npm test
```

Inspect that test output is materially quieter.

## Step 6: Normalize the API client

### Problem

`apps/web/src/lib/api-client.ts` still duplicates request flow between:

- `apiClient`
- `apiClientBlob`

It also assumes JSON success responses too rigidly.

### Files

- `apps/web/src/lib/api-client.ts`
- any tests touching API client behavior

### Required change

Extract a shared internal request helper that handles:

- timing
- fetch execution
- request logging
- error payload parsing

Then layer response parsing on top.

Recommended shape:

- one low-level `performRequest`
- one JSON helper
- one blob helper

Make the JSON path resilient to future `204 No Content` responses.

### Acceptance criteria

- duplicated request/error code is reduced
- behavior remains unchanged for current callers
- future response-type additions become simpler

### Verification

Run:

```bash
npm run typecheck
npm test
```

## Step 7: Optional cleanup pass after the main fixes

Only do this after Steps 1 through 6 are complete.

Potential follow-up cleanup:

- reduce remaining duplicated class-name constants across pages
- extract repeated search control rendering from board/tickets if it keeps drifting
- review `projects-page.tsx` for smaller helper splits still worth doing
- review `jira-page.tsx` for whether `useTicketsQuery()` should be narrowed or paged later

This step is optional because it is polish, not risk reduction.

## Recommended Codex Prompt Sequence

Use separate prompts for each step. Do not ask Codex to do all of this in one pass.

### Prompt 1

```text
Read docs/remediation-plan-2026-03.md and implement Step 1 only.
Fix the React Query cache-key/data-shape collision in apps/web/src/features/tickets/queries.ts.
Do not work on any other step.
Run tests and typecheck after the change and report the result.
```

### Prompt 2

```text
Read docs/remediation-plan-2026-03.md and implement Step 2 only.
Finish helper extraction for apps/web/src/pages/jira-page.tsx.
Do not work on any other step.
Run tests and typecheck after the change and report the result.
```

### Prompt 3

```text
Read docs/remediation-plan-2026-03.md and implement Step 3 only.
Decompose apps/web/src/pages/projects-page.tsx by responsibility without changing behavior.
Keep the page as an orchestrator and extract components/helpers/hooks where appropriate.
Run tests and typecheck after the change and report the result.
```

### Prompt 4

```text
Read docs/remediation-plan-2026-03.md and implement Step 4 only.
Remove the remaining db:any usage from packages/server/src/modules/board/columns.ts using typed DB abstractions.
Run typecheck and tests after the change and report the result.
```

### Prompt 5

```text
Read docs/remediation-plan-2026-03.md and implement Step 5 only.
Gate noisy request logging by environment in the server without removing error logging.
Run tests and confirm the output is quieter.
```

### Prompt 6

```text
Read docs/remediation-plan-2026-03.md and implement Step 6 only.
Refactor apps/web/src/lib/api-client.ts to remove duplicated request flow and make response parsing more resilient.
Run tests and typecheck after the change and report the result.
```

## Definition of Done

This remediation plan is complete when all of the following are true:

- no query hooks share the same key while returning different shapes
- `projects-page.tsx` is no longer the dominant UI monolith
- Jira page no longer duplicates generic shared helpers
- board column helpers are typed
- request logging is quieter during tests
- API client request flow is consolidated
- `npm test` passes
- `npm run typecheck` passes
