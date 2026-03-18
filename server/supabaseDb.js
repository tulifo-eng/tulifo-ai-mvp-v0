// ── Scraper Database Connection (read-only) ──────────────────────────────────
// Connects to the SCRAPER Supabase project to read scraped job data.
// This is separate from the main tulifo-ai Supabase project (SUPABASE_URL).
//
// Two databases:
//   1. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  →  tulifo-ai backend (auth, tracking, users)
//   2. SCRAPER_DB_URL                            →  scraper database (jobs table, read-only)

require('dotenv').config();
const { Pool } = require('pg');

const scraperDbUrl = process.env.SCRAPER_DB_URL;

let pool = null;

if (scraperDbUrl) {
  pool = new Pool({
    connectionString: scraperDbUrl,
    max: 5,                    // max connections in pool
    idleTimeoutMillis: 30000,  // close idle connections after 30s
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },  // Supabase requires SSL
  });
  console.log('[ScraperDB] PostgreSQL pool initialized (scraper database)');
} else {
  console.warn('[ScraperDB] SCRAPER_DB_URL not set — Tulifo DB job source will be unavailable.');
}

/**
 * Run a query against the scraper PostgreSQL database.
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} rows
 */
async function query(text, params = []) {
  if (!pool) throw new Error('Scraper DB pool not initialized — set SCRAPER_DB_URL in .env');
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
