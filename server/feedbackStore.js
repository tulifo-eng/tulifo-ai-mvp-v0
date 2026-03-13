// ── Feedback Store ─────────────────────────────────────────────────────────────
// In-memory store backed by Supabase for permanent persistence.

const supabase = require('./supabaseAdmin');

const feedbackItems = [];
const MAX_ITEMS = 1000;

function addFeedback({ type, rating, message, email, page, userAgent }) {
  const entry = {
    id:        `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type:      type    || 'general',
    rating:    rating  || null,
    message:   (message || '').trim().slice(0, 2000),
    email:     (email   || '').trim().slice(0, 200) || null,
    page:      page    || null,
    userAgent: userAgent || null,
    ts:        new Date().toISOString(),
  };
  feedbackItems.unshift(entry);
  if (feedbackItems.length > MAX_ITEMS) feedbackItems.length = MAX_ITEMS;

  if (supabase) {
    supabase.from('feedback').insert({
      id:         entry.id,
      type:       entry.type,
      rating:     entry.rating,
      message:    entry.message,
      email:      entry.email,
      page:       entry.page,
      user_agent: entry.userAgent,
      ts:         entry.ts,
    }).then(({ error }) => { if (error) console.error('[Feedback] Supabase write error:', error.message); });
  }

  return entry;
}

function getAllFeedback(limit = 200) { return feedbackItems.slice(0, limit); }

function getFeedbackStats() {
  const total = feedbackItems.length;
  if (total === 0) return { total: 0, byType: {}, avgRating: null, ratedCount: 0 };

  const byType = {};
  let ratingSum = 0, ratedCount = 0;
  for (const f of feedbackItems) {
    byType[f.type] = (byType[f.type] || 0) + 1;
    if (f.rating) { ratingSum += f.rating; ratedCount++; }
  }

  return { total, byType, avgRating: ratedCount > 0 ? (ratingSum / ratedCount).toFixed(1) : null, ratedCount };
}

// ── Startup: load from Supabase ───────────────────────────────────────────────

if (supabase) {
  (async () => {
    try {
      const { data, error } = await supabase.from('feedback').select('*').order('ts', { ascending: false }).limit(1000);
      if (error) throw error;
      if (data?.length) {
        feedbackItems.push(...data.map(r => ({
          id:        r.id,
          type:      r.type,
          rating:    r.rating,
          message:   r.message,
          email:     r.email,
          page:      r.page,
          userAgent: r.user_agent,
          ts:        r.ts,
        })));
        console.log(`[Feedback] Loaded ${data.length} items from Supabase`);
      }
    } catch (err) {
      console.error('[Feedback] Supabase startup load failed:', err.message);
    }
  })();
}

module.exports = { addFeedback, getAllFeedback, getFeedbackStats };
