import type { Queries } from "../db/queries.ts";
import type { AddonAPI, AddonManifest } from "./types.ts";

export function createAddonApi(manifest: AddonManifest, queries: Queries): AddonAPI {
  const hasPermission = (perm: string) => manifest.permissions.includes(perm as never);

  return {
    version: "1",
    async getConfig() {
      if (!hasPermission("settings.read")) {
        throw new Error(`Addon ${manifest.id} does not have settings.read permission`);
      }
      const row = queries.listConfig().find((item) => item.key === `addon.${manifest.id}.config`);
      if (!row) {
        return {};
      }
      const parsed = JSON.parse(row.value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, never>) : {};
    },
    async setConfig(config) {
      if (!hasPermission("settings.read")) {
        throw new Error(`Addon ${manifest.id} does not have settings.read permission`);
      }
      queries.setConfig(`addon.${manifest.id}.config`, JSON.stringify(config));
    },
    async notify(level, message) {
      if (!hasPermission("notifications.write")) {
        throw new Error(`Addon ${manifest.id} does not have notifications.write permission`);
      }
      queries.audit("system", "addon.notification", { addon: manifest.id, level, message }, null, "ok");
    }
  };
}
