import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { stat } from "node:fs/promises";
import { COOKIE_NAMES, CONFIG_KEYS, ROLE_HIERARCHY, SESSION_TOKEN_BYTES, WS_TOKEN_TTL_SECONDS } from "../shared/constants.ts";
import { AppError, PermissionError, ValidationError } from "../shared/errors.ts";
import type { ActiveRole, AirlinkEnv, JsonObject, Role, WebSession } from "../shared/types.ts";
import { validateUsername } from "../shared/validate.ts";
import type { Queries } from "../db/queries.ts";
import { createCsrfToken, csrfCookie } from "./csrf.ts";
import { log } from "./logger.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type AuthDeps = {
  queries: Queries;
  appSecret: () => string;
};

export function randomHex(bytes: number): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("hex");
}

export function createSessionToken(): string {
  return randomHex(SESSION_TOKEN_BYTES);
}

export function fingerprint(ip: string, userAgent: string, appSecret: string, strictIp = true): string {
  const bindKey = strictIp ? `${ip}:${userAgent}` : userAgent;
  return new Bun.CryptoHasher("sha256").update(`${bindKey}:${appSecret}`).digest("hex");
}

export async function authenticateUnixUser(username: string, password: string): Promise<boolean> {
  validateUsername(username);
  if (password.length === 0 || password.length > 4096) {
    throw new ValidationError("password length is invalid");
  }

  const shadowResult = await verifyViaShadow(username, password);
  if (shadowResult !== null) {
    return shadowResult;
  }
  return verifyViaSu(username, password);
}

async function verifyViaShadow(username: string, password: string): Promise<boolean | null> {
  try {
    const shadow = await Bun.file("/etc/shadow").text();
    const line = shadow.split("\n").find((candidate) => candidate.startsWith(`${username}:`));
    if (!line) {
      return false;
    }
    const hash = line.split(":")[1];
    if (!hash || hash === "!" || hash === "*") {
      return false;
    }
    return await Bun.password.verify(password, hash);
  } catch (error) {
    if (error instanceof Error) {
      log("debug", "shadow auth unavailable", { error: error.message });
    }
    return null;
  }
}

async function verifyViaSu(username: string, password: string): Promise<boolean> {
  log("warn", "using su fallback for auth - shadow file not readable by daemon");
  const suBin = await resolveExecutable("su");
  if (!suBin) {
    log("error", "su not found - authentication will fail");
    return false;
  }

  const proc = Bun.spawn([suBin, "-s", "/bin/sh", "-c", "true", username], {
    stdin: "pipe",
    stdout: "ignore",
    stderr: "ignore"
  });
  await proc.stdin.write(encoder.encode(`${password}\n`));
  proc.stdin.end();

  const timeoutHandle = setTimeout(() => proc.kill(9), 10_000);
  const exitCode = await proc.exited;
  clearTimeout(timeoutHandle);
  return exitCode === 0;
}

async function resolveExecutable(name: string): Promise<string | null> {
  for (const dir of ["/bin", "/usr/bin", "/sbin", "/usr/sbin"]) {
    const candidate = `${dir}/${name}`;
    if (await Bun.file(candidate).exists()) {
      const info = await stat(candidate).catch(() => null);
      if (info && (info.mode & 0o4000) === 0) {
        log("error", `${candidate} is not setuid - authentication will fail`);
        return null;
      }
      return candidate;
    }
  }
  return null;
}

export function sessionCookie(value: string, maxAgeSeconds: number): string {
  return `${COOKIE_NAMES.session}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAMES.session}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function sessionAuth(deps: AuthDeps) {
  return createMiddleware<AirlinkEnv>(async (c, next) => {
    const token = getCookie(c, COOKIE_NAMES.session);
    if (!token) {
      return c.json({ error: "Unauthorized", code: "NO_SESSION" }, 401);
    }

    const session = deps.queries.findSession(token);
    if (!session) {
      return c.json({ error: "Unauthorized", code: "INVALID_SESSION" }, 401);
    }

    const ip = clientIp(c.req.raw);
    const ua = c.req.header("user-agent") ?? "";
    const strictIp = (deps.queries.getConfig(CONFIG_KEYS.strictSessionBinding) ?? "1") !== "0";
    const expected = fingerprint(ip, ua, deps.appSecret(), strictIp);
    if (session.fingerprint !== expected) {
      deps.queries.revokeSession(session.id);
      deps.queries.audit(session.unix_username, "auth.session_fingerprint_mismatch", { ip }, ip, "denied");
      return c.json({ error: "Unauthorized", code: "FINGERPRINT_MISMATCH" }, 401);
    }

    const role = deps.queries.roleFor(session.unix_username);
    if (role === "banned") {
      deps.queries.revokeSession(session.id);
      return c.json({ error: "Forbidden", code: "BANNED" }, 403);
    }

    deps.queries.touchSession(session.id, unixNow());
    c.set("session", session);
    c.set("role", role);
    const csrf = await createCsrfToken(session.id, deps.appSecret());
    c.header("Set-Cookie", csrfCookie(csrf), { append: true });
    await next();
    return undefined;
  });
}

export const requireRole = (minRole: ActiveRole) =>
  createMiddleware<AirlinkEnv>(async (c, next) => {
    const session = c.get("session");
    if (!session) {
      return c.json({ error: "Unauthorized", code: "NO_SESSION" }, 401);
    }
    const role = c.get("role");
    if (role === "banned") {
      return c.json({ error: "Forbidden", code: "BANNED" }, 403);
    }
    if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minRole]) {
      return c.json({ error: "Forbidden", code: "INSUFFICIENT_ROLE" }, 403);
    }
    await next();
    return undefined;
  });

export async function issueWsToken(payload: {
  username: string;
  role: Role;
  sessionId: string;
  appSecret: string;
  now?: number;
}): Promise<string> {
  const now = payload.now ?? unixNow();
  const header = { alg: "HS256", typ: "JWT" } satisfies JsonObject;
  const body = {
    sub: payload.username,
    role: payload.role,
    sessionId: payload.sessionId,
    exp: now + WS_TOKEN_TTL_SECONDS
  } satisfies JsonObject;
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(body))}`;
  const signature = await hmacSha256(unsigned, payload.appSecret);
  return `${unsigned}.${base64Url(signature)}`;
}

export async function verifyWsToken(token: string, appSecret: string, now = unixNow()): Promise<{
  username: string;
  role: Role;
  sessionId: string;
}> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new PermissionError("Invalid WebSocket token");
  }
  const [encodedHeader, encodedBody, encodedSignature] = parts;
  if (!encodedHeader || !encodedBody || !encodedSignature) {
    throw new PermissionError("Invalid WebSocket token");
  }
  const unsigned = `${encodedHeader}.${encodedBody}`;
  const expected = base64Url(await hmacSha256(unsigned, appSecret));
  if (!timingSafeEqual(encodedSignature, expected)) {
    throw new PermissionError("Invalid WebSocket token");
  }
  const payload = JSON.parse(decoder.decode(base64UrlDecode(encodedBody))) as unknown;
  if (!isWsPayload(payload)) {
    throw new PermissionError("Invalid WebSocket token payload");
  }
  if (payload.exp <= now) {
    throw new PermissionError("Expired WebSocket token");
  }
  return { username: payload.sub, role: payload.role, sessionId: payload.sessionId };
}

export function unixNow(): number {
  return Math.floor(Date.now() / 1000);
}

export function clientIp(request: Request): string {
  const url = new URL(request.url);
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? url.hostname;
}

export function setLoginCookies(headers: Headers, sessionId: string, maxAgeSeconds: number, csrf: string): void {
  headers.append("Set-Cookie", sessionCookie(sessionId, maxAgeSeconds));
  headers.append("Set-Cookie", csrfCookie(csrf));
}

export function appSecretOrThrow(queries: Queries): string {
  const value = queries.getConfig(CONFIG_KEYS.appSecret);
  if (!value) {
    throw new AppError("App secret is not configured", "APP_SECRET_MISSING", 500);
  }
  return value;
}

export async function resolveUidGid(username: string): Promise<{ uid: number; gid: number }> {
  const passwd = await Bun.file("/etc/passwd").text().catch(() => "");
  for (const line of passwd.split("\n")) {
    const parts = line.split(":");
    if (parts[0] === username && parts.length >= 4) {
      const uid = Number(parts[2]);
      const gid = Number(parts[3]);
      if (Number.isInteger(uid) && Number.isInteger(gid) && uid > 0) {
        return { uid, gid };
      }
    }
  }

  const uidProc = Bun.spawn(["id", "-u", username], { stdout: "pipe", stderr: "ignore" });
  const gidProc = Bun.spawn(["id", "-g", username], { stdout: "pipe", stderr: "ignore" });
  const [uidCode, gidCode] = await Promise.all([uidProc.exited, gidProc.exited]);
  if (uidCode !== 0 || gidCode !== 0) {
    throw new Error(`Cannot resolve uid/gid for user: ${username}`);
  }
  const uid = Number((await new Response(uidProc.stdout).text()).trim());
  const gid = Number((await new Response(gidProc.stdout).text()).trim());
  if (!Number.isInteger(uid) || !Number.isInteger(gid) || uid === 0) {
    throw new Error(`Resolved uid=${uid} gid=${gid} for ${username} - refusing root bridge`);
  }
  return { uid, gid };
}

function base64Url(input: string | ArrayBuffer): string {
  const bytes = typeof input === "string" ? encoder.encode(input) : new Uint8Array(input);
  return Buffer.from(bytes).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=").replaceAll("-", "+").replaceAll("_", "/");
  return new Uint8Array(Buffer.from(padded, "base64"));
}

async function hmacSha256(value: string, secret: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, encoder.encode(value));
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function isWsPayload(value: unknown): value is { sub: string; role: Role; sessionId: string; exp: number } {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.sub === "string" &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.exp === "number" &&
    (candidate.role === "owner" || candidate.role === "admin" || candidate.role === "user")
  );
}
