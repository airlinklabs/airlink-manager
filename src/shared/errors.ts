export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class PermissionError extends AppError {
  constructor(message = "Permission denied") {
    super(message, "PERMISSION_DENIED", 403);
    this.name = "PermissionError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

export class RateLimitError extends AppError {
  constructor(public readonly retryAfter: number) {
    super("Rate limit exceeded", "RATE_LIMITED", 429);
    this.name = "RateLimitError";
  }
}

export function errorToPayload(error: unknown): { message: string; code: string; status: number } {
  if (error instanceof AppError) {
    return { message: error.message, code: error.code, status: error.status };
  }
  if (error instanceof Error) {
    return { message: error.message, code: "INTERNAL_ERROR", status: 500 };
  }
  return { message: "Internal server error", code: "INTERNAL_ERROR", status: 500 };
}
