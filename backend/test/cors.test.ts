import assert from "node:assert/strict";
import test from "node:test";
import { getAllowedOrigins, PRODUCTION_FRONTEND_ORIGIN } from "../src/cors";

test("allows the production Vercel frontend alongside configured origins", () => {
  assert.deepEqual(
    getAllowedOrigins("https://preview.example, http://localhost:3000"),
    [
      PRODUCTION_FRONTEND_ORIGIN,
      "https://preview.example",
      "http://localhost:3000",
    ],
  );
});

test("uses localhost as the configured default and removes duplicates", () => {
  assert.deepEqual(getAllowedOrigins(undefined), [
    PRODUCTION_FRONTEND_ORIGIN,
    "http://localhost:3000",
  ]);
  assert.deepEqual(
    getAllowedOrigins(`${PRODUCTION_FRONTEND_ORIGIN},${PRODUCTION_FRONTEND_ORIGIN}`),
    [PRODUCTION_FRONTEND_ORIGIN],
  );
});
