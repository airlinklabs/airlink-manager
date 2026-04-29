export type ApiErrorBody = {
  error: string;
  code: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "GET" });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return body === undefined ? apiRequest<T>(path, { method: "POST" }) : apiRequest<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export async function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return body === undefined ? apiRequest<T>(path, { method: "DELETE" }) : apiRequest<T>(path, { method: "DELETE", body: JSON.stringify(body) });
}

export async function apiRequest<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const csrf = readCookie("airlink_csrf");
  if (csrf) {
    headers.set("x-csrf-token", csrf);
  }
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include"
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? ((await response.json()) as unknown) : await response.text();
  if (!response.ok) {
    const body = typeof data === "object" && data !== null ? (data as Partial<ApiErrorBody>) : {};
    throw new ApiError(body.error ?? "Request failed", body.code ?? "REQUEST_FAILED", response.status);
  }
  return data as T;
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const found = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : null;
}
