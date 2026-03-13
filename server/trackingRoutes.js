// Tulifo AI — User tracking routes
// Mount at /api/track  (public — no admin auth required)

const express = require('express');
const fetch   = require('node-fetch');
const router  = express.Router();
const { upsertSession, touchSession, addEvent } = require('./trackingStore');

// ── UA Parser (inline, no extra deps) ────────────────────────────────────────

function parseUA(ua) {
  ua = ua || '';
  // Browser
  let browserName = 'Unknown', browserVersion = '';
  if (/Edg\//.test(ua))            { browserName='Edge';    browserVersion=ua.match(/Edg\/([\d.]+)/)?.[1]||''; }
  else if (/OPR\//.test(ua))       { browserName='Opera';   browserVersion=ua.match(/OPR\/([\d.]+)/)?.[1]||''; }
  else if (/Chrome\//.test(ua))    { browserName='Chrome';  browserVersion=ua.match(/Chrome\/([\d.]+)/)?.[1]||''; }
  else if (/Firefox\//.test(ua))   { browserName='Firefox'; browserVersion=ua.match(/Firefox\/([\d.]+)/)?.[1]||''; }
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) { browserName='Safari'; browserVersion=ua.match(/Version\/([\d.]+)/)?.[1]||''; }
  else if (/MSIE|Trident/.test(ua)){ browserName='IE';      browserVersion=ua.match(/(?:MSIE |rv:)([\d.]+)/)?.[1]||''; }

  // OS
  let osName = 'Unknown', osVersion = '';
  if (/Windows NT 10/.test(ua))       { osName='Windows'; osVersion='10/11'; }
  else if (/Windows NT 6\.3/.test(ua)){ osName='Windows'; osVersion='8.1'; }
  else if (/Windows NT 6\.1/.test(ua)){ osName='Windows'; osVersion='7'; }
  else if (/Windows/.test(ua))        { osName='Windows'; osVersion=''; }
  else if (/Mac OS X ([\d_]+)/.test(ua)){ osName='macOS'; osVersion=(ua.match(/Mac OS X ([\d_]+)/)?.[1]||'').replace(/_/g,'.'); }
  else if (/iPhone|iPad/.test(ua))    { osName='iOS';     osVersion=(ua.match(/OS ([\d_]+)/)?.[1]||'').replace(/_/g,'.'); }
  else if (/Android ([\d.]+)/.test(ua)){ osName='Android'; osVersion=ua.match(/Android ([\d.]+)/)?.[1]||''; }
  else if (/Linux/.test(ua))          { osName='Linux'; }

  // Device
  let deviceType = 'desktop', deviceVendor = '';
  if (/iPad/.test(ua))                          { deviceType='tablet'; deviceVendor='Apple'; }
  else if (/iPhone/.test(ua))                   { deviceType='mobile'; deviceVendor='Apple'; }
  else if (/Android.*Mobile/.test(ua))          { deviceType='mobile'; }
  else if (/Android/.test(ua))                  { deviceType='tablet'; }
  else if (/Mobile|BlackBerry|IEMobile/.test(ua)){ deviceType='mobile'; }

  // Bot detection
  const isBot = /bot|crawler|spider|crawl|slurp|curl|wget|python|java\/|go-http/i.test(ua);

  return {
    browserName,
    browserVersion: (browserVersion.split('.')[0] || ''),
    osName,
    osVersion,
    deviceType,
    deviceVendor,
    isBot,
  };
}

// ── Private IP detection ──────────────────────────────────────────────────────

function isPrivateIP(ip) {
  if (!ip) return true;
  if (ip === '::1' || ip === 'localhost' || ip === '127.0.0.1') return true;
  if (/^127\./.test(ip)) return true;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^::ffff:127\./.test(ip)) return true;
  if (/^::ffff:10\./.test(ip)) return true;
  if (/^::ffff:192\.168\./.test(ip)) return true;
  return false;
}

// ── Geo cache (1 hour TTL) ────────────────────────────────────────────────────

const geoCache = new Map(); // ip -> { data, expiresAt }
const GEO_TTL  = 60 * 60 * 1000; // 1 hour

async function geolocate(ip) {
  if (isPrivateIP(ip)) {
    return { country: 'Local', countryCode: 'DEV', region: '', city: 'localhost', timezone: '', lat: null, lon: null };
  }

  const cached = geoCache.get(ip);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,timezone,lat,lon`,
      { timeout: 3000 }
    );
    if (!res.ok) throw new Error(`ip-api HTTP ${res.status}`);
    const j = await res.json();
    if (j.status !== 'success') throw new Error('ip-api status: ' + j.status);

    const data = {
      country:     j.country     || '',
      countryCode: j.countryCode || '',
      region:      j.regionName  || '',
      city:        j.city        || '',
      timezone:    j.timezone    || '',
      lat:         j.lat         ?? null,
      lon:         j.lon         ?? null,
    };
    geoCache.set(ip, { data, expiresAt: Date.now() + GEO_TTL });
    return data;
  } catch (err) {
    console.warn('[tracking] geo lookup failed for', ip, '—', err.message);
    return null;
  }
}

// ── Helper: extract real IP ───────────────────────────────────────────────────

function extractIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || '';
}

// ── POST /api/track/session ───────────────────────────────────────────────────

router.post('/session', async (req, res) => {
  try {
    const {
      sessionId, userId, isLoggedIn,
      screen, referrer, referrerDomain,
      utmSource, utmMedium, utmCampaign,
      language, isReturning,
    } = req.body || {};

    if (!sessionId) return res.json({ ok: true });

    const ip  = extractIP(req);
    const ua  = req.headers['user-agent'] || '';
    const parsed = parseUA(ua);
    const geo = await geolocate(ip);

    upsertSession({
      sessionId,
      userId:    userId    || null,
      isLoggedIn: !!isLoggedIn,
      ip,
      geo:    geo || {},
      browser: { name: parsed.browserName, version: parsed.browserVersion },
      os:      { name: parsed.osName,      version: parsed.osVersion },
      device:  { type: parsed.deviceType,  vendor:  parsed.deviceVendor },
      screen:  screen || {},
      referrer:       referrer       || '',
      referrerDomain: referrerDomain || '',
      utmSource:   utmSource   || '',
      utmMedium:   utmMedium   || '',
      utmCampaign: utmCampaign || '',
      language:  language   || '',
      isBot:     parsed.isBot,
      isReturning: !!isReturning,
      pageViews:    1,
      actionsCount: 0,
      durationSecs: 0,
    });
  } catch (err) {
    console.warn('[tracking] /session error:', err.message);
  }
  res.json({ ok: true });
});

// ── POST /api/track/event ─────────────────────────────────────────────────────

router.post('/event', (req, res) => {
  try {
    const { sessionId, userId, type, category, label, pagePath, metadata } = req.body || {};
    if (!sessionId || !type) return res.json({ ok: true });
    addEvent({ sessionId, userId: userId || null, type, category: category || '', label: label || '', pagePath: pagePath || '', metadata: metadata || {} });
    // If this is a performance event, also record web vitals
    if (type === 'performance' && metadata) {
      const { recordVitals } = require('./perfStore');
      recordVitals({ sessionId: sessionId || '', ...metadata });
    }
    // If this is a scroll_depth or rage_click event, just let it store normally (already handled by addEvent)
  } catch (err) {
    console.warn('[tracking] /event error:', err.message);
  }
  res.json({ ok: true });
});

// ── POST /api/track/heartbeat ─────────────────────────────────────────────────

router.post('/heartbeat', (req, res) => {
  try {
    const { sessionId, durationSecs, pageViews, userId, isLoggedIn } = req.body || {};
    if (!sessionId) return res.json({ ok: true });
    touchSession(sessionId, {
      durationSecs: durationSecs != null ? Number(durationSecs) : undefined,
      pageViews:    pageViews    != null ? Number(pageViews)    : undefined,
      userId:       userId       || undefined,
      isLoggedIn:   isLoggedIn   != null ? !!isLoggedIn         : undefined,
    });
  } catch (err) {
    console.warn('[tracking] /heartbeat error:', err.message);
  }
  res.json({ ok: true });
});

module.exports = router;
