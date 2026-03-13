-- Admin analytics tables (optional — the server uses in-memory analytics by default)
-- Run this in the Supabase SQL editor if you want persistent analytics storage.

CREATE TABLE IF NOT EXISTS admin_search_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  query       TEXT,
  location    TEXT,
  result_count INTEGER DEFAULT 0,
  sources     TEXT[],
  duration_ms INTEGER,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS admin_error_events (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  endpoint TEXT,
  message  TEXT,
  details  JSONB
);

-- Only admins (service role) can read these
ALTER TABLE admin_search_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_error_events  ENABLE ROW LEVEL SECURITY;

-- No public access — use service role key from server only
CREATE POLICY "No public access to search events"
  ON admin_search_events FOR ALL USING (false);
CREATE POLICY "No public access to error events"
  ON admin_error_events FOR ALL USING (false);

-- Indexes for performance
CREATE INDEX admin_search_events_ts_idx ON admin_search_events(ts DESC);
CREATE INDEX admin_error_events_ts_idx  ON admin_error_events(ts DESC);
