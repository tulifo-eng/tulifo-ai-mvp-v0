// In-memory user tracking store — backed by Supabase for persistence.

const supabase = require('./supabaseAdmin');

const MAX_SESSIONS = 1000;
const MAX_EVENTS   = 5000;

const sessions = [];
const events   = [];

let _idCtr = 0;
function uid() { return `${Date.now()}-${++_idCtr}`; }

// auth.users(id) is a UUID — guests pass an email as their tracking id, which
// would fail FK/type validation. Coerce non-UUID values to null.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuidOrNull(v) { return v && UUID_RE.test(v) ? v : null; }

// ── Session helpers ────────────────────────────────────────────────────────────

function sessionToRow(s) {
  return {
    session_id:           s.sessionId,
    user_id:              uuidOrNull(s.userId),
    is_logged_in:         s.isLoggedIn    || false,
    ip_address:           s.ip            || null,
    country:              s.geo?.country      || null,
    country_code:         s.geo?.countryCode  || null,
    region:               s.geo?.region       || null,
    city:                 s.geo?.city         || null,
    timezone:             s.geo?.timezone     || null,
    latitude:             s.geo?.lat          || null,
    longitude:            s.geo?.lon          || null,
    browser_name:         s.browser?.name     || null,
    browser_version:      s.browser?.version  || null,
    os_name:              s.os?.name          || null,
    os_version:           s.os?.version       || null,
    device_type:          s.device?.type      || null,
    device_vendor:        s.device?.vendor    || null,
    screen_width:         s.screen?.w         || null,
    screen_height:        s.screen?.h         || null,
    viewport_width:       s.screen?.vw        || null,
    viewport_height:      s.screen?.vh        || null,
    pixel_ratio:          s.screen?.ratio     || null,
    referrer_url:         s.referrer          || null,
    referrer_domain:      s.referrerDomain    || null,
    utm_source:           s.utmSource         || null,
    utm_medium:           s.utmMedium         || null,
    utm_campaign:         s.utmCampaign       || null,
    language:             s.language          || null,
    is_bot:               s.isBot             || false,
    is_returning:         s.isReturning       || false,
    page_views:           s.pageViews         || 1,
    actions_count:        s.actionsCount      || 0,
    session_duration_secs:s.durationSecs      || 0,
    first_seen_at:        s.firstSeenAt,
    last_seen_at:         s.lastSeenAt,
  };
}

function rowToSession(r) {
  return {
    sessionId:     r.session_id,
    userId:        r.user_id,
    isLoggedIn:    r.is_logged_in,
    ip:            r.ip_address,
    geo: {
      country:     r.country,
      countryCode: r.country_code,
      region:      r.region,
      city:        r.city,
      timezone:    r.timezone,
      lat:         r.latitude,
      lon:         r.longitude,
    },
    browser:       { name: r.browser_name,  version: r.browser_version  },
    os:            { name: r.os_name,        version: r.os_version        },
    device:        { type: r.device_type,    vendor:  r.device_vendor     },
    screen:        { w: r.screen_width, h: r.screen_height, vw: r.viewport_width, vh: r.viewport_height, ratio: r.pixel_ratio },
    referrer:      r.referrer_url,
    referrerDomain:r.referrer_domain,
    utmSource:     r.utm_source,
    utmMedium:     r.utm_medium,
    utmCampaign:   r.utm_campaign,
    language:      r.language,
    isBot:         r.is_bot,
    isReturning:   r.is_returning,
    pageViews:     r.page_views,
    actionsCount:  r.actions_count,
    durationSecs:  r.session_duration_secs,
    firstSeenAt:   r.first_seen_at,
    lastSeenAt:    r.last_seen_at,
  };
}

// ── Sessions ──────────────────────────────────────────────────────────────────

function upsertSession(data) {
  const existing = sessions.find(s => s.sessionId === data.sessionId);
  if (existing) {
    Object.assign(existing, data, { lastSeenAt: new Date().toISOString() });
    if (supabase) {
      supabase.from('user_sessions').upsert(sessionToRow(existing))
        .then(({ error }) => { if (error) console.error('[Tracking] Session upsert error:', error.message); });
    }
    return existing;
  }
  if (sessions.length >= MAX_SESSIONS) sessions.shift();
  const s = { ...data, firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() };
  sessions.push(s);
  if (supabase) {
    supabase.from('user_sessions').upsert(sessionToRow(s), { onConflict: 'session_id' })
      .then(({ error }) => { if (error) console.error('[Tracking] Session insert error:', error.message); });
  }
  return s;
}

function touchSession(sessionId, { durationSecs, pageViews, actionsCount, userId, isLoggedIn } = {}) {
  const s = sessions.find(s => s.sessionId === sessionId);
  if (!s) return;
  s.lastSeenAt = new Date().toISOString();
  if (durationSecs  != null) s.durationSecs  = durationSecs;
  if (pageViews     != null) s.pageViews     = pageViews;
  if (actionsCount  != null) s.actionsCount  = actionsCount;
  if (userId        != null) s.userId        = userId;
  if (isLoggedIn    != null) s.isLoggedIn    = isLoggedIn;
  if (supabase) {
    supabase.from('user_sessions').upsert(sessionToRow(s), { onConflict: 'session_id' })
      .then(({ error }) => { if (error) console.error('[Tracking] Session touch error:', error.message); });
  }
}

function getRecentSessions(limit = 100) {
  return sessions.slice().reverse().slice(0, limit);
}

// ── Events ────────────────────────────────────────────────────────────────────

function addEvent(data) {
  if (events.length >= MAX_EVENTS) events.shift();
  const e = { id: uid(), ...data, createdAt: new Date().toISOString() };
  events.push(e);
  const s = sessions.find(s => s.sessionId === data.sessionId);
  if (s) s.actionsCount = (s.actionsCount || 0) + 1;

  if (supabase) {
    supabase.from('user_events').insert({
      session_id:     e.sessionId  || null,
      user_id:        uuidOrNull(e.userId),
      event_type:     e.type,
      event_category: e.category   || null,
      event_label:    e.label      || null,
      page_path:      e.pagePath   || null,
      metadata:       e.metadata   || {},
      created_at:     e.createdAt,
    }).then(({ error }) => { if (error) console.error('[Tracking] Event insert error:', error.message); });
  }

  return e;
}

function getEventsForSession(sessionId) {
  return events.filter(e => e.sessionId === sessionId).reverse();
}

function getEventsForType(type, limit = 200) {
  return events.filter(e => e.type === type).slice().reverse().slice(0, limit);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function getSessionStats() {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const todayTs = todayStart.toISOString();

  const totalSessions  = sessions.length;
  const todayCount     = sessions.filter(s => s.firstSeenAt >= todayTs).length;
  const returningCount = sessions.filter(s => s.isReturning).length;
  const loggedInCount  = sessions.filter(s => s.isLoggedIn).length;

  const countries = {};
  sessions.forEach(s => { if (s.geo?.country) countries[s.geo.country] = (countries[s.geo.country]||0)+1; });
  const topCountries = Object.entries(countries).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>({name:k,count:v}));

  const browsers = {};
  sessions.forEach(s => { if (s.browser?.name) browsers[s.browser.name] = (browsers[s.browser.name]||0)+1; });
  const topBrowsers = Object.entries(browsers).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>({name:k,count:v}));

  const oses = {};
  sessions.forEach(s => { if (s.os?.name) oses[s.os.name] = (oses[s.os.name]||0)+1; });
  const topOS = Object.entries(oses).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>({name:k,count:v}));

  const devices = {};
  sessions.forEach(s => { const d = s.device?.type||'unknown'; devices[d]=(devices[d]||0)+1; });
  const deviceBreakdown = Object.entries(devices).map(([k,v])=>({type:k,count:v}));

  const withDuration = sessions.filter(s => s.durationSecs > 0);
  const avgDuration  = withDuration.length
    ? Math.round(withDuration.reduce((a,s)=>a+s.durationSecs,0)/withDuration.length)
    : 0;

  return { totalSessions, todayCount, returningCount, loggedInCount, topCountries, topBrowsers, topOS, deviceBreakdown, avgDuration };
}

// ── Startup: load from Supabase ───────────────────────────────────────────────

if (supabase) {
  (async () => {
    try {
      const [{ data: sSessions }, { data: sEvents }] = await Promise.all([
        supabase.from('user_sessions').select('*').order('first_seen_at', { ascending: false }).limit(1000),
        supabase.from('user_events').select('*').order('created_at', { ascending: false }).limit(5000),
      ]);
      if (sSessions?.length) {
        sessions.push(...sSessions.reverse().map(rowToSession));
        console.log(`[Tracking] Loaded ${sSessions.length} sessions from Supabase`);
      }
      if (sEvents?.length) {
        events.push(...sEvents.reverse().map(r => ({
          id:        uid(),
          sessionId: r.session_id,
          userId:    r.user_id,
          type:      r.event_type,
          category:  r.event_category,
          label:     r.event_label,
          pagePath:  r.page_path,
          metadata:  r.metadata || {},
          createdAt: r.created_at,
        })));
        console.log(`[Tracking] Loaded ${sEvents.length} events from Supabase`);
      }
    } catch (err) {
      console.error('[Tracking] Supabase startup load failed:', err.message);
    }
  })();
}

module.exports = { upsertSession, touchSession, getRecentSessions, addEvent, getEventsForSession, getEventsForType, getSessionStats };
