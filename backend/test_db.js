const { Pool } = require('pg');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: 'C:\\Users\\srija\\Documents\\Callframe\\backend\\.env' });

const databaseUrl = process.env.DATABASE_URL;
console.log('Testing connection to:', databaseUrl.replace(/:[^:@]*@/, ':****@'));

const pool = new Pool({
  connectionString: databaseUrl,
  ssl:
    process.env.DATABASE_SSL === 'false'
      ? false
      : {
          ca: fs.readFileSync(path.resolve(__dirname, "certs/supabase-ca.crt")),
        },
  connectionTimeoutMillis: 5000,
});

async function test() {
  try {
    const result = await pool.query('SELECT 1');
    console.log('SUCCESS:', result.rows);
  } catch (error) {
    console.error('ERROR:', error.code, error.message);
    if (error.stack) console.error(error.stack);
  } finally {
    await pool.end();
  }
}

test();