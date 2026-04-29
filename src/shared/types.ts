export const CHANNEL_TYPES = [
  "terminal",
  "exec",
  "stream",
  "fsread",
  "fswrite",
  "fslist",
  "metrics",
  "systemd",
  "docker",
  "users"
] as const;

export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const ROLES = ["owner", "admin", "user", "banned"] as const;
export type Role = (typeof ROLES)[number];
export type ActiveRole = Exclude<Role, "banned">;

export const FRAME_ACTIONS = ["open", "data", "resize", "close", "ping"] as const;
export type FrameAction = (typeof FRAME_ACTIONS)[number];

export const BRIDGE_EVENTS = ["data", "exit", "error", "ready", "pong"] as const;
export type BridgeEvent = (typeof BRIDGE_EVENTS)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonObject = { readonly [key: string]: JsonValue };
export type JsonArray = readonly JsonValue[];

export type DaemonFrame = {
  id: string;
  channel: ChannelType;
  action: FrameAction;
  payload: unknown;
};

export type BridgeFrame = {
  id: string;
  channel: ChannelType;
  event: BridgeEvent;
  payload: unknown;
};

export type ClientMessage =
  | { type: "channel.open"; channelId: string; channel: ChannelType; payload: unknown }
  | { type: "channel.data"; channelId: string; data: string | Uint8Array }
  | { type: "channel.resize"; channelId: string; cols: number; rows: number }
  | { type: "channel.close"; channelId: string }
  | { type: "ping" }
  | { type: "pong" };

export type ServerMessage =
  | { type: "connected"; sessionId: string; username: string }
  | { type: "channel.ready"; channelId: string }
  | { type: "channel.data"; channelId: string; data: string }
  | { type: "channel.exit"; channelId: string; code: number }
  | { type: "channel.error"; channelId: string; message: string; code?: string }
  | { type: "notification"; id: string; level: NotificationLevel; message: string }
  | { type: "ping" }
  | { type: "pong" };

export type NotificationLevel = "info" | "success" | "warning" | "error";

export type WebSession = {
  id: string;
  unix_username: string;
  created_at: number;
  expires_at: number;
  last_active_at: number;
  ip_address: string | null;
  user_agent: string | null;
  fingerprint: string | null;
  revoked: number;
};

export type WebRole = {
  unix_username: string;
  role: Role;
  assigned_by: string | null;
  assigned_at: number;
};

export type AuditResult = "ok" | "denied" | "error";

export type AuditLog = {
  id: number;
  unix_username: string;
  action: string;
  detail: string | null;
  ip_address: string | null;
  result: AuditResult;
  ts: number;
};

export type AppConfigRow = {
  key: string;
  value: string;
};

export type UserPreference = {
  unix_username: string;
  theme: "light" | "dark" | "system";
  avatar_path: string | null;
  display_name: string | null;
  email: string | null;
  terminal_font_size: number;
  preferences_json: string;
};

export type FeatureFlags = {
  docker: boolean;
  systemd: boolean;
  accountsService: boolean;
  shadowReadable: boolean;
};

export type HealthResponse = {
  status: "ok";
  version: string;
  uptime: number;
  db: "ok" | "error";
  features: FeatureFlags;
};

export type FileEntry = {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink" | "other";
  size: number;
  mode: number;
  uid: number;
  gid: number;
  modifiedAt: number;
  target?: string;
};

export type MetricsSnapshot = {
  ts: number;
  cpu: { totalPercent: number; perCore: number[] };
  memory: {
    total: number;
    available: number;
    used: number;
    swapTotal: number;
    swapFree: number;
  };
  disk: { mount: string; total: number; used: number; available: number }[];
  network: { iface: string; rxBytesPerSecond: number; txBytesPerSecond: number }[];
  load: [number, number, number];
  uptimeSeconds: number;
  processes: ProcessInfo[];
  os: OsInfo;
};

export type ProcessInfo = {
  pid: number;
  name: string;
  user: string;
  cpuPercent: number;
  memoryPercent: number;
  rssBytes: number;
  state: string;
  startedAt: number;
  command: string;
};

export type OsInfo = {
  hostname: string;
  distro: string;
  version: string;
  kernel: string;
};

export type AppContextVariables = {
  requestId: string;
  cspNonce: string;
  session: WebSession;
  role: Role;
};

export type AirlinkEnv = {
  Variables: AppContextVariables;
};
