require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { aggregateJobs } = require('./jobAggregator');
const { addFeedback }  = require('./feedbackStore');
const { scoreJobs } = require('./aiScoring');
const analytics = require('./analytics');
const adminRoutes    = require('./adminRoutes');
const trackingRoutes = require('./trackingRoutes');
const perfMiddleware = require('./perfMiddleware');
const jobSources     = require('./config/jobSources');

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '2mb' }));
app.use('/api/track', trackingRoutes);
app.use(perfMiddleware);

// ── Admin server on its own port ──────────────────────────────────────────────
const ADMIN_PORT = process.env.ADMIN_PORT || 5051;
const adminApp = express();
adminApp.use(cors({ origin: 'http://localhost:3000' }));
adminApp.use(express.json({ limit: '2mb' }));
adminApp.use('/api/admin', adminRoutes);
adminApp.listen(ADMIN_PORT, () => {
  console.log(`Admin console API running on http://localhost:${ADMIN_PORT}`);
});

const PORT = process.env.PORT || 5050;
const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
const client = hasApiKey ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

const hasAdzuna  = !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY && process.env.ADZUNA_APP_ID !== 'your_app_id_here');
const hasUSAJobs = !!(process.env.USAJOBS_API_KEY && process.env.USAJOBS_EMAIL);
const hasJSearch = !!process.env.JSEARCH_API_KEY;

// ── POST /api/search-jobs ────────────────────────────────────────────────────
// Body: { query: string, location: string, userProfile: {...}, limit?: number }
// Returns: { jobs: [...], total: number, sources: string[], durationMs: number }
app.post('/api/search-jobs', async (req, res) => {
  const { query = '', location = '', userProfile = {}, limit = 100 } = req.body;
  const start = Date.now();

  try {
    // 1. Aggregate jobs from all enabled sources
    const rawJobs = await aggregateJobs({ query, location, limit });

    if (!rawJobs.length) {
      return res.json({ jobs: [], total: 0, sources: [], durationMs: Date.now() - start });
    }

    // 2. AI-score the jobs against user profile
    const scoredJobs = await scoreJobs(rawJobs, userProfile);

    // 3. Collect source attribution
    const sources = [...new Set(scoredJobs.map(j => j.source))];

    const durationMs = Date.now() - start;
    console.log(`[/api/search-jobs] Returning ${scoredJobs.length} jobs from [${sources.join(', ')}] in ${durationMs}ms`);
    analytics.addSearch({ query, location, count: scoredJobs.length, sources, durationMs });
    res.json({
      jobs: scoredJobs,
      total: scoredJobs.length,
      sources,
      durationMs,
    });
  } catch (err) {
    console.error('[/api/search-jobs] Error:', err.message);
    analytics.addError({ endpoint: '/api/search-jobs', message: err.message });
    res.status(500).json({ error: 'Job search failed', message: err.message });
  }
});

// ── Chat helpers ──────────────────────────────────────────────────────────────

// Location keywords → canonical values
const LOCATION_KEYWORDS = [
  [/anywhere|worldwide|globally|international|world/i, 'remote'],
  [/\bremote\b/i, 'remote'],
];

// Words that are never a skill on their own
const FILLER_WORDS = new Set([
  'a', 'an', 'the', 'i', 'me', 'my', 'find', 'get', 'need',
  'want', 'looking', 'for', 'some', 'any', 'just', 'please',
  'job', 'jobs', 'work', 'role', 'position', 'opportunity',
  // Location-only words — user saying these means location, not skill
  'remote', 'anywhere', 'globally', 'worldwide', 'international',
]);

// Strip noise prefixes and trailing location/job words from a raw skill phrase
function cleanSkill(raw) {
  return raw
    .replace(/^(i want |i need |find me |get me |looking for |search for |i do |i can |i am |i'm |as a?n? )/i, '')
    .replace(/\s+(job|jobs|role|roles|position|work|opportunity)s?\s*$/i, '')
    .replace(/\s+(anywhere|worldwide|globally|remote|international|in the world)\s*$/i, '')
    .trim();
}

// Extract skill and location — MESSAGE takes priority over profile.
// Profile is only used as fallback when message doesn't contain the info.
function extractSearchParams(text, messages, userProfile) {
  // Only use last 6 user messages (skip AI messages) to build context
  const userHistory = messages
    .filter(m => m.role === 'user')
    .slice(-6)
    .map(m => m.content || '');

  const allText = [...userHistory, text].join(' ');

  let query = '';
  let location = '';

  // ── Location from message ────────────────────────────────────────────────────
  for (const [pattern, canonical] of LOCATION_KEYWORDS) {
    if (pattern.test(allText)) { location = canonical; break; }
  }
  if (!location) {
    const m = allText.match(/\bin\s+((?:[A-Z][a-zA-Z]+\s*){1,3})/);
    if (m) location = m[1].trim();
  }

  // ── Skill from message ───────────────────────────────────────────────────────
  // Pattern 1: "find/want/need [a] X job/role"
  const p1 = allText.match(/(?:i want|i need|find me|get me|looking for|search for)\s+(?:a\s+|an\s+)?(.+?)\s*(?:job|jobs|role|roles|position|work|opportunity)s?\b/i);
  if (p1) query = cleanSkill(p1[1]);

  // Pattern 2: "X job(s)" anywhere
  if (!query) {
    const p2 = allText.match(/\b(.+?)\s+(?:job|jobs|role|roles|position|work)\b/i);
    if (p2) query = cleanSkill(p2[1]);
  }

  // Pattern 3: "I'm a / I am a / as a X"
  if (!query) {
    const p3 = allText.match(/(?:i(?:'m| am)|as)\s+(?:a\s+|an\s+)?(.+?)(?:\s+in\s|\s+with\s|[,.]|$)/i);
    if (p3) query = cleanSkill(p3[1]);
  }

  // Pattern 4: "I can / I do X"
  if (!query) {
    const p4 = allText.match(/i\s+(?:can|do)\s+(.+?)(?:\s+in\s|\s+with\s|[,.]|$)/i);
    if (p4) query = cleanSkill(p4[1]);
  }

  // Pattern 5: raw message text (last resort — user typed just a skill word)
  if (!query) {
    const candidate = cleanSkill(text);
    if (candidate && !FILLER_WORDS.has(candidate.toLowerCase())) query = candidate;
  }

  // Pattern 6: current message was location-only — rescue skill from full history
  // e.g. user said "Data Scientist" then "anywhere" → allText has skill but text is just location
  if (!query && location && allText.length > text.length) {
    const stripped = allText
      .replace(/\b(remote|anywhere|worldwide|globally|international|world)\b/gi, ' ')
      .replace(/\bin\s+\S+(\s+\S+)*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const candidate = cleanSkill(stripped);
    if (candidate && !FILLER_WORDS.has(candidate.toLowerCase())) query = candidate;
  }

  // Drop filler words that slipped through
  if (FILLER_WORDS.has((query || '').toLowerCase())) query = '';

  // Strip location clause from query tail
  if (query && location) {
    query = query.replace(new RegExp(`\\s+in\\s+${location}\\s*$`, 'i'), '').trim();
  }

  // ── Fall back to profile only for whatever is still missing ──────────────────
  if (!query)    query    = (userProfile?.role     || '').trim();
  if (!location) location = (userProfile?.location || '').trim();

  return { query: query.trim(), location: location.trim() };
}

// ── POST /api/chat ───────────────────────────────────────────────────────────
// Body: { messages: [{role, content}], userProfile: {...}, text: string }
// Returns: { reply: string, jobs?: [...], jobCount?: number, searchQuery?: string, searchLocation?: string }
app.post('/api/chat', async (req, res) => {
  if (!client) {
    return res.json({ reply: 'AI is not configured — add your ANTHROPIC_API_KEY to server/.env.' });
  }

  const { messages = [], userProfile = {}, text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  // Extract skill + location from conversation
  const { query, location } = extractSearchParams(text, messages, userProfile);
  // Search as soon as we have a skill — location is optional (empty = global)
  const hasEnoughToSearch = !!(query);

  // If we have skill + location, run a real job search in parallel with the AI call
  let jobSearchPromise = Promise.resolve({ jobs: [], count: 0 });
  if (hasEnoughToSearch) {
    console.log(`[chat] Auto-searching: "${query}" in "${location}"`);
    jobSearchPromise = aggregateJobs({ query, location, limit: 100 })
      .then(async rawJobs => {
        if (!rawJobs.length) return { jobs: [], count: 0 };
        const scored = await scoreJobs(rawJobs, { ...userProfile, role: query, location });
        return { jobs: scored, count: scored.length };
      })
      .catch(err => {
        console.error('[chat] Background search failed:', err.message);
        return { jobs: [], count: 0 };
      });
  }

  // Build system prompt — include real job count if available
  const profileContext = userProfile?.role
    ? `User profile: ${userProfile.role}${userProfile.location ? ` | ${userProfile.location}` : ''}${(userProfile.salary_min || userProfile.salaryMin) ? ` | $${Number(userProfile.salary_min || userProfile.salaryMin).toLocaleString()}+` : ''}${userProfile.skills?.length ? ` | Skills: ${userProfile.skills.join(', ')}` : ''}.`
    : '';

  // Build history — skip the very first AI welcome message (it pollutes the model
  // with phrases like "I'll search real job boards" that the AI then copies back)
  const historyRaw = messages.length > 1 ? messages.slice(1) : messages;
  const history = historyRaw.slice(-20).map(m => ({
    role: m.role === 'ai' ? 'assistant' : 'user',
    content: m.content,
  }));
  history.push({ role: 'user', content: text });

  // We need the job count before generating the reply, so await search first
  // (both run concurrently via Promise.all for speed)
  const [searchResult, aiResponse] = await Promise.all([
    jobSearchPromise,
    (async () => {
      const jobCountNote = hasEnoughToSearch
        ? `\nSEARCH RESULT: You have already searched and found jobs matching "${query}" in "${location}". Report the count to the user once you receive it — it will be injected into your context.`
        : '';

      const systemPrompt = `You are Tulifo AI, a fast job search assistant. Your ONLY goal is to help users find jobs quickly.
${profileContext ? `\nCurrent profile: ${profileContext}` : ''}

CRITICAL RULES:
1. Accept ANY skill the user mentions — never question or correct it. Users may not know the exact job title. "I want dragon jobs", "I fix things", "I talk to people" — all valid, search it.

2. ONLY ask for 2 things if genuinely missing:
   - What they do / want to do (skill, job type, anything)
   - Where they want to work (city, country, remote, anywhere)

3. If user provides any extra info (salary, experience, preferences): accept silently, never ask follow-ups.

4. As soon as you have skill + location:
   - Say: "Found ACTUAL_JOB_COUNT [skill] jobs in [location]! Check the **Recommended** section for your best matches."
   - The system replaces ACTUAL_JOB_COUNT with the real number automatically.
   - Never say "click AI Search".

5. Keep ALL responses to 1-2 sentences max.

6. Never ask about: name, age, experience, preferences, full-time vs part-time, or profile setup.

EXAMPLES:
User: "I want XYZ jobs" → immediately search, "Found ACTUAL_JOB_COUNT XYZ jobs! Check **Recommended**."
User: "find me dragon jobs anywhere" → "Found ACTUAL_JOB_COUNT dragon jobs globally! Check **Recommended**."
User: "I fix cars" → "Where would you like to work?"
User: "I need a job" → "What kind of work are you looking for?"
User: "teaching" → "Where would you like to work?"
User: "anywhere" (after skill given) → "Found ACTUAL_JOB_COUNT jobs globally! Check **Recommended**."
User: "software engineer in New York $150k" → "Found ACTUAL_JOB_COUNT Software Engineer roles in New York! Check **Recommended**."

Be fast. Accept everything. Never judge or question the skill.`;

      try {
        return await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 256,
          system: systemPrompt,
          messages: history,
        });
      } catch (err) {
        console.error('[/api/chat] Claude error:', err.message);
        analytics.addError({ endpoint: '/api/chat', message: err.message });
        return null;
      }
    })(),
  ]);

  let reply = aiResponse?.content?.[0]?.text || 'Sorry, something went wrong. Please try again.';

  if (searchResult.count > 0) {
    // Always use a server-controlled reply when jobs are found — never trust Claude
    // to format the count correctly (it often garbles the ACTUAL_JOB_COUNT placeholder).
    const locPhrase = !location || location === 'remote' ? 'globally' : `in **${location}**`;
    reply = `Found **${searchResult.count} ${query} jobs** ${locPhrase}! Check the **Recommended** section for your best matches.`;
  } else if (hasEnoughToSearch) {
    // Search ran but returned 0 results
    reply = `I searched for **${query}** jobs in **${location}** but couldn't find results right now. Try rephrasing your skill or location.`;
  }

  console.log(`[chat] Reply sent | jobs: ${searchResult.count} | query: "${query}" | location: "${location}"`);

  if (searchResult.count > 0) {
    analytics.addSearch({
      query,
      location,
      count: searchResult.count,
      sources: searchResult.jobs
        ? [...new Set(searchResult.jobs.map(j => j.source).filter(Boolean))]
        : [],
      durationMs: 0,
    });
  }

  res.json({
    reply,
    ...(searchResult.count > 0 && {
      jobs: searchResult.jobs,
      jobCount: searchResult.count,
      searchQuery: query,
      searchLocation: location,
    }),
  });
});

// ── POST /api/match-jobs (legacy) ────────────────────────────────────────────
// Body: { jobs: [...], userProfile: {...} }
// Returns: { scores: { [jobId]: number } }
app.post('/api/match-jobs', async (req, res) => {
  const { jobs = [], userProfile = {} } = req.body;
  if (!jobs.length) return res.json({ scores: {} });

  try {
    const scored = await scoreJobs(jobs, userProfile);
    const scores = {};
    scored.forEach(j => { scores[String(j.id)] = j.matchScore; });
    res.json({ scores });
  } catch (err) {
    console.error('[/api/match-jobs] Error:', err.message);
    const scores = {};
    jobs.forEach(j => { scores[String(j.id)] = 70; });
    res.json({ scores });
  }
});

// ── POST /api/feedback ───────────────────────────────────────────────────────
// Body: { type, rating, message, email, page }
// Public — no auth required
app.post('/api/feedback', (req, res) => {
  const { type, rating, message, email, page } = req.body || {};

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  const validTypes = ['bug', 'feature', 'general', 'praise'];
  const safeType = validTypes.includes(type) ? type : 'general';

  const safeRating = Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;

  const entry = addFeedback({
    type:      safeType,
    rating:    safeRating,
    message,
    email,
    page,
    userAgent: req.headers['user-agent'],
  });

  console.log(`[Feedback] New ${safeType} feedback (id: ${entry.id})`);
  res.json({ ok: true, id: entry.id });
});

// ── GET /api/health ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    version: '2.0.0',
    aiEnabled: hasApiKey,
    features: {
      chat: hasApiKey,
      jobSearch: true,
      aiScoring: hasApiKey,
      sources: {
        jsearch: hasJSearch,
        adzuna: hasAdzuna,
        remotive: true,
        remoteok: true,
        weworkremotely: true,
        hn: true,
        usajobs: hasUSAJobs,
      },
    },
  });
});

app.listen(PORT, () => {
  console.log(`\nTulifo AI server v2.0.0 running on http://localhost:${PORT}`);
  console.log(`AI (Claude):  ${hasApiKey ? 'enabled' : 'disabled — set ANTHROPIC_API_KEY'}`);
  console.log(`JSearch:         ${hasJSearch ? '✓ enabled' : '✗ disabled — set JSEARCH_API_KEY'}`);
  console.log(`Adzuna:          ${hasAdzuna ? '✓ enabled' : '✗ disabled — set ADZUNA_APP_ID + ADZUNA_APP_KEY'}`);
  console.log(`Remotive:        ✓ enabled`);
  console.log(`Remote OK:       ✓ enabled`);
  console.log(`We Work Remotely:✓ enabled`);
  console.log(`HN Who's Hiring: ✓ enabled`);
  console.log(`USAJobs:         ${hasUSAJobs ? '✓ enabled' : '✗ disabled — set USAJOBS_API_KEY + USAJOBS_EMAIL'}`);
  console.log(`Greenhouse:      ✓ enabled (${(jobSources.greenhouse.companies || []).length} companies)\n`);
});
