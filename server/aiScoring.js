require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ── Algorithmic fallback scorer ───────────────────────────────────────────────
// Used when the API is unavailable or quota is exceeded.

function algorithmicScore(job, userProfile) {
  let score = 50;
  const role = (userProfile.role || '').toLowerCase();
  const skills = (userProfile.skills || []).map(s => s.toLowerCase());
  const jobText = `${job.title} ${job.description} ${job.tags?.join(' ')}`.toLowerCase();

  // Role match
  if (role && jobText.includes(role)) score += 20;

  // Skills match
  const matchedSkills = skills.filter(s => jobText.includes(s));
  score += Math.min(matchedSkills.length * 5, 20);

  // Salary match
  const minSalary = Number(userProfile.salary_min || userProfile.salaryMin || 0);
  if (minSalary && job.salaryMin && job.salaryMin >= minSalary) score += 10;

  return Math.min(Math.max(score, 30), 95);
}

function algorithmicScoreAll(jobs, userProfile) {
  return jobs.map(job => ({
    ...job,
    matchScore: algorithmicScore(job, userProfile),
    reasoning: 'Scored algorithmically (AI scoring unavailable)',
    pros: [],
    cons: [],
  }));
}

// ── Claude Haiku AI scorer ────────────────────────────────────────────────────
// Approximate cost: ~$0.001 per job scored

async function scoreJobBatch(jobs, userProfile) {
  const profileDesc = [
    userProfile.role && `Target role: ${userProfile.role}`,
    userProfile.location && `Preferred location: ${userProfile.location}`,
    (userProfile.salary_min || userProfile.salaryMin)
      && `Minimum salary: $${Number(userProfile.salary_min || userProfile.salaryMin).toLocaleString()}`,
    userProfile.skills?.length && `Skills: ${userProfile.skills.join(', ')}`,
  ].filter(Boolean).join('\n');

  const jobsDesc = jobs.map(j =>
    `ID:${j.id} | ${j.title} at ${j.company} | ${j.location} | ${j.salary} | Tags: ${j.tags?.join(', ') || 'none'}`
  ).join('\n');

  const prompt = `You are a job matching assistant. Score how well each job matches the candidate.

CANDIDATE PROFILE:
${profileDesc || 'No profile — use neutral scores around 65.'}

JOBS:
${jobsDesc}

Return ONLY valid JSON mapping each job ID (string) to an object with:
- score (0-100)
- reasoning (1 sentence)
- pros (array of 1-2 strings)
- cons (array of 1-2 strings)

Scoring guide:
90-100: Excellent (role, location, salary, skills all align)
70-89:  Good (most criteria match)
50-69:  Partial (some criteria match)
0-49:   Poor match

Example output:
{"1001": {"score": 85, "reasoning": "Strong React match...", "pros": ["Remote-friendly"], "cons": ["Below target salary"]}}

Return ONLY the JSON object, no explanation.`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.text || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
}

// ── Main scorer — batches of 5 concurrently ───────────────────────────────────

async function scoreJobs(jobs, userProfile = {}) {
  if (!client) {
    console.log('[aiScoring] No API key — using algorithmic fallback');
    return algorithmicScoreAll(jobs, userProfile);
  }

  console.log(`[aiScoring] Scoring ${jobs.length} jobs with Claude Haiku...`);
  const start = Date.now();

  const BATCH_SIZE = 5;
  const batches = [];
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    batches.push(jobs.slice(i, i + BATCH_SIZE));
  }

  // Run all batches concurrently
  const batchResults = await Promise.all(
    batches.map(async (batch, idx) => {
      try {
        console.log(`[aiScoring] Batch ${idx + 1}/${batches.length} (${batch.length} jobs)`);
        return await scoreJobBatch(batch, userProfile);
      } catch (err) {
        console.error(`[aiScoring] Batch ${idx + 1} failed: ${err.message} — using fallback`);
        // Return algorithmic scores for this batch as fallback
        const fallback = {};
        batch.forEach(j => {
          fallback[String(j.id)] = {
            score: algorithmicScore(j, userProfile),
            reasoning: 'Algorithmic score (AI batch failed)',
            pros: [],
            cons: [],
          };
        });
        return fallback;
      }
    })
  );

  // Merge all batch results
  const scoreMap = Object.assign({}, ...batchResults);

  // Apply scores back to jobs
  const scoredJobs = jobs.map(job => {
    const result = scoreMap[String(job.id)];
    return {
      ...job,
      matchScore: result?.score ?? algorithmicScore(job, userProfile),
      reasoning: result?.reasoning ?? 'No reasoning available',
      pros: result?.pros ?? [],
      cons: result?.cons ?? [],
    };
  });

  // Sort highest match first
  scoredJobs.sort((a, b) => b.matchScore - a.matchScore);

  console.log(`[aiScoring] Done in ${Date.now() - start}ms`);
  return scoredJobs;
}

module.exports = { scoreJobs };
