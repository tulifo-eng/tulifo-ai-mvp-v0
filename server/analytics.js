// In-memory analytics store — backed by Supabase for persistence.
// Reads are served from memory (fast). Writes go to both memory + Supabase.

const supabase = require('./supabaseAdmin');
const startTime = Date.now();

const searches = [];
const errors   = [];
const MAX_EVENTS = 500;

let idCounter = 0;
function nextId() { return ++idCounter; }

// ── Write ─────────────────────────────────────────────────────────────────────

function addSearch({ query, location, count, sources, durationMs, userId }) {
  if (searches.length >= MAX_EVENTS) searches.shift();
  const entry = {
    id: nextId(),
    ts: new Date().toISOString(),
    query:      query     || '',
    location:   location  || '',
    count:      count     || 0,
    sources:    Array.isArray(sources) ? sources : [],
    durationMs: durationMs || 0,
  };
  searches.push(entry);

  if (supabase) {
    supabase.from('admin_search_events').insert({
      ts:           entry.ts,
      query:        entry.query,
      location:     entry.location,
      result_count: entry.count,
      sources:      entry.sources,
      duration_ms:  entry.durationMs,
      user_id:      userId || null,
    }).then(({ error }) => { if (error) console.error('[Analytics] Supabase write error:', error.message); });
  }
}

function addError({ endpoint, message }) {
  if (errors.length >= MAX_EVENTS) errors.shift();
  const entry = {
    id: nextId(),
    ts: new Date().toISOString(),
    endpoint: endpoint || '',
    message:  message  || '',
  };
  errors.push(entry);

  if (supabase) {
    supabase.from('admin_error_events').insert({
      ts:       entry.ts,
      endpoint: entry.endpoint,
      message:  entry.message,
    }).then(({ error }) => { if (error) console.error('[Analytics] Supabase error write failed:', error.message); });
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

function getOverview() {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTs = todayStart.toISOString();

  const todaySearches    = searches.filter(s => s.ts >= todayTs).length;
  const totalSearches    = searches.length;
  const avgJobsPerSearch = totalSearches
    ? Math.round(searches.reduce((sum, s) => sum + (s.count || 0), 0) / totalSearches)
    : 0;
  const avgDurationMs = totalSearches
    ? Math.round(searches.reduce((sum, s) => sum + (s.durationMs || 0), 0) / totalSearches)
    : 0;

  const queryCounts = {};
  for (const s of searches) {
    if (!s.query) continue;
    const key = s.query.toLowerCase().trim();
    queryCounts[key] = (queryCounts[key] || 0) + 1;
  }
  const topQueries = Object.entries(queryCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([query, count]) => ({ query, count }));

  const sourceStats = {};
  for (const s of searches) {
    for (const src of (s.sources || [])) {
      if (!sourceStats[src]) sourceStats[src] = { calls: 0, jobs: 0, totalMs: 0 };
      sourceStats[src].calls  += 1;
      sourceStats[src].jobs   += s.count || 0;
      sourceStats[src].totalMs += s.durationMs || 0;
    }
  }
  for (const src of Object.keys(sourceStats)) {
    const st = sourceStats[src];
    st.avgMs = st.calls ? Math.round(st.totalMs / st.calls) : 0;
    delete st.totalMs;
  }

  return { totalSearches, todaySearches, avgJobsPerSearch, avgDurationMs, topQueries, sourceStats, errorCount: errors.length, uptimeMs: now - startTime };
}

function getRecentSearches(limit = 50) { return searches.slice().reverse().slice(0, limit); }
function getRecentErrors(limit = 20)   { return errors.slice().reverse().slice(0, limit); }

// ── Startup: load from Supabase ───────────────────────────────────────────────

if (supabase) {
  (async () => {
    try {
      const [{ data: sData }, { data: eData }] = await Promise.all([
        supabase.from('admin_search_events').select('*').order('ts', { ascending: false }).limit(500),
        supabase.from('admin_error_events').select('*').order('ts', { ascending: false }).limit(200),
      ]);
      if (sData?.length) {
        searches.push(...sData.reverse().map(r => ({
          id:         nextId(),
          ts:         r.ts,
          query:      r.query     || '',
          location:   r.location  || '',
          count:      r.result_count || 0,
          sources:    r.sources   || [],
          durationMs: r.duration_ms || 0,
        })));
        console.log(`[Analytics] Loaded ${sData.length} search events from Supabase`);
      }
      if (eData?.length) {
        errors.push(...eData.reverse().map(r => ({
          id:       nextId(),
          ts:       r.ts,
          endpoint: r.endpoint || '',
          message:  r.message  || '',
        })));
      }
    } catch (err) {
      console.error('[Analytics] Supabase startup load failed:', err.message);
    }
  })();
}

module.exports = { addSearch, addError, getOverview, getRecentSearches, getRecentErrors };
