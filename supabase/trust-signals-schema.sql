-- ═══════════════════════════════════════════════════════════
-- TRUST SIGNALS SYSTEM — DATABASE SCHEMA
-- ═══════════════════════════════════════════════════════════

-- Company Trust Profiles
CREATE TABLE IF NOT EXISTS company_trust_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name        TEXT UNIQUE NOT NULL,
  company_domain      TEXT,

  -- Verification
  verified            BOOLEAN DEFAULT false,
  verification_level  INTEGER DEFAULT 0,  -- 0–5
  is_known_brand      BOOLEAN DEFAULT false,
  stock_ticker        TEXT,
  founded_year        INTEGER,
  employee_count      INTEGER,
  official_website    TEXT,
  linkedin_url        TEXT,
  glassdoor_url       TEXT,
  physical_address    TEXT,
  address_verified    BOOLEAN DEFAULT false,

  -- Reputation
  company_rating      NUMERIC(3,2),       -- 0.00–5.00
  total_reviews       INTEGER DEFAULT 0,
  awards              JSONB,              -- [{name, year, issuer}]

  -- Trust
  trust_score         INTEGER DEFAULT 68, -- 0–100
  last_verified       TIMESTAMP DEFAULT NOW(),
  verification_checks JSONB,              -- {check: passed|failed}

  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- Per-job trust scores (cached calculation results)
CREATE TABLE IF NOT EXISTS job_trust_scores (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                  TEXT UNIQUE NOT NULL,
  job_title               TEXT,
  company_name            TEXT,

  -- Overall (0–100)
  trust_score             INTEGER NOT NULL,
  trust_level             TEXT,           -- 'verified'|'trusted'|'caution'|'low'

  -- Category scores (each 0–100)
  freshness_score         INTEGER,
  freshness_label         TEXT,
  source_score            INTEGER,
  source_label            TEXT,
  safety_score            INTEGER,        -- inverse of scam risk
  scam_risk               INTEGER,        -- raw scam risk 0–100
  scam_flags              TEXT[],
  company_score           INTEGER,
  company_label           TEXT,
  is_known_company        BOOLEAN DEFAULT false,
  transparency_score      INTEGER,
  transparency_signals    TEXT[],
  desc_quality_score      INTEGER,
  desc_quality_label      TEXT,

  -- Freshness detail
  posted_at               TIMESTAMP,
  age_days                INTEGER,
  is_new                  BOOLEAN DEFAULT false,  -- <24 hrs

  -- Salary
  salary_disclosed        BOOLEAN DEFAULT false,
  salary_min              INTEGER,
  salary_max              INTEGER,
  salary_realistic        BOOLEAN,

  -- Meta
  last_calculated         TIMESTAMP DEFAULT NOW(),
  calculation_version     TEXT DEFAULT 'v2.0',

  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

-- User feedback on job postings
CREATE TABLE IF NOT EXISTS job_user_feedback (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            TEXT NOT NULL,
  user_id           UUID,

  feedback_type     TEXT,               -- 'rating'|'scam_report'|'success_story'

  -- Ratings
  overall_rating    INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  response_received BOOLEAN,
  days_to_response  INTEGER,
  got_interview     BOOLEAN,
  got_offer         BOOLEAN,

  -- Success story
  hired             BOOLEAN DEFAULT false,
  hire_date         DATE,
  salary_accepted   INTEGER,

  -- Scam report
  is_scam_report    BOOLEAN DEFAULT false,
  scam_details      TEXT,
  scam_verified     BOOLEAN,

  -- Review
  review_text       TEXT,
  would_recommend   BOOLEAN,

  -- Meta
  verified          BOOLEAN DEFAULT false,
  helpful_count     INTEGER DEFAULT 0,

  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- Source reliability registry
CREATE TABLE IF NOT EXISTS job_source_reliability (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name         TEXT UNIQUE NOT NULL,

  trust_score         INTEGER DEFAULT 65,  -- 0–100
  tier                INTEGER DEFAULT 3,   -- 1=top, 2=established, 3=aggregator
  tier_label          TEXT,

  total_jobs_posted   BIGINT DEFAULT 0,
  scam_jobs_found     INTEGER DEFAULT 0,
  scam_rate           NUMERIC(5,2),        -- percentage

  average_job_quality INTEGER DEFAULT 65,
  user_satisfaction   NUMERIC(3,2),        -- 0.00–5.00
  is_premium_source   BOOLEAN DEFAULT false,
  requires_auth       BOOLEAN DEFAULT false,

  last_updated        TIMESTAMP DEFAULT NOW(),
  created_at          TIMESTAMP DEFAULT NOW()
);

-- Scam detection rules registry
CREATE TABLE IF NOT EXISTS scam_detection_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name     TEXT NOT NULL,
  rule_pattern  TEXT,
  rule_type     TEXT,                   -- 'keyword'|'regex'|'pattern'
  severity      TEXT,                   -- 'low'|'medium'|'high'|'critical'
  weight        INTEGER DEFAULT 10,     -- score impact
  enabled       BOOLEAN DEFAULT true,
  description   TEXT,
  examples      JSONB,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_company_trust_name   ON company_trust_profiles(company_name);
CREATE INDEX IF NOT EXISTS idx_job_trust_score      ON job_trust_scores(trust_score DESC);
CREATE INDEX IF NOT EXISTS idx_job_trust_level      ON job_trust_scores(trust_level);
CREATE INDEX IF NOT EXISTS idx_job_trust_id         ON job_trust_scores(job_id);
CREATE INDEX IF NOT EXISTS idx_feedback_job         ON job_user_feedback(job_id);
CREATE INDEX IF NOT EXISTS idx_source_reliability   ON job_source_reliability(trust_score DESC);

-- ── Auto-update timestamps ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_company_trust_ts ON company_trust_profiles;
CREATE TRIGGER trg_company_trust_ts
  BEFORE UPDATE ON company_trust_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_job_trust_ts ON job_trust_scores;
CREATE TRIGGER trg_job_trust_ts
  BEFORE UPDATE ON job_trust_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Seed: source reliability baseline data ────────────────────────────────────
INSERT INTO job_source_reliability (source_name, trust_score, tier, tier_label, scam_rate, is_premium_source, requires_auth)
VALUES
  ('USAJobs',         98, 1, 'Government',     0.00, false, true),
  ('Remotive',        88, 1, 'Curated Remote', 0.10, false, false),
  ('We Work Remotely',86, 1, 'Established',    0.15, false, false),
  ('Adzuna',          82, 2, 'Established',    0.50, false, true),
  ('Remote OK',       80, 2, 'Established',    0.60, false, false),
  ('HN Who''s Hiring',78, 2, 'Community',      0.30, false, false)
ON CONFLICT (source_name) DO NOTHING;
