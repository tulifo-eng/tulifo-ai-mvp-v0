-- ============================================================================
-- Full-text search index for the jobs table
-- Run this in Supabase Dashboard → SQL Editor → New query
-- ============================================================================

-- Create a GIN index for full-text search on title + description + company
-- This dramatically speeds up @@ (text search) queries
CREATE INDEX IF NOT EXISTS idx_jobs_fulltext
  ON jobs
  USING GIN (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(company,''))
  );

-- Index for active jobs filter (used in every query)
CREATE INDEX IF NOT EXISTS idx_jobs_active
  ON jobs (is_active)
  WHERE is_active = true;

-- Index for location ILIKE searches
CREATE INDEX IF NOT EXISTS idx_jobs_location_trgm
  ON jobs
  USING GIN (location gin_trgm_ops);

-- Enable pg_trgm extension (needed for ILIKE index above)
-- This may already be enabled in Supabase
CREATE EXTENSION IF NOT EXISTS pg_trgm;
