// ── Supabase Admin Client ─────────────────────────────────────────────────────
// Uses the service role key — bypasses RLS. Server-side only.

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.warn('[Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — data will not persist across restarts.');
}

const supabase = url && key ? createClient(url, key, {
  auth: { persistSession: false },
}) : null;

module.exports = supabase;
