import type { Role } from "./types.ts";

export const VERSION = "1.0.0";
export const DEFAULT_PORT = 9090;

export const AIRLINK_PATHS = {
  etcDir: "/etc/airlink",
  tlsDir: "/etc/airlink/tls",
  tlsKey: "/etc/airlink/tls/key.pem",
  tlsCert: "/etc/airlink/tls/cert.pem",
  signingKey: "/etc/airlink/signing.key",
  dataDir: "/var/lib/airlink",
  avatarDir: "/var/lib/airlink/avatars",
  addonDir: "/var/lib/airlink/addons",
  dbPath: "/var/lib/airlink/db.sqlite",
  systemdUnit: "/etc/systemd/system/airlink.service"
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
  appSecret: "app_secret"
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
