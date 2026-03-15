import { logClientError, logClientEvent } from "./logger";

interface ErrorResponse {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

class InvalidApiResponseError extends Error {
  constructor(message: string) {
    super(message);
  }
}

interface RequestLogContext {
  method: string;
  path: string;
  startedAt: number;
}

function createRequestContext(path: string, init?: RequestInit): RequestLogContext {
  return {
    method: init?.method ?? "GET",
    path,
    startedAt: performance.now()
  };
}

function withRequestHeaders(init?: RequestInit): RequestInit | undefined {
  const headers = new Headers(init?.headers);
  const isFormDataBody = typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (init?.body && !isFormDataBody && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return {
    ...init,
    headers
  };
}

async function parseErrorResponse(response: Response): Promise<ErrorResponse | null> {
  const rawBody = await response.text();

  if (!rawBody.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawBody) as ErrorResponse;
  } catch {
    return null;
  }
}

function hasEmptyResponseBody(response: Response, rawBody: string): boolean {
  return response.status === 204 || response.status === 205 || !rawBody.trim();
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const rawBody = await response.text();

  if (hasEmptyResponseBody(response, rawBody)) {
    throw new InvalidApiResponseError("Expected a JSON response body but received an empty response.");
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new InvalidApiResponseError("Expected a valid JSON response body.");
  }
}

async function performRequest(path: string, init: RequestInit | undefined, eventName: string) {
  const context = createRequestContext(path, init);

  logClientEvent("info", `${eventName}.started`, {
    method: context.method,
    path: context.path
  });

  let response: Response;

  try {
    response = await fetch(path, init);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logClientEvent("info", `${eventName}.aborted`, {
        method: context.method,
        path: context.path,
        durationMs: Math.round(performance.now() - context.startedAt)
      });
      throw error;
    }

    logClientError(`${eventName}.network_failed`, error, {
      method: context.method,
      path: context.path,
      durationMs: Math.round(performance.now() - context.startedAt)
    });
    throw error;
  }

  if (!response.ok) {
    const payload = await parseErrorResponse(response);

    const error = new ApiError(
      payload?.error?.message ?? `Request failed: ${response.status}`,
      response.status,
      payload?.error?.code,
      payload?.error?.details
    );
    logClientError(`${eventName}.failed`, error, {
      method: context.method,
      path: context.path,
      statusCode: response.status,
      requestId: response.headers.get("x-request-id"),
      errorCode: payload?.error?.code,
      errorDetails: payload?.error?.details,
      durationMs: Math.round(performance.now() - context.startedAt)
    });
    throw error;
  }

  logClientEvent("info", `${eventName}.completed`, {
    method: context.method,
    path: context.path,
    statusCode: response.status,
    requestId: response.headers.get("x-request-id"),
    durationMs: Math.round(performance.now() - context.startedAt)
  });

  return response;
}

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await performRequest(path, withRequestHeaders(init), "api.request");
  return parseJsonResponse<T>(response);
}

export async function apiClientVoid(path: string, init?: RequestInit): Promise<void> {
  await performRequest(path, withRequestHeaders(init), "api.request");
}

export async function apiClientBlob(path: string, init?: RequestInit): Promise<Blob> {
  const response = await performRequest(path, withRequestHeaders(init), "api.blob_request");
  return response.blob();
}
