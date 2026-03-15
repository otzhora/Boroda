import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient, apiClientVoid } from "./api-client";

describe("apiClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns undefined for empty successful responses via apiClientVoid", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiClientVoid("/api/example")).resolves.toBeUndefined();
  });

  it("rejects empty successful responses when JSON is expected", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiClient("/api/example")).rejects.toThrow("Expected a JSON response body but received an empty response.");
  });

  it("falls back to a generic API error when an error response is not JSON", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("upstream failed", { status: 502, statusText: "Bad Gateway" }));

    await expect(apiClient("/api/example")).rejects.toMatchObject({
      message: "Request failed: 502",
      statusCode: 502,
      code: undefined,
      details: undefined
    } satisfies Partial<ApiError>);
  });
});
