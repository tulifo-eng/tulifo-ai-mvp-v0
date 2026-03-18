const db = require('./supabaseDb');

(async () => {
  try {
    const searchTerms = 'software engineer';
    console.log(`[Test] Searching for: "${searchTerms}"`);
    
    let sql = `
      SELECT title, company, location, ts_rank(
        to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(company,'')),
        plainto_tsquery('english', $1)
      ) AS rank
      FROM jobs
      WHERE is_active = true
        AND to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(company,''))
            @@ plainto_tsquery('english', $1)
      ORDER BY rank DESC LIMIT 5
    `;
    
    const rows = await db.query(sql, [searchTerms]);
    console.log(`[Test] Found ${rows.length} matches:`);
    rows.forEach((r, i) => {
      console.log(`${i+1}. ${r.title} @ ${r.company} (Rank: ${r.rank.toFixed(4)})`);
    });

    // Test ILIKE for location
    const locationPart = 'remote';
    console.log(`\n[Test] Searching for: "${searchTerms}" in "${locationPart}"`);
    let sql2 = `
      SELECT title, company, location
      FROM jobs
      WHERE is_active = true
        AND to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(company,''))
            @@ plainto_tsquery('english', $1)
        AND location ILIKE $2
      ORDER BY posted_at DESC LIMIT 5
    `;
    const rows2 = await db.query(sql2, [searchTerms, `%${locationPart}%`]);
    console.log(`[Test] Found ${rows2.length} matches with location:`);
    rows2.forEach((r, i) => {
      console.log(`${i+1}. ${r.title} @ ${r.company} (${r.location})`);
    });

    process.exit(0);
  } catch (err) {
    console.error('[Test] FAIL:', err.message);
    process.exit(1);
  }
})();
