// ── Google OAuth → Supabase-compatible JWT ───────────────────────────────────
// Verifies a Google ID token, finds-or-creates the user in Supabase auth.users
// (via the admin API), then mints a JWT signed with SUPABASE_JWT_SECRET so the
// frontend's supabase.from(...) calls continue to satisfy RLS policies that
// check auth.uid().

const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const supabaseAdmin = require('./supabaseAdmin');

const router = express.Router();

const GOOGLE_CLIENT_ID   = process.env.GOOGLE_CLIENT_ID;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

async function findUserByEmail(email) {
  // GoTrue admin API doesn't expose a direct "get by email" in supabase-js,
  // so we page through listUsers. Fine for current scale; swap for an indexed
  // lookup if user count grows large.
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const hit = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (users.length < perPage) return null;
    page++;
  }
}

async function findOrCreateUser({ email, name, picture, googleSub }) {
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      name,
      avatar_url: picture,
      provider_id: googleSub,
      iss: 'https://accounts.google.com',
    },
    app_metadata: { provider: 'google', providers: ['google'] },
  });
  if (!createErr && created?.user) return created.user;

  // Duplicate email → user already exists; look them up
  const existing = await findUserByEmail(email);
  if (existing) return existing;

  throw createErr || new Error(`Failed to create or find user ${email}`);
}

function mintSupabaseJwt(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: 'authenticated',
    role: 'authenticated',
    iss: 'supabase',
    sub: user.id,
    email: user.email,
    phone: user.phone || '',
    app_metadata: user.app_metadata || { provider: 'google', providers: ['google'] },
    user_metadata: user.user_metadata || {},
    aal: 'aal1',
    amr: [{ method: 'oauth', timestamp: now }],
    session_id: `${user.id}-${now}`,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  return jwt.sign(payload, SUPABASE_JWT_SECRET, { algorithm: 'HS256' });
}

function userResponse(user, fallbackName) {
  return {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.user_metadata?.name || fallbackName || user.email?.split('@')[0],
    avatar: user.user_metadata?.avatar_url || null,
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /api/auth/signup
// Body: { email, password, name? }
// Returns: { access_token, expires_in, user }
router.post('/signup', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin client not configured' });
  if (!SUPABASE_JWT_SECRET) return res.status(500).json({ error: 'SUPABASE_JWT_SECRET not configured on server' });

  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Please use a valid email address.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  try {
    const displayName = (name || email.split('@')[0]).trim();
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName, name: displayName },
      app_metadata: { provider: 'email', providers: ['email'] },
    });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (error.code === 'email_exists' || /already (registered|exists|been registered)/.test(msg)) {
        return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
      }
      throw error;
    }
    const user = data.user;
    const access_token = mintSupabaseJwt(user);
    res.json({ access_token, expires_in: SESSION_TTL_SECONDS, user: userResponse(user, displayName) });
  } catch (err) {
    console.error('[/api/auth/signup] Error:', err.message);
    res.status(500).json({ error: 'Sign up failed', message: err.message });
  }
});

// POST /api/auth/login
// Body: { email, password }
// Returns: { access_token, expires_in, user }
router.post('/login', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin client not configured' });
  if (!SUPABASE_JWT_SECRET) return res.status(500).json({ error: 'SUPABASE_JWT_SECRET not configured on server' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  try {
    // signInWithPassword bcrypt-verifies against auth.users.encrypted_password.
    // ⚠ The SDK attaches the resulting user session to supabaseAdmin — we MUST
    // clear it (scope: 'local') so subsequent supabaseAdmin.from(...) calls keep
    // sending the service-role apikey. Without this, downstream writes (e.g.
    // trackingStore) start hitting RLS as the just-signed-in user.
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (/invalid|credentials|not\s*found|password/i.test(msg)) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      throw error;
    }
    const user = data.user;
    await supabaseAdmin.auth.signOut({ scope: 'local' }).catch(() => {});
    const access_token = mintSupabaseJwt(user);
    res.json({ access_token, expires_in: SESSION_TTL_SECONDS, user: userResponse(user) });
  } catch (err) {
    console.error('[/api/auth/login] Error:', err.message);
    await supabaseAdmin.auth.signOut({ scope: 'local' }).catch(() => {});
    res.status(500).json({ error: 'Login failed', message: err.message });
  }
});

// POST /api/auth/google
// Body: { credential: <Google ID token> }
// Returns: { access_token, expires_in, user }
router.post('/google', async (req, res) => {
  if (!googleClient) {
    return res.status(500).json({ error: 'GOOGLE_CLIENT_ID not configured on server' });
  }
  if (!SUPABASE_JWT_SECRET) {
    return res.status(500).json({ error: 'SUPABASE_JWT_SECRET not configured on server' });
  }
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client not configured' });
  }

  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: 'credential is required' });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) return res.status(401).json({ error: 'Google token missing email' });
    if (payload.email_verified === false) return res.status(401).json({ error: 'Google email not verified' });

    const user = await findOrCreateUser({
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture || null,
      googleSub: payload.sub,
    });

    const access_token = mintSupabaseJwt(user);

    res.json({
      access_token,
      expires_in: SESSION_TTL_SECONDS,
      user: userResponse(user, payload.name),
    });
  } catch (err) {
    console.error('[/api/auth/google] Error:', err.message);
    res.status(401).json({ error: 'Google sign-in failed', message: err.message });
  }
});

module.exports = router;
