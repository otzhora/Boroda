# Boroda MCP Local Run Path

Boroda's MCP server is local-only and uses stdio. It is off by default in config and only enabled by the dedicated start script.

## Start Boroda normally

The existing developer workflow does not change:

```bash
npm run dev
```

That starts the web app and HTTP server only.

## Start Boroda MCP

From the repo root:

```bash
npm run mcp
```

This runs `@boroda/server`'s MCP stdio entry point and sets `BORODA_MCP_ENABLED=true` for that process only.

Useful defaults:

- MCP shares the normal Boroda database and storage paths unless you override them.
- `BORODA_MCP_ENABLED` defaults to `false`, so MCP does not start accidentally from the raw stdio entry point.
- `BORODA_REQUEST_LOGGING=false` is reasonable for local client integration if you want quieter output.

Common local overrides:

```bash
BORODA_DB_PATH=/tmp/boroda-agent.sqlite npm run mcp
BORODA_REQUEST_LOGGING=false npm run mcp
```

## Smoke Check

To verify the local MCP handshake and tool registration:

```bash
npm run mcp:smoke
```

This runs an isolated temp-database startup check with `BORODA_MCP_ENABLED=true`, calls MCP `initialize` and `tools/list` in-process, and verifies the expected Boroda tool surface.

## MCP Client Config

Any MCP client that supports stdio can point at the root script.

### Codex CLI

Add Boroda to Codex with:

```bash
codex mcp add boroda -- npm --prefix /home/otzhora/projects/codex_projects/boroda run mcp
```

### Claude Code

Add Boroda to Claude Code with:

```bash
claude mcp add boroda -- npm --prefix /home/otzhora/projects/codex_projects/boroda run mcp
```

Both commands use the same repo-root `npm run mcp` entrypoint and avoid depending on per-client working-directory support.

If the client supports a working directory:

```json
{
  "mcpServers": {
    "boroda": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/home/otzhora/projects/codex_projects/boroda"
    }
  }
}
```

If the client does not support `cwd`, use npm's prefix flag:

```json
{
  "mcpServers": {
    "boroda": {
      "command": "npm",
      "args": ["--prefix", "/home/otzhora/projects/codex_projects/boroda", "run", "mcp"]
    }
  }
}
```

That is the intended local connection path for Codex, Claude, or any similar MCP client.
