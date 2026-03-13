// ── API Key Store ─────────────────────────────────────────────────────────────
// Manages runtime API keys. Persists to data/apiKeys.json so changes survive
// server restarts without touching the .env file.
// All writes also update process.env so fetchers pick them up immediately.

const fs   = require('fs');
const path = require('path');

const STORE_FILE = path.join(__dirname, 'data', 'apiKeys.json');

// ── Full credential registry ──────────────────────────────────────────────────
// Add any new credentials here — they will appear automatically in the admin UI.
const CREDENTIAL_REGISTRY = [
  // ── Active sources ──
  { envKey: 'JSEARCH_API_KEY',         source: 'JSearch',         label: 'API Key',       emoji: '🌐', active: true  },
  { envKey: 'ADZUNA_APP_ID',           source: 'Adzuna',          label: 'App ID',        emoji: '🔍', active: true  },
  { envKey: 'ADZUNA_APP_KEY',          source: 'Adzuna',          label: 'App Key',       emoji: '🔍', active: true  },
  { envKey: 'USAJOBS_API_KEY',         source: 'USAJobs',         label: 'API Key',       emoji: '🏢', active: true  },
  { envKey: 'USAJOBS_EMAIL',           source: 'USAJobs',         label: 'Email',         emoji: '🏢', active: true  },
  // ── AI ──
  { envKey: 'ANTHROPIC_API_KEY',       source: 'Claude AI',       label: 'API Key',       emoji: '🤖', active: true  },
  // ── Future / restricted sources ──
  { envKey: 'LINKEDIN_CLIENT_ID',      source: 'LinkedIn',        label: 'Client ID',     emoji: '💼', active: false },
  { envKey: 'LINKEDIN_CLIENT_SECRET',  source: 'LinkedIn',        label: 'Client Secret', emoji: '💼', active: false },
  { envKey: 'GLASSDOOR_PARTNER_ID',    source: 'Glassdoor',       label: 'Partner ID',    emoji: '🚪', active: false },
  { envKey: 'GLASSDOOR_KEY',           source: 'Glassdoor',       label: 'API Key',       emoji: '🚪', active: false },
  { envKey: 'ZIPRECRUITER_API_KEY',    source: 'ZipRecruiter',    label: 'API Key',       emoji: '⚡', active: false },
  { envKey: 'HANDSHAKE_API_KEY',       source: 'Handshake',       label: 'API Key',       emoji: '🤝', active: false },
  { envKey: 'COLLEGE_RECRUITER_API_KEY',source:'College Recruiter',label: 'API Key',      emoji: '🏫', active: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskValue(val) {
  if (!val) return null;
  if (val.length <= 8) return '****';
  return `${val.slice(0, 4)}${'*'.repeat(Math.min(val.length - 8, 16))}${val.slice(-4)}`;
}

function loadSaved() {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function persistSaved(saved) {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(saved, null, 2), 'utf8');
}

// ── On startup: apply saved keys to process.env ───────────────────────────────
(function applyOnStartup() {
  const saved = loadSaved();
  for (const [envKey, value] of Object.entries(saved)) {
    if (value) process.env[envKey] = value;
  }
  if (Object.keys(saved).length) {
    console.log(`[ApiKeyStore] Loaded ${Object.keys(saved).length} saved key(s) from store`);
  }
})();

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns all credentials with masked values and set status — safe for API response */
function listKeys() {
  return CREDENTIAL_REGISTRY.map(cred => ({
    envKey:   cred.envKey,
    source:   cred.source,
    label:    cred.label,
    emoji:    cred.emoji,
    active:   cred.active,
    isSet:    !!process.env[cred.envKey],
    masked:   maskValue(process.env[cred.envKey]),
  }));
}

/** Set a key — updates process.env and persists to file */
function setKey(envKey, value) {
  const allowed = CREDENTIAL_REGISTRY.find(c => c.envKey === envKey);
  if (!allowed) throw new Error(`Unknown credential key: ${envKey}`);
  if (!value || !value.trim()) throw new Error('Value cannot be empty');

  process.env[envKey] = value.trim();

  const saved = loadSaved();
  saved[envKey] = value.trim();
  persistSaved(saved);
}

/** Delete/clear a key — removes from process.env and persisted store */
function deleteKey(envKey) {
  const allowed = CREDENTIAL_REGISTRY.find(c => c.envKey === envKey);
  if (!allowed) throw new Error(`Unknown credential key: ${envKey}`);

  delete process.env[envKey];

  const saved = loadSaved();
  delete saved[envKey];
  persistSaved(saved);
}

module.exports = { listKeys, setKey, deleteKey, CREDENTIAL_REGISTRY };
