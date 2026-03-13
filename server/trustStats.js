// ── Trust Statistics Store ────────────────────────────────────────────────────
// Records aggregate trust data each time jobs are enriched.

let totalProcessed = 0;
let totalBlocked   = 0;
let scoreSum       = 0;
let scoreCount     = 0;

const levelCounts  = { verified: 0, trusted: 0, caution: 0, low: 0 };
const scamFlagFreq = {}; // flag -> count
const sourceScores = {}; // source -> { sum, count }

function recordBatch(jobs, blockedJobs) {
  totalProcessed += jobs.length + blockedJobs.length;
  totalBlocked   += blockedJobs.length;

  for (const job of jobs) {
    const t = job.trust;
    if (!t) continue;

    scoreSum   += t.trustScore;
    scoreCount += 1;

    if (levelCounts[t.trustLevel] !== undefined) {
      levelCounts[t.trustLevel]++;
    }

    for (const flag of (t.scamFlags || [])) {
      scamFlagFreq[flag] = (scamFlagFreq[flag] || 0) + 1;
    }

    if (job.source) {
      if (!sourceScores[job.source]) sourceScores[job.source] = { sum: 0, count: 0 };
      sourceScores[job.source].sum   += t.trustScore;
      sourceScores[job.source].count += 1;
    }
  }
}

function getTrustStats() {
  const avgScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null;

  const topScamFlags = Object.entries(scamFlagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([flag, count]) => ({ flag, count }));

  const sourceBreakdown = Object.entries(sourceScores)
    .map(([source, { sum, count }]) => ({
      source,
      avgTrust: Math.round(sum / count),
      jobCount: count,
    }))
    .sort((a, b) => b.jobCount - a.jobCount);

  const blockRate = totalProcessed > 0
    ? ((totalBlocked / totalProcessed) * 100).toFixed(1)
    : '0.0';

  return {
    totalProcessed,
    totalBlocked,
    blockRate: `${blockRate}%`,
    avgScore,
    scoreCount,
    levelCounts,
    topScamFlags,
    sourceBreakdown,
  };
}

module.exports = { recordBatch, getTrustStats };
