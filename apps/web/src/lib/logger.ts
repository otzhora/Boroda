type LogLevel = "debug" | "info" | "warn" | "error";

function prefix(event: string) {
  return `[boroda] ${event}`;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: String(error)
  };
}

export function logClientEvent(
  level: LogLevel,
  event: string,
  details: Record<string, unknown> = {}
) {
  console[level](prefix(event), details);
}

export function logClientError(
  event: string,
  error: unknown,
  details: Record<string, unknown> = {}
) {
  console.error(prefix(event), {
    ...details,
    error: normalizeError(error)
  });
}
