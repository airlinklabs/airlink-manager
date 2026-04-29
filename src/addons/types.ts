import type { JsonObject } from "../shared/types.ts";

export type AddonPermission = "metrics.read" | "notifications.write" | "settings.read" | "network";

export type AddonNavItem = {
  label: string;
  path: string;
  icon?: string;
};

export type AddonManifest = {
  id: string;
  name: string;
  version: string;
  author?: string | undefined;
  entrypoint: string;
  permissions: AddonPermission[];
  nav?: AddonNavItem[] | undefined;
  signature?: string | undefined;
};

export type AddonRecord = {
  manifest: AddonManifest;
  enabled: boolean;
  worker: Worker | null;
  errors: number;
  lastError: string | null;
};

export type AddonAPI = {
  version: "1";
  getConfig(): Promise<JsonObject>;
  setConfig(config: JsonObject): Promise<void>;
  notify(level: "info" | "success" | "warning" | "error", message: string): Promise<void>;
};
