// ── Supabase Direct PostgreSQL Connection ────────────────────────────────────
// Uses the `pg` library for direct, high-performance queries (no REST overhead).
// Requires SUPABASE_DB_URL in .env (get from Supabase Dashboard → Settings → Database → Connection string URI)

require('dotenv').config();
const { Pool } = require('pg');

const dbUrl = process.env.SUPABASE_DB_URL;

let pool = null;

if (dbUrl) {
  pool = new Pool({
    connectionString: dbUrl,
    max: 5,                    // max connections in pool
    idleTimeoutMillis: 30000,  // close idle connections after 30s
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },  // Supabase requires SSL
  });
  console.log('[SupabaseDB] PostgreSQL pool initialized');
} else {
  console.warn('[SupabaseDB] SUPABASE_DB_URL not set — Supabase job source will be unavailable.');
}

/**
 * Run a query against the Supabase PostgreSQL database.
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} rows
 */
async function query(text, params = []) {
  if (!pool) throw new Error('Supabase DB pool not initialized');
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

function isAvailable() {
  return !!pool;
}

module.exports = { query, isAvailable };
