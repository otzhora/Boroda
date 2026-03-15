# Boroda

Boroda is a local-first work orchestration tool for managing tickets, projects, workspaces, and manual work context from a single board-style UI.

The repository is a TypeScript monorepo with:

- `apps/web`: React + Vite frontend
- `packages/server`: Fastify + Drizzle + SQLite backend
- `drizzle/migrations`: SQL migrations
- `data/mock-repos`: sample repositories used by seed data and integration flows
- `docs`: product and implementation notes

## What It Does

- Jira-style board with configurable columns
- Ticket CRUD with priorities, descriptions, due dates, and branch metadata
- Project management with linked local folders
- Work context tracking for agent sessions, links, PRs, and manual notes
- Local SQLite persistence
- Optional MCP integration for agent workflows

## Requirements

- Node.js 22 or newer
- npm

## Getting Started

Install dependencies:

```bash
npm install
```

Run the app in development:

```bash
npm run dev
```

This starts:

- the web app in `apps/web`
- the API server in `packages/server`

The server listens on `http://localhost:3000` by default.

## Common Commands

```bash
npm run dev
npm run build
npm run test
npm run lint
npm run typecheck
npm run verify
npm run db:migrate
npm run db:seed
npm run mcp
```

## Data and Runtime Notes

- The backend applies database migrations on startup.
- By default, Boroda stores its SQLite database under the OS-specific app data directory as `boroda.sqlite`.
- Built frontend assets from `apps/web/dist` are served by the backend when present.

Useful environment variables:

- `PORT`: HTTP port for the server, default `3000`
- `HOST`: bind host, default `0.0.0.0`
- `BORODA_DB_PATH`: override the SQLite database path
- `BORODA_UPLOADS_PATH`: override uploads storage
- `BORODA_WORKTREES_PATH`: override managed worktree storage
- `BORODA_MCP_ENABLED`: enable MCP-related behavior

## Repo Structure

```text
.
├── apps/
│   └── web/
├── packages/
│   └── server/
├── drizzle/
│   └── migrations/
├── data/
│   └── mock-repos/
└── docs/
```

## Notes

The repository also includes local planning and integration documents in [`docs/`](./docs), including the implementation blueprint and agent usage guides.
