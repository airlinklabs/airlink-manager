import { chmod, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DaemonFrame, FileEntry } from "../../shared/types.ts";
import { ValidationError } from "../../shared/errors.ts";
import { assertString, validatePath } from "../../shared/validate.ts";
import type { BridgeContext } from "../index.ts";

export abstract class BaseChannel {
  protected constructor(protected readonly context: BridgeContext) {}

  protected ready(frame: DaemonFrame): void {
    this.context.emit({ id: frame.id, channel: frame.channel, event: "ready", payload: null });
  }

  protected emitData(frame: DaemonFrame, payload: unknown): void {
    this.context.emit({ id: frame.id, channel: frame.channel, event: "data", payload });
  }

  protected exit(frame: DaemonFrame, code: number): void {
    this.context.emit({ id: frame.id, channel: frame.channel, event: "exit", payload: code });
  }
}

export function payloadObject(frame: DaemonFrame): Record<string, unknown> {
  if (frame.payload === null || typeof frame.payload !== "object" || Array.isArray(frame.payload)) {
    throw new ValidationError("payload must be an object");
  }
  return frame.payload as Record<string, unknown>;
}

export function allowedRoot(): string {
  return process.env.HOME ?? `/home/${process.env.USER ?? ""}`;
}

export async function readSafeFile(rawPath: unknown, maxBytes: number): Promise<string> {
  const safe = validatePath(assertString(rawPath, "path", 4096), allowedRoot());
  const file = Bun.file(safe);
  if (file.size > maxBytes) {
    throw new ValidationError("file exceeds maximum size");
  }
  return file.text();
}

export async function writeSafeFile(rawPath: unknown, content: unknown): Promise<void> {
  const safe = validatePath(assertString(rawPath, "path", 4096), allowedRoot());
  const text = assertString(content, "content", 10 * 1024 * 1024);
  let originalMode = 0o600;
  try {
    const info = await stat(safe);
    originalMode = info.mode & 0o7777;
  } catch {
    // New files default to private user-only permissions.
  }
  const tmpPath = `${safe}.airlink-tmp-${crypto.randomUUID()}`;
  await writeFile(tmpPath, text, { mode: originalMode });
  await chmod(tmpPath, originalMode);
  await rename(tmpPath, safe);
}

export async function listSafeDirectory(rawPath: unknown): Promise<FileEntry[]> {
  const safe = validatePath(assertString(rawPath, "path", 4096), allowedRoot());
  const entries = await readdir(safe);
  const result: FileEntry[] = [];
  for (const name of entries) {
    const full = path.join(safe, name);
    const info = await stat(full);
    result.push({
      name,
      path: full,
      type: info.isDirectory() ? "directory" : info.isFile() ? "file" : info.isSymbolicLink() ? "symlink" : "other",
      size: info.size,
      mode: info.mode,
      uid: info.uid,
      gid: info.gid,
      modifiedAt: Math.floor(info.mtimeMs)
    });
  }
  return result;
}

export async function readTextFile(pathname: string): Promise<string> {
  return readFile(pathname, "utf8");
}
