-- ============================================================================
-- USER TRACKING & ANALYTICS SCHEMA
-- Run in Supabase SQL Editor. Server uses in-memory by default.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            TEXT UNIQUE NOT NULL,
  user_id               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_logged_in          BOOLEAN DEFAULT false,

  ip_address            TEXT,
  ip_type               TEXT,

  country               TEXT,
  country_code          TEXT,
  region                TEXT,
  city                  TEXT,
  timezone              TEXT,
  latitude              NUMERIC,
  longitude             NUMERIC,

  browser_name          TEXT,
  browser_version       TEXT,
  os_name               TEXT,
  os_version            TEXT,
  device_type           TEXT,
  device_vendor         TEXT,

  screen_width          INTEGER,
  screen_height         INTEGER,
  viewport_width        INTEGER,
  viewport_height       INTEGER,
  pixel_ratio           NUMERIC,

  referrer_url          TEXT,
  referrer_domain       TEXT,
  utm_source            TEXT,
  utm_medium            TEXT,
  utm_campaign          TEXT,

  language              TEXT,
  is_bot                BOOLEAN DEFAULT false,
  is_returning          BOOLEAN DEFAULT false,

  page_views            INTEGER DEFAULT 1,
  actions_count         INTEGER DEFAULT 0,
  session_duration_secs INTEGER DEFAULT 0,

  first_seen_at         TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     TEXT REFERENCES user_sessions(session_id) ON DELETE CASCADE,
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type     TEXT NOT NULL,
  event_category TEXT,
  event_label    TEXT,
  page_path      TEXT,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events   ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No public access to sessions" ON user_sessions FOR ALL USING (false);
CREATE POLICY "No public access to events"   ON user_events   FOR ALL USING (false);

CREATE INDEX user_sessions_first_seen_idx ON user_sessions(first_seen_at DESC);
CREATE INDEX user_events_session_idx      ON user_events(session_id, created_at DESC);
