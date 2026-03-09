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

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const isFormDataBody = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const method = init?.method ?? "GET";
  const startedAt = performance.now();

  if (init?.body && !isFormDataBody && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  logClientEvent("info", "api.request.started", {
    method,
    path
  });

  let response: Response;

  try {
    response = await fetch(path, {
      ...init,
      headers
    });
  } catch (error) {
    logClientError("api.request.network_failed", error, {
      method,
      path,
      durationMs: Math.round(performance.now() - startedAt)
    });
    throw error;
  }

  if (!response.ok) {
    let payload: ErrorResponse | null = null;

    try {
      payload = (await response.json()) as ErrorResponse;
    } catch {
      payload = null;
    }

    const error = new ApiError(
      payload?.error?.message ?? `Request failed: ${response.status}`,
      response.status,
      payload?.error?.code,
      payload?.error?.details
    );
    logClientError("api.request.failed", error, {
      method,
      path,
      statusCode: response.status,
      requestId: response.headers.get("x-request-id"),
      errorCode: payload?.error?.code,
      errorDetails: payload?.error?.details,
      durationMs: Math.round(performance.now() - startedAt)
    });
    throw error;
  }

  logClientEvent("info", "api.request.completed", {
    method,
    path,
    statusCode: response.status,
    requestId: response.headers.get("x-request-id"),
    durationMs: Math.round(performance.now() - startedAt)
  });

  return response.json() as Promise<T>;
}

export async function apiClientBlob(path: string, init?: RequestInit): Promise<Blob> {
  const method = init?.method ?? "GET";
  const startedAt = performance.now();

  logClientEvent("info", "api.blob_request.started", {
    method,
    path
  });

  let response: Response;

  try {
    response = await fetch(path, init);
  } catch (error) {
    logClientError("api.blob_request.network_failed", error, {
      method,
      path,
      durationMs: Math.round(performance.now() - startedAt)
    });
    throw error;
  }

  if (!response.ok) {
    let payload: ErrorResponse | null = null;

    try {
      payload = (await response.json()) as ErrorResponse;
    } catch {
      payload = null;
    }

    const error = new ApiError(
      payload?.error?.message ?? `Request failed: ${response.status}`,
      response.status,
      payload?.error?.code,
      payload?.error?.details
    );
    logClientError("api.blob_request.failed", error, {
      method,
      path,
      statusCode: response.status,
      requestId: response.headers.get("x-request-id"),
      errorCode: payload?.error?.code,
      errorDetails: payload?.error?.details,
      durationMs: Math.round(performance.now() - startedAt)
    });
    throw error;
  }

  logClientEvent("info", "api.blob_request.completed", {
    method,
    path,
    statusCode: response.status,
    requestId: response.headers.get("x-request-id"),
    durationMs: Math.round(performance.now() - startedAt)
  });

  return response.blob();
}
