// ── Trust & Verification Scoring System ──────────────────────────────────────
// Calculates comprehensive trust score across 6 signal categories.

// ── Category 1: Source Reliability ───────────────────────────────────────────
const SOURCE_RELIABILITY = {
  'Tulifo DB':         { score: 99, tier: 1, label: 'Direct Employer'},
  'JSearch':           { score: 88, tier: 1, label: 'Multi-source'  },
  'USAJobs':           { score: 98, tier: 1, label: 'Government'    },
  'Remotive':          { score: 88, tier: 1, label: 'Curated Remote' },
  'We Work Remotely':  { score: 86, tier: 1, label: 'Established'   },
  'Greenhouse':        { score: 95, tier: 1, label: 'Direct Employer'},
  'Adzuna':            { score: 82, tier: 2, label: 'Established'   },
  'Remote OK':         { score: 80, tier: 2, label: 'Established'   },
  "HN Who's Hiring":   { score: 78, tier: 2, label: 'Community'     },
};
const DEFAULT_SOURCE = { score: 65, tier: 3, label: 'Aggregator' };

function scoreSource(sourceName) {
  return SOURCE_RELIABILITY[sourceName] || DEFAULT_SOURCE;
}

// ── Category 2: Freshness ─────────────────────────────────────────────────────
function scoreFreshness(postedAt) {
  if (!postedAt) return { score: 45, label: 'Unknown', emoji: '⚪', color: '#94a3b8', ageDays: null };

  const days = Math.floor((Date.now() - new Date(postedAt).getTime()) / 86400000);

  if (days <= 1)  return { score: 100, label: 'Today',    emoji: '🟢', color: '#16a34a', ageDays: days };
  if (days <= 3)  return { score: 97,  label: '2–3 days', emoji: '🟢', color: '#16a34a', ageDays: days };
  if (days <= 7)  return { score: 90,  label: 'This week',emoji: '🟢', color: '#16a34a', ageDays: days };
  if (days <= 14) return { score: 78,  label: '2 weeks',  emoji: '🟡', color: '#d97706', ageDays: days };
  if (days <= 30) return { score: 62,  label: '1 month',  emoji: '🟡', color: '#d97706', ageDays: days };
  if (days <= 60) return { score: 40,  label: '2 months', emoji: '🟠', color: '#ea580c', ageDays: days };
  return               { score: 15,  label: 'Stale',     emoji: '🔴', color: '#dc2626', ageDays: days };
}

// ── Category 3: Scam Detection ────────────────────────────────────────────────
const SCAM_KEYWORDS = [
  // Payment scams
  { kw: 'pay upfront',           weight: 30 },
  { kw: 'upfront fee',           weight: 30 },
  { kw: 'processing fee',        weight: 30 },
  { kw: 'registration fee',      weight: 25 },
  { kw: 'training fee',          weight: 25 },
  { kw: 'starter kit',           weight: 20 },
  // Financial
  { kw: 'wire transfer',         weight: 30 },
  { kw: 'western union',         weight: 30 },
  { kw: 'bitcoin payment',       weight: 30 },
  { kw: 'crypto payment',        weight: 30 },
  { kw: 'cashier check',         weight: 25 },
  { kw: 'money order',           weight: 20 },
  // Income promises
  { kw: 'guaranteed income',     weight: 25 },
  { kw: 'guaranteed salary',     weight: 25 },
  { kw: 'guaranteed money',      weight: 25 },
  { kw: 'easy money',            weight: 20 },
  { kw: 'make money fast',       weight: 25 },
  { kw: 'unlimited income',      weight: 25 },
  { kw: 'passive income',        weight: 20 },
  { kw: 'six figures guaranteed',weight: 30 },
  // Urgency / pressure
  { kw: 'act now',               weight: 15 },
  { kw: 'limited time offer',    weight: 15 },
  { kw: 'immediate start',       weight: 8  },
  { kw: 'must start today',      weight: 20 },
  // Identity / PII
  { kw: 'social security',       weight: 30 },
  { kw: 'ssn required',          weight: 30 },
  { kw: 'bank account required', weight: 30 },
  { kw: 'provide your credit',   weight: 30 },
  // MLM / pyramid
  { kw: 'multi-level marketing', weight: 25 },
  { kw: 'network marketing',     weight: 20 },
  { kw: 'recruit others',        weight: 18 },
  { kw: 'downline',              weight: 22 },
  // Too-good-to-be-true
  { kw: 'no experience needed',  weight: 10 },
  { kw: 'no experience required',weight: 10 },
  { kw: 'anyone can do',         weight: 12 },
  { kw: 'work from home easy',   weight: 15 },
  { kw: 'earn $1000',            weight: 20 },
  { kw: 'earn $500 per day',     weight: 25 },
];

const SCAM_TITLE_PATTERNS = [
  /\$\s*\d{3,}\s*(\/hr|per\s*hour|an\s*hour)/i,   // "$500/hr"
  /\b\d{3,}\$\s*(\/hr|per\s*hour)/i,               // "500$/hr"
  /\bunlimited\s+income\b/i,
  /\bpassive\s+income\b/i,
  /\b(make|earn)\s+\$\d+k?\s+(?:a\s+)?(?:day|week)\b/i,
];

const LEGIT_SIGNALS = [
  // These words suggest legitimate postings — reduce scam score
  'health insurance', 'dental', 'vision', '401k', 'pto', 'paid time off',
  'equity', 'stock options', 'annual review', 'performance bonus',
  'background check', 'drug screening', 'reference check',
];

function scoreScam(job) {
  const text  = `${job.title || ''} ${job.description || ''} ${job.company || ''}`.toLowerCase();
  const title = (job.title || '').toLowerCase();

  let rawScore = 0;
  const flags = [];

  // Keyword checks (weighted)
  for (const { kw, weight } of SCAM_KEYWORDS) {
    if (text.includes(kw)) {
      rawScore += weight;
      flags.push(kw);
    }
  }

  // Title pattern checks
  for (const pat of SCAM_TITLE_PATTERNS) {
    if (pat.test(title)) {
      rawScore += 25;
      flags.push('suspicious salary claim');
    }
  }

  // No company name
  if (!job.company || ['Company Not Listed', 'Unknown', ''].includes(job.company)) {
    rawScore += 12;
    flags.push('no company name');
  }

  // Very short description
  if (job.description && job.description.length < 50) {
    rawScore += 12;
    flags.push('minimal description');
  }

  // Legit signals reduce score
  let legitBonus = 0;
  for (const sig of LEGIT_SIGNALS) {
    if (text.includes(sig)) legitBonus += 4;
  }
  rawScore = Math.max(0, rawScore - Math.min(legitBonus, 20));

  const score = Math.min(rawScore, 100);
  return {
    scamRisk:    score,
    safetyScore: 100 - score,  // higher = safer
    flags:       [...new Set(flags)],
    isSuspicious: score >= 25,
    shouldBlock:  score >= 70,
  };
}

// ── Category 4: Company Legitimacy ───────────────────────────────────────────
const KNOWN_COMPANIES = new Set([
  'google', 'meta', 'apple', 'amazon', 'microsoft', 'netflix', 'stripe',
  'airbnb', 'uber', 'lyft', 'twitter', 'x', 'openai', 'anthropic', 'deepmind',
  'salesforce', 'shopify', 'spotify', 'slack', 'zoom', 'palantir', 'snowflake',
  'databricks', 'notion', 'figma', 'linear', 'vercel', 'cloudflare', 'tailscale',
  'hashicorp', 'gitlab', 'github', 'atlassian', 'hubspot', 'twilio', 'okta',
  'datadog', 'mongodb', 'elastic', 'confluent', 'hashnode', 'supabase',
  'planetscale', 'neon', 'turso', 'railway', 'render', 'fly.io', 'digitalocean',
  'linode', 'fastly', 'akamai', 'splunk', 'pagerduty', 'new relic', 'dynatrace',
]);

function scoreCompany(job) {
  const name = (job.company || '').toLowerCase().trim();

  if (!name || name === 'unknown' || name === 'company not listed') {
    return { score: 40, label: 'Unknown company', isKnown: false };
  }

  // Known tier-1 company
  if (KNOWN_COMPANIES.has(name)) {
    return { score: 98, label: 'Top-tier company', isKnown: true };
  }

  // Company name looks real (2+ words or has Inc/LLC/Corp)
  const hasLegalSuffix = /\b(inc|llc|corp|ltd|co\.|gmbh|plc|technologies|solutions|systems|software|group|labs|studios|ventures)\b/i.test(name);
  const hasMultipleWords = name.split(/\s+/).length >= 2;
  const nameLength = name.length;

  let score = 68; // baseline for named company
  if (hasLegalSuffix)   score += 12;
  if (hasMultipleWords) score += 8;
  if (nameLength > 4)   score += 5;

  return { score: Math.min(score, 92), label: 'Company listed', isKnown: false };
}

// ── Category 5: Transparency ──────────────────────────────────────────────────
function scoreTransparency(job) {
  let score = 0;
  const signals = [];

  // Salary disclosed
  const hasSalary = job.salary && job.salary !== 'Not listed' && job.salary !== '';
  if (hasSalary) { score += 30; signals.push('Salary disclosed'); }

  // Location specified
  const hasLocation = job.location && !['', 'unknown'].includes((job.location || '').toLowerCase());
  if (hasLocation) { score += 20; signals.push('Location specified'); }

  // Apply URL valid
  const hasApplyUrl = job.applyUrl && job.applyUrl !== '#' && job.applyUrl.startsWith('http');
  if (hasApplyUrl) { score += 20; signals.push('Direct apply link'); }

  // Meaningful description (200+ chars)
  const descLen = (job.description || '').length;
  if (descLen >= 200) { score += 20; signals.push('Detailed description'); }
  else if (descLen >= 80) { score += 10; }

  // Tags / skills listed
  if (job.tags && job.tags.length >= 2) { score += 10; signals.push('Skills listed'); }

  return { score: Math.min(score, 100), signals };
}

// ── Category 6: Description Quality ──────────────────────────────────────────
function scoreDescriptionQuality(job) {
  const desc = (job.description || '').toLowerCase();
  const len  = desc.length;

  if (len === 0) return { score: 20, label: 'No description' };

  let score = 40;

  // Length scoring
  if (len >= 500) score += 30;
  else if (len >= 200) score += 20;
  else if (len >= 80) score += 10;

  // Professional terms
  const professionalTerms = [
    'experience', 'requirements', 'responsibilities', 'qualifications',
    'benefits', 'compensation', 'team', 'role', 'position', 'skills',
    'opportunity', 'candidate', 'work', 'collaborate', 'develop',
  ];
  const termCount = professionalTerms.filter(t => desc.includes(t)).length;
  score += Math.min(termCount * 3, 30);

  return { score: Math.min(score, 100), label: score >= 80 ? 'Detailed' : score >= 60 ? 'Adequate' : 'Brief' };
}

// ── Composite Trust Score ─────────────────────────────────────────────────────
function calculateTrustScore(job) {
  const freshness = scoreFreshness(job.postedAt);
  const source    = scoreSource(job.source);
  const scam      = scoreScam(job);
  const company   = scoreCompany(job);
  const transp    = scoreTransparency(job);
  const descQ     = scoreDescriptionQuality(job);

  // Weighted composite
  const composite = Math.round(
    freshness.score   * 0.18 +
    source.score      * 0.22 +
    scam.safetyScore  * 0.28 +   // safety (inverted scam risk)
    company.score     * 0.15 +
    transp.score      * 0.10 +
    descQ.score       * 0.07
  );

  let trustLevel, trustBadge, trustColor, trustBg;
  if (composite >= 88) {
    trustLevel = 'verified'; trustBadge = '✓ Verified';   trustColor = '#16a34a'; trustBg = '#f0fdf4';
  } else if (composite >= 72) {
    trustLevel = 'trusted';  trustBadge = '✓ Trusted';    trustColor = '#2563eb'; trustBg = '#eff6ff';
  } else if (composite >= 55) {
    trustLevel = 'caution';  trustBadge = '⚠ Review';     trustColor = '#d97706'; trustBg = '#fffbeb';
  } else {
    trustLevel = 'low';      trustBadge = '⚠ Low Trust';  trustColor = '#dc2626'; trustBg = '#fef2f2';
  }

  return {
    // Overall
    trustScore:         composite,
    trustLevel,
    trustBadge,
    trustColor,
    trustBg,
    // Category scores
    freshnessScore:     freshness.score,
    freshnessLabel:     freshness.label,
    freshnessEmoji:     freshness.emoji,
    freshnessColor:     freshness.color,
    freshnessAgeDays:   freshness.ageDays,
    sourceScore:        source.score,
    sourceLabel:        source.label,
    sourceTier:         source.tier,
    safetyScore:        scam.safetyScore,
    scamRisk:           scam.scamRisk,
    scamFlags:          scam.flags,
    isSuspicious:       scam.isSuspicious,
    shouldBlock:        scam.shouldBlock,
    companyScore:       company.score,
    companyLabel:       company.label,
    isKnownCompany:     company.isKnown,
    transparencyScore:  transp.score,
    transparencySignals:transp.signals,
    descQualityScore:   descQ.score,
    descQualityLabel:   descQ.label,
  };
}

// ── Enrich a job array with trust data ────────────────────────────────────────
function enrichWithTrust(jobs) {
  const { recordBatch } = require('./trustStats');

  const enriched = jobs.map(job => ({ ...job, trust: calculateTrustScore(job) }));
  const passed   = enriched.filter(job => !job.trust.shouldBlock);
  const blocked  = enriched.filter(job =>  job.trust.shouldBlock);

  recordBatch(passed, blocked);

  return passed;
}

module.exports = { calculateTrustScore, enrichWithTrust, scoreSource };
