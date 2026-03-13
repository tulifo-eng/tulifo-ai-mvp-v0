-- ============================================================================
-- Tulifo AI — Full Persistence Schema
-- Run ALL of these in Supabase Dashboard → SQL Editor → New query
-- ============================================================================

-- ── profiles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT,
  role       TEXT,
  location   TEXT,
  salary_min INTEGER,
  skills     TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users can read own profile"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY IF NOT EXISTS "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY IF NOT EXISTS "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ── saved_jobs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_jobs (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id   TEXT NOT NULL,
  job_data JSONB NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users can manage own saved jobs" ON saved_jobs FOR ALL USING (auth.uid() = user_id);

-- ── discarded_jobs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discarded_jobs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id     TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);
ALTER TABLE discarded_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users can manage own discarded jobs" ON discarded_jobs FOR ALL USING (auth.uid() = user_id);

-- ── chat_messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'ai')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON chat_messages(user_id, created_at DESC);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users can manage own chat messages" ON chat_messages FOR ALL USING (auth.uid() = user_id);

-- ── job_matches ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_matches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id     TEXT NOT NULL,
  score      INTEGER NOT NULL DEFAULT 70 CHECK (score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);
ALTER TABLE job_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Users can manage own job matches" ON job_matches FOR ALL USING (auth.uid() = user_id);

-- ── feedback ──────────────────────────────────────────────────────────────────
-- Stores user feedback submissions. Only accessible via service role key.
CREATE TABLE IF NOT EXISTS feedback (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL DEFAULT 'general',
  rating     INTEGER CHECK (rating BETWEEN 1 AND 5),
  message    TEXT,
  email      TEXT,
  page       TEXT,
  user_agent TEXT,
  ts         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS feedback_ts_idx ON feedback(ts DESC);
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
-- Public can insert (submitting feedback) but not read
CREATE POLICY IF NOT EXISTS "Anyone can submit feedback" ON feedback FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "No public read of feedback"  ON feedback FOR SELECT USING (false);

-- ── admin_search_events ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_search_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  query        TEXT,
  location     TEXT,
  result_count INTEGER DEFAULT 0,
  sources      TEXT[],
  duration_ms  INTEGER,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS admin_search_events_ts_idx ON admin_search_events(ts DESC);
ALTER TABLE admin_search_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "No public access to search events" ON admin_search_events FOR ALL USING (false);

-- ── admin_error_events ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_error_events (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  endpoint TEXT,
  message  TEXT,
  details  JSONB
);
CREATE INDEX IF NOT EXISTS admin_error_events_ts_idx ON admin_error_events(ts DESC);
ALTER TABLE admin_error_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "No public access to error events" ON admin_error_events FOR ALL USING (false);

-- ── user_sessions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id             TEXT UNIQUE NOT NULL,
  user_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_logged_in           BOOLEAN DEFAULT false,
  ip_address             TEXT,
  country                TEXT,
  country_code           TEXT,
  region                 TEXT,
  city                   TEXT,
  timezone               TEXT,
  latitude               NUMERIC,
  longitude              NUMERIC,
  browser_name           TEXT,
  browser_version        TEXT,
  os_name                TEXT,
  os_version             TEXT,
  device_type            TEXT,
  device_vendor          TEXT,
  screen_width           INTEGER,
  screen_height          INTEGER,
  viewport_width         INTEGER,
  viewport_height        INTEGER,
  pixel_ratio            NUMERIC,
  referrer_url           TEXT,
  referrer_domain        TEXT,
  utm_source             TEXT,
  utm_medium             TEXT,
  utm_campaign           TEXT,
  language               TEXT,
  is_bot                 BOOLEAN DEFAULT false,
  is_returning           BOOLEAN DEFAULT false,
  page_views             INTEGER DEFAULT 1,
  actions_count          INTEGER DEFAULT 0,
  session_duration_secs  INTEGER DEFAULT 0,
  first_seen_at          TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_sessions_first_seen_idx ON user_sessions(first_seen_at DESC);
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "No public access to sessions" ON user_sessions FOR ALL USING (false);

-- ── user_events ───────────────────────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS user_events_session_idx  ON user_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_events_type_idx     ON user_events(event_type, created_at DESC);
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "No public access to events" ON user_events FOR ALL USING (false);
