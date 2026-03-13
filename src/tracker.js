// Tulifo AI — Client-side tracker (enhanced)
// Collects browser/device/screen/referral/performance/behavior data

const API_BASE = process.env.REACT_APP_API_URL || '';

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateSessionId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function getOrCreateSessionId() {
  let sid = sessionStorage.getItem('tulifo_session_id');
  if (!sid) { sid = generateSessionId(); sessionStorage.setItem('tulifo_session_id', sid); }
  return sid;
}

function isReturning() {
  const key = 'tulifo_visited';
  const was = !!localStorage.getItem(key);
  localStorage.setItem(key, '1');
  return was;
}

function getUTM() {
  const p = new URLSearchParams(window.location.search);
  return {
    utmSource:   p.get('utm_source')   || '',
    utmMedium:   p.get('utm_medium')   || '',
    utmCampaign: p.get('utm_campaign') || '',
  };
}

function getScreen() {
  return {
    w:     window.screen.width,
    h:     window.screen.height,
    vw:    window.innerWidth,
    vh:    window.innerHeight,
    ratio: window.devicePixelRatio || 1,
  };
}

function getReferrer() {
  const ref = document.referrer || '';
  try { return { referrer: ref, referrerDomain: ref ? new URL(ref).hostname : '' }; }
  catch { return { referrer: ref, referrerDomain: '' }; }
}

async function post(path, body) {
  try {
    await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch { /* fire and forget */ }
}

// ── Web Vitals & Performance ──────────────────────────────────────────────────

function collectPerfMetrics() {
  try {
    const t = performance.timing;
    if (!t || !t.navigationStart) return null;
    return {
      ttfb:     t.responseStart  - t.requestStart,
      domReady: t.domContentLoadedEventEnd - t.navigationStart,
      pageLoad: t.loadEventEnd   - t.navigationStart,
      dns:      t.domainLookupEnd - t.domainLookupStart,
      tcp:      t.connectEnd     - t.connectStart,
    };
  } catch { return null; }
}

function observeWebVitals(onVital) {
  try {
    // FCP — First Contentful Paint
    const fcpObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          onVital('fcp', Math.round(entry.startTime));
        }
      }
    });
    fcpObs.observe({ type: 'paint', buffered: true });

    // LCP — Largest Contentful Paint
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length) {
        onVital('lcp', Math.round(entries[entries.length - 1].startTime));
      }
    });
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true });

    // CLS — Cumulative Layout Shift
    let clsValue = 0;
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) clsValue += entry.value;
      }
      onVital('cls', parseFloat(clsValue.toFixed(4)));
    });
    clsObs.observe({ type: 'layout-shift', buffered: true });

    // FID — First Input Delay
    const fidObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        onVital('fid', Math.round(entry.processingStart - entry.startTime));
      }
    });
    fidObs.observe({ type: 'first-input', buffered: true });
  } catch { /* PerformanceObserver not supported */ }
}

function sendVitals(sessionId, vitalsAccum) {
  const perf = collectPerfMetrics();
  const payload = { ...vitalsAccum, ...(perf || {}) };
  // Only send if we have at least one meaningful value
  if (Object.keys(payload).length > 0) {
    post('/api/track/event', {
      sessionId,
      type: 'performance',
      category: 'web_vitals',
      label: '',
      metadata: payload,
    });
  }
}

// ── Scroll Depth Tracking ────────────────────────────────────────────────────

function initScrollTracking(sessionId) {
  const milestones = new Set();
  let maxDepth = 0;

  const onScroll = () => {
    const docH    = document.documentElement.scrollHeight - window.innerHeight;
    if (docH <= 0) return;
    const pct = Math.round((window.scrollY / docH) * 100);
    if (pct > maxDepth) maxDepth = pct;

    for (const m of [25, 50, 75, 90, 100]) {
      if (pct >= m && !milestones.has(m)) {
        milestones.add(m);
        post('/api/track/event', {
          sessionId,
          type: 'scroll_depth',
          category: 'behavior',
          label: `${m}%`,
          metadata: { depth: m, maxDepth },
        });
      }
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}

// ── Click & Rage Click Tracking ───────────────────────────────────────────────

function initClickTracking(sessionId) {
  // Rage click: 3+ clicks within 700ms in same area (50px radius)
  const recent = [];
  const RAGE_THRESHOLD = 3;
  const RAGE_WINDOW_MS = 700;
  const RAGE_RADIUS_PX = 50;

  const onClick = (e) => {
    const x = e.clientX;
    const y = e.clientY;
    const now = Date.now();

    // Track the click element
    const el = e.target;
    const tag = el.tagName?.toLowerCase() || '';
    const id  = el.id ? `#${el.id}` : '';
    const cls = el.className && typeof el.className === 'string'
      ? `.${el.className.trim().split(/\s+/)[0]}`
      : '';
    const text = (el.innerText || el.value || el.alt || '').slice(0, 40).trim();

    post('/api/track/event', {
      sessionId,
      type: 'click',
      category: 'behavior',
      label: `${tag}${id || cls}`,
      metadata: { x, y, tag, id: el.id || '', text },
    });

    // Rage click detection
    recent.push({ x, y, ts: now });
    // Keep only last 2s
    const window2s = recent.filter(c => now - c.ts < 2000);
    while (recent.length > 20) recent.shift();

    // Check for clicks near same point within RAGE_WINDOW_MS
    const nearby = window2s.filter(c =>
      now - c.ts < RAGE_WINDOW_MS &&
      Math.hypot(c.x - x, c.y - y) < RAGE_RADIUS_PX
    );

    if (nearby.length >= RAGE_THRESHOLD) {
      post('/api/track/event', {
        sessionId,
        type: 'rage_click',
        category: 'behavior',
        label: `${tag}${id || cls}`,
        metadata: { x, y, clickCount: nearby.length, element: `${tag}${id || cls}`, text },
      });
    }
  };

  window.addEventListener('click', onClick);
  return () => window.removeEventListener('click', onClick);
}

// ── Idle Detection ────────────────────────────────────────────────────────────

function initIdleDetection(onIdleChange) {
  let idle = false;
  let timer;
  const IDLE_MS = 30000; // 30s of no interaction = idle

  const reset = () => {
    if (idle) { idle = false; onIdleChange(false); }
    clearTimeout(timer);
    timer = setTimeout(() => { idle = true; onIdleChange(true); }, IDLE_MS);
  };

  ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, reset, { passive: true })
  );
  reset();
  return () => clearTimeout(timer);
}

// ── Core Exports ──────────────────────────────────────────────────────────────

export async function initTracker(userId = null, isLoggedIn = false) {
  const sessionId = getOrCreateSessionId();
  const { referrer, referrerDomain } = getReferrer();

  // Send session
  await post('/api/track/session', {
    sessionId, userId, isLoggedIn,
    screen:      getScreen(),
    referrer, referrerDomain,
    language:    navigator.language || '',
    isReturning: isReturning(),
    ...getUTM(),
  });

  // Collect Web Vitals (non-blocking, send after page fully loads)
  const vitalsAccum = {};
  observeWebVitals((key, val) => { vitalsAccum[key] = val; });

  // Send vitals 5s after load (gives LCP/CLS time to settle)
  const sendAfterLoad = () => {
    setTimeout(() => sendVitals(sessionId, vitalsAccum), 5000);
  };
  if (document.readyState === 'complete') {
    sendAfterLoad();
  } else {
    window.addEventListener('load', sendAfterLoad, { once: true });
  }

  // Behavior tracking
  initScrollTracking(sessionId);
  initClickTracking(sessionId);

  return sessionId;
}

export function trackEvent(type, category = '', label = '', metadata = {}) {
  const sessionId = getOrCreateSessionId();
  post('/api/track/event', { sessionId, type, category, label, metadata });
}

export function identifyUser(userId, isLoggedIn = true) {
  const sessionId = getOrCreateSessionId();
  post('/api/track/heartbeat', { sessionId, userId, isLoggedIn });
}

export function startHeartbeat() {
  const sessionId = getOrCreateSessionId();
  let pageViews = 1;
  let activeSecs = 0;
  let idleNow = false;
  const startTime = Date.now();

  initIdleDetection((isIdle) => { idleNow = isIdle; });

  // Accumulate active time every second
  setInterval(() => { if (!idleNow) activeSecs++; }, 1000);

  const tick = () => {
    const durationSecs = Math.floor((Date.now() - startTime) / 1000);
    post('/api/track/heartbeat', { sessionId, durationSecs, pageViews, activeSecs });
  };

  const interval = setInterval(tick, 30000);
  window.addEventListener('beforeunload', () => { tick(); clearInterval(interval); });
  return { increment: () => { pageViews++; } };
}
