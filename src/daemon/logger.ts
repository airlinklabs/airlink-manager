import type { AuditResult } from "../shared/types.ts";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, string | number | boolean | null | undefined>;

const SECRET_FIELD_RE = /(password|token|secret|cookie|authorization|csrf|jwt)/i;

export function log(level: LogLevel, msg: string, fields: LogFields = {}): void {
  const safeFields: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || SECRET_FIELD_RE.test(key)) {
      continue;
    }
    safeFields[key] = value;
  }

  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...safeFields
  });

  if (process.env.NODE_ENV === "production") {
    console.error(line);
    return;
  }

  const prefix = `[${level}]`;
  if (level === "error" || level === "warn") {
    console.error(prefix, msg, safeFields);
  } else {
    console.info(prefix, msg, safeFields);
  }
}

export function auditResultFromStatus(status: number): AuditResult {
  if (status >= 500) {
    return "error";
  }
  if (status >= 400) {
    return "denied";
  }
  return "ok";
}
