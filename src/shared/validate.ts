import path from "node:path";
import { PermissionError, ValidationError } from "./errors.ts";
import { ROLE_HIERARCHY } from "./constants.ts";
import type { ActiveRole, JsonObject, Role } from "./types.ts";

const USERNAME_RE = /^[a-z_][a-z0-9_-]{0,30}$/;
const SAFE_SERVICE_RE = /^[A-Za-z0-9_.@:-]+\.service$/;
const SAFE_CONTAINER_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

export function assertString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new ValidationError(`${label} must be a string`);
  }
  if (value.length === 0) {
    throw new ValidationError(`${label} is required`);
  }
  if (value.length > maxLength) {
    throw new ValidationError(`${label} exceeds ${maxLength} characters`);
  }
  return value;
}

export function assertJsonObject(value: unknown, label = "body"): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${label} must be an object`);
  }
  return value as JsonObject;
}

export function validateUsername(value: unknown): string {
  const username = assertString(value, "username", 31);
  if (!USERNAME_RE.test(username)) {
    throw new ValidationError("username contains invalid characters");
  }
  return username;
}

export function validateRole(value: unknown): Role {
  if (value === "owner" || value === "admin" || value === "user" || value === "banned") {
    return value;
  }
  throw new ValidationError("role is invalid");
}

export function assertRoleAtLeast(actual: Role, minRole: ActiveRole): void {
  if (actual === "banned" || ROLE_HIERARCHY[actual] < ROLE_HIERARCHY[minRole]) {
    throw new PermissionError("Insufficient role");
  }
}

export function validateFileName(value: unknown): string {
  const name = assertString(value, "file name", 255);
  if (name.includes("\0") || /[\u0000-\u001f]/u.test(name)) {
    throw new ValidationError("file name contains control characters");
  }
  if (name.includes("/") || name.includes("\\") || name === "." || name === "..") {
    throw new ValidationError("file name must be a single path component");
  }
  return name;
}

export function validatePath(raw: string, allowedRoot: string): string {
  if (typeof raw !== "string") {
    throw new ValidationError("path must be a string");
  }
  if (raw.length === 0) {
    throw new ValidationError("path is required");
  }
  if (raw.length > 4096) {
    throw new ValidationError("path exceeds 4096 characters");
  }
  if (raw.includes("\0")) {
    throw new PermissionError(`Path traversal attempt: ${raw}`);
  }

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    throw new ValidationError("path is not valid URI encoding");
  }

  if (decoded.includes("\0")) {
    throw new PermissionError(`Path traversal attempt: ${raw}`);
  }
  if (decoded.split(/[\\/]+/u).includes("..")) {
    throw new PermissionError(`Path traversal attempt: ${raw}`);
  }

  const root = path.resolve(allowedRoot);
  const candidate = path.isAbsolute(decoded) ? path.resolve(decoded) : path.resolve(root, decoded);
  const relative = path.relative(root, candidate);

  // The relative-prefix check blocks ../ traversal, absolute paths outside root,
  // and sibling-prefix bypasses such as /home/user2 when root is /home/user.
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    return candidate;
  }

  throw new PermissionError(`Path traversal attempt: ${raw}`);
}

export function validateServiceName(value: unknown): string {
  const service = assertString(value, "service name", 256);
  if (!SAFE_SERVICE_RE.test(service)) {
    throw new ValidationError("service name is invalid");
  }
  return service;
}

export function validateDockerId(value: unknown): string {
  const id = assertString(value, "docker id", 128);
  if (!SAFE_CONTAINER_ID_RE.test(id)) {
    throw new ValidationError("docker id is invalid");
  }
  return id;
}

export function validatePort(value: unknown): number {
  const port = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ValidationError("port must be between 1 and 65535");
  }
  return port;
}

export function validateOctalMode(value: unknown): number {
  const mode = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(mode) || mode < 0 || mode > 0o7777) {
    throw new ValidationError("mode must be a valid octal permission");
  }
  return mode;
}

export function validatePositiveInt(value: unknown, label: string, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new ValidationError(`${label} must be between 1 and ${max}`);
  }
  return parsed;
}

export function sanitizeDetail(value: unknown): string {
  return JSON.stringify(value, (_key, current) => {
    if (typeof current === "string" && current.length > 1024) {
      return `${current.slice(0, 1024)}...`;
    }
    return current;
  });
}
