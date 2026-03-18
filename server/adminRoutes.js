// Admin API routes — protected by username/password login
const express = require('express');
const router = express.Router();
const { getOverview, getRecentSearches, getRecentErrors } = require('./analytics');
const { getAllFeedback, getFeedbackStats }                = require('./feedbackStore');
const { getTrustStats }                                  = require('./trustStats');
const { listKeys, setKey, deleteKey }                    = require('./apiKeyStore');
const jobSources = require('./config/jobSources');
// trackingStore loaded lazily in route handler (avoids circular dep issues)

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';
const SESSION_TOKEN  = 'tulifo-admin-authenticated';

// ── POST /api/admin/login (public) ────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return res.json({ token: SESSION_TOKEN });
  }
  res.status(401).json({ error: 'Invalid username or password' });
});

// ── Auth middleware (all routes below require valid token) ────────────────────
router.use((req, res, next) => {
  const provided = req.headers['x-admin-secret'];
  if (provided !== SESSION_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized — please log in' });
  }
  next();
});

// ── GET /api/admin/overview ───────────────────────────────────────────────────
router.get('/overview', (req, res) => {
  res.json(getOverview());
});

// ── GET /api/admin/searches?limit=50 ─────────────────────────────────────────
router.get('/searches', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
  res.json(getRecentSearches(limit));
});

// ── GET /api/admin/errors ─────────────────────────────────────────────────────
router.get('/errors', (req, res) => {
  res.json(getRecentErrors());
});

// ── GET /api/admin/sources ────────────────────────────────────────────────────
router.get('/sources', (req, res) => {
  const overview = getOverview();
  const { sourceStats } = overview;

  const sources = Object.entries(jobSources).map(([key, cfg]) => ({
    key,
    name: cfg.name,
    emoji: cfg.emoji || '🔧',
    status: cfg.status,
    enabled: cfg.enabled,
    type: cfg.type,
    requiresAuth: cfg.requiresAuth,
    notes: cfg.notes || '',
    stats: sourceStats[key] || { calls: 0, jobs: 0, avgMs: 0 },
  }));

  res.json(sources);
});

// ── POST /api/admin/sources/:key/toggle ──────────────────────────────────────
router.post('/sources/:key/toggle', (req, res) => {
  const { key } = req.params;
  const cfg = jobSources[key];
  if (!cfg) return res.status(404).json({ error: 'Source not found' });
  cfg.enabled = !cfg.enabled;
  res.json({ key, enabled: cfg.enabled });
});

// ── GET /api/admin/health ─────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  const { errorCount, uptimeMs } = getOverview();
  res.json({
    ok: true,
    uptimeMs,
    env: {
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasAdzunaKeys: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY && process.env.ADZUNA_APP_ID !== 'your_app_id_here'),
      hasUSAJobsKey: !!(process.env.USAJOBS_API_KEY && process.env.USAJOBS_EMAIL),
      hasScraperDbUrl: !!process.env.SCRAPER_DB_URL,
      nodeEnv: process.env.NODE_ENV || 'development',
    },
    memory: process.memoryUsage(),
    errorCount,
  });
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', (req, res) => {
  const { getRecentSessions, getSessionStats } = require('./trackingStore');
  res.json({
    stats:    getSessionStats(),
    sessions: getRecentSessions(200),
  });
});

// ── GET /api/admin/performance ────────────────────────────────────────────────
router.get('/performance', (req, res) => {
  const { getApiStats, getRecentApiCalls, getVitalsStats } = require('./perfStore');
  res.json({
    api:    getApiStats(),
    vitals: getVitalsStats(),
    recent: getRecentApiCalls(100),
  });
});

// ── GET /api/admin/behavior ───────────────────────────────────────────────────
router.get('/behavior', (req, res) => {
  const { getEventsForType } = require('./trackingStore');
  // Get scroll depth events and rage click events
  const scrollEvents     = (getEventsForType ? getEventsForType('scroll_depth', 500)     : []);
  const rageClickEvents  = (getEventsForType ? getEventsForType('rage_click',   200)     : []);
  const clickEvents      = (getEventsForType ? getEventsForType('click',        500)     : []);
  res.json({ scrollEvents, rageClickEvents, clickEvents });
});

// ── GET /api/admin/trust ──────────────────────────────────────────────────────
router.get('/trust', (req, res) => {
  res.json(getTrustStats());
});

// ── GET /api/admin/engagement ─────────────────────────────────────────────────
router.get('/engagement', (req, res) => {
  const { getEventsForType } = require('./trackingStore');
  const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);

  const applyClicks = getEventsForType('apply_click',  limit);
  const jobSaves    = getEventsForType('job_save',     limit);
  const jobViews    = getEventsForType('job_view',     limit);
  const jobDiscards = getEventsForType('job_discard',  limit);
  const feedbackOpen= getEventsForType('feedback_open',limit);

  // Aggregate top applied companies/jobs
  const companyCounts = {};
  for (const e of applyClicks) {
    const c = e.metadata?.company || 'Unknown';
    companyCounts[c] = (companyCounts[c] || 0) + 1;
  }
  const topApplied = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([company, count]) => ({ company, count }));

  // Aggregate top saved sources
  const sourceSaveCounts = {};
  for (const e of jobSaves) {
    const s = e.metadata?.source || 'Unknown';
    sourceSaveCounts[s] = (sourceSaveCounts[s] || 0) + 1;
  }
  const topSavedSources = Object.entries(sourceSaveCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([source, count]) => ({ source, count }));

  res.json({
    counts: {
      applyClicks:  applyClicks.length,
      jobSaves:     jobSaves.length,
      jobViews:     jobViews.length,
      jobDiscards:  jobDiscards.length,
      feedbackOpens:feedbackOpen.length,
    },
    topApplied,
    topSavedSources,
    recentApplies: applyClicks.slice(0, 50),
  });
});

// ── GET /api/admin/feedback ───────────────────────────────────────────────────
router.get('/feedback', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
  res.json({
    stats: getFeedbackStats(),
    items: getAllFeedback(limit),
  });
});

// ── GET /api/admin/apikeys ────────────────────────────────────────────────────
router.get('/apikeys', (req, res) => {
  res.json(listKeys());
});

// ── POST /api/admin/apikeys ───────────────────────────────────────────────────
router.post('/apikeys', (req, res) => {
  const { envKey, value } = req.body || {};
  if (!envKey || !value) {
    return res.status(400).json({ error: 'envKey and value are required' });
  }
  try {
    setKey(envKey, value);
    res.json({ ok: true, message: `Key ${envKey} updated successfully` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── DELETE /api/admin/apikeys/:envKey ─────────────────────────────────────────
router.delete('/apikeys/:envKey', (req, res) => {
  const { envKey } = req.params;
  try {
    deleteKey(envKey);
    res.json({ ok: true, message: `Key ${envKey} cleared successfully` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
