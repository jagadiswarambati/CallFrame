// Verifies frontend/src/data/examples.json against the local transcript files.
//
//   TRANSCRIPTS_DIR=<folder with the transcripts and index.csv> node scripts/verify-quotes.mjs
//
// The transcripts are NOT part of this repository and must never be committed (the dataset
// README says nothing in them is to be published). Point TRANSCRIPTS_DIR at your unpacked copy.
//
// Fails (exit 1) when:
//   - a quote's text is not found verbatim in the transcript of its callId, or
//   - a quote's datasetLogged differs from the logged outcome for that call in index.csv.
// Exit codes: 0 = all verified, 1 = verification failed, 2 = NOT RUN (no/bad TRANSCRIPTS_DIR).
//
// "Verbatim" means character for character, with two tolerances: Unicode normalisation (NFC)
// and runs of whitespace (a quote may wrap across lines). Quote marks and apostrophes are NOT
// normalised; a mismatch that only differs there is reported with a hint but still fails.
//
// Optional overrides if index.csv uses unexpected headers (names are case-insensitive):
//   INDEX_ID_COLUMN, INDEX_OUTCOME_COLUMN

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const examplesPath = path.resolve(here, "../frontend/src/data/examples.json");
const dir = process.env.TRANSCRIPTS_DIR?.trim();

function notRun(message) {
  console.error(`NOT RUN: ${message}`);
  process.exit(2);
}

if (!dir) notRun("set TRANSCRIPTS_DIR to the folder holding the transcripts and index.csv.");
if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) notRun(`TRANSCRIPTS_DIR is not a folder: ${dir}`);

const failures = [];
const fail = (message) => failures.push(message);

// ---------------------------------------------------------------- helpers

const normalise = (text) => text.normalize("NFC").replace(/\s+/g, " ").trim();
const looseQuotes = (text) =>
  text.replace(/[\u2018\u2019\u201B]/g, "'").replace(/[\u201C\u201D\u201F]/g, '"');

// Small RFC 4180 CSV parser (quoted fields, doubled quotes, CRLF, BOM).
function parseCsv(input) {
  const text = input.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function findColumn(header, override, patterns) {
  const lower = header.map((name) => name.trim().toLowerCase());
  if (override) return lower.indexOf(override.trim().toLowerCase());
  for (const pattern of patterns) {
    const index = lower.findIndex((name) => pattern.test(name));
    if (index !== -1) return index;
  }
  return -1;
}

// ---------------------------------------------------------------- load examples.json

let examples;
try {
  examples = JSON.parse(fs.readFileSync(examplesPath, "utf8"));
} catch (error) {
  console.error(`FAIL: cannot read ${examplesPath}: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
const stages = Array.isArray(examples?.examples) ? examples.examples : [];
const quotes = stages.flatMap((stage) =>
  (Array.isArray(stage.quotes) ? stage.quotes : []).map((quote) => ({ ...quote, stage: stage.stage })),
);
if (!quotes.length) {
  console.error("FAIL: examples.json contains no quotes (expected examples[].quotes[]).");
  process.exit(1);
}

// ---------------------------------------------------------------- load index.csv

const indexPath = path.join(dir, "index.csv");
if (!fs.existsSync(indexPath)) notRun(`index.csv not found in ${dir}`);
const csv = parseCsv(fs.readFileSync(indexPath, "utf8"));
const header = csv[0] ?? [];
const idColumn = findColumn(header, process.env.INDEX_ID_COLUMN, [/^(call[_ -]?id|callid|id|call|file|filename|transcript)$/]);
const outcomeColumn = findColumn(header, process.env.INDEX_OUTCOME_COLUMN, [
  /^(logged[_ -]?outcome|outcome[_ -]?logged)$/,
  /^outcome$/,
  /outcome/,
  /logged/,
]);
if (idColumn === -1 || outcomeColumn === -1) {
  console.error(
    `FAIL: cannot find the call-id and logged-outcome columns in index.csv. Headers found: ${JSON.stringify(header)}. ` +
      "Set INDEX_ID_COLUMN and INDEX_OUTCOME_COLUMN to the right header names.",
  );
  process.exit(1);
}
const callIdPattern = /T\d{3}/i;
const loggedByCall = new Map();
for (const row of csv.slice(1)) {
  const match = (row[idColumn] ?? "").match(callIdPattern);
  if (match) loggedByCall.set(match[0].toUpperCase(), (row[outcomeColumn] ?? "").trim());
}
if (!loggedByCall.size) {
  console.error(`FAIL: no call ids like T001 found in column "${header[idColumn]}" of index.csv.`);
  process.exit(1);
}

// ---------------------------------------------------------------- find transcript files

const transcriptFiles = fs
  .readdirSync(dir)
  .filter((name) => !/^(index|readme)\./i.test(name) && fs.statSync(path.join(dir, name)).isFile());

function transcriptFor(callId) {
  const wanted = callId.toUpperCase();
  const matches = transcriptFiles.filter((name) => name.toUpperCase().match(callIdPattern)?.[0] === wanted);
  return matches.length === 1 ? path.join(dir, matches[0]) : { error: matches.length ? "several files match" : "no file matches" };
}

// ---------------------------------------------------------------- verify

const textCache = new Map();
let verified = 0;
for (const quote of quotes) {
  const label = `stage ${quote.stage} ${quote.callId}`;
  if (typeof quote.callId !== "string" || typeof quote.text !== "string" || !quote.text.trim()) {
    fail(`${label}: quote needs a callId and non-empty text`);
    continue;
  }
  const file = transcriptFor(quote.callId);
  if (typeof file !== "string") {
    fail(`${label}: transcript not found (${file.error}; ${transcriptFiles.length} candidate files in TRANSCRIPTS_DIR)`);
  } else {
    if (!textCache.has(file)) textCache.set(file, normalise(fs.readFileSync(file, "utf8")));
    const transcript = textCache.get(file);
    const needle = normalise(quote.text);
    if (!transcript.includes(needle)) {
      const hint = looseQuotes(transcript).includes(looseQuotes(needle))
        ? " (differs only in quote marks or apostrophes)"
        : "";
      fail(`${label}: quote not found verbatim in ${path.basename(file)}${hint}: "${quote.text}"`);
    }
  }

  if (!loggedByCall.has(String(quote.callId).toUpperCase())) {
    fail(`${label}: call is not listed in index.csv`);
  } else {
    const logged = loggedByCall.get(String(quote.callId).toUpperCase());
    if (quote.datasetLogged !== logged) {
      fail(`${label}: datasetLogged is "${quote.datasetLogged}" but index.csv says "${logged}"`);
    }
  }
  verified += 1;
}

if (failures.length) {
  console.error(`FAIL: ${failures.length} problem(s) in ${quotes.length} quotes:`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}
console.log(`PASS: ${verified} quotes found verbatim and matching index.csv (${new Set(quotes.map((q) => q.callId)).size} calls).`);
