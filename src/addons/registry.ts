import path from "node:path";
import { AIRLINK_PATHS, CONFIG_KEYS } from "../shared/constants.ts";
import type { Queries } from "../db/queries.ts";
import type { AddonRecord } from "./types.ts";
import { readManifest, spawnAddonWorker, verifyManifestSignature } from "./loader.ts";

export class AddonRegistry {
  private readonly records = new Map<string, AddonRecord>();

  constructor(private readonly queries: Queries) {}

  list(): AddonRecord[] {
    return [...this.records.values()];
  }

  async loadEnabled(): Promise<void> {
    const publicKey = this.queries.getConfig(CONFIG_KEYS.addonSigningPubkey) ?? "";
    const entries = new Bun.Glob("*/manifest.json").scan({ cwd: AIRLINK_PATHS.addonDir });
    for await (const manifestPath of entries) {
      const full = path.join(AIRLINK_PATHS.addonDir, manifestPath);
      const manifest = await readManifest(full);
      if (!(await verifyManifestSignature(manifest, publicKey))) {
        this.queries.audit("system", "addon.load", { id: manifest.id, reason: "signature_invalid" }, null, "denied");
        continue;
      }
      const root = path.dirname(full);
      try {
        const record = await spawnAddonWorker(root, manifest, this.queries);
        this.records.set(manifest.id, record);
        this.queries.audit("system", "addon.load", { id: manifest.id }, null, "ok");
      } catch (error) {
        const message = error instanceof Error ? error.message : "addon failed";
        this.queries.audit("system", "addon.load", { id: manifest.id, error: message }, null, "error");
      }
    }
  }

  stop(id: string): void {
    const record = this.records.get(id);
    if (!record) {
      return;
    }
    record.worker?.terminate();
    this.records.delete(id);
  }

  stopAll(): void {
    for (const id of this.records.keys()) {
      this.stop(id);
    }
  }
}
