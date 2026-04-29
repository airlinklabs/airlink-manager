import type { Database } from "bun:sqlite";
import type { AppConfigRow, AuditLog, AuditResult, Role, UserPreference, WebRole, WebSession } from "../shared/types.ts";
import { sanitizeDetail } from "../shared/validate.ts";

type InsertSessionArgs = [string, string, number, number, number, string | null, string | null, string | null];
type InsertAuditArgs = [string, string, string | null, string | null, AuditResult];
type UpsertRoleArgs = [string, Role, string | null];
type UpsertConfigArgs = [string, string];
type UpsertPreferenceArgs = [string, string, string | null, string | null, string | null, number, string];

export class Queries {
  private readonly findSessionStmt;
  private readonly findSessionAnyStmt;
  private readonly insertSessionStmt;
  private readonly touchSessionStmt;
  private readonly revokeSessionStmt;
  private readonly revokeUserSessionsStmt;
  private readonly listSessionsStmt;
  private readonly listSessionsForUserStmt;
  private readonly deleteOldSessionsStmt;
  private readonly findRoleStmt;
  private readonly upsertRoleStmt;
  private readonly listRolesStmt;
  private readonly getConfigStmt;
  private readonly setConfigStmt;
  private readonly listConfigStmt;
  private readonly insertAuditStmt;
  private readonly listAuditStmt;
  private readonly getPreferenceStmt;
  private readonly upsertPreferenceStmt;

  constructor(private readonly db: Database) {
    this.findSessionStmt = db.prepare<WebSession, [string]>(
      "SELECT * FROM web_sessions WHERE id = ? AND revoked = 0 AND expires_at > unixepoch()"
    );
    this.findSessionAnyStmt = db.prepare<WebSession, [string]>("SELECT * FROM web_sessions WHERE id = ?");
    this.insertSessionStmt = db.prepare<never, InsertSessionArgs>(
      `INSERT INTO web_sessions
       (id, unix_username, created_at, expires_at, last_active_at, ip_address, user_agent, fingerprint)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.touchSessionStmt = db.prepare<never, [number, string]>(
      "UPDATE web_sessions SET last_active_at = ? WHERE id = ? AND revoked = 0"
    );
    this.revokeSessionStmt = db.prepare<never, [string]>("UPDATE web_sessions SET revoked = 1 WHERE id = ?");
    this.revokeUserSessionsStmt = db.prepare<never, [string]>(
      "UPDATE web_sessions SET revoked = 1 WHERE unix_username = ?"
    );
    this.listSessionsStmt = db.prepare<WebSession, []>(
      "SELECT * FROM web_sessions WHERE revoked = 0 AND expires_at > unixepoch() ORDER BY last_active_at DESC"
    );
    this.listSessionsForUserStmt = db.prepare<WebSession, [string]>(
      "SELECT * FROM web_sessions WHERE unix_username = ? AND revoked = 0 AND expires_at > unixepoch() ORDER BY last_active_at DESC"
    );
    this.deleteOldSessionsStmt = db.prepare<never, [string, number]>(
      `UPDATE web_sessions
       SET revoked = 1
       WHERE id IN (
         SELECT id FROM web_sessions
         WHERE unix_username = ? AND revoked = 0
         ORDER BY created_at ASC
         LIMIT ?
       )`
    );
    this.findRoleStmt = db.prepare<WebRole, [string]>("SELECT * FROM web_roles WHERE unix_username = ?");
    this.upsertRoleStmt = db.prepare<never, UpsertRoleArgs>(
      `INSERT INTO web_roles (unix_username, role, assigned_by, assigned_at)
       VALUES (?, ?, ?, unixepoch())
       ON CONFLICT(unix_username) DO UPDATE SET role = excluded.role, assigned_by = excluded.assigned_by, assigned_at = unixepoch()`
    );
    this.listRolesStmt = db.prepare<WebRole, []>("SELECT * FROM web_roles ORDER BY unix_username ASC");
    this.getConfigStmt = db.prepare<AppConfigRow, [string]>("SELECT key, value FROM app_config WHERE key = ?");
    this.setConfigStmt = db.prepare<never, UpsertConfigArgs>(
      "INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    );
    this.listConfigStmt = db.prepare<AppConfigRow, []>("SELECT key, value FROM app_config ORDER BY key ASC");
    this.insertAuditStmt = db.prepare<never, InsertAuditArgs>(
      "INSERT INTO audit_log (unix_username, action, detail, ip_address, result) VALUES (?, ?, ?, ?, ?)"
    );
    this.listAuditStmt = db.prepare<AuditLog, [number, number]>(
      "SELECT * FROM audit_log ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?"
    );
    this.getPreferenceStmt = db.prepare<UserPreference, [string]>(
      "SELECT * FROM user_preferences WHERE unix_username = ?"
    );
    this.upsertPreferenceStmt = db.prepare<never, UpsertPreferenceArgs>(
      `INSERT INTO user_preferences
       (unix_username, theme, avatar_path, display_name, email, terminal_font_size, preferences_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(unix_username) DO UPDATE SET
         theme = excluded.theme,
         avatar_path = excluded.avatar_path,
         display_name = excluded.display_name,
         email = excluded.email,
         terminal_font_size = excluded.terminal_font_size,
         preferences_json = excluded.preferences_json`
    );
  }

  findSession(id: string): WebSession | null {
    return this.findSessionStmt.get(id) ?? null;
  }

  findSessionAny(id: string): WebSession | null {
    return this.findSessionAnyStmt.get(id) ?? null;
  }

  insertSession(args: InsertSessionArgs): void {
    this.insertSessionStmt.run(...args);
  }

  touchSession(id: string, now: number): void {
    this.touchSessionStmt.run(now, id);
  }

  revokeSession(id: string): void {
    this.revokeSessionStmt.run(id);
  }

  revokeUserSessions(username: string): void {
    this.revokeUserSessionsStmt.run(username);
  }

  listSessions(username: string | null, includeAll: boolean): WebSession[] {
    if (includeAll) {
      return this.listSessionsStmt.all();
    }
    if (username === null) {
      return [];
    }
    return this.listSessionsForUserStmt.all(username);
  }

  enforceSessionLimit(username: string, maxSessions: number): void {
    const overflow = Math.max(0, this.listSessionsForUserStmt.all(username).length - maxSessions);
    if (overflow > 0) {
      this.deleteOldSessionsStmt.run(username, overflow);
    }
  }

  findRole(username: string): WebRole | null {
    return this.findRoleStmt.get(username) ?? null;
  }

  roleFor(username: string): Role {
    return this.findRole(username)?.role ?? "user";
  }

  upsertRole(username: string, role: Role, assignedBy: string | null): void {
    this.upsertRoleStmt.run(username, role, assignedBy);
  }

  listRoles(): WebRole[] {
    return this.listRolesStmt.all();
  }

  getConfig(key: string): string | null {
    return this.getConfigStmt.get(key)?.value ?? null;
  }

  setConfig(key: string, value: string): void {
    this.setConfigStmt.run(key, value);
  }

  listConfig(): AppConfigRow[] {
    return this.listConfigStmt.all();
  }

  audit(username: string, action: string, detail: unknown, ipAddress: string | null, result: AuditResult): void {
    this.insertAuditStmt.run(username, action, detail === null ? null : sanitizeDetail(detail), ipAddress, result);
  }

  listAudit(limit: number, offset: number): AuditLog[] {
    return this.listAuditStmt.all(limit, offset);
  }

  getPreference(username: string): UserPreference | null {
    return this.getPreferenceStmt.get(username) ?? null;
  }

  upsertPreference(preference: UserPreference): void {
    this.upsertPreferenceStmt.run(
      preference.unix_username,
      preference.theme,
      preference.avatar_path,
      preference.display_name,
      preference.email,
      preference.terminal_font_size,
      preference.preferences_json
    );
  }
}
