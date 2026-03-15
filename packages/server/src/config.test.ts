import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

const originalRequestLogging = process.env.BORODA_REQUEST_LOGGING;
const originalMcpEnabled = process.env.BORODA_MCP_ENABLED;
const originalNodeEnv = process.env.NODE_ENV;
const originalNodeTestContext = process.env.NODE_TEST_CONTEXT;

beforeEach(() => {
  process.env.BORODA_REQUEST_LOGGING = originalRequestLogging;
  process.env.BORODA_MCP_ENABLED = originalMcpEnabled;
  process.env.NODE_ENV = originalNodeEnv;
  process.env.NODE_TEST_CONTEXT = originalNodeTestContext;
});

test("request logging defaults off in test runtime", async () => {
  delete process.env.BORODA_REQUEST_LOGGING;
  delete process.env.NODE_ENV;
  process.env.NODE_TEST_CONTEXT = "child-v8";

  const { getConfig } = await import(`./config.ts?case=default-test-runtime-${Date.now()}`);

  assert.equal(getConfig().requestLoggingEnabled, false);
});

test("request logging can be enabled explicitly in test runtime", async () => {
  process.env.BORODA_REQUEST_LOGGING = "true";
  delete process.env.NODE_ENV;
  process.env.NODE_TEST_CONTEXT = "child-v8";

  const { getConfig } = await import(`./config.ts?case=explicit-enable-${Date.now()}`);

  assert.equal(getConfig().requestLoggingEnabled, true);
});

test("request logging can be disabled explicitly outside test runtime", async () => {
  process.env.BORODA_REQUEST_LOGGING = "false";
  process.env.NODE_ENV = "development";
  delete process.env.NODE_TEST_CONTEXT;

  const { getConfig } = await import(`./config.ts?case=explicit-disable-${Date.now()}`);

  assert.equal(getConfig().requestLoggingEnabled, false);
});

test("mcp defaults to disabled", async () => {
  delete process.env.BORODA_MCP_ENABLED;

  const { getConfig } = await import(`./config.ts?case=mcp-disabled-default-${Date.now()}`);

  assert.equal(getConfig().mcpEnabled, false);
});

test("mcp can be enabled explicitly", async () => {
  process.env.BORODA_MCP_ENABLED = "true";

  const { getConfig } = await import(`./config.ts?case=mcp-enabled-${Date.now()}`);

  assert.equal(getConfig().mcpEnabled, true);
});
