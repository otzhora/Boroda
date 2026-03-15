# Boroda MCP Local Setup

Boroda's MCP server is local-only and uses stdio. It is disabled by default and is meant to be started by the MCP client when needed.

Important: MCP stdio must stay clean. Plain `npm run mcp` can write npm lifecycle text to stdout before the MCP protocol begins, which can break the handshake for some clients.

## Preconditions

Before configuring an MCP client on a new machine:

1. Clone the Boroda repo.
2. Install dependencies from the repo root:

```bash
npm install
```

3. Confirm Node is available:

```bash
node --version
```

The launcher script uses `node` from `PATH` when available and falls back to `~/.nvm/versions/node/*/bin/node` when possible.

## Normal Boroda Dev Run

The regular local development workflow is unchanged:

```bash
npm run dev
```

That starts the web app and HTTP server. It does not start MCP.

## MCP Launch Command

For MCP clients, use the silent launcher from the repo root:

```bash
./scripts/run-mcp.sh
```

This is the recommended command because it avoids npm stdout noise and starts the correct stdio entrypoint directly.

You do not need to run it manually before launching Codex, Claude Code, or another MCP client. In normal use, the MCP client starts Boroda itself.

Run it manually only when debugging startup behavior:

```bash
./scripts/run-mcp.sh
```

When started manually, it should stay quiet and wait for MCP messages on stdin.

## Optional Environment Overrides

Useful defaults:

- MCP shares the normal Boroda database and storage paths unless you override them.
- `BORODA_MCP_ENABLED` defaults to `false`, so MCP does not start accidentally from the raw stdio entry point.
- `BORODA_REQUEST_LOGGING=false` is useful if you want quieter local runs.

Examples:

```bash
BORODA_DB_PATH=/tmp/boroda-agent.sqlite ./scripts/run-mcp.sh
BORODA_REQUEST_LOGGING=false ./scripts/run-mcp.sh
```

## Smoke Check

To verify the local MCP handshake and tool registration:

```bash
npm run mcp:smoke
```

This runs an isolated startup check, calls MCP `initialize` and `tools/list`, and verifies the expected Boroda tool surface.

## Codex Setup

From the repo root:

```bash
codex mcp add boroda -- "$(pwd)/scripts/run-mcp.sh"
```

After that, verify the registered command:

```bash
codex mcp get boroda
```

If you prefer to edit `~/.codex/config.toml` manually:

```toml
[mcp_servers.boroda]
command = "/absolute/path/to/boroda/scripts/run-mcp.sh"
startup_timeout_sec = 30
```

## Claude Code Setup

From the repo root:

```bash
claude mcp add boroda -- "$(pwd)/scripts/run-mcp.sh"
```

If the client supports JSON config instead of a CLI helper, use the same absolute script path.

## Generic MCP Client Config

If your client supports a working directory:

```json
{
  "mcpServers": {
    "boroda": {
      "command": "/absolute/path/to/boroda/scripts/run-mcp.sh",
      "cwd": "/absolute/path/to/boroda"
    }
  }
}
```

If you prefer not to use the wrapper script, use a direct Node command with absolute paths:

```json
{
  "mcpServers": {
    "boroda": {
      "command": "/absolute/path/to/node",
      "args": [
        "--import",
        "/absolute/path/to/boroda/node_modules/tsx/dist/loader.mjs",
        "/absolute/path/to/boroda/packages/server/src/modules/integrations/mcp/run.ts"
      ],
      "cwd": "/absolute/path/to/boroda"
    }
  }
}
```

This direct form is useful on machines where shell startup, `PATH`, or wrapper execution is unreliable.

## Troubleshooting

If the MCP client fails to start Boroda:

1. Run `codex mcp get boroda` or the equivalent client inspection command and confirm it points at the expected command.
2. Run `./scripts/run-mcp.sh` manually from the repo root and confirm it stays quiet.
3. Run `npm run mcp:smoke` and confirm it passes.
4. If using the direct Node form, make sure the Node binary and `tsx` loader paths are absolute and still valid on that machine.
5. Avoid `npm run mcp` as the MCP client command unless you have verified it produces no stdout noise in that environment.
