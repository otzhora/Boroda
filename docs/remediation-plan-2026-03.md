# Boroda Remediation Plan

## Purpose

This document turns the current audit findings into an execution plan that can be handed to Codex step by step.

The goals are:

- remove maintainability hotspots before they harden
- reduce unnecessary coupling across UI and server modules
- fix structural smells even when tests currently pass
- keep the local-only app easy to expand without fear

## Working Policy

Adopt a zero-tolerance policy for code smells.

Use this rule during every implementation step:

- if something smells and the fix is small and adjacent, fix it in the same step
- if the fix is larger or not adjacent, do not silently widen scope
- instead, report it explicitly and add it back into this plan

Examples of smells that matter in this repo:

- duplicated orchestration logic across pages
- large files mixing unrelated responsibilities
- server modules that combine OS, DB, and business logic
- client hooks that fetch broader data than the feature actually needs
- type contracts that promise more than runtime code actually supports
- repeated timestamp helpers and repeated query/filter plumbing

Do not treat "tests pass" as proof that the code is healthy.

## Current Status

The repo is passing checks:

- `npm test` passes
- `npm run typecheck` passes

The main remaining issues from the audit are:

1. Jira page loads the full ticket list for linking and filters it client-side
2. Tickets page still renders a non-virtualized full table and remains a large orchestration page
3. Board, Tickets, and Jira pages duplicate search/header/keyboard behavior
4. `packages/server/src/modules/integrations/open-in/service.ts` is a god module
5. project archive/restore logic duplicates sibling-project query rules
6. board column reordering uses noisy multi-pass row updates
7. `apps/web/src/lib/api-client.ts` is still type-unsound and too rigid about JSON
8. projects page complexity mostly moved into a large controller hook and prop-heavy boundaries
9. the repo has no lint or structural guardrail step

## How Codex Should Apply This Plan

For each step in this document:

1. implement only that step
2. fix small adjacent smells discovered while touching the same area
3. do not batch unrelated refactors
4. run the requested verification
5. report any newly discovered follow-up items

Use separate Codex prompts per step.

## Execution Order

Work through these steps in order.

### Step 1: Narrow Jira ticket linking data flow

#### Problem

`apps/web/src/pages/jira-page.tsx` currently calls `useTicketsQuery()` with no narrowing and filters the result on the client.

That creates avoidable coupling between the Jira page and the generic ticket list query, and it scales badly as ticket count grows.

#### Files

- `apps/web/src/pages/jira-page.tsx`
- `apps/web/src/features/tickets/queries.ts`
- optionally add a Jira-specific ticket lookup hook under `apps/web/src/features/jira/`
- related tests for Jira page data loading

#### Required change

Replace the broad "load everything, then filter in the page" approach with a narrower query shape.

Acceptable approaches:

- create a dedicated hook for linkable ticket options
- add explicit server-side filtering for the Jira linking flow
- reuse the existing ticket list endpoint only if the query is intentionally narrowed and the response shape is appropriate

The important rule is:

- Jira page should fetch only what it needs for linking existing tickets
- page-level code should stop owning broad list filtering that belongs in the data layer

#### Acceptance criteria

- Jira page no longer fetches the full unbounded ticket inventory by default
- link-existing behavior still works
- no cache-shape regressions are introduced
- tests pass

#### Verification

Run:

```bash
npm test
npm run typecheck
```

### Step 2: Extract shared page command-bar behavior

#### Problem

Board, Tickets, and Jira pages duplicate:

- search input rendering
- keyboard shortcut handling
- header action composition

These implementations are already drifting.

#### Files

- `apps/web/src/pages/board-page.tsx`
- `apps/web/src/pages/tickets-page.tsx`
- `apps/web/src/pages/jira-page.tsx`
- `apps/web/src/features/tickets/url-state.ts`
- optionally create shared helpers/components under `apps/web/src/components/ui/` or `apps/web/src/features/`

#### Required change

Extract the repeated command-bar/search/shortcut behavior into shared primitives.

Use this rule:

- generic search focus and keyboard behavior goes into shared helpers/hooks
- page-specific filter controls stay page-specific
- page components should orchestrate, not redefine the same command-bar behavior

Good extraction targets:

- reusable search field shell
- reusable search hotkey hook
- reusable header actions wrapper for host/fallback rendering

#### Acceptance criteria

- duplicated keyboard shortcut logic is materially reduced
- duplicated search control rendering is materially reduced
- Board, Tickets, and Jira behavior stays unchanged
- page files get smaller and more focused

#### Verification

Run:

```bash
npm test
npm run typecheck
```

### Step 3: Decompose the Tickets page and add list virtualization

#### Problem

`apps/web/src/pages/tickets-page.tsx` is still large and renders the full table body directly.

That is both a maintainability hotspot and a clear performance smell once the ticket count grows.

#### Files

- `apps/web/src/pages/tickets-page.tsx`
- `apps/web/src/features/tickets/`
- `apps/web/src/components/ticket/`
- related tests for tickets page behavior

#### Required change

Split the page by responsibility and introduce virtualization for the ticket list.

Recommended extraction order:

1. filter/search/scope controller logic
2. ticket table header and row rendering
3. empty/error/loading state sections
4. virtualized list body

Do not over-engineer a generic table system.
The goal is a focused tickets feature structure with a virtualized list that preserves current behavior.

#### Acceptance criteria

- `tickets-page.tsx` becomes a thinner orchestration page
- ticket rows are not all rendered at once for large lists
- selection, sorting, filtering, and drawer behavior stay unchanged
- tests pass

#### Verification

Run:

```bash
npm test
npm run typecheck
```

Add or update tests for the extracted behavior if needed.

### Step 4: Decompose open-in server service

#### Problem

`packages/server/src/modules/integrations/open-in/service.ts` currently mixes:

- OS/platform detection
- launcher argument construction
- Windows Terminal settings discovery
- workspace resolution
- DB updates
- ticket activity writes
- high-level open-in orchestration

It is already too coupled to evolve safely.

#### Files

- `packages/server/src/modules/integrations/open-in/service.ts`
- existing sibling files in `packages/server/src/modules/integrations/open-in/`
- optionally new files under that same folder
- relevant tests around open-in behavior

#### Required change

Split by responsibility, not by arbitrary line count.

Recommended target structure:

```text
packages/server/src/modules/integrations/open-in/
  service.ts
  launchers.ts
  windows-terminal.ts
  workspace-resolution.ts
  activity.ts
  types.ts
```

Rules:

- `service.ts` should remain the orchestration entry point
- OS-specific launch behavior should move out
- workspace preparation and DB persistence should not be mixed with launcher detection

#### Acceptance criteria

- `service.ts` is substantially smaller
- launcher logic and workspace logic are separated
- behavior is unchanged
- tests pass

#### Verification

Run:

```bash
npm test
npm run typecheck
```

### Step 5: Deduplicate project archive and restore rules

#### Problem

`packages/server/src/modules/projects/service.ts` contains nearly duplicated logic for:

- finding tickets to archive when archiving a project
- finding tickets to restore when restoring a project

This is business-rule duplication in a sensitive path.

#### Files

- `packages/server/src/modules/projects/service.ts`
- related project and ticket tests

#### Required change

Extract the shared sibling-project decision logic into one helper with explicit parameters.

The helper should make the rule obvious:

- start from tickets linked to this project in one archive state
- exclude tickets that still have another active linked project
- return the final ticket ids to archive or restore

Prefer one clear helper over two similar functions.

#### Acceptance criteria

- duplicated project archive/restore query logic is removed
- resulting helper names make the rule easier to understand
- project archive/restore behavior is unchanged
- tests pass

#### Verification

Run:

```bash
npm test
npm run typecheck
```

### Step 6: Simplify board column reorder mechanics

#### Problem

`packages/server/src/modules/board/columns.ts` reorders columns with noisy multi-pass updates.

It works, but the intent is harder to read than it needs to be.

#### Files

- `packages/server/src/modules/board/columns.ts`
- board tests

#### Required change

Refactor reorder operations into one clearer shared primitive.

Possible directions:

- compute the final ordered column list in memory, then persist final positions once
- extract shared reorder persistence helper used by insert and delete paths

Do not optimize for SQL cleverness.
Optimize for clarity and single-source-of-truth behavior.

#### Acceptance criteria

- insert/delete reorder behavior stays unchanged
- repeated multi-pass update logic is materially reduced
- code becomes easier to reason about
- tests pass

#### Verification

Run:

```bash
npm test
npm run typecheck
```

### Step 7: Tighten the API client contract

#### Problem

`apps/web/src/lib/api-client.ts` has two maintainability problems:

- generic JSON helpers can return `undefined as T`
- success handling assumes JSON for any non-empty body

That makes the type contract looser and more misleading than it should be.

#### Files

- `apps/web/src/lib/api-client.ts`
- `apps/web/src/lib/api-client.test.ts`
- any callers that depend on current behavior

#### Required change

Refactor the API client so its runtime contract and TypeScript contract match more honestly.

Recommended direction:

- keep one shared request executor
- make JSON parsing explicit rather than implied for all successful responses
- handle empty-body responses without pretending they are arbitrary `T`
- keep blob handling as a thin typed layer on top

If needed, introduce separate helpers for:

- JSON responses
- empty responses
- blob responses

#### Acceptance criteria

- no `undefined as T` remains
- response parsing behavior is explicit
- current callers still work or are updated intentionally
- tests pass

#### Verification

Run:

```bash
npm test
npm run typecheck
```

### Step 8: Finish project page decomposition

#### Problem

The projects page is improved, but complexity mainly moved into `useProjectsPageController` and into a prop-heavy `ProjectListItem` boundary.

That is better than one monolith, but still harder to extend than necessary.

#### Files

- `apps/web/src/pages/projects-page.tsx`
- `apps/web/src/features/projects/use-projects-page-controller.ts`
- `apps/web/src/components/project/project-list-item.tsx`
- related project components and tests

#### Required change

Further split the projects feature by domain responsibility.

Recommended extraction order:

1. separate URL/scope state from form/editing state
2. extract project-row orchestration from folder-row orchestration
3. reduce prop surface passed into `ProjectListItem`
4. move mutation side-effect bookkeeping closer to feature-specific hooks

The target is not "many tiny files".
The target is explicit boundaries with smaller public surfaces.

#### Acceptance criteria

- controller hook becomes meaningfully smaller
- `ProjectListItem` receives a smaller, clearer prop surface
- page remains a thin orchestrator
- tests pass

#### Verification

Run:

```bash
npm test
npm run typecheck
```

### Step 9: Add lint and structural guardrails

#### Problem

The repo currently relies on tests and typecheck only.

That does not enforce:

- dead-code cleanup
- duplication warnings
- unsafe type shortcuts
- consistent import/style hygiene

With a zero-smell policy, this is a process gap.

#### Files

- root `package.json`
- workspace `package.json` files
- new lint config files as needed

#### Required change

Add a lightweight lint/quality gate that fits the repo.

Minimum target:

- one root `lint` script
- workspace lint scripts
- rules for unused code, unsafe suppressions, and obvious hygiene failures

Optional additions if they stay pragmatic:

- import ordering
- simple complexity caps for extreme files
- CI-friendly `verify` integration

Do not turn this into config theater.
Choose the smallest useful guardrail set.

#### Acceptance criteria

- repo has a `lint` command
- lint can run at root and workspace level
- `verify` can include lint without becoming brittle
- docs or scripts make the quality gate obvious

#### Verification

Run:

```bash
npm run lint
npm run verify
```

## Suggested Codex Prompt Sequence

Use separate prompts. Do not ask Codex to do the whole plan in one pass.

### Prompt 1 -- Done

```text
Read docs/remediation-plan-2026-03.md and implement Step 1 only.
Narrow the Jira ticket-linking data flow so apps/web/src/pages/jira-page.tsx no longer loads and filters the full ticket inventory by default.
Do not work on any other step.
Run tests and typecheck after the change and report the result.
```

### Prompt 2 -- Done

```text
Read docs/remediation-plan-2026-03.md and implement Step 2 only.
Extract the duplicated command-bar, search, and keyboard shortcut behavior shared by the Board, Tickets, and Jira pages.
Do not work on any other step.
Run tests and typecheck after the change and report the result.
```

### Prompt 3 -- Done

```text
Read docs/remediation-plan-2026-03.md and implement Step 3 only.
Decompose apps/web/src/pages/tickets-page.tsx and add virtualization for the ticket list without changing behavior.
Do not work on any other step.
Run tests and typecheck after the change and report the result.
```

### Prompt 4

```text
Read docs/remediation-plan-2026-03.md and implement Step 4 only.
Decompose packages/server/src/modules/integrations/open-in/service.ts by responsibility while keeping service.ts as the orchestration entry point.
Do not work on any other step.
Run tests and typecheck after the change and report the result.
```

### Prompt 5

```text
Read docs/remediation-plan-2026-03.md and implement Step 5 only.
Deduplicate the project archive and restore rules in packages/server/src/modules/projects/service.ts without changing behavior.
Do not work on any other step.
Run tests and typecheck after the change and report the result.
```

### Prompt 6

```text
Read docs/remediation-plan-2026-03.md and implement Step 6 only.
Simplify the board column reorder mechanics in packages/server/src/modules/board/columns.ts so insert/delete paths share a clearer reorder primitive.
Do not work on any other step.
Run tests and typecheck after the change and report the result.
```

### Prompt 7

```text
Read docs/remediation-plan-2026-03.md and implement Step 7 only.
Tighten the API client contract in apps/web/src/lib/api-client.ts so its runtime behavior and TypeScript behavior match more honestly.
Do not work on any other step.
Run tests and typecheck after the change and report the result.
```

### Prompt 8

```text
Read docs/remediation-plan-2026-03.md and implement Step 8 only.
Finish the project page decomposition by shrinking useProjectsPageController and reducing the prop surface of ProjectListItem.
Do not work on any other step.
Run tests and typecheck after the change and report the result.
```

### Prompt 9

```text
Read docs/remediation-plan-2026-03.md and implement Step 9 only.
Add pragmatic lint and structural guardrails to the repo and integrate them into the verification flow.
Do not work on any other step.
Run lint, tests, and typecheck after the change and report the result.
```

## Definition of Done

This plan is complete when all of the following are true:

- Jira page no longer depends on a broad unbounded ticket fetch for linking
- shared command-bar behavior is extracted instead of copied across pages
- tickets page is thinner and uses virtualization for larger lists
- open-in server logic is decomposed by responsibility
- project archive and restore business rules have one clear shared source
- board column reorder logic is simpler and less repetitive
- API client contracts are explicit and type-honest
- project page orchestration surfaces are smaller and clearer
- the repo has lint/quality guardrails in addition to tests and typecheck
- `npm test` passes
- `npm run typecheck` passes
