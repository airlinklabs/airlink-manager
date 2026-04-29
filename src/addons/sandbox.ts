import type { Queries } from "../db/queries.ts";
import type { AddonAPI, AddonManifest } from "./types.ts";

export function createAddonApi(manifest: AddonManifest, queries: Queries): AddonAPI {
  return {
    version: "1",
    async getConfig() {
      const row = queries.listConfig().find((item) => item.key === `addon.${manifest.id}.config`);
      if (!row) {
        return {};
      }
      const parsed = JSON.parse(row.value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, never>) : {};
    },
    async setConfig(config) {
      queries.setConfig(`addon.${manifest.id}.config`, JSON.stringify(config));
    },
    async notify(level, message) {
      queries.audit("system", "addon.notification", { addon: manifest.id, level, message }, null, "ok");
    }
  };
}
