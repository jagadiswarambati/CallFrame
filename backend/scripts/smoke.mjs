// Smoke test against a RUNNING Callframe API (needs a real database behind it).
//
//   BASE_URL=http://localhost:4000 node scripts/smoke.mjs
//   BASE_URL=https://<your-render-host> ACCESS_CODE=<code> node scripts/smoke.mjs
//
// BASE_URL defaults to http://localhost:4000. ACCESS_CODE is only needed when the API
// has APP_ACCESS_CODE set; it is sent as the x-access-code header and never printed.
// Every run creates two throw-away calls named "Smoke Test <random>" (the API has no delete
// endpoint). The assist check hits the do-not-call block, so Gemini is never called.

import crypto from "node:crypto";

const baseUrl = (process.env.BASE_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const accessCode = process.env.ACCESS_CODE?.trim() || undefined;

const results = [];

async function api(method, path, body) {
  const headers = { "content-type": "application/json" };
  if (accessCode) headers["x-access-code"] = accessCode;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    // non-JSON body; leave json as null
  }
  return { status: response.status, json };
}

// Runs one check. A failed assertion or a thrown error is recorded as FAIL, never skipped.
async function check(name, run) {
  try {
    const evidence = await run();
    results.push({ name, ok: true, evidence: evidence ?? "" });
  } catch (error) {
    results.push({ name, ok: false, evidence: error instanceof Error ? error.message : String(error) });
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function expectStatus(res, wanted, what) {
  expect(res.status === wanted, `${what}: expected HTTP ${wanted}, got ${res.status} ${JSON.stringify(res.json?.error ?? res.json)}`);
}

const suffix = crypto.randomBytes(4).toString("hex");
const company = `Smoke Co ${suffix}`;
let callId;
let dncCallId;

await check("health", async () => {
  const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(20_000) });
  const json = await res.json().catch(() => null);
  expect(res.status === 200, `expected HTTP 200, got ${res.status}`);
  expect(json?.status === "ok" && json?.db === "up", `unexpected body ${JSON.stringify(json)}`);
  return `200 status=${json.status} db=${json.db}`;
});

await check("start call", async () => {
  const res = await api("POST", "/api/calls", { prospect_name: `Smoke Test ${suffix}`, company, prospect_role: "Tester" });
  expectStatus(res, 201, "start call");
  callId = res.json?.call?.id;
  expect(typeof callId === "string" && callId.length > 0, "no call id returned");
  expect(res.json.call.status === "in_progress", `status ${res.json.call.status}`);
  return `201 id=${callId}`;
});

const stagePayload = { outcome_key: "needs_stated", prospect_words: "We lose time on manual reports.", notes: "smoke" };

await check("save stage -> revision 1", async () => {
  const res = await api("PUT", `/api/calls/${callId}/stages/2`, stagePayload);
  expectStatus(res, 200, "save stage");
  expect(Number(res.json?.result?.revision) === 1, `revision ${res.json?.result?.revision}`);
  return "200 revision=1";
});

await check("same payload again -> still revision 1", async () => {
  const res = await api("PUT", `/api/calls/${callId}/stages/2`, stagePayload);
  expectStatus(res, 200, "repeat save");
  expect(Number(res.json?.result?.revision) === 1, `revision ${res.json?.result?.revision}`);
  return "200 revision=1";
});

await check("changed payload -> revision 2", async () => {
  const res = await api("PUT", `/api/calls/${callId}/stages/2`, { ...stagePayload, notes: "smoke, changed" });
  expectStatus(res, 200, "changed save");
  expect(Number(res.json?.result?.revision) === 2, `revision ${res.json?.result?.revision}`);
  return "200 revision=2";
});

await check("progress", async () => {
  const res = await api("PATCH", `/api/calls/${callId}/progress`, { stage: 4 });
  expectStatus(res, 200, "progress");
  expect(Number(res.json?.call?.last_stage) === 4, `last_stage ${res.json?.call?.last_stage}`);
  return "200 last_stage=4";
});

await check("close with invalid outcome -> 422", async () => {
  const res = await api("POST", `/api/calls/${callId}/close`, { outcome: "success", ended_stage: 3 });
  expectStatus(res, 422, "invalid outcome");
  return `422 code=${res.json?.error?.code}`;
});

await check("close valid (ended at stage 3 after reaching 4) -> 200", async () => {
  const res = await api("POST", `/api/calls/${callId}/close`, { outcome: "declined", ended_stage: 3 });
  expectStatus(res, 200, "close");
  const call = res.json?.call;
  expect(Number(call?.last_stage) === 4, `last_stage should keep the highest stage 4, got ${call?.last_stage}`);
  expect(call?.status === "ended_early", `status ${call?.status}`);
  expect(call?.outcome === "declined", `outcome ${call?.outcome}`);
  return `200 status=${call.status} last_stage=${call.last_stage}`;
});

await check("save after close -> 409", async () => {
  const res = await api("PUT", `/api/calls/${callId}/stages/2`, { ...stagePayload, notes: "after close" });
  expectStatus(res, 409, "save after close");
  return `409 code=${res.json?.error?.code}`;
});

await check("list contains the call with correct last_stage", async () => {
  const res = await api("GET", "/api/calls?limit=100");
  expectStatus(res, 200, "list");
  const found = res.json?.calls?.find((call) => call.id === callId);
  expect(found, "call not in the newest 100 calls");
  expect(Number(found.last_stage) === 4, `last_stage ${found.last_stage}`);
  expect(found.display_status === "ended_early", `display_status ${found.display_status}`);
  return `found last_stage=${found.last_stage} display_status=${found.display_status}`;
});

await check("do-not-call: record at stage 6, close do_not_call -> 200", async () => {
  const start = await api("POST", "/api/calls", { prospect_name: `Smoke DNC ${suffix}`, company });
  expectStatus(start, 201, "start DNC call");
  dncCallId = start.json?.call?.id;
  const saved = await api("PUT", `/api/calls/${dncCallId}/stages/6`, {
    outcome_key: "asked_not_to_call",
    prospect_words: "Please do not call me again.",
    notes: "",
  });
  expectStatus(saved, 200, "save stage 6");
  const closed = await api("POST", `/api/calls/${dncCallId}/close`, { outcome: "do_not_call", ended_stage: 6 });
  expectStatus(closed, 200, "close do_not_call");
  expect(closed.json?.call?.do_not_call === true, "do_not_call flag not set");
  return "200 do_not_call=true";
});

await check("DNC restart -> 409", async () => {
  const res = await api("POST", "/api/calls", { prospect_name: `Smoke DNC ${suffix}`, company });
  expectStatus(res, 409, "restart DNC prospect");
  expect(res.json?.error?.code === "DNC_RESTRICTED", `code ${res.json?.error?.code}`);
  return "409 DNC_RESTRICTED";
});

await check("assist on a DNC call -> blocked:true", async () => {
  const res = await api("POST", `/api/calls/${dncCallId}/assist`, { stage: 6 });
  expectStatus(res, 200, "assist");
  expect(res.json?.blocked === true, `body ${JSON.stringify(res.json)}`);
  expect(res.json?.suggestion === undefined, "a suggestion was returned for a DNC call");
  return "200 blocked=true";
});

console.log(`Smoke test against ${baseUrl}${accessCode ? " (with access code)" : ""}`);
for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.evidence ? `  [${result.evidence}]` : ""}`);
}
const failed = results.filter((result) => !result.ok).length;
console.log(failed ? `\n${failed} of ${results.length} checks FAILED` : `\nAll ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
