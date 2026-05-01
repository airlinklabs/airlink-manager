import { existsSync } from "node:fs";
import path from "node:path";
import { createDatabase } from "../db/index.ts";
import { AIRLINK_PATHS, CONFIG_KEYS, DEFAULT_PORT, VERSION } from "../shared/constants.ts";
import type { FeatureFlags, WebSession } from "../shared/types.ts";
import { createRouter } from "./router.ts";
import { loadTlsMaterial, tlsExists } from "./tls.ts";
import { SessionManager } from "./session.ts";
import { resolveUidGid } from "./auth.ts";
import { authenticateWsRequest, handleWsMessage } from "./ws.ts";
import { log } from "./logger.ts";

export async function runDaemon(): Promise<void> {
  const startedAt = Date.now();
  const { queries } = await createDatabase();
  const secret = queries.getConfig(CONFIG_KEYS.appSecret);
  if (!secret) {
    log("warn", "app secret missing; run airlink install before production use");
    queries.setConfig(CONFIG_KEYS.appSecret, Buffer.from(crypto.getRandomValues(new Uint8Array(64))).toString("hex"));
  }
  const features = await detectFeatures();
  const sessions = new SessionManager();
  const appSecret = () => queries.getConfig(CONFIG_KEYS.appSecret) ?? "";
  const app = createRouter({ queries, appSecret, features, startedAt });
  const staticNonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const port = Number(queries.getConfig(CONFIG_KEYS.port) ?? String(DEFAULT_PORT));
  const tls = (await tlsExists()) ? await loadTlsMaterial() : null;
  const serveOptions = {
    port,
    async fetch(request, serverInstance) {
      const url = new URL(request.url);
      if (url.pathname === "/ws") {
        try {
          const session = await authenticateWsRequest(request, { queries, appSecret, sessions });
          const upgraded = serverInstance.upgrade(request, { data: { session } });
          if (!upgraded) {
            return new Response("upgrade failed", { status: 400 });
          }
          return undefined;
        } catch {
          return new Response("unauthorized", { status: 401 });
        }
      }
      const apiResponse = await app.fetch(request);
      if (apiResponse.status !== 404 || url.pathname.startsWith("/api/")) {
        return apiResponse;
      }
      return serveSpaAsset(url.pathname, staticNonce);
    },
    websocket: {
      async open(ws) {
        const session = ws.data.session;
        sessions.attachSocket(session, ws);
        ws.send(JSON.stringify({ type: "connected", sessionId: session.id, username: session.unix_username }));
        try {
          const { uid, gid } = await resolveUidGid(session.unix_username);
          await sessions.ensureBridge(session, uid, gid);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "bridge spawn failed";
          ws.send(JSON.stringify({
            type: "notification",
            id: crypto.randomUUID(),
            level: "error",
            message: `Bridge failed to start: ${msg}`
          }));
        }
      },
      message(ws, message) {
        handleWsMessage(ws.data.session, ws, message, { queries, appSecret, sessions });
      },
      close(ws) {
        sessions.detachSocket(ws.data.session.id, ws);
      }
    }
  } satisfies Parameters<typeof Bun.serve<{ session: WebSession }>>[0];
  const server = Bun.serve<{ session: WebSession }>(tls ? { ...serveOptions, tls } : serveOptions);

  const cleanupIntervalMs = 60 * 60 * 1000;
  setInterval(() => {
    try {
      const deleted = queries.purgeExpiredSessions();
      if (deleted > 0) {
        log("info", "purged expired sessions", { count: deleted });
      }
    } catch (err) {
      log("warn", "session purge failed", { error: err instanceof Error ? err.message : String(err) });
    }
  }, cleanupIntervalMs);

  log("info", "Airlink daemon started", {
    version: VERSION,
    port: server.port,
    tls: Boolean(tls),
    url: `${tls ? "https" : "http"}://localhost:${server.port}`
  });

  await new Promise<void>((resolve) => {
    const shutdown = () => {
      server.stop();
      resolve();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}

async function detectFeatures(): Promise<FeatureFlags> {
  return {
    docker: existsSync("/var/run/docker.sock"),
    systemd: await commandAvailable(["systemctl", "--version"]),
    accountsService: existsSync("/var/lib/AccountsService"),
    shadowReadable: await Bun.file("/etc/shadow").exists()
  };
}

async function commandAvailable(command: string[]): Promise<boolean> {
  try {
    const proc = Bun.spawn(command, { stdout: "ignore", stderr: "ignore" });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

async function serveSpaAsset(pathname: string, nonce: string): Promise<Response> {
  const cleaned = pathname === "/" ? "/index.html" : pathname;
  const relative = cleaned.replace(/^\/+/u, "").replace(/\.\./gu, "");
  const distDir = path.resolve(process.cwd(), "frontend", "dist");
  const diskPath = path.resolve(distDir, relative);
  if (!diskPath.startsWith(distDir + path.sep) && diskPath !== distDir) {
    return new Response("not found", { status: 404 });
  }
  const file = Bun.file(diskPath);
  if (!(await file.exists())) {
    const index = Bun.file(path.join(distDir, "index.html"));
    if (!(await index.exists())) {
      return new Response("frontend not built", { status: 503 });
    }
    return withStaticHeaders(index, "no-cache", nonce);
  }
  if (relative === "index.html") {
    return withStaticHeaders(file, "no-cache", nonce);
  }
  const immutable = /\.[a-f0-9]{8,}\./iu.test(relative);
  return withStaticHeaders(file, immutable ? "public, max-age=31536000, immutable" : "no-cache", nonce);
}

async function withStaticHeaders(file: ReturnType<typeof Bun.file>, cacheControl: string, nonce: string): Promise<Response> {
  const bytes = await file.arrayBuffer();
  const etag = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "connect-src 'self' wss:",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join("; ");
  if (file.type?.includes("html")) {
    const html = new TextDecoder().decode(bytes).replace(/__CSP_NONCE__|\{NONCE\}/gu, nonce);
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": cacheControl,
        "content-security-policy": csp,
        etag
      }
    });
  }
  return new Response(bytes, {
    headers: {
      "content-type": file.type || "application/octet-stream",
      "cache-control": cacheControl,
      "content-security-policy": csp,
      etag
    }
  });
}
