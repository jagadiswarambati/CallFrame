// Shared fetch wrapper for the Callframe API. Used by the history pages.
// (The workspace still has its own copy; it is intentionally not refactored yet.)

export const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export const ACCESS_CODE_STORAGE_KEY = "callframe.accessCode";

export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: FieldError[];

  constructor(status: number, code: string, message: string, details: FieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// sessionStorage can throw (private windows, blocked storage); the app must work without it.
function readAccessCode(): string | null {
  try {
    const value = window.sessionStorage.getItem(ACCESS_CODE_STORAGE_KEY);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

const NETWORK_MESSAGE = "Could not reach the server. It may be waking up; please retry in a moment.";

type ErrorPayload = { error?: { code?: unknown; message?: unknown; details?: unknown } };

function toDetails(value: unknown): FieldError[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const entry = item as { field?: unknown; message?: unknown } | null;
    return typeof entry?.field === "string" && typeof entry.message === "string"
      ? [{ field: entry.field, message: entry.message }]
      : [];
  });
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessCode = readAccessCode();
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessCode) headers.set("x-access-code", accessCode);
  const request: RequestInit = { ...init, headers };

  // One retry, and only when the request never got an HTTP answer (network error)
  // and cannot change data. HTTP errors (4xx/5xx) are never retried.
  const method = (init.method ?? "GET").toUpperCase();
  const mayRetry = method === "GET" || method === "HEAD";

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, request);
  } catch (firstError) {
    if (isAbort(firstError)) throw firstError;
    if (!mayRetry) throw new ApiError(0, "NETWORK", NETWORK_MESSAGE);
    try {
      response = await fetch(`${apiUrl}${path}`, request);
    } catch (secondError) {
      if (isAbort(secondError)) throw secondError;
      throw new ApiError(0, "NETWORK", NETWORK_MESSAGE);
    }
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload as ErrorPayload | null)?.error;
    throw new ApiError(
      response.status,
      typeof error?.code === "string" ? error.code : "HTTP_ERROR",
      typeof error?.message === "string" ? error.message : "The request could not be completed. Please retry.",
      toDetails(error?.details),
    );
  }
  if (payload === null) {
    throw new ApiError(response.status, "BAD_RESPONSE", "The server sent an unreadable answer. Please retry.");
  }
  return payload as T;
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
