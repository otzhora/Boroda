import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

const originalRequestLogging = process.env.BORODA_REQUEST_LOGGING;
const originalNodeEnv = process.env.NODE_ENV;
const originalNodeTestContext = process.env.NODE_TEST_CONTEXT;

beforeEach(() => {
  process.env.BORODA_REQUEST_LOGGING = originalRequestLogging;
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
