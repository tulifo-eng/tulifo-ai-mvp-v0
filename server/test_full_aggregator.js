const { aggregateJobs } = require('./jobAggregator');
require('dotenv').config();

(async () => {
  try {
    const query = 'software engineer';
    const location = 'remote';
    
    console.log(`[Full Test] Running aggregated search for "${query}" in "${location}"...`);
    const start = Date.now();
    
    // We only enable Tulifo DB to isolate it in the final output
    // but the aggregator will try all enabled sources.
    const results = await aggregateJobs({ query, location, limit: 10 });
    
    console.log(`\n[Full Test] Results summary (${Date.now() - start}ms):`);
    console.log('Total returned:', results.length);
    
    results.forEach((j, i) => {
      console.log(`${i+1}. [${j.source}] ${j.title} @ ${j.company} (${j.location})`);
      console.log(`   - Match Score: ${j.matchScore}, Trust Score: ${j.trust?.trustScore}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('[Full Test] FAIL:', err.message);
    process.exit(1);
  }
})();
