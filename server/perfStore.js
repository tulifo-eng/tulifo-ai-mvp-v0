// Performance store — API latency + Web Vitals
const MAX_CALLS   = 2000;
const MAX_VITALS  = 500;

const apiCalls = [];  // { ts, endpoint, method, statusCode, durationMs, sizeBytes }
const vitals   = [];  // { ts, sessionId, fcp, lcp, cls, ttfb, domReady, pageLoad }

// ── API calls ─────────────────────────────────────────────────────────────────

function recordApiCall({ endpoint, method, statusCode, durationMs, sizeBytes }) {
  if (apiCalls.length >= MAX_CALLS) apiCalls.shift();
  apiCalls.push({
    ts: new Date().toISOString(),
    endpoint: endpoint || '',
    method:   method   || 'GET',
    statusCode: statusCode || 0,
    durationMs: durationMs || 0,
    sizeBytes:  sizeBytes  || 0,
  });
}

function getApiStats() {
  if (!apiCalls.length) return { totalCalls: 0, overallAvgMs: 0, overallP95Ms: 0, errorRate: 0, endpoints: [] };

  // Per-endpoint breakdown
  const map = {};
  for (const c of apiCalls) {
    const key = `${c.method} ${c.endpoint}`;
    if (!map[key]) map[key] = [];
    map[key].push(c);
  }

  const endpoints = Object.entries(map).map(([key, items]) => {
    const sorted = items.map(i => i.durationMs).sort((a, b) => a - b);
    const errors = items.filter(i => i.statusCode >= 400).length;
    return {
      endpoint: key,
      count:     items.length,
      avgMs:     Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
      p50Ms:     sorted[Math.floor(sorted.length * 0.50)] || 0,
      p95Ms:     sorted[Math.floor(sorted.length * 0.95)] || 0,
      maxMs:     sorted[sorted.length - 1] || 0,
      errorRate: Math.round((errors / items.length) * 100),
    };
  }).sort((a, b) => b.count - a.count);

  const allMs    = apiCalls.map(c => c.durationMs).sort((a, b) => a - b);
  const errTotal = apiCalls.filter(c => c.statusCode >= 400).length;

  return {
    totalCalls:    apiCalls.length,
    overallAvgMs:  Math.round(allMs.reduce((a, b) => a + b, 0) / allMs.length),
    overallP95Ms:  allMs[Math.floor(allMs.length * 0.95)] || 0,
    errorRate:     Math.round((errTotal / apiCalls.length) * 100),
    endpoints,
  };
}

function getRecentApiCalls(limit = 50) {
  return apiCalls.slice().reverse().slice(0, limit);
}

// ── Web Vitals ────────────────────────────────────────────────────────────────

function recordVitals(data) {
  if (vitals.length >= MAX_VITALS) vitals.shift();
  vitals.push({ ts: new Date().toISOString(), ...data });
}

function getVitalsStats() {
  if (!vitals.length) return { count: 0, avgFCP: 0, avgLCP: 0, avgTTFB: 0, avgDomReady: 0, avgPageLoad: 0, avgCLS: '0.00' };
  const avg = (key) => {
    const vals = vitals.filter(v => v[key] > 0);
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a, v) => a + (v[key] || 0), 0) / vals.length);
  };
  return {
    count:       vitals.length,
    avgFCP:      avg('fcp'),
    avgLCP:      avg('lcp'),
    avgTTFB:     avg('ttfb'),
    avgDomReady: avg('domReady'),
    avgPageLoad: avg('pageLoad'),
    avgCLS:      (vitals.reduce((a, v) => a + (v.cls || 0), 0) / vitals.length).toFixed(3),
  };
}

module.exports = { recordApiCall, getApiStats, getRecentApiCalls, recordVitals, getVitalsStats };
