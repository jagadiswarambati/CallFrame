import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ABANDONED_AFTER_MS,
  DNC_OUTCOME_KEY,
  OUTCOMES,
  displayStatus,
  isBlockedByDnc,
  isOutcome,
  latestByStage,
  latestRevisions,
  outcomeClass,
  reachedStage,
  statusFromStage,
  validateCloseOutcome,
  validateDoNotCallEvidence,
  type Outcome,
} from "../src/rules";

const fields = (outcome: Outcome, step: Parameters<typeof validateCloseOutcome>[1]) =>
  validateCloseOutcome(outcome, step).map((error) => error.field);

describe("do_not_call", () => {
  it("needs the stage-6 button AND the exact words", () => {
    assert.deepEqual(
      validateDoNotCallEvidence({ outcome_key: DNC_OUTCOME_KEY, prospect_words: "Please remove me." }),
      [],
    );
    assert.deepEqual(validateDoNotCallEvidence({ outcome_key: DNC_OUTCOME_KEY, prospect_words: "" }).map((e) => e.field), ["dnc_words"]);
    assert.deepEqual(validateDoNotCallEvidence({ outcome_key: DNC_OUTCOME_KEY, prospect_words: "   " }).map((e) => e.field), ["dnc_words"]);
    assert.deepEqual(validateDoNotCallEvidence({ outcome_key: DNC_OUTCOME_KEY, prospect_words: null }).map((e) => e.field), ["dnc_words"]);
    assert.deepEqual(validateDoNotCallEvidence({ outcome_key: "declined", prospect_words: "Not interested." }).map((e) => e.field), ["dnc_words"]);
    assert.deepEqual(validateDoNotCallEvidence(undefined).map((e) => e.field), ["dnc_words"]);
  });

  it("carries no next step at all", () => {
    assert.deepEqual(fields("do_not_call", {}), []);
    assert.deepEqual(fields("do_not_call", { type: " ", channel: "", when: null, detail: undefined }), []);
    for (const step of [{ type: "call" }, { channel: "email" }, { when: "Friday" }, { detail: "x" }]) {
      assert.deepEqual(fields("do_not_call", step), ["next_step"], JSON.stringify(step));
    }
  });
});

describe("document_requested", () => {
  it("needs type document and a channel", () => {
    assert.deepEqual(fields("document_requested", { type: "document", channel: "WhatsApp" }), []);
    assert.deepEqual(fields("document_requested", { type: "document" }), ["next_step.channel"]);
    assert.deepEqual(fields("document_requested", { type: "document", channel: "  " }), ["next_step.channel"]);
    assert.deepEqual(fields("document_requested", { type: "call", channel: "Email" }), ["next_step.channel"]);
  });

  it("is never classed as success", () => {
    assert.equal(outcomeClass("document_requested"), "partial");
    assert.notEqual(outcomeClass("document_requested"), "success");
  });
});

describe("next_step_set", () => {
  it("needs a call or meeting plus a time", () => {
    assert.deepEqual(fields("next_step_set", { type: "call", when: "Thursday 3pm" }), []);
    assert.deepEqual(fields("next_step_set", { type: "meeting", when: "Monday" }), []);
    assert.deepEqual(fields("next_step_set", { type: "call" }), ["next_step.when"]);
    assert.deepEqual(fields("next_step_set", { type: "meeting", when: "  " }), ["next_step.when"]);
    assert.deepEqual(fields("next_step_set", { type: "document", when: "Monday" }), ["next_step.when"]);
    assert.deepEqual(fields("next_step_set", { type: "referral", when: "Monday" }), ["next_step.when"]);
    assert.deepEqual(fields("next_step_set", {}), ["next_step.when"]);
  });

  it("is the only success outcome", () => {
    const successes = OUTCOMES.filter((outcome) => outcomeClass(outcome) === "success");
    assert.deepEqual(successes, ["next_step_set"]);
  });
});

describe("callback_requested", () => {
  it("needs a call plus a time", () => {
    assert.deepEqual(fields("callback_requested", { type: "call", when: "Tomorrow morning" }), []);
    assert.deepEqual(fields("callback_requested", { type: "call" }), ["next_step.when"]);
    assert.deepEqual(fields("callback_requested", { type: "meeting", when: "Tomorrow" }), ["next_step.when"]);
    assert.deepEqual(fields("callback_requested", { when: "Tomorrow" }), ["next_step.when"]);
    assert.equal(outcomeClass("callback_requested"), "partial");
  });
});

describe("referred", () => {
  it("needs type referral plus who they referred you to", () => {
    assert.deepEqual(fields("referred", { type: "referral", detail: "Ask Meera in operations" }), []);
    assert.deepEqual(fields("referred", { type: "referral" }), ["next_step.detail"]);
    assert.deepEqual(fields("referred", { type: "referral", detail: "  " }), ["next_step.detail"]);
    assert.deepEqual(fields("referred", { type: "call", detail: "Meera" }), ["next_step.detail"]);
    assert.equal(outcomeClass("referred"), "partial");
  });
});

describe("negative outcomes", () => {
  for (const outcome of ["declined", "wrong_contact", "no_contact"] as const) {
    it(`${outcome} is valid with no next step and rejects any next step`, () => {
      assert.equal(outcomeClass(outcome), "negative");
      assert.deepEqual(fields(outcome, {}), []);
      assert.deepEqual(fields(outcome, { type: "", channel: " ", when: null, detail: null }), []);
      for (const step of [{ type: "call" }, { channel: "email" }, { when: "Friday" }, { detail: "x" }]) {
        assert.deepEqual(fields(outcome, step), ["next_step"], JSON.stringify(step));
      }
    });
  }
});

describe("outcome list", () => {
  it("accepts the eight spec outcomes and nothing else", () => {
    assert.equal(OUTCOMES.length, 8);
    for (const outcome of OUTCOMES) assert.equal(isOutcome(outcome), true);
    for (const bad of ["success", "interested", "", "DECLINED", null, undefined, 7, {}]) {
      assert.equal(isOutcome(bad), false, String(bad));
    }
  });

  it("do_not_call is restricted", () => {
    assert.equal(outcomeClass("do_not_call"), "restricted");
  });
});

describe("status from reached stage", () => {
  it("is completed only when stage 8 was reached", () => {
    for (let stage = 1; stage <= 7; stage += 1) {
      assert.equal(statusFromStage(stage), "ended_early", `stage ${stage}`);
    }
    assert.equal(statusFromStage(8), "completed");
  });

  it("keeps the highest stage reached, not the stage the call ended at", () => {
    assert.equal(reachedStage(8, 3), 8);
    assert.equal(statusFromStage(reachedStage(8, 3)), "completed");
    assert.equal(reachedStage(4, 6), 6);
    assert.equal(statusFromStage(reachedStage(4, 6)), "ended_early");
    assert.equal(statusFromStage(reachedStage(3, 8)), "completed");
  });
});

describe("abandoned display status", () => {
  const now = Date.parse("2026-10-19T12:00:00.000Z");

  it("in_progress with no activity for more than 2 h is abandoned", () => {
    assert.equal(displayStatus("in_progress", now - ABANDONED_AFTER_MS - 1, now), "abandoned");
    assert.equal(displayStatus("in_progress", "2026-10-19T09:00:00.000Z", now), "abandoned");
  });

  it("in_progress at or under 2 h stays in_progress", () => {
    assert.equal(displayStatus("in_progress", now - ABANDONED_AFTER_MS, now), "in_progress");
    assert.equal(displayStatus("in_progress", new Date(now - 60_000), now), "in_progress");
  });

  it("closed calls are never shown as abandoned", () => {
    const old = now - 10 * ABANDONED_AFTER_MS;
    assert.equal(displayStatus("completed", old, now), "completed");
    assert.equal(displayStatus("ended_early", old, now), "ended_early");
  });

  it("2 h is 7,200,000 ms", () => {
    assert.equal(ABANDONED_AFTER_MS, 7_200_000);
  });
});

describe("do-not-call detection", () => {
  const row = (stage: number, outcome_key: string | null) => ({ stage, outcome_key });

  it("trips on the call flag", () => {
    assert.equal(isBlockedByDnc({ do_not_call: true }, []), true);
  });

  it("trips on the stage-6 key, in any stage row or revision", () => {
    assert.equal(isBlockedByDnc({ do_not_call: false }, [row(6, DNC_OUTCOME_KEY)]), true);
    assert.equal(isBlockedByDnc({ do_not_call: false }, [row(2, "ok"), row(6, "declined"), row(6, DNC_OUTCOME_KEY)]), true);
  });

  it("an ordinary refusal is never upgraded to do-not-call", () => {
    assert.equal(
      isBlockedByDnc({ do_not_call: false }, [row(6, "not_interested"), row(3, "said_no"), row(7, null)]),
      false,
    );
    assert.equal(isBlockedByDnc({ do_not_call: false }, []), false);
  });

  it("the only trigger key is asked_not_to_call", () => {
    assert.equal(DNC_OUTCOME_KEY, "asked_not_to_call");
  });
});

describe("latest revision per stage", () => {
  const rows = [
    { stage: 6, revision: 1, id: "a" },
    { stage: 3, revision: 2, id: "b" },
    { stage: 3, revision: 1, id: "c" },
    { stage: 6, revision: 3, id: "d" },
    { stage: 6, revision: 2, id: "e" },
    { stage: 1, revision: 1, id: "f" },
  ];

  it("picks the highest revision whatever the row order", () => {
    const latest = latestByStage(rows);
    assert.equal(latest.get(6)?.id, "d");
    assert.equal(latest.get(3)?.id, "b");
    assert.equal(latest.get(1)?.id, "f");
    assert.equal(latest.size, 3);
    assert.equal(latestByStage([...rows].reverse()).get(6)?.id, "d");
  });

  it("latestRevisions returns one row per stage ordered by stage", () => {
    assert.deepEqual(latestRevisions(rows).map((row) => [row.stage, row.id]), [
      [1, "f"],
      [3, "b"],
      [6, "d"],
    ]);
  });

  it("copes with revisions arriving as numeric strings (pg bigint) and with no rows", () => {
    const text = [
      { stage: 2, revision: "9" as unknown as number },
      { stage: 2, revision: "10" as unknown as number },
    ];
    assert.equal(Number(latestByStage(text).get(2)?.revision), 10);
    assert.deepEqual(latestRevisions([]), []);
  });
});
