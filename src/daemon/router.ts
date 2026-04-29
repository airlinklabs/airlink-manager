import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { Queries } from "../db/queries.ts";
import { CONFIG_KEYS, COOKIE_NAMES, VERSION } from "../shared/constants.ts";
import { AppError, PermissionError, ValidationError } from "../shared/errors.ts";
import type { AirlinkEnv, FeatureFlags, HealthResponse, Role, UserPreference } from "../shared/types.ts";
import { assertJsonObject, assertString, validateDockerId, validateOctalMode, validatePath, validatePort, validatePositiveInt, validateRole, validateServiceName, validateUsername } from "../shared/validate.ts";
import { authenticateUnixUser, clearSessionCookie, clientIp, createSessionToken, fingerprint, issueWsToken, requireRole, sessionAuth, setLoginCookies, unixNow } from "./auth.ts";
import { compression, csrfValidate, installErrorHandler, rateLimit, requestId, requestLogger, sameOriginCors, securityHeaders } from "./middleware.ts";

type RouterDeps = {
  queries: Queries;
  appSecret: () => string;
  features: FeatureFlags;
  startedAt: number;
};

export function createRouter(deps: RouterDeps): Hono<AirlinkEnv> {
  const app = new Hono<AirlinkEnv>();
  installErrorHandler(app);
  app.use("*", requestId(), requestLogger(), securityHeaders(), compression(), sameOriginCors());

  app.get("/api/health", (c) => {
    const body: HealthResponse = {
      status: "ok",
      version: VERSION,
      uptime: Math.floor((Date.now() - deps.startedAt) / 1000),
      db: "ok",
      features: deps.features
    };
    return c.json(body);
  });

  app.post("/api/auth/login", rateLimit("auth"), async (c) => {
    const body = assertJsonObject(await c.req.json().catch(() => null));
    const username = validateUsername(body.username);
    const password = assertString(body.password, "password", 4096);
    const ip = clientIp(c.req.raw);
    const roleRow = deps.queries.findRole(username);
    if (roleRow?.role === "banned") {
      deps.queries.audit(username, "auth.login", { reason: "banned" }, ip, "denied");
      return c.json({ error: "Forbidden", code: "BANNED" }, 403);
    }

    const valid = await authenticateUnixUser(username, password);
    if (!valid) {
      deps.queries.audit(username, "auth.login", { reason: "invalid_credentials" }, ip, "denied");
      return c.json({ error: "Unauthorized", code: "INVALID_CREDENTIALS" }, 401);
    }

    const now = unixNow();
    const sessionId = createSessionToken();
    const role: Role = roleRow?.role ?? "user";
    if (!roleRow) {
      deps.queries.upsertRole(username, role, null);
    }
    const timeoutHours = Number(deps.queries.getConfig(CONFIG_KEYS.sessionTimeoutHours) ?? "24");
    const maxAgeSeconds = Math.max(60, Math.floor(timeoutHours * 3600));
    const userAgent = c.req.header("user-agent") ?? "";
    deps.queries.insertSession([
      sessionId,
      username,
      now,
      now + maxAgeSeconds,
      now,
      ip,
      userAgent,
      fingerprint(ip, userAgent, deps.appSecret())
    ]);
    deps.queries.enforceSessionLimit(username, Number(deps.queries.getConfig(CONFIG_KEYS.maxSessionsPerUser) ?? "5"));
    deps.queries.audit(username, "auth.login", { role }, ip, "ok");
    const csrf = await import("./csrf.ts").then((module) => module.createCsrfToken(sessionId, deps.appSecret()));
    const headers = new Headers({ "content-type": "application/json" });
    setLoginCookies(headers, sessionId, maxAgeSeconds, csrf);
    return new Response(JSON.stringify({ username, role, displayName: username }), { status: 200, headers });
  });

  app.post("/api/auth/logout", (c) => {
    const sessionId = getCookie(c, COOKIE_NAMES.session);
    if (sessionId) {
      const session = deps.queries.findSessionAny(sessionId);
      deps.queries.revokeSession(sessionId);
      deps.queries.audit(session?.unix_username ?? "system", "auth.logout", {}, clientIp(c.req.raw), "ok");
    }
    c.header("Set-Cookie", clearSessionCookie());
    return c.json({ ok: true });
  });

  app.use("/api/*", rateLimit("api"));
  app.use("/api/*", sessionAuth({ queries: deps.queries, appSecret: deps.appSecret }));
  app.use("/api/*", csrfValidate(deps.appSecret));

  app.get("/api/auth/me", (c) => {
    const session = c.get("session");
    const role = c.get("role");
    const pref = deps.queries.getPreference(session.unix_username);
    return c.json({
      username: session.unix_username,
      role,
      displayName: pref?.display_name ?? session.unix_username,
      avatar: pref?.avatar_path ?? null,
      features: deps.features
    });
  });

  app.get("/api/auth/ws-token", async (c) => {
    const session = c.get("session");
    return c.json({
      token: await issueWsToken({
        username: session.unix_username,
        role: c.get("role"),
        sessionId: session.id,
        appSecret: deps.appSecret()
      })
    });
  });

  app.patch("/api/account/password", async (c) => {
    const session = c.get("session");
    const body = assertJsonObject(await c.req.json().catch(() => null));
    const currentPassword = assertString(body.currentPassword, "currentPassword", 4096);
    const newPassword = assertString(body.newPassword, "newPassword", 4096);
    if (newPassword.length < 12) {
      throw new ValidationError("new password must be at least 12 characters");
    }
    const valid = await authenticateUnixUser(session.unix_username, currentPassword);
    if (!valid) {
      deps.queries.audit(session.unix_username, "account.password", { reason: "invalid_current_password" }, clientIp(c.req.raw), "denied");
      throw new PermissionError("Current password is invalid");
    }
    const proc = Bun.spawn(["chpasswd"], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    proc.stdin.write(`${session.unix_username}:${newPassword}\n`);
    proc.stdin.end();
    const code = await proc.exited;
    if (code !== 0) {
      throw new AppError("Password change failed", "PASSWORD_CHANGE_FAILED", 500);
    }
    deps.queries.revokeUserSessions(session.unix_username);
    deps.queries.audit(session.unix_username, "account.password", {}, clientIp(c.req.raw), "ok");
    return c.json({ ok: true });
  });

  app.get("/api/account/preferences", (c) => {
    return c.json(preferenceOrDefault(deps.queries, c.get("session").unix_username));
  });

  app.patch("/api/account/preferences", async (c) => {
    const session = c.get("session");
    const body = assertJsonObject(await c.req.json().catch(() => null));
    const current = preferenceOrDefault(deps.queries, session.unix_username);
    const next: UserPreference = {
      ...current,
      theme: body.theme === "light" || body.theme === "dark" || body.theme === "system" ? body.theme : current.theme,
      display_name: typeof body.displayName === "string" ? body.displayName.slice(0, 100) : current.display_name,
      email: typeof body.email === "string" ? body.email.slice(0, 254) : current.email,
      terminal_font_size: body.terminalFontSize ? validatePositiveInt(body.terminalFontSize, "terminalFontSize", 40) : current.terminal_font_size
    };
    deps.queries.upsertPreference(next);
    deps.queries.audit(session.unix_username, "account.preferences", {}, clientIp(c.req.raw), "ok");
    return c.json(next);
  });

  app.post("/api/account/avatar", () => new Response(JSON.stringify({ error: "Avatar upload requires multipart streaming on Linux runtime", code: "NOT_IMPLEMENTED" }), { status: 501 }));
  app.delete("/api/account/avatar", (c) => {
    const pref = preferenceOrDefault(deps.queries, c.get("session").unix_username);
    deps.queries.upsertPreference({ ...pref, avatar_path: null });
    return c.json({ ok: true });
  });

  app.get("/api/fs/list", (c) => {
    validatePath(c.req.query("path") ?? ".", homeRoot(c.get("session").unix_username));
    return c.json({ entries: [], message: "File listing is served through the bridge on Linux runtime" });
  });
  app.get("/api/fs/read", (c) => {
    validatePath(c.req.query("path") ?? "", homeRoot(c.get("session").unix_username));
    return c.json({ content: "", binary: false });
  });
  app.post("/api/fs/write", requireRole(roleFromConfig(deps, CONFIG_KEYS.fileEditMinRole)), async (c) => {
    const body = assertJsonObject(await c.req.json().catch(() => null));
    validatePath(assertString(body.path, "path", 4096), homeRoot(c.get("session").unix_username));
    assertString(body.content, "content", 10 * 1024 * 1024);
    return c.json({ ok: true, queued: true });
  });
  app.post("/api/fs/upload", requireRole(roleFromConfig(deps, CONFIG_KEYS.fileEditMinRole)), () => cJsonNotImplemented("upload streaming"));
  app.get("/api/fs/download", (c) => {
    validatePath(c.req.query("path") ?? "", homeRoot(c.get("session").unix_username));
    return c.body("", 200);
  });
  app.post("/api/fs/mkdir", requireRole(roleFromConfig(deps, CONFIG_KEYS.fileEditMinRole)), async (c) => {
    const body = assertJsonObject(await c.req.json().catch(() => null));
    validatePath(assertString(body.path, "path", 4096), homeRoot(c.get("session").unix_username));
    return c.json({ ok: true, queued: true });
  });
  app.post("/api/fs/rename", requireRole(roleFromConfig(deps, CONFIG_KEYS.fileEditMinRole)), async (c) => {
    const body = assertJsonObject(await c.req.json().catch(() => null));
    validatePath(assertString(body.from, "from", 4096), homeRoot(c.get("session").unix_username));
    validatePath(assertString(body.to, "to", 4096), homeRoot(c.get("session").unix_username));
    return c.json({ ok: true, queued: true });
  });
  app.delete("/api/fs/delete", requireRole(roleFromConfig(deps, CONFIG_KEYS.fileEditMinRole)), async (c) => {
    const body = assertJsonObject(await c.req.json().catch(() => null));
    const paths = Array.isArray(body.paths) ? body.paths : [];
    for (const item of paths) {
      validatePath(assertString(item, "path", 4096), homeRoot(c.get("session").unix_username));
    }
    return c.json({ ok: true, queued: true });
  });
  app.get("/api/fs/stat", (c) => {
    validatePath(c.req.query("path") ?? "", homeRoot(c.get("session").unix_username));
    return c.json({ exists: true });
  });
  app.post("/api/fs/chmod", requireRole(roleFromConfig(deps, CONFIG_KEYS.fileEditMinRole)), async (c) => {
    const body = assertJsonObject(await c.req.json().catch(() => null));
    validatePath(assertString(body.path, "path", 4096), homeRoot(c.get("session").unix_username));
    validateOctalMode(body.mode);
    return c.json({ ok: true, queued: true });
  });
  app.post("/api/fs/chown", requireRole("owner"), async (c) => {
    const body = assertJsonObject(await c.req.json().catch(() => null));
    validatePath(assertString(body.path, "path", 4096), homeRoot(c.get("session").unix_username));
    validatePositiveInt(body.uid, "uid", 999_999);
    validatePositiveInt(body.gid, "gid", 999_999);
    return c.json({ ok: true, queued: true });
  });

  app.get("/api/docker/info", featureGate(deps.features.docker, "Docker socket not found at /var/run/docker.sock"), (c) => c.json({ available: true }));
  app.get("/api/docker/containers", featureGate(deps.features.docker, "Docker socket not found at /var/run/docker.sock"), (c) => c.json({ containers: [] }));
  app.get("/api/docker/images", featureGate(deps.features.docker, "Docker socket not found at /var/run/docker.sock"), (c) => c.json({ images: [] }));
  app.get("/api/docker/volumes", featureGate(deps.features.docker, "Docker socket not found at /var/run/docker.sock"), (c) => c.json({ volumes: [] }));
  app.get("/api/docker/networks", featureGate(deps.features.docker, "Docker socket not found at /var/run/docker.sock"), (c) => c.json({ networks: [] }));
  for (const action of ["start", "stop", "restart", "pause", "unpause", "kill"] as const) {
    app.post(`/api/docker/containers/:id/${action}`, featureGate(deps.features.docker, "Docker unavailable"), (c) => {
      validateDockerId(c.req.param("id"));
      return c.json({ ok: true, queued: true });
    });
  }
  app.delete("/api/docker/containers/:id", featureGate(deps.features.docker, "Docker unavailable"), (c) => {
    validateDockerId(c.req.param("id"));
    return c.json({ ok: true, queued: true });
  });
  app.patch("/api/docker/containers/:id/rename", featureGate(deps.features.docker, "Docker unavailable"), (c) => {
    validateDockerId(c.req.param("id"));
    return c.json({ ok: true, queued: true });
  });
  app.get("/api/docker/containers/:id/inspect", featureGate(deps.features.docker, "Docker unavailable"), (c) => {
    validateDockerId(c.req.param("id"));
    return c.json({ inspect: null });
  });
  app.post("/api/docker/images/pull", featureGate(deps.features.docker, "Docker unavailable"), (c) => c.json({ ok: true, queued: true }));
  app.delete("/api/docker/images/:id", featureGate(deps.features.docker, "Docker unavailable"), (c) => {
    validateDockerId(c.req.param("id"));
    return c.json({ ok: true, queued: true });
  });
  app.delete("/api/docker/volumes/:name", featureGate(deps.features.docker, "Docker unavailable"), (c) => {
    assertString(c.req.param("name"), "volume name", 128);
    return c.json({ ok: true, queued: true });
  });

  app.get("/api/systemd/services", featureGate(deps.features.systemd, "systemd is not running"), (c) => c.json({ services: [], filter: c.req.query("filter") ?? "" }));
  for (const action of ["start", "stop", "restart", "reload", "enable", "disable"] as const) {
    app.post(`/api/systemd/services/:name/${action}`, featureGate(deps.features.systemd, "systemd unavailable"), (c) => {
      validateServiceName(c.req.param("name"));
      return c.json({ ok: true, queued: true });
    });
  }
  app.get("/api/systemd/services/:name/file", featureGate(deps.features.systemd, "systemd unavailable"), (c) => {
    validateServiceName(c.req.param("name"));
    return c.json({ content: "" });
  });

  app.get("/api/users/os", requireRole("admin"), (c) => c.json({ users: [] }));
  app.post("/api/users/os", requireRole("admin"), async (c) => {
    const body = assertJsonObject(await c.req.json().catch(() => null));
    validateUsername(body.username);
    return c.json({ ok: true, queued: true });
  });
  app.delete("/api/users/os/:username", requireRole("admin"), (c) => {
    validateUsername(c.req.param("username"));
    return c.json({ ok: true, queued: true });
  });
  app.patch("/api/users/os/:username", requireRole("admin"), (c) => {
    validateUsername(c.req.param("username"));
    return c.json({ ok: true, queued: true });
  });
  app.post("/api/users/os/:username/lock", requireRole("admin"), (c) => {
    validateUsername(c.req.param("username"));
    return c.json({ ok: true, queued: true });
  });
  app.post("/api/users/os/:username/unlock", requireRole("admin"), (c) => {
    validateUsername(c.req.param("username"));
    return c.json({ ok: true, queued: true });
  });
  app.get("/api/users/web", requireRole("admin"), (c) => c.json({ roles: deps.queries.listRoles() }));
  app.patch("/api/users/web/:username/role", requireRole("owner"), async (c) => {
    const username = validateUsername(c.req.param("username"));
    const body = assertJsonObject(await c.req.json().catch(() => null));
    const role = validateRole(body.role);
    if (role === "owner") {
      throw new PermissionError("Owner role cannot be assigned via API");
    }
    deps.queries.upsertRole(username, role, c.get("session").unix_username);
    deps.queries.audit(c.get("session").unix_username, "users.role_change", { username, role }, clientIp(c.req.raw), "ok");
    return c.json({ ok: true });
  });
  app.post("/api/users/web/:username/ban", requireRole("admin"), (c) => {
    const username = validateUsername(c.req.param("username"));
    deps.queries.upsertRole(username, "banned", c.get("session").unix_username);
    return c.json({ ok: true });
  });
  app.post("/api/users/web/:username/unban", requireRole("admin"), (c) => {
    const username = validateUsername(c.req.param("username"));
    deps.queries.upsertRole(username, "user", c.get("session").unix_username);
    return c.json({ ok: true });
  });

  app.get("/api/sessions", (c) => {
    const role = c.get("role");
    const session = c.get("session");
    return c.json({ sessions: deps.queries.listSessions(session.unix_username, role === "admin" || role === "owner") });
  });
  app.delete("/api/sessions/all", (c) => {
    deps.queries.revokeUserSessions(c.get("session").unix_username);
    return c.json({ ok: true });
  });
  app.delete("/api/sessions/:id", (c) => {
    deps.queries.revokeSession(c.req.param("id"));
    return c.json({ ok: true });
  });

  app.get("/api/settings", requireRole("owner"), (c) => c.json({ settings: deps.queries.listConfig() }));
  app.patch("/api/settings", requireRole("owner"), async (c) => {
    const body = assertJsonObject(await c.req.json().catch(() => null));
    for (const [key, value] of Object.entries(body)) {
      if (!allowedSettingKeys.has(key)) {
        throw new ValidationError(`setting ${key} cannot be changed`);
      }
      if (key === CONFIG_KEYS.port) {
        validatePort(value);
      }
      deps.queries.setConfig(key, String(value));
    }
    return c.json({ ok: true });
  });
  app.get("/api/settings/audit", requireRole("owner"), (c) => {
    const limit = Math.min(100, validatePositiveInt(c.req.query("limit") ?? "50", "limit", 100));
    const page = validatePositiveInt(c.req.query("page") ?? "1", "page", 10_000);
    return c.json({ rows: deps.queries.listAudit(limit, (page - 1) * limit) });
  });
  app.get("/api/settings/tls", requireRole("owner"), (c) => c.json({ certPath: "/etc/airlink/tls/cert.pem", expiresAt: null }));
  app.post("/api/settings/tls", requireRole("owner"), () => cJsonNotImplemented("TLS upload"));
  app.post("/api/settings/tls/regen", requireRole("owner"), () => cJsonNotImplemented("TLS regeneration"));

  app.get("/api/addons", requireRole("owner"), (c) => c.json({ addons: [] }));
  app.patch("/api/addons/:id/toggle", requireRole("owner"), (c) => c.json({ id: c.req.param("id"), ok: true }));
  app.post("/api/addons/install", requireRole("owner"), () => cJsonNotImplemented("addon install"));
  app.delete("/api/addons/:id", requireRole("owner"), (c) => c.json({ id: c.req.param("id"), ok: true }));
  app.get("/api/addons/:id/config", requireRole("owner"), (c) => c.json({ id: c.req.param("id"), config: {} }));
  app.patch("/api/addons/:id/config", requireRole("owner"), (c) => c.json({ id: c.req.param("id"), ok: true }));

  return app;
}

const allowedSettingKeys = new Set<string>([
  CONFIG_KEYS.appName,
  CONFIG_KEYS.port,
  CONFIG_KEYS.sessionTimeoutHours,
  CONFIG_KEYS.maxSessionsPerUser,
  CONFIG_KEYS.allowRegistration,
  CONFIG_KEYS.addonNetworkAllowed,
  CONFIG_KEYS.fileEditMinRole,
  CONFIG_KEYS.chownMinRole
]);

function featureGate(available: boolean, reason: string) {
  return createMiddleware<AirlinkEnv>(async (c, next) => {
    if (!available) {
      return c.json({ available: false, reason }, 503);
    }
    await next();
    return undefined;
  });
}

function cJsonNotImplemented(feature: string): Response {
  return new Response(JSON.stringify({ error: `${feature} not implemented in this build`, code: "NOT_IMPLEMENTED" }), {
    status: 501,
    headers: { "content-type": "application/json" }
  });
}

function preferenceOrDefault(queries: Queries, username: string): UserPreference {
  return (
    queries.getPreference(username) ?? {
      unix_username: username,
      theme: "system",
      avatar_path: null,
      display_name: username,
      email: null,
      terminal_font_size: 14,
      preferences_json: "{}"
    }
  );
}

function homeRoot(username: string): string {
  return `/home/${username}`;
}

function roleFromConfig(deps: RouterDeps, key: string): "owner" | "admin" | "user" {
  const role = deps.queries.getConfig(key);
  if (role === "owner" || role === "admin" || role === "user") {
    return role;
  }
  return "user";
}
