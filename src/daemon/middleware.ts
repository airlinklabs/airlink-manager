import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { COOKIE_NAMES, MUTATING_METHODS, RATE_LIMITS, SAME_ORIGIN_CORS_HEADERS, SECURITY_HEADER_NAMES } from "../shared/constants.ts";
import { AppError, RateLimitError, errorToPayload } from "../shared/errors.ts";
import type { AirlinkEnv } from "../shared/types.ts";
import { validateCsrfToken } from "./csrf.ts";
import { clientIp } from "./auth.ts";
import { log } from "./logger.ts";

export type Bucket = { tokens: number; lastRefill: number };

export class TokenBucketStore {
  private readonly buckets = new Map<string, Bucket>();

  consumeToken(key: string, capacity: number, refillPerSecond: number, now = Date.now()): { allowed: boolean; remaining: number; retryAfter: number } {
    const bucket = this.buckets.get(key) ?? { tokens: capacity, lastRefill: now };
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerSecond);
    bucket.lastRefill = now;

    if (bucket.tokens < 1) {
      this.buckets.set(key, bucket);
      const retryAfter = Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerSecond));
      return { allowed: false, remaining: Math.floor(bucket.tokens), retryAfter };
    }

    bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfter: 0 };
  }

  purgeStale(maxAgeMs: number, now = Date.now()): void {
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAgeMs) {
        this.buckets.delete(key);
      }
    }
  }

  size(): number {
    return this.buckets.size;
  }
}

export const sharedBuckets = new TokenBucketStore();

export const requestId = () =>
  createMiddleware<AirlinkEnv>(async (c, next) => {
    const id = crypto.randomUUID();
    c.set("requestId", id);
    c.header(SECURITY_HEADER_NAMES.requestId, id);
    await next();
  });

export const requestLogger = () =>
  createMiddleware<AirlinkEnv>(async (c, next) => {
    const started = performance.now();
    await next();
    log("info", "request completed", {
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      duration_ms: Math.round(performance.now() - started),
      requestId: c.get("requestId")
    });
  });

export const securityHeaders = () =>
  createMiddleware<AirlinkEnv>(async (c, next) => {
    const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
    c.set("cspNonce", nonce);
    c.header(
      SECURITY_HEADER_NAMES.csp,
      [
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
      ].join("; ")
    );
    c.header("X-Frame-Options", "DENY");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-XSS-Protection", "0");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    c.header("Cross-Origin-Opener-Policy", "same-origin");
    c.header("Cross-Origin-Resource-Policy", "same-origin");
    c.header("Cross-Origin-Embedder-Policy", "require-corp");
    await next();
  });

export const sameOriginCors = () =>
  createMiddleware<AirlinkEnv>(async (c, next) => {
    const origin = c.req.header("origin");
    if (origin) {
      const requestOrigin = new URL(c.req.url).origin;
      if (origin === requestOrigin) {
        c.header("Access-Control-Allow-Origin", origin);
        for (const [key, value] of Object.entries(SAME_ORIGIN_CORS_HEADERS)) {
          c.header(key, value);
        }
      }
    }
    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }
    await next();
    return undefined;
  });

export const rateLimit = (kind: keyof typeof RATE_LIMITS, store = sharedBuckets) =>
  createMiddleware<AirlinkEnv>(async (c, next) => {
    const limit = RATE_LIMITS[kind];
    const ip = clientIp(c.req.raw);
    const sessionId = kind !== "auth" ? getCookie(c, COOKIE_NAMES.session) : null;
    const key = `${kind}:${sessionId ? `session:${sessionId}` : `ip:${ip}`}`;
    const result = store.consumeToken(key, limit.capacity, limit.refillPerSecond);
    c.header("X-RateLimit-Remaining", String(result.remaining));
    if (!result.allowed) {
      c.header("Retry-After", String(result.retryAfter));
      return c.json({ error: "Rate limit exceeded", code: "RATE_LIMITED" }, 429);
    }
    await next();
    return undefined;
  });

export const compression = () =>
  createMiddleware<AirlinkEnv>(async (c, next) => {
    await next();
    if (!c.req.header("accept-encoding")?.includes("gzip")) {
      return;
    }
    const contentType = c.res.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      return;
    }
    const clone = c.res.clone();
    const body = await clone.arrayBuffer();
    if (body.byteLength <= 1024) {
      return;
    }
    const gzipped = await gzipBody(body);
    const compressed = new ArrayBuffer(gzipped.byteLength);
    new Uint8Array(compressed).set(gzipped);
    c.res = new Response(compressed, {
      status: c.res.status,
      statusText: c.res.statusText,
      headers: c.res.headers
    });
    c.header("Content-Encoding", "gzip");
    c.header("Vary", "Accept-Encoding");
    return undefined;
  });

export const csrfValidate = (appSecret: () => string) =>
  createMiddleware<AirlinkEnv>(async (c, next) => {
    if (!MUTATING_METHODS.includes(c.req.method as (typeof MUTATING_METHODS)[number])) {
      await next();
      return;
    }
    const session = c.get("session");
    if (!session) {
      return c.json({ error: "Unauthorized", code: "NO_SESSION" }, 401);
    }
    try {
      await validateCsrfToken(
        session.id,
        appSecret(),
        c.req.header("x-csrf-token") ?? null,
        getCookie(c, COOKIE_NAMES.csrf) ?? null
      );
    } catch (error) {
      const payload = errorToPayload(error);
      return c.json({ error: payload.message, code: payload.code }, payload.status as 400);
    }
    await next();
    return undefined;
  });

export function installErrorHandler(app: { onError: (handler: (err: Error, c: { json: (body: unknown, status?: number) => Response }) => Response) => void }): void {
  app.onError((err, c) => {
    if (err instanceof RateLimitError) {
      return c.json({ error: err.message, code: err.code, retryAfter: err.retryAfter }, err.status);
    }
    if (err instanceof AppError) {
      return c.json({ error: err.message, code: err.code }, err.status);
    }
    log("error", "unhandled error", { error: err.message });
    return c.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, 500);
  });
}

async function gzipBody(body: ArrayBuffer): Promise<Uint8Array> {
  const bun = Bun as typeof Bun & { gzip?: (input: ArrayBuffer) => Promise<Uint8Array> };
  if (bun.gzip) {
    return bun.gzip(body);
  }
  const stream = new Blob([body]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
