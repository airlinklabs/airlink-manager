import path from "node:path";
import { ValidationError } from "../shared/errors.ts";
import type { Queries } from "../db/queries.ts";
import type { AddonManifest, AddonRecord } from "./types.ts";
import { createAddonApi } from "./sandbox.ts";

const ADDON_ID_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

export async function readManifest(filePath: string): Promise<AddonManifest> {
  const parsed = JSON.parse(await Bun.file(filePath).text()) as unknown;
  return validateManifest(parsed);
}

export function validateManifest(value: unknown): AddonManifest {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("addon manifest must be an object");
  }
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || !ADDON_ID_RE.test(item.id)) {
    throw new ValidationError("addon id is invalid");
  }
  if (typeof item.name !== "string" || item.name.length === 0 || item.name.length > 100) {
    throw new ValidationError("addon name is invalid");
  }
  if (typeof item.version !== "string" || item.version.length === 0 || item.version.length > 40) {
    throw new ValidationError("addon version is invalid");
  }
  if (typeof item.entrypoint !== "string" || item.entrypoint.includes("..") || path.isAbsolute(item.entrypoint)) {
    throw new ValidationError("addon entrypoint is invalid");
  }
  const permissions = Array.isArray(item.permissions) ? item.permissions : [];
  if (!permissions.every((permission) => permission === "metrics.read" || permission === "notifications.write" || permission === "settings.read" || permission === "network")) {
    throw new ValidationError("addon permissions are invalid");
  }
  return {
    id: item.id,
    name: item.name,
    version: item.version,
    author: typeof item.author === "string" ? item.author : undefined,
    entrypoint: item.entrypoint,
    permissions,
    nav: Array.isArray(item.nav) ? item.nav.filter(isNavItem) : undefined,
    signature: typeof item.signature === "string" ? item.signature : undefined
  };
}

export async function verifyManifestSignature(manifest: AddonManifest, publicKeyBase64: string): Promise<boolean> {
  if (!manifest.signature || !publicKeyBase64) {
    return false;
  }
  const signature = Buffer.from(manifest.signature, "base64");
  const publicKey = await crypto.subtle.importKey("raw", Buffer.from(publicKeyBase64, "base64"), { name: "Ed25519" }, false, ["verify"]);
  const unsigned = JSON.stringify({ ...manifest, signature: undefined });
  return crypto.subtle.verify("Ed25519", publicKey, signature, new TextEncoder().encode(unsigned));
}

export async function spawnAddonWorker(rootDir: string, manifest: AddonManifest, queries: Queries): Promise<AddonRecord> {
  const entry = path.resolve(rootDir, manifest.entrypoint);
  if (!entry.startsWith(path.resolve(rootDir) + path.sep)) {
    throw new ValidationError("addon entrypoint escapes addon directory");
  }
  const api = createAddonApi(manifest, queries);
  const options: WorkerOptions & { resourceLimits?: { maxOldGenerationSizeMb: number } } = {
    type: "module",
    resourceLimits: { maxOldGenerationSizeMb: 200 }
  };
  const worker = new Worker(entry, options);
  worker.postMessage({ type: "airlink.init", api });
  const boot = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("addon boot timeout")), 60_000);
    worker.addEventListener(
      "message",
      (event) => {
        const data = event.data as { type?: string };
        if (data.type === "airlink.ready") {
          clearTimeout(timer);
          resolve();
        }
      },
      { once: true }
    );
  });
  await boot;
  return { manifest, enabled: true, worker, errors: 0, lastError: null };
}

function isNavItem(value: unknown): value is { label: string; path: string; icon?: string } {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const item = value as Record<string, unknown>;
  return typeof item.label === "string" && typeof item.path === "string" && (item.icon === undefined || typeof item.icon === "string");
}
