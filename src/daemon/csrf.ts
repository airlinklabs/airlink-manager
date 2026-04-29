import { COOKIE_NAMES } from "../shared/constants.ts";
import { ValidationError } from "../shared/errors.ts";

const encoder = new TextEncoder();

export async function createCsrfToken(sessionId: string, appSecret: string, now = Date.now()): Promise<string> {
  const day = Math.floor(now / 86_400_000);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${sessionId}:${day}`));
  return bytesToHex(new Uint8Array(signature));
}

export async function validateCsrfToken(
  sessionId: string,
  appSecret: string,
  headerToken: string | null,
  cookieToken: string | null,
  now = Date.now()
): Promise<void> {
  if (!headerToken || !cookieToken) {
    throw new ValidationError("Missing CSRF token");
  }
  if (headerToken !== cookieToken) {
    throw new ValidationError("CSRF token mismatch");
  }

  const today = await createCsrfToken(sessionId, appSecret, now);
  const yesterday = await createCsrfToken(sessionId, appSecret, now - 86_400_000);
  if (!timingSafeEqualHex(headerToken, today) && !timingSafeEqualHex(headerToken, yesterday)) {
    throw new ValidationError("Invalid CSRF token");
  }
}

export function csrfCookie(token: string): string {
  return `${COOKIE_NAMES.csrf}=${token}; Secure; SameSite=Strict; Path=/`;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}
