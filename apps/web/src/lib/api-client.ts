interface ErrorResponse {
  error?: {
    message?: string;
  };
}

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers
  });

  if (!response.ok) {
    let payload: ErrorResponse | null = null;

    try {
      payload = (await response.json()) as ErrorResponse;
    } catch {
      payload = null;
    }

    throw new Error(payload?.error?.message ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function apiClientBlob(path: string, init?: RequestInit): Promise<Blob> {
  const response = await fetch(path, init);

  if (!response.ok) {
    let payload: ErrorResponse | null = null;

    try {
      payload = (await response.json()) as ErrorResponse;
    } catch {
      payload = null;
    }

    throw new Error(payload?.error?.message ?? `Request failed: ${response.status}`);
  }

  return response.blob();
}
