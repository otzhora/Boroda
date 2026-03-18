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
When running the monorepo dev command, the Vite frontend proxy follows `BORODA_SERVER_PORT` or `PORT`, then falls back to `3000`.

## Common Commands

```bash
npm run dev
npm run dev:ensure
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
- `BORODA_SERVER_PORT`: optional frontend-proxy override for dev; use this if you want the web app to target a different backend port without changing any other process
- `BORODA_DEV_PORT`: optional detached dev launcher backend port override; useful if you want Boroda to stay off common project ports like `3000`
- `BORODA_WEB_PORT`: optional detached dev launcher web port override, default `5173`
- `HOST`: bind host, default `0.0.0.0`
- `BORODA_DB_PATH`: override the SQLite database path
- `BORODA_UPLOADS_PATH`: override uploads storage
- `BORODA_WORKTREES_PATH`: override managed worktree storage
- `BORODA_MCP_ENABLED`: enable MCP-related behavior

## Detached Dev Launcher

If you want Boroda available throughout the workday without interfering with other projects, prefer the detached launcher over embedding process control directly in `.zshrc`:

```bash
BORODA_DEV_PORT=2222 npm run dev:ensure
```

The launcher:

- checks `http://127.0.0.1:<port>/api/health`
- checks the Vite web server on `http://127.0.0.1:5173` by default
- backs off if Boroda is already running
- starts `npm run dev` with `nohup` if it is not running
- writes logs to `.boroda/run/boroda-dev.log`

If you want a shell hook, call the launcher from `.zprofile` or `.zshrc` instead of inlining the startup logic there:

```bash
boroda_ensure_running() {
  BORODA_DEV_PORT=2222 /home/otzhora/projects/codex_projects/boroda/scripts/ensure-dev.sh >/dev/null 2>&1
}

boroda_ensure_running &
```

`.zprofile` is usually the cleaner place if you want this to happen once per login shell. `.zshrc` also works because the launcher backs off cleanly when Boroda is already up.

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
