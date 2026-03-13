-- Tulifo AI — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)

-- ── profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  role        TEXT,          -- target job role e.g. "Software Engineer"
  location    TEXT,          -- preferred location e.g. "San Francisco, CA"
  salary_min  INTEGER,       -- minimum salary expectation
  skills      TEXT[],        -- array of skill strings
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- ── saved_jobs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_jobs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id     TEXT NOT NULL,          -- matches DEMO_JOBS id field
  job_data   JSONB NOT NULL,         -- full job object snapshot
  saved_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own saved jobs"
  ON saved_jobs FOR ALL USING (auth.uid() = user_id);

-- ── discarded_jobs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discarded_jobs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id     TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

ALTER TABLE discarded_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own discarded jobs"
  ON discarded_jobs FOR ALL USING (auth.uid() = user_id);

-- ── chat_messages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'ai')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX chat_messages_user_id_created_at_idx
  ON chat_messages(user_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own chat messages"
  ON chat_messages FOR ALL USING (auth.uid() = user_id);

-- ── job_matches ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_matches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id     TEXT NOT NULL,
  score      INTEGER NOT NULL DEFAULT 70 CHECK (score >= 0 AND score <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

ALTER TABLE job_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own job matches"
  ON job_matches FOR ALL USING (auth.uid() = user_id);
