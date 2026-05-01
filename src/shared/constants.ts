import path from "node:path";
import type { Role } from "./types.ts";

export const VERSION = "1.0.0";
export const DEFAULT_PORT = 9090;

const AIRLINK_ETC_DIR = process.env.AIRLINK_ETC_DIR ?? "/etc/airlink";
const AIRLINK_DATA_DIR = process.env.AIRLINK_DATA_DIR ?? "/var/lib/airlink";
const AIRLINK_TLS_DIR = process.env.AIRLINK_TLS_DIR ?? path.join(AIRLINK_ETC_DIR, "tls");
const AIRLINK_DB_PATH = process.env.AIRLINK_DB_PATH ?? path.join(AIRLINK_DATA_DIR, "db.sqlite");
const AIRLINK_SIGNING_KEY = process.env.AIRLINK_SIGNING_KEY ?? path.join(AIRLINK_ETC_DIR, "signing.key");
const AIRLINK_SYSTEMD_UNIT = process.env.AIRLINK_SYSTEMD_UNIT ?? path.join(AIRLINK_ETC_DIR, "systemd", "airlink.service");

export const AIRLINK_PATHS = {
  etcDir: AIRLINK_ETC_DIR,
  tlsDir: AIRLINK_TLS_DIR,
  tlsKey: path.join(AIRLINK_TLS_DIR, "key.pem"),
  tlsCert: path.join(AIRLINK_TLS_DIR, "cert.pem"),
  signingKey: AIRLINK_SIGNING_KEY,
  dataDir: AIRLINK_DATA_DIR,
  avatarDir: process.env.AIRLINK_AVATAR_DIR ?? path.join(AIRLINK_DATA_DIR, "avatars"),
  addonDir: process.env.AIRLINK_ADDON_DIR ?? path.join(AIRLINK_DATA_DIR, "addons"),
  dbPath: AIRLINK_DB_PATH,
  systemdUnit: AIRLINK_SYSTEMD_UNIT
} as const;

export const COOKIE_NAMES = {
  session: "airlink_session",
  csrf: "airlink_csrf"
} as const;

export const CONFIG_KEYS = {
  ownerUsername: "owner_username",
  appName: "app_name",
  port: "port",
  sessionTimeoutHours: "session_timeout_hours",
  maxSessionsPerUser: "max_sessions_per_user",
  allowRegistration: "allow_registration",
  addonNetworkAllowed: "addon_network_allowed",
  addonSigningPubkey: "addon_signing_pubkey",
  fileEditMinRole: "file_edit_min_role",
  chownMinRole: "chown_min_role",
  appSecret: "app_secret",
  strictSessionBinding: "strict_session_binding"
} as const;

export const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  admin: 3,
  user: 2,
  banned: 0
};

export const SESSION_COOKIE_MAX_AGE_FALLBACK = 60 * 60 * 24;
export const WS_TOKEN_TTL_SECONDS = 60 * 15;
export const SESSION_TOKEN_BYTES = 32;
export const APP_SECRET_BYTES = 64;

export const RATE_LIMITS = {
  auth: { capacity: 5, refillPerSecond: 5 / 60 },
  api: { capacity: 200, refillPerSecond: 200 / 60 },
  upload: { capacity: 10, refillPerSecond: 10 / 60 }
} as const;

export const SECURITY_HEADER_NAMES = {
  csp: "Content-Security-Policy",
  requestId: "X-Request-Id"
} as const;

export const SAME_ORIGIN_CORS_HEADERS = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token, X-Requested-With",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
} as const;

export const MUTATING_METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const;

/** Absolute path to the running binary.
 * When compiled with `bun build --compile`, argv[1] is the binary.
 * When run as `bun src/index.ts` in dev, argv[1] ends in .ts - fall back to execPath.
 * Note: Bun's virtual filesystem (/$bunfs/) is not accessible to child processes,
 * so we use the environment override AIRLINK_BINARY_PATH if available, then fall back to argv[0]. */
export const SELF_BINARY_PATH: string = (() => {
  // Allow explicit override via environment variable
  if (process.env.AIRLINK_BINARY_PATH) {
    return process.env.AIRLINK_BINARY_PATH;
  }
  
  const argv1 = process.argv[1] ?? "";
  
  // If argv[1] is a virtual Bun filesystem path, use argv[0] (bun executable)
  if (argv1.startsWith("/$bunfs/")) {
    return process.argv[0] ?? process.execPath;
  }
  
  // If argv[1] is a valid binary path (not .ts/.js), use it
  if (argv1.length > 0 && !argv1.endsWith(".ts") && !argv1.endsWith(".js")) {
    return path.isAbsolute(argv1) ? argv1 : path.resolve(process.cwd(), argv1);
  }
  
  // Default fallback: use argv[0] (usually bun executable in dev)
  return process.argv[0] ?? process.execPath;
})();
