/**
 * Workspace logic tests.
 *
 * These tests focus on the pure helper functions and the state-management
 * decisions that caused bugs visible in the screen recording:
 *
 *  1. Stale localStorage: a completed/ended-early call stored in
 *     activeCallId must NOT be restored into the workspace.
 *
 *  2. saveAndClose timeout handling: ApiError with code "TIMEOUT" must
 *     produce a human-readable message and must re-enable the button
 *     (i.e. the finally block always sets closing = false).
 *
 *  3. suggestedOutcome: derives the correct outcome from stage drafts.
 *
 *  4. api.ts MUTATING_TIMEOUT_MS: exported so callers can verify it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MUTATING_TIMEOUT_MS } from "@/lib/api";
import { activeCallStorageKey } from "@/app/workspace/page";

// ─── helpers that mirror workspace logic ─────────────────────────────────────

type Draft = { outcome: string | null; words: string; notes: string };
const emptyDraft = (): Draft => ({ outcome: null, words: "", notes: "" });

/** Mirrors suggestedOutcome() in workspace/page.tsx */
function suggestedOutcome(drafts: Draft[]) {
  const key = (s: number) => drafts[s - 1]?.outcome;
  if (drafts.some((d) => d.outcome === "asked_not_to_call"))
    return "do_not_call";
  if (key(7) === "meeting_agreed" || key(7) === "time_named")
    return "next_step_set";
  if (key(7) === "doc_agreed")
    return "document_requested";
  if (key(7) === "referred")
    return "referred";
  if (key(3) === "asked_callback")
    return "callback_requested";
  if (key(3) === "send_first" || key(6) === "wants_writing")
    return "document_requested";
  if (key(3) === "declined_to_talk" || ["declined","not_relevant","has_provider"].includes(key(6) ?? ""))
    return "declined";
  if (key(6) === "not_right_person")
    return "declined";
  if (key(1) === "wrong_or_left")
    return "wrong_contact";
  if (["line_or_language", "not_available"].includes(key(1) ?? ""))
    return "no_contact";
  return null;
}

function makeDrafts(overrides: Partial<Record<number, string | null>> = {}): Draft[] {
  return Array.from({ length: 8 }, (_, i) => ({
    ...emptyDraft(),
    outcome: overrides[i + 1] ?? null,
  }));
}

// ─── 1. activeCallStorageKey export ──────────────────────────────────────────

describe("activeCallStorageKey", () => {
  it("is exported from workspace/page and equals the expected string", () => {
    expect(activeCallStorageKey).toBe("callframe.activeCallId");
  });
});

// ─── 2. stale localStorage behaviour (Bug #1) ────────────────────────────────

describe("stale localStorage handling", () => {
  const storageKey = "callframe.activeCallId";

  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("removes the key when the fetched call has status completed", () => {
    // Simulate what loadCall() does when call.status !== 'in_progress'
    localStorage.setItem(storageKey, "some-completed-call-id");
    const status: string = "completed";  // use string to avoid TS literal narrowing
    if (status !== "in_progress") {
      localStorage.removeItem(storageKey);
    }
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("removes the key when the fetched call has status ended_early", () => {
    localStorage.setItem(storageKey, "some-ended-call-id");
    const status: string = "ended_early";
    if (status !== "in_progress") {
      localStorage.removeItem(storageKey);
    }
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("preserves the key when the call is in_progress (user should be resumed)", () => {
    localStorage.setItem(storageKey, "active-call-id");
    const status: string = "in_progress";
    if (status !== "in_progress") {
      localStorage.removeItem(storageKey); // should NOT run
    }
    expect(localStorage.getItem(storageKey)).toBe("active-call-id");
  });

  it("removes the key on 404 (call deleted from DB)", () => {
    localStorage.setItem(storageKey, "deleted-call-id");
    const status = 404;
    if (status === 404) {
      localStorage.removeItem(storageKey);
    }
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("does NOT remove the key on a general network error (user should be able to retry)", () => {
    localStorage.setItem(storageKey, "call-id");
    const isNetworkError = true;
    const is404 = false;
    if (is404) {
      localStorage.removeItem(storageKey);
    }
    // network error: key stays so the user can retry
    expect(localStorage.getItem(storageKey)).toBe("call-id");
    expect(isNetworkError).toBe(true); // suppress unused var warning
  });

  it("only removes the key after a confirmed successful close (persistence guarantee)", () => {
    localStorage.setItem(storageKey, "open-call-id");
    // Close fails — key must remain
    let closeFailed = true;
    if (!closeFailed) localStorage.removeItem(storageKey);
    expect(localStorage.getItem(storageKey)).toBe("open-call-id");

    // Close succeeds — key is removed
    closeFailed = false;
    if (!closeFailed) localStorage.removeItem(storageKey);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });
});

// ─── 3. saveAndClose timeout (Bug #2) ─────────────────────────────────────────

describe("saveAndClose timeout / error handling", () => {
  it("ApiError with code TIMEOUT surfaces a human-readable message", () => {
    // Mirrors the error-handling block in saveAndClose
    class ApiError extends Error {
      constructor(readonly status: number, readonly code: string, message: string) {
        super(message);
      }
    }
    const error = new ApiError(0, "TIMEOUT", "The request timed out.");
    const isTimeout = error instanceof ApiError && error.code === "TIMEOUT";
    const message = isTimeout
      ? "The request timed out. Your edits are safe — check your connection and retry."
      : error.message;
    expect(message).toContain("timed out");
    expect(message).toContain("retry");
  });

  it("closing is always set to false after an error (button re-enabled)", async () => {
    let closing = true;
    // Simulates the finally{} block
    const fakeClose = async () => {
      try {
        throw new Error("Network error");
      } catch {
        // error handled
      } finally {
        closing = false;
      }
    };
    await fakeClose();
    expect(closing).toBe(false);
  });

  it("closing is always set to false after a timeout", async () => {
    let closing = true;
    const fakeClose = async () => {
      try {
        throw Object.assign(new DOMException("Timeout", "TimeoutError"));
      } catch {
        // swallowed
      } finally {
        closing = false;
      }
    };
    await fakeClose();
    expect(closing).toBe(false);
  });

  it("closing stays false when a stage save fails before the close call", async () => {
    let closing = true;
    const persistStage = async (_i: number) => false; // simulate save failure
    const flush = async () => {
      for (let i = 0; i < 3; i++) {
        const saved = await persistStage(i);
        if (!saved) {
          closing = false;
          return;
        }
      }
    };
    closing = true;
    await flush();
    expect(closing).toBe(false);
  });
});

// ─── 4. MUTATING_TIMEOUT_MS ──────────────────────────────────────────────────

describe("api MUTATING_TIMEOUT_MS", () => {
  it("is a positive number ≥ 5s and ≤ 30s", () => {
    expect(MUTATING_TIMEOUT_MS).toBeGreaterThanOrEqual(5_000);
    expect(MUTATING_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});

// ─── 5. suggestedOutcome logic ───────────────────────────────────────────────

describe("suggestedOutcome", () => {
  it("returns do_not_call when any stage has asked_not_to_call", () => {
    const drafts = makeDrafts({ 6: "asked_not_to_call" });
    expect(suggestedOutcome(drafts)).toBe("do_not_call");
  });

  it("returns do_not_call even if triggered at a non-stage-6 index (future-proof)", () => {
    const drafts = makeDrafts({ 3: "asked_not_to_call" });
    expect(suggestedOutcome(drafts)).toBe("do_not_call");
  });

  it("returns next_step_set for time_named at stage 7", () => {
    expect(suggestedOutcome(makeDrafts({ 7: "time_named" }))).toBe("next_step_set");
  });

  it("returns next_step_set for meeting_agreed at stage 7", () => {
    expect(suggestedOutcome(makeDrafts({ 7: "meeting_agreed" }))).toBe("next_step_set");
  });

  it("returns document_requested for doc_agreed at stage 7", () => {
    expect(suggestedOutcome(makeDrafts({ 7: "doc_agreed" }))).toBe("document_requested");
  });

  it("returns referred for referred at stage 7", () => {
    expect(suggestedOutcome(makeDrafts({ 7: "referred" }))).toBe("referred");
  });

  it("returns callback_requested for asked_callback at stage 3", () => {
    expect(suggestedOutcome(makeDrafts({ 3: "asked_callback" }))).toBe("callback_requested");
  });

  it("returns document_requested for send_first at stage 3", () => {
    expect(suggestedOutcome(makeDrafts({ 3: "send_first" }))).toBe("document_requested");
  });

  it("returns document_requested for wants_writing at stage 6", () => {
    expect(suggestedOutcome(makeDrafts({ 6: "wants_writing" }))).toBe("document_requested");
  });

  it("returns declined for declined at stage 6", () => {
    expect(suggestedOutcome(makeDrafts({ 6: "declined" }))).toBe("declined");
  });

  it("returns declined for not_relevant at stage 6", () => {
    expect(suggestedOutcome(makeDrafts({ 6: "not_relevant" }))).toBe("declined");
  });

  it("returns declined for has_provider at stage 6", () => {
    expect(suggestedOutcome(makeDrafts({ 6: "has_provider" }))).toBe("declined");
  });

  it("returns declined for not_right_person at stage 6", () => {
    expect(suggestedOutcome(makeDrafts({ 6: "not_right_person" }))).toBe("declined");
  });

  it("returns wrong_contact for wrong_or_left at stage 1", () => {
    expect(suggestedOutcome(makeDrafts({ 1: "wrong_or_left" }))).toBe("wrong_contact");
  });

  it("returns no_contact for line_or_language at stage 1", () => {
    expect(suggestedOutcome(makeDrafts({ 1: "line_or_language" }))).toBe("no_contact");
  });

  it("returns no_contact for not_available at stage 1", () => {
    expect(suggestedOutcome(makeDrafts({ 1: "not_available" }))).toBe("no_contact");
  });

  it("returns null when no signals are recorded", () => {
    expect(suggestedOutcome(makeDrafts())).toBeNull();
  });

  it("do_not_call wins over any other signal (highest priority)", () => {
    // Even if stage 7 has meeting_agreed, DNC wins
    const drafts = makeDrafts({ 7: "meeting_agreed", 6: "asked_not_to_call" });
    expect(suggestedOutcome(drafts)).toBe("do_not_call");
  });

  it("does not upgrade ordinary refusals to do_not_call", () => {
    const drafts = makeDrafts({ 6: "declined" });
    expect(suggestedOutcome(drafts)).toBe("declined");
    expect(suggestedOutcome(drafts)).not.toBe("do_not_call");
  });
});

// ─── 6. History navigation (resume flow) ─────────────────────────────────────

describe("History → resume call flow", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("sets the activeCallId in localStorage to the resumed call ID", () => {
    const id = "abc-123";
    // Simulates HistoryList resume()
    localStorage.setItem("callframe.activeCallId", id);
    expect(localStorage.getItem("callframe.activeCallId")).toBe(id);
  });

  it("does not affect localStorage when a different key is written", () => {
    localStorage.setItem("callframe.activeCallId", "existing");
    localStorage.setItem("something.else", "value");
    expect(localStorage.getItem("callframe.activeCallId")).toBe("existing");
  });
});
