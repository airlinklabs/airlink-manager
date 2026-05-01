import { Database } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import pathLib from "node:path";
import { AIRLINK_PATHS } from "../shared/constants.ts";
import { Queries } from "./queries.ts";

export type AirlinkDatabase = Database;

// Embedded schema to ensure it works in compiled binaries
const EMBEDDED_SCHEMA = `PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;
PRAGMA cache_size=-32000;
PRAGMA temp_store=MEMORY;
PRAGMA mmap_size=268435456;

CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_config VALUES ('owner_username', '');
INSERT OR IGNORE INTO app_config VALUES ('app_name', 'Airlink Panel');
INSERT OR IGNORE INTO app_config VALUES ('port', '9090');
INSERT OR IGNORE INTO app_config VALUES ('session_timeout_hours', '24');
INSERT OR IGNORE INTO app_config VALUES ('max_sessions_per_user', '5');
INSERT OR IGNORE INTO app_config VALUES ('allow_registration', '0');
INSERT OR IGNORE INTO app_config VALUES ('addon_network_allowed', '0');
INSERT OR IGNORE INTO app_config VALUES ('addon_signing_pubkey', '');
INSERT OR IGNORE INTO app_config VALUES ('file_edit_min_role', 'user');
INSERT OR IGNORE INTO app_config VALUES ('chown_min_role', 'owner');
INSERT OR IGNORE INTO app_config VALUES ('app_secret', '');
INSERT OR IGNORE INTO app_config VALUES ('strict_session_binding', '1');

CREATE TABLE IF NOT EXISTS web_sessions (
  id              TEXT PRIMARY KEY,
  unix_username   TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL,
  last_active_at  INTEGER NOT NULL,
  ip_address      TEXT,
  user_agent      TEXT,
  fingerprint     TEXT,
  revoked         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS web_roles (
  unix_username TEXT PRIMARY KEY,
  role          TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'user', 'banned')),
  assigned_by   TEXT,
  assigned_at   INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  unix_username TEXT NOT NULL,
  action        TEXT NOT NULL,
  detail        TEXT,
  ip_address    TEXT,
  result        TEXT NOT NULL DEFAULT 'ok' CHECK(result IN ('ok', 'denied', 'error')),
  ts            INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS addon_registry (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  version        TEXT NOT NULL,
  author         TEXT,
  enabled        INTEGER NOT NULL DEFAULT 1,
  installed_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  config         TEXT DEFAULT '{}',
  error_count    INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT
);

CREATE TABLE IF NOT EXISTS user_preferences (
  unix_username  TEXT PRIMARY KEY,
  theme          TEXT NOT NULL DEFAULT 'system' CHECK(theme IN ('light', 'dark', 'system')),
  avatar_path    TEXT,
  display_name   TEXT,
  email          TEXT,
  terminal_font_size INTEGER NOT NULL DEFAULT 14,
  preferences_json   TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS rate_limit_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  key       TEXT NOT NULL,
  endpoint  TEXT NOT NULL,
  ts        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_username ON web_sessions(unix_username);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON web_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_username ON audit_log(unix_username);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_rate_limit ON rate_limit_log(key, endpoint, ts);

CREATE TRIGGER IF NOT EXISTS prevent_audit_delete
  BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit log is immutable'); END;

CREATE TRIGGER IF NOT EXISTS prevent_audit_update
  BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit log is immutable'); END;`;

export async function createDatabase(path = AIRLINK_PATHS.dbPath): Promise<{ db: AirlinkDatabase; queries: Queries }> {
  await mkdir(pathLib.dirname(path), { recursive: true });
  const db = new Database(path, { create: true, strict: true });
  applyPragmas(db);
  db.exec(EMBEDDED_SCHEMA);
  return { db, queries: new Queries(db) };
}

export function createMemoryDatabase(): { db: AirlinkDatabase; queries: Queries } {
  const db = new Database(":memory:", { create: true, strict: true });
  applyPragmas(db);
  throw new Error("createMemoryDatabase is async; use createMemoryDatabaseAsync instead");
}

export async function createMemoryDatabaseAsync(): Promise<{ db: AirlinkDatabase; queries: Queries }> {
  const db = new Database(":memory:", { create: true, strict: true });
  applyPragmas(db);
  db.exec(EMBEDDED_SCHEMA);
  return { db, queries: new Queries(db) };
}

export function applyPragmas(db: AirlinkDatabase): void {
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec("PRAGMA synchronous=NORMAL;");
  db.exec("PRAGMA foreign_keys=ON;");
  db.exec("PRAGMA cache_size=-32000;");
  db.exec("PRAGMA temp_store=MEMORY;");
  db.exec("PRAGMA mmap_size=268435456;");
}
