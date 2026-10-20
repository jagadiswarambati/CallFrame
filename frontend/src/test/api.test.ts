import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";

describe("API failure diagnostics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("logs safe request metadata without logging server messages or request bodies", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: { code: "FORBIDDEN", message: "Do not log this secret or prospect name." },
      }),
    }));

    await expect(apiFetch("/api/calls", {
      method: "POST",
      body: JSON.stringify({ prospect_name: "Private prospect", token: "secret-token" }),
    })).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });

    expect(warn).toHaveBeenCalledWith("Callframe API request failed", expect.objectContaining({
      method: "POST",
      path: "/api/calls",
      status: 403,
      code: "FORBIDDEN",
    }));
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Private prospect");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret-token");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Do not log this secret");
  });

  it("logs a network failure using a route template instead of a call ID", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(apiFetch("/api/calls/123e4567-e89b-12d3-a456-426614174000", {
      method: "GET",
    })).rejects.toMatchObject({ status: 0, code: "NETWORK" });

    expect(warn).toHaveBeenCalledWith("Callframe API request failed", expect.objectContaining({
      method: "GET",
      path: "/api/calls/:id",
      status: 0,
      code: "NETWORK",
    }));
    expect(JSON.stringify(warn.mock.calls)).not.toContain("123e4567-e89b-12d3-a456-426614174000");
  });
});
