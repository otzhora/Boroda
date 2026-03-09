import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { AppError } from "./errors";

type LogLevel = "debug" | "info" | "warn" | "error";

interface ConsoleLikeLogger {
  debug: (message?: unknown, ...optionalParams: unknown[]) => void;
  info: (message?: unknown, ...optionalParams: unknown[]) => void;
  warn: (message?: unknown, ...optionalParams: unknown[]) => void;
  error: (message?: unknown, ...optionalParams: unknown[]) => void;
}

type LogTarget = FastifyBaseLogger | FastifyInstance | ConsoleLikeLogger;

function resolveLogger(target: LogTarget): ConsoleLikeLogger {
  if ("log" in target && typeof target.log === "object" && target.log !== null) {
    return target.log as ConsoleLikeLogger;
  }

  return target as ConsoleLikeLogger;
}

function toErrorMeta(error: unknown) {
  if (error instanceof AppError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details
    };
  }

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

export function logServerEvent(
  target: LogTarget,
  level: LogLevel,
  event: string,
  details: Record<string, unknown> = {}
) {
  const logger = resolveLogger(target);
  logger[level](
    {
      event,
      ...details
    },
    event
  );
}

export function logServerError(
  target: LogTarget,
  event: string,
  error: unknown,
  details: Record<string, unknown> = {}
) {
  const logger = resolveLogger(target);
  const level = error instanceof AppError && error.statusCode < 500 ? "warn" : "error";

  logger[level](
    {
      event,
      ...details,
      error: toErrorMeta(error)
    },
    event
  );
}

export async function withServerSpan<T>(
  target: LogTarget,
  event: string,
  details: Record<string, unknown>,
  fn: () => Promise<T>
) {
  const startedAt = Date.now();
  logServerEvent(target, "info", `${event}.started`, details);

  try {
    const result = await fn();
    logServerEvent(target, "info", `${event}.completed`, {
      ...details,
      durationMs: Date.now() - startedAt
    });
    return result;
  } catch (error) {
    logServerError(target, `${event}.failed`, error, {
      ...details,
      durationMs: Date.now() - startedAt
    });
    throw error;
  }
}
