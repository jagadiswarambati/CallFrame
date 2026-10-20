// Shared fetch wrapper for the Callframe API. Used by the workspace and the history pages.
// When the API answers 401 UNAUTHORIZED it asks for the access code once (through the
// AccessCodeGate dialog), keeps it in sessionStorage and retries the request.

export const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export const MUTATING_TIMEOUT_MS = 12_000;
export const ASSIST_TIMEOUT_MS = 35_000;

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

function storeAccessCode(code: string) {
  try {
    window.sessionStorage.setItem(ACCESS_CODE_STORAGE_KEY, code);
  } catch {
    // Storage blocked: the code is asked for again on the next 401.
  }
}

function clearAccessCode() {
  try {
    window.sessionStorage.removeItem(ACCESS_CODE_STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

// The gate dialog registers itself here. Without a registered prompt (e.g. server render)
// a 401 is simply thrown to the caller.
type AccessCodePrompt = (rejected: boolean) => Promise<string | null>;
let promptHandler: AccessCodePrompt | null = null;
let pendingPrompt: Promise<string | null> | null = null;

export function registerAccessCodePrompt(handler: AccessCodePrompt | null) {
  promptHandler = handler;
}

// Several requests can hit 401 at once; they all share one dialog.
function askForAccessCode(rejected: boolean): Promise<string | null> {
  if (!promptHandler) return Promise.resolve(null);
  if (!pendingPrompt) {
    pendingPrompt = promptHandler(rejected).finally(() => {
      pendingPrompt = null;
    });
  }
  return pendingPrompt;
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

async function requestOnce<T>(path: string, init: RequestInit): Promise<T> {
  const accessCode = readAccessCode();
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessCode) headers.set("x-access-code", accessCode);

  const method = (init.method ?? "GET").toUpperCase();
  const mayRetry = method === "GET" || method === "HEAD";

  // Every request gets a hard timeout unless the caller supplies its own AbortSignal.
  // This also prevents History/detail loading states from waiting forever on a stuck GET.
  // Assist requests get ASSIST_TIMEOUT_MS (35s) to allow Gemini generation sufficient time.
  let signal = init.signal ?? undefined;
  if (!signal) {
    const isAssist = path.includes("/assist");
    signal = AbortSignal.timeout(isAssist ? ASSIST_TIMEOUT_MS : MUTATING_TIMEOUT_MS);
  }

  const request: RequestInit = { ...init, headers, signal };

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, request);
  } catch (firstError) {
    if (isAbort(firstError)) {
      // Distinguish a user-initiated abort from a timeout so callers can show different messages.
      const isTimeout = firstError instanceof DOMException && firstError.name === "TimeoutError";
      throw new ApiError(
        0,
        isTimeout ? "TIMEOUT" : "ABORTED",
        isTimeout
          ? "The request timed out. Check your connection and retry."
          : NETWORK_MESSAGE,
      );
    }
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

function isUnauthorized(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 401 && error.code === "UNAUTHORIZED";
}

function logApiFailure(path: string, init: RequestInit, error: unknown) {
  const safePath = path
    .split("?")[0]
    .replace(/\/api\/calls\/[^/]+/g, "/api/calls/:id");
  const method = (init.method ?? "GET").toUpperCase();
  let safeOrigin = "invalid";
  try {
    safeOrigin = new URL(apiUrl).origin;
  } catch {
    // Report only that configuration is invalid; never echo arbitrary URL input.
  }
  const diagnostic = error instanceof ApiError
    ? { method, origin: safeOrigin, path: safePath, status: error.status, code: error.code }
    : { method, origin: safeOrigin, path: safePath, code: "UNEXPECTED" };

  console.warn("Callframe API request failed", diagnostic);
}

const MAX_CODE_ATTEMPTS = 3;

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let used = readAccessCode();
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await requestOnce<T>(path, init);
    } catch (error) {
      if (!isUnauthorized(error) || attempt >= MAX_CODE_ATTEMPTS) {
        logApiFailure(path, init, error);
        throw error;
      }
      const current = readAccessCode();
      if (current !== used) {
        // Another request supplied a code while this one was in flight: just retry with it.
        used = current;
        continue;
      }
      // The code we sent (if any) was refused: drop it and ask once.
      if (current) clearAccessCode();
      const code = await askForAccessCode(current !== null);
      if (!code) throw error;
      storeAccessCode(code);
      used = code;
    }
  }
}

function isAbort(error: unknown) {
  return error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError");
}
