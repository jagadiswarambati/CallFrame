// Checks that the backend can reach the database over VERIFIED TLS.
//
//   cd backend && node scripts/test_db.js
//
// Reads backend/.env (relative to this file; no machine-specific paths). Needs:
//   DATABASE_URL           connection string (never printed)
//   DATABASE_SSL_CA_PATH   optional path to the CA certificate; a relative path is resolved
//                          from the backend/ folder. Default: certs/supabase-ca.crt
// TLS certificate verification is always ON here (rejectUnauthorized: true). There is no
// switch to turn it off. Only the error type and code are printed, never messages or URLs.

const fs = require("node:fs");
const path = require("node:path");

const backendDir = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(backendDir, ".env") });

function die(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) die("DATABASE_URL is not set (put it in backend/.env).");

const caPath = path.resolve(backendDir, process.env.DATABASE_SSL_CA_PATH?.trim() || "certs/supabase-ca.crt");
let ca;
try {
  ca = fs.readFileSync(caPath);
} catch {
  die(`Cannot read the CA certificate file. Set DATABASE_SSL_CA_PATH (tried: ${path.relative(backendDir, caPath) || caPath}).`);
}

// pg lets URL-derived SSL settings (sslmode=...) override the ssl option, which could drop
// the CA. Remove sslmode from the URL so the explicit, verified settings below always apply.
const connectionString = databaseUrl.replace(/([?&])sslmode=[^&]*&?/i, "$1").replace(/[?&]$/, "");

async function main() {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString,
    ssl: { ca, rejectUnauthorized: true },
    connectionTimeoutMillis: 5_000,
  });
  try {
    const result = await pool.query("SELECT 1 AS ok");
    console.log(`SUCCESS: connected with verified TLS, SELECT 1 returned ${result.rows[0].ok}`);
  } catch (error) {
    const name = error instanceof Error ? error.name : typeof error;
    const code = error && typeof error === "object" && "code" in error ? error.code : "none";
    console.error(`ERROR: connection failed (${name}, code ${code}).`);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main();
