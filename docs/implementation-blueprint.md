# Boroda MVP Implementation Blueprint

## Purpose

This document turns the agreed MVP spec into an implementation-ready blueprint for `boroda`.

The app is a local-only, WSL-first work orchestration tool with a Jira-like board. It runs inside WSL, stores data in SQLite, and is accessed from the Windows browser over `localhost`.

## Product Boundaries

### In scope for MVP

- Local dashboard with Jira-style board
- Ticket CRUD
- Drag/drop ticket status changes
- Logical projects with one or more attached WSL folders
- One ticket linked to multiple projects
- Manual work contexts on tickets, such as PR links, AI sessions, and AWS/manual UI notes
- Local SQLite persistence

### Out of scope for MVP

- Jira sync
- GitHub or GitLab sync
- Automatic PR discovery
- Automatic Codex, Claude, or Cursor ingestion
- AWS API integrations
- Auth and multi-user support
- Desktop packaging
- Configurable statuses in UI

## System Architecture

### Runtime model

- Backend runs inside WSL
- Frontend runs inside WSL during development
- Windows browser accesses the app through `http://localhost:<port>`
- Production MVP serves built frontend assets from the backend process

### Recommended stack

#### Frontend

- React
- Vite
- TypeScript
- React Router
- TanStack Query
- dnd-kit

#### Backend

- Node.js
- Fastify
- TypeScript
- Drizzle ORM
- better-sqlite3
- zod

### Why this architecture

- Stable and low-friction in WSL
- Strong SQLite support
- Clean local filesystem access
- Simple deployment model
- Easy future migration if runtime choices change

## Repository Layout

Suggested monorepo-style layout:

```text
boroda/
  docs/
    implementation-blueprint.md
  apps/
    web/
      index.html
      package.json
      tsconfig.json
      vite.config.ts
      src/
        main.tsx
        app/
          router.tsx
          providers.tsx
        pages/
          board-page.tsx
          projects-page.tsx
        components/
          board/
            board-view.tsx
            board-column.tsx
            ticket-card.tsx
          ticket/
            ticket-drawer.tsx
            ticket-form.tsx
            work-context-list.tsx
          project/
            project-list.tsx
            project-form.tsx
            folder-list.tsx
          ui/
            button.tsx
            input.tsx
            modal.tsx
            drawer.tsx
        features/
          board/
            queries.ts
            mutations.ts
          tickets/
            queries.ts
            mutations.ts
          projects/
            queries.ts
            mutations.ts
        lib/
          api-client.ts
          constants.ts
          types.ts
          utils.ts
        styles/
          globals.css
  packages/
    server/
      package.json
      tsconfig.json
      src/
        index.ts
        app.ts
        config.ts
        plugins/
          db.ts
        db/
          client.ts
          schema.ts
          migrate.ts
          seed.ts
        modules/
          health/
            routes.ts
          board/
            routes.ts
            service.ts
          tickets/
            routes.ts
            service.ts
            schemas.ts
          projects/
            routes.ts
            service.ts
            schemas.ts
          work-contexts/
            routes.ts
            service.ts
            schemas.ts
          fs/
            routes.ts
            service.ts
            schemas.ts
        shared/
          errors.ts
          path-utils.ts
          response.ts
          types.ts
  data/
    .gitkeep
  drizzle/
    migrations/
  package.json
  tsconfig.base.json
```

Notes:

- `apps/web` contains the React UI
- `packages/server` contains the Fastify app and DB logic
- `data/` holds the local SQLite file in development
- `drizzle/migrations` stores generated SQL migrations

## Domain Model

### Project

Logical grouping of work, such as `payments-backend` or `customer-auth`.

Fields:

- `id`
- `name`
- `slug`
- `description`
- `color`
- `created_at`
- `updated_at`

### ProjectFolder

Physical WSL folder attached to a project.

Fields:

- `id`
- `project_id`
- `label`
- `path`
- `kind`
- `is_primary`
- `exists_on_disk`
- `created_at`
- `updated_at`

### Ticket

Primary work item shown on the board.

Fields:

- `id`
- `key`
- `title`
- `description`
- `status`
- `priority`
- `type`
- `due_at`
- `created_at`
- `updated_at`
- `archived_at`

### TicketProjectLink

Join table allowing one ticket to link to multiple projects.

Fields:

- `id`
- `ticket_id`
- `project_id`
- `relationship`
- `created_at`

### WorkContext

Manual attachments for external work references.

Fields:

- `id`
- `ticket_id`
- `type`
- `label`
- `value`
- `meta_json`
- `created_at`
- `updated_at`

### TicketActivity

System-generated or manual event history for a ticket.

Fields:

- `id`
- `ticket_id`
- `type`
- `message`
- `meta_json`
- `created_at`

## Enum Values

### Ticket status

- `INBOX`
- `READY`
- `IN_PROGRESS`
- `BLOCKED`
- `IN_REVIEW`
- `MANUAL_UI`
- `DONE`

These values should be hardcoded for MVP but isolated in one shared constant file so later DB-backed configuration is straightforward.

### Ticket priority

- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

### Ticket type

- `TASK`
- `BUG`
- `CHORE`
- `REVIEW`
- `MANUAL`

### Project folder kind

- `APP`
- `BACKEND`
- `TERRAFORM`
- `INFRA`
- `DOCS`
- `OTHER`

### Ticket-project relationship

- `PRIMARY`
- `RELATED`
- `DEPENDENCY`

### Work context type

- `CODEX_SESSION`
- `CLAUDE_SESSION`
- `CURSOR_SESSION`
- `PR`
- `AWS_CONSOLE`
- `TERRAFORM_RUN`
- `MANUAL_UI`
- `LINK`
- `NOTE`

## Relational Rules

- A project can have many project folders
- A project folder belongs to one project
- A ticket can link to many projects
- A project can be linked from many tickets
- A ticket can have many work contexts
- A ticket can have many activity entries
- A ticket should have at most one `PRIMARY` project link in MVP

## SQLite Schema Blueprint

### `projects`

```sql
create table projects (
  id integer primary key autoincrement,
  name text not null,
  slug text not null unique,
  description text not null default '',
  color text not null default '',
  created_at text not null,
  updated_at text not null
);
```

### `project_folders`

```sql
create table project_folders (
  id integer primary key autoincrement,
  project_id integer not null references projects(id) on delete cascade,
  label text not null,
  path text not null unique,
  kind text not null,
  is_primary integer not null default 0,
  exists_on_disk integer not null default 1,
  created_at text not null,
  updated_at text not null
);
```

### `tickets`

```sql
create table tickets (
  id integer primary key autoincrement,
  key text not null unique,
  title text not null,
  description text not null default '',
  status text not null,
  priority text not null,
  type text not null,
  due_at text,
  created_at text not null,
  updated_at text not null,
  archived_at text
);
```

### `ticket_project_links`

```sql
create table ticket_project_links (
  id integer primary key autoincrement,
  ticket_id integer not null references tickets(id) on delete cascade,
  project_id integer not null references projects(id) on delete cascade,
  relationship text not null,
  created_at text not null
);
```

Recommended unique constraint:

- unique pair on `(ticket_id, project_id)`

### `work_contexts`

```sql
create table work_contexts (
  id integer primary key autoincrement,
  ticket_id integer not null references tickets(id) on delete cascade,
  type text not null,
  label text not null,
  value text not null,
  meta_json text not null default '{}',
  created_at text not null,
  updated_at text not null
);
```

### `ticket_activities`

```sql
create table ticket_activities (
  id integer primary key autoincrement,
  ticket_id integer not null references tickets(id) on delete cascade,
  type text not null,
  message text not null,
  meta_json text not null default '{}',
  created_at text not null
);
```

### Suggested indexes

```sql
create index idx_tickets_status_priority_updated
  on tickets(status, priority, updated_at);

create index idx_project_folders_project_id
  on project_folders(project_id);

create index idx_ticket_project_links_ticket_id
  on ticket_project_links(ticket_id);

create index idx_ticket_project_links_project_id
  on ticket_project_links(project_id);

create index idx_work_contexts_ticket_id
  on work_contexts(ticket_id);
```

## Drizzle Table Design

Suggested ownership:

- `packages/server/src/db/schema.ts` defines all tables and relations
- module services use typed queries from the shared schema
- enums are represented as string literals in TypeScript and validated through `zod`

Implementation notes:

- timestamps stored as ISO strings for simplicity in SQLite
- `meta_json` stored as text and parsed in service layer
- keep schema flat and explicit; avoid premature abstraction

## API Contract

Base path: `/api`

### Health

- `GET /health`

Response:

```json
{
  "ok": true
}
```

### Projects

- `GET /projects`
- `POST /projects`
- `GET /projects/:id`
- `PATCH /projects/:id`
- `DELETE /projects/:id`

Create request example:

```json
{
  "name": "payments-backend",
  "slug": "payments-backend",
  "description": "Main backend system",
  "color": "#355c7d"
}
```

### Project folders

- `POST /projects/:id/folders`
- `PATCH /project-folders/:id`
- `DELETE /project-folders/:id`

Create request example:

```json
{
  "label": "terraform",
  "path": "/home/otzhora/projects/payments-terraform",
  "kind": "TERRAFORM",
  "isPrimary": false
}
```

Response should include validated path metadata:

```json
{
  "id": 2,
  "projectId": 1,
  "label": "terraform",
  "path": "/home/otzhora/projects/payments-terraform",
  "kind": "TERRAFORM",
  "isPrimary": false,
  "existsOnDisk": true
}
```

### Tickets

- `GET /tickets`
- `POST /tickets`
- `GET /tickets/:id`
- `PATCH /tickets/:id`
- `DELETE /tickets/:id`

Query filters:

- `status`
- `priority`
- `projectId`
- `q`

Create request example:

```json
{
  "title": "Finish backend refactor and terraform update",
  "description": "Need app repo changes and infra follow-up",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "type": "TASK",
  "projectLinks": [
    { "projectId": 1, "relationship": "PRIMARY" },
    { "projectId": 2, "relationship": "RELATED" }
  ]
}
```

### Ticket-project links

- `POST /tickets/:id/projects`
- `DELETE /ticket-project-links/:id`

### Board

- `GET /board`

Query filters:

- `projectId`
- `priority`
- `q`

Response shape example:

```json
{
  "columns": [
    {
      "status": "IN_PROGRESS",
      "label": "In Progress",
      "tickets": [
        {
          "id": 7,
          "key": "BRD-7",
          "title": "Finish backend refactor and terraform update",
          "priority": "HIGH",
          "projectBadges": [
            { "id": 1, "name": "payments-backend", "relationship": "PRIMARY" },
            { "id": 2, "name": "payments-terraform", "relationship": "RELATED" }
          ],
          "updatedAt": "2026-02-28T18:00:00.000Z"
        }
      ]
    }
  ]
}
```

### Work contexts

- `POST /tickets/:id/contexts`
- `PATCH /work-contexts/:id`
- `DELETE /work-contexts/:id`

Create request example:

```json
{
  "type": "AWS_CONSOLE",
  "label": "prod ecs check",
  "value": "https://console.aws.amazon.com/ecs/home",
  "meta": {
    "note": "Manual verification needed after deploy"
  }
}
```

### Filesystem utility routes

- `POST /fs/validate-path`

Request:

```json
{
  "path": "/home/otzhora/projects/payments-backend"
}
```

Response:

```json
{
  "path": "/home/otzhora/projects/payments-backend",
  "resolvedPath": "/home/otzhora/projects/payments-backend",
  "exists": true,
  "isDirectory": true
}
```

## Validation and Error Handling

### Path validation rules

- path must be absolute
- path must be normalized before storage
- path should resolve safely inside WSL
- path does not need to remain present forever; old records stay valid even if folder is missing later

### API validation

- all mutating endpoints validate request payloads with `zod`
- parse and validate route params
- return consistent error objects

Suggested error shape:

```json
{
  "error": {
    "code": "INVALID_PATH",
    "message": "Path does not exist",
    "details": {}
  }
}
```

### Server-side path utility functions

Implement shared helpers in `packages/server/src/shared/path-utils.ts`:

- `normalizeWslPath(input: string): string`
- `validateAbsolutePath(path: string): boolean`
- `resolvePathInfo(path: string): Promise<PathInfo>`

## Frontend Blueprint

### Routes

- `/` -> board page
- `/projects` -> projects page

Ticket detail opens in a drawer, not a separate route in MVP.

### Board page responsibilities

- fetch board data
- render summary cards
- render filters
- render kanban columns
- open ticket drawer
- support drag/drop status changes
- provide quick-create ticket interaction

### Ticket drawer responsibilities

- edit title and description
- edit status, priority, and type
- manage linked projects
- show linked project folders
- manage work contexts
- show activity list

### Projects page responsibilities

- list projects
- create/edit/delete projects
- attach/remove project folders
- run path validation before folder save

### State management

- TanStack Query for server state
- local component state for forms and drawer state
- no global state library needed in MVP

## UI Component Plan

### Board components

- `BoardPage`
- `BoardView`
- `BoardColumn`
- `TicketCard`
- `BoardFilters`
- `QuickCreateTicket`

### Ticket components

- `TicketDrawer`
- `TicketForm`
- `ProjectLinkEditor`
- `WorkContextList`
- `ActivityTimeline`

### Project components

- `ProjectsPage`
- `ProjectList`
- `ProjectForm`
- `FolderList`
- `FolderForm`

## Ticket Card Data Shape

The board should not fetch excessive detail for every card. Keep board payload compact.

Recommended card fields:

- `id`
- `key`
- `title`
- `status`
- `priority`
- `type`
- `projectBadges`
- `contextsCount`
- `updatedAt`

Detailed ticket data can be fetched when the drawer opens.

## Board UX Rules

- status column order is fixed in MVP
- card drag updates ticket status immediately
- optimistic UI is allowed, but failed updates must roll back
- column ordering within a status is derived from priority and recent update time
- no manual per-column ordering in MVP

## Ticket Key Strategy

Use a local monotonic sequence:

- `BRD-1`
- `BRD-2`
- `BRD-3`

Implementation options:

- simple sequence table in SQLite
- generate from max existing numeric suffix in early MVP

Recommendation:

- start with a dedicated sequence approach to avoid racey key generation later

## Activity Logging

Write activity entries for:

- ticket created
- status changed
- priority changed
- project link added or removed
- work context added or removed

MVP can auto-generate simple human-readable messages.

## WSL-Specific Rules

These constraints should be treated as first-class.

- Store only WSL absolute paths in the database
- Run the database file inside the WSL filesystem, not on a mounted Windows drive
- Bind the server host explicitly for localhost access from Windows
- Prefer manual validated path input over browser folder pickers in MVP
- Treat backend path validation as authoritative

## `.boroda` Strategy

`.boroda` is optional and not required for MVP.

Future uses:

- repo-local metadata
- cached repo inspection results
- local notes
- machine-specific integration data

Current rule:

- central SQLite remains the system of record

## Initial Delivery Plan

### Phase 1: Foundation

- scaffold workspace
- configure shared TypeScript settings
- set up Fastify server
- set up React app
- add Drizzle, SQLite, and migrations
- add health route

### Phase 2: Projects

- implement `projects` table and CRUD
- implement `project_folders` table and CRUD
- add WSL path validation route
- build basic Projects page

### Phase 3: Tickets

- implement `tickets` and `ticket_project_links`
- build ticket CRUD
- support linking multiple projects to one ticket
- add activity log writes

### Phase 4: Board

- implement grouped board query
- build board page
- add drag/drop status changes
- add filters and quick create

### Phase 5: Work Contexts

- implement `work_contexts`
- add ticket drawer editing for contexts
- support PR, session, and manual UI references

### Phase 6: Polish

- improve empty and error states
- add keyboard shortcuts
- add backup/export
- add lightweight seed data for local testing

## Bootstrap Flow

Expected development flow:

1. install dependencies
2. generate or apply DB migrations
3. start backend in WSL
4. start frontend in WSL
5. open app in Windows browser

Expected production-like local flow:

1. build frontend assets
2. start backend server
3. backend serves API and static frontend

## Suggested Implementation Order

If coding starts immediately after this document, the first build pass should happen in this order:

1. workspace scaffold and tooling
2. Drizzle schema and migration generation
3. project and folder routes
4. ticket routes and relations
5. board endpoint
6. React board shell
7. ticket drawer
8. project management page
9. work context editing

## Open Upgrade Paths

Planned later without redesigning the core model:

- configurable statuses stored in DB
- automatic repo inspection
- `.boroda` metadata support
- session ingestion for Codex, Claude, and Cursor
- Git hosting integrations
- AWS integration helpers
- desktop packaging if local browser workflow stops being sufficient
