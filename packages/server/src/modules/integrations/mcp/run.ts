if (process.env.BORODA_MCP_ENABLED === undefined) {
  process.env.BORODA_MCP_ENABLED = "true";
}

const { runMcpServer } = await import("./stdio");

await runMcpServer();

export {};
