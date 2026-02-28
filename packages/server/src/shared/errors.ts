import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export function toErrorPayload(error: unknown) {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      payload: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      }
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      payload: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: {
            issues: error.issues
          }
        }
      }
    };
  }

  return {
    statusCode: 500,
    payload: {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error",
        details: {}
      }
    }
  };
}

