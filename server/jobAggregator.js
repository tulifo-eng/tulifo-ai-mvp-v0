require('dotenv').config();
const fetch = require('node-fetch');
const jobSources = require('./config/jobSources');
const { enrichWithTrust } = require('./trustScoring');
const supabaseDb = require('./supabaseDb');

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateJobBoardUrls(title, company) {
  const query = encodeURIComponent(`${title} ${company}`);
  return {
    linkedin: `https://www.linkedin.com/jobs/search/?keywords=${query}`,
    indeed: `https://www.indeed.com/jobs?q=${query}`,
    glassdoor: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${query}`,
    google: `https://www.google.com/search?q=${query}+jobs`,
  };
}

let _jobIdCounter = 1000;
function nextId() { return ++_jobIdCounter; }

// Simple RSS/XML field extractor (no external deps)
function extractXmlField(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? (match[1] || match[2] || '').trim() : '';
}

// Decode common HTML entities in plain text
function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'").replace(/&#x2F;/g, '/');
}

// Parse an HTML job description into structured sections.
// Returns { description, responsibilities, requirements, benefits, how_to_apply, company_culture }
function parseHtmlToSections(html) {
  if (!html) return { description: '', responsibilities: [], requirements: [], benefits: [], how_to_apply: '', company_culture: '' };

  const RESP_KEYS  = ['responsibilit', "what you'll do", 'what you will do', 'your role', 'key duties', 'job duties', "you'll be doing", 'day-to-day', 'the role', 'about the role'];
  const REQ_KEYS   = ['requirement', 'qualif', "what we're looking for", 'what we are looking for', 'must have', 'skills required', 'you have', 'you should have', 'you need', 'about you', 'ideal candidate', 'basic qualif', 'minimum qualif', 'preferred qualif'];
  const BEN_KEYS   = ['benefit', 'what we offer', 'what we provide', 'perks', 'we offer', 'why join', 'compensation', 'package', 'rewards'];
  const APPLY_KEYS = ['how to apply', 'application process', 'how to submit', 'to apply'];
  const CULT_KEYS  = ['company culture', 'about us', 'who we are', 'our culture', 'about the company', 'our mission', 'our values'];

  // Mark up headers and list items in a scannable way
  const marked = html
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n__HEADER__$1__END__\n')
    .replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, (m, inner) => {
      const t = inner.replace(/<[^>]+>/g, '').trim();
      // Only treat as section header if short enough and looks like a title
      return (t.length < 100 && (t.endsWith(':') || /^[A-Z\W]/.test(t)))
        ? `\n__HEADER__${inner}__END__\n`
        : m;
    })
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n__ITEM__$1__END__\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n__PARA__$1__END__\n')
    .replace(/<br\s*\/?>/gi, '\n');

  const lines = marked.split('\n');
  const responsibilities = [], requirements = [], benefits = [];
  let how_to_apply = '', company_culture = '';
  let currentSection = null;
  const descParts = [];

  for (const rawLine of lines) {
    const clean = decodeEntities(rawLine.replace(/<[^>]+>/g, '').trim());
    if (!clean) continue;

    if (rawLine.includes('__HEADER__')) {
      const h = clean.toLowerCase();
      if (RESP_KEYS.some(k => h.includes(k)))   currentSection = 'resp';
      else if (REQ_KEYS.some(k => h.includes(k)))   currentSection = 'req';
      else if (BEN_KEYS.some(k => h.includes(k)))   currentSection = 'ben';
      else if (APPLY_KEYS.some(k => h.includes(k))) currentSection = 'apply';
      else if (CULT_KEYS.some(k => h.includes(k)))  currentSection = 'culture';
      else currentSection = null;
    } else if (rawLine.includes('__ITEM__')) {
      if (currentSection === 'resp')   responsibilities.push(clean);
      else if (currentSection === 'req')   requirements.push(clean);
      else if (currentSection === 'ben')   benefits.push(clean);
    } else if (rawLine.includes('__PARA__')) {
      if (currentSection === 'apply')   how_to_apply   += (how_to_apply   ? ' ' : '') + clean;
      else if (currentSection === 'culture') company_culture += (company_culture ? ' ' : '') + clean;
      else descParts.push(clean);
    } else if (clean.length > 20) {
      descParts.push(clean);
    }
  }

  // Full plain-text description as fallback
  const description = decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();

  return {
    description,
    responsibilities: responsibilities.slice(0, 15),
    requirements:     requirements.slice(0, 15),
    benefits:         benefits.slice(0, 10),
    how_to_apply:     how_to_apply.trim(),
    company_culture:  company_culture.trim(),
  };
}

function extractAllXmlItems(xml, tag) {
  const items = [];
  const regex = new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, 'g');
  let m;
  while ((m = regex.exec(xml)) !== null) items.push(m[0]);
  return items;
}

// ── Adzuna ───────────────────────────────────────────────────────────────────

async function fetchAdzuna(query, location) {
  const cfg = jobSources.adzuna;
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey || appId === 'your_app_id_here') {
    console.log('[Adzuna] Skipping — credentials not configured');
    return [];
  }

  const isRemote = /remote/i.test(location || '');
  const what = isRemote
    ? `${query || 'software engineer'} remote`
    : (query || 'software engineer');

  const paramObj = { app_id: appId, app_key: appKey, results_per_page: 50, what, sort_by: 'date' };
  if (location && !isRemote) paramObj.where = location;

  const url = `${cfg.endpoint}/${cfg.country}/search/1?${new URLSearchParams(paramObj)}`;
  console.log(`[Adzuna] Fetching "${what}"...`);
  const start = Date.now();

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Adzuna HTTP ${response.status}`);
  const data = await response.json();

  const jobs = (data.results || []).map(j => ({
    id: nextId(),
    title: j.title,
    company: j.company?.display_name || 'Unknown',
    location: j.location?.display_name || location || 'Remote',
    salary: j.salary_min && j.salary_max
      ? `$${Math.round(j.salary_min / 1000)}k–$${Math.round(j.salary_max / 1000)}k`
      : 'Not listed',
    salaryMin: j.salary_min || 0,
    tags: j.category?.label ? [j.category.label] : [],
    description: j.description?.replace(/<[^>]+>/g, '').trim() || '',
    applyUrl: j.redirect_url,
    jobBoardUrls: generateJobBoardUrls(j.title, j.company?.display_name || ''),
    source: 'Adzuna',
    postedAt: j.created,
    matchScore: 70,
  }));

  console.log(`[Adzuna] Got ${jobs.length} jobs in ${Date.now() - start}ms`);
  return jobs;
}

// ── USAJobs ──────────────────────────────────────────────────────────────────

async function fetchUSAJobs(query, location) {
  const apiKey = process.env.USAJOBS_API_KEY;
  const email = process.env.USAJOBS_EMAIL;
  if (!apiKey || !email) {
    console.log('[USAJobs] Skipping — set USAJOBS_API_KEY and USAJOBS_EMAIL in .env');
    return [];
  }

  const params = new URLSearchParams({ Keyword: query || 'software engineer', LocationName: location || '', ResultsPerPage: 50 });
  console.log(`[USAJobs] Fetching "${query}"...`);
  const start = Date.now();

  const response = await fetch(`${jobSources.usajobs.endpoint}?${params}`, {
    headers: { 'Host': 'data.usajobs.gov', 'User-Agent': email, 'Authorization-Key': apiKey },
  });
  if (!response.ok) throw new Error(`USAJobs HTTP ${response.status}`);
  const data = await response.json();

  const jobs = (data.SearchResult?.SearchResultItems || []).map(item => {
    const d = item.MatchedObjectDescriptor;
    const details = d.UserArea?.Details || {};
    const sal = (d.PositionRemuneration || [])[0];
    const salMin = sal ? Math.round(Number(sal.MinimumRange)) : 0;
    const salMax = sal ? Math.round(Number(sal.MaximumRange)) : 0;

    // Build structured sections from USAJobs API fields
    const responsibilities = details.MajorDuties
      ? details.MajorDuties.split(/\n|•/).map(s => s.trim()).filter(s => s.length > 10)
      : [];
    const requirements = [
      ...(details.Requirements ? details.Requirements.split(/\n/).map(s => s.trim()).filter(s => s.length > 10) : []),
      ...(details.Conditions   ? details.Conditions.split(/\n/).map(s => s.trim()).filter(s => s.length > 10)   : []),
    ].slice(0, 15);
    const benefits = details.Benefits
      ? details.Benefits.split(/\n|•/).map(s => s.trim()).filter(s => s.length > 10).slice(0, 10)
      : [];

    return {
      id: nextId(),
      title: d.PositionTitle,
      company: d.OrganizationName,
      location: d.PositionLocationDisplay || 'USA',
      salary: salMin && salMax ? `$${Math.round(salMin/1000)}k–$${Math.round(salMax/1000)}k` : 'Gov. pay scale',
      salaryMin: salMin,
      tags: ['Government'],
      description: (details.JobSummary || '').trim(),
      responsibilities,
      requirements,
      benefits,
      how_to_apply: (details.HowToApply || '').trim(),
      company_culture: (details.MissionStatement || '').trim(),
      applyUrl: d.PositionURI,
      jobBoardUrls: generateJobBoardUrls(d.PositionTitle, d.OrganizationName),
      source: 'USAJobs',
      postedAt: d.PublicationStartDate,
      matchScore: 70,
    };
  });

  console.log(`[USAJobs] Got ${jobs.length} jobs in ${Date.now() - start}ms`);
  return jobs;
}

// ── Remotive ─────────────────────────────────────────────────────────────────

const REMOTIVE_CATEGORY_MAP = {
  frontend: 'software-dev', backend: 'software-dev', fullstack: 'software-dev',
  engineer: 'software-dev', developer: 'software-dev', software: 'software-dev',
  devops: 'devops-sysadmin', sysadmin: 'devops-sysadmin',
  data: 'data', analyst: 'data', scientist: 'data',
  design: 'design', ux: 'design', ui: 'design',
  product: 'product', manager: 'product',
  marketing: 'marketing', sales: 'sales',
  support: 'customer-support', qa: 'qa', test: 'qa',
  writing: 'writing', content: 'writing',
  finance: 'finance-legal', legal: 'finance-legal',
  default: 'software-dev',
};

function queryToRemotiveCategory(query) {
  const q = (query || '').toLowerCase();
  for (const [keyword, category] of Object.entries(REMOTIVE_CATEGORY_MAP)) {
    if (keyword !== 'default' && q.includes(keyword)) return category;
  }
  return REMOTIVE_CATEGORY_MAP.default;
}

async function fetchRemotive(query) {
  const category = queryToRemotiveCategory(query);
  console.log(`[Remotive] Fetching category "${category}" (query: "${query}")...`);
  const start = Date.now();

  const response = await fetch(`${jobSources.remotive.endpoint}?category=${encodeURIComponent(category)}`);
  if (!response.ok) throw new Error(`Remotive HTTP ${response.status}`);
  const data = await response.json();

  const queryWords = (query || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const allJobs = data.jobs || [];
  const filtered = queryWords.length
    ? allJobs.filter(j => queryWords.some(w => `${j.title} ${(j.tags||[]).join(' ')}`.toLowerCase().includes(w)))
    : allJobs;
  const source = filtered.length >= 3 ? filtered : allJobs;

  const jobs = source.slice(0, 50).map(j => {
    const parsed = parseHtmlToSections(j.description || '');
    return {
      id: nextId(),
      title: j.title,
      company: j.company_name,
      location: 'Remote',
      salary: j.salary || 'Not listed',
      salaryMin: 0,
      tags: [j.category, ...(j.tags || [])].filter(Boolean).slice(0, 5),
      ...parsed,
      applyUrl: j.url,
      jobBoardUrls: generateJobBoardUrls(j.title, j.company_name),
      source: 'Remotive',
      postedAt: j.publication_date,
      matchScore: 70,
    };
  });

  console.log(`[Remotive] Got ${jobs.length} jobs in ${Date.now() - start}ms`);
  return jobs;
}

// ── Remote OK ─────────────────────────────────────────────────────────────────

async function fetchRemoteOK(query) {
  console.log(`[RemoteOK] Fetching remote jobs (query: "${query}")...`);
  const start = Date.now();

  const response = await fetch(jobSources.remoteok.endpoint, {
    headers: { 'User-Agent': 'tulifo-ai/2.0 (job aggregator)', Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`RemoteOK HTTP ${response.status}`);
  const data = await response.json();

  // First item is a metadata object, skip it
  const listings = data.filter(j => j.id && j.position);

  // Client-side keyword filter
  const queryWords = (query || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const filtered = queryWords.length
    ? listings.filter(j => queryWords.some(w => `${j.position} ${(j.tags||[]).join(' ')} ${j.company||''}`.toLowerCase().includes(w)))
    : listings;
  const source = filtered.length >= 3 ? filtered : listings.slice(0, 30);

  const jobs = source.slice(0, 50).map(j => {
    const parsed = parseHtmlToSections(j.description || '');
    return {
      id: nextId(),
      title: j.position,
      company: j.company || 'Unknown',
      location: 'Remote',
      salary: j.salary || 'Not listed',
      salaryMin: 0,
      tags: (j.tags || []).slice(0, 5),
      ...parsed,
      applyUrl: j.apply_url || j.url,
      jobBoardUrls: generateJobBoardUrls(j.position, j.company || ''),
      source: 'Remote OK',
      postedAt: j.date,
      matchScore: 70,
    };
  });

  console.log(`[RemoteOK] Got ${jobs.length} jobs in ${Date.now() - start}ms`);
  return jobs;
}

// ── We Work Remotely (RSS) ────────────────────────────────────────────────────

async function fetchWeWorkRemotely(query) {
  console.log(`[WeWorkRemotely] Fetching RSS (query: "${query}")...`);
  const start = Date.now();

  const response = await fetch(jobSources.weworkremotely.endpoint, {
    headers: { 'User-Agent': 'tulifo-ai/2.0' },
  });
  if (!response.ok) throw new Error(`WeWorkRemotely HTTP ${response.status}`);
  const xml = await response.text();

  const items = extractAllXmlItems(xml, 'item');
  const queryWords = (query || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);

  const allJobs = items.map(item => {
    const title = extractXmlField(item, 'title').replace(/^[^:]+:\s*/, ''); // strip "Category: " prefix
    const company = extractXmlField(item, 'dc:company') || extractXmlField(item, 'company') || 'Unknown';
    const link = extractXmlField(item, 'link') || extractXmlField(item, 'guid');
    const pubDate = extractXmlField(item, 'pubDate');
    const region = extractXmlField(item, 'region') || 'Remote';
    const rawDesc = extractXmlField(item, 'description');
    const parsed = parseHtmlToSections(rawDesc);

    return {
      id: nextId(),
      title,
      company,
      location: region === 'Anywhere' ? 'Remote (Worldwide)' : region || 'Remote',
      salary: 'Not listed',
      salaryMin: 0,
      tags: ['Remote'],
      ...parsed,
      applyUrl: link,
      jobBoardUrls: generateJobBoardUrls(title, company),
      source: 'We Work Remotely',
      postedAt: pubDate ? new Date(pubDate).toISOString() : null,
      matchScore: 70,
    };
  }).filter(j => j.title);

  const filtered = queryWords.length
    ? allJobs.filter(j => queryWords.some(w => `${j.title} ${j.description}`.toLowerCase().includes(w)))
    : allJobs;
  const source = filtered.length >= 3 ? filtered : allJobs.slice(0, 30);

  console.log(`[WeWorkRemotely] Got ${source.length} jobs in ${Date.now() - start}ms`);
  return source;
}

// ── HN Who's Hiring ───────────────────────────────────────────────────────────

async function fetchHNJobs(query) {
  console.log(`[HN] Fetching Who's Hiring jobs (query: "${query}")...`);
  const start = Date.now();

  // Get the list of job story IDs (these are HN job posts, not the Who's Hiring thread)
  const response = await fetch(`${jobSources.hn.endpoint}/jobstories.json`);
  if (!response.ok) throw new Error(`HN API HTTP ${response.status}`);
  const ids = await response.json();

  // Fetch top 30 job stories in parallel
  const topIds = ids.slice(0, 30);
  const items = await Promise.all(
    topIds.map(id =>
      fetch(`${jobSources.hn.endpoint}/item/${id}.json`)
        .then(r => r.json())
        .catch(() => null)
    )
  );

  const queryWords = (query || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);

  const allJobs = items
    .filter(item => item && item.title)
    .map(item => {
      // HN job titles are freeform: "Company Name | Role | Location | Salary"
      const titleParts = (item.title || '').split('|').map(s => s.trim());
      const company = titleParts[0] || 'Unknown';
      const role = titleParts[1] || item.title || 'Software Engineer';
      const location = titleParts[2] || 'Remote';

      // Parse the HTML post body for structured sections
      const parsed = parseHtmlToSections(item.text || '');

      return {
        id: nextId(),
        title: role,
        company,
        location,
        salary: titleParts[3] || 'Not listed',
        salaryMin: 0,
        tags: ['HN', 'Startup'],
        ...parsed,
        applyUrl: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
        jobBoardUrls: generateJobBoardUrls(role, company),
        source: "HN Who's Hiring",
        postedAt: item.time ? new Date(item.time * 1000).toISOString() : null,
        matchScore: 70,
      };
    });

  const filtered = queryWords.length
    ? allJobs.filter(j => queryWords.some(w => `${j.title} ${j.company} ${j.description}`.toLowerCase().includes(w)))
    : allJobs;
  const source = filtered.length >= 2 ? filtered : allJobs;

  console.log(`[HN] Got ${source.length} jobs in ${Date.now() - start}ms`);
  return source;
}

// ── JSearch (OpenWebNinja) ────────────────────────────────────────────────────

async function fetchJSearch(query, location) {
  const apiKey = process.env.JSEARCH_API_KEY;
  if (!apiKey) {
    console.log('[JSearch] Skipping — JSEARCH_API_KEY not configured');
    return [];
  }

  // Build a natural-language query string the way JSearch expects it
  const q = [query || 'software engineer', location || ''].filter(Boolean).join(' in ');

  const params = new URLSearchParams({
    query:      q,
    page:       '1',
    num_pages:  '1',
  });

  const url = `${jobSources.jsearch.endpoint}?${params}`;
  console.log(`[JSearch] Fetching "${q}"...`);
  const start = Date.now();

  const response = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
      'Accept':    'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`JSearch HTTP ${response.status}: ${body.slice(0, 120)}`);
  }

  const data = await response.json();
  const listings = Array.isArray(data.data) ? data.data : [];

  const jobs = listings.map(j => {
    // Build location string
    const loc = [j.job_city, j.job_state, j.job_country]
      .filter(Boolean).join(', ') || (j.job_is_remote ? 'Remote' : 'Location Not Specified');

    // Salary
    let salary = 'Not listed';
    if (j.job_min_salary && j.job_max_salary) {
      const period = (j.job_salary_period || '').toLowerCase();
      const fmt = n => period === 'hour'
        ? `$${Number(n).toFixed(0)}/hr`
        : `$${Math.round(n / 1000)}k`;
      salary = `${fmt(j.job_min_salary)}–${fmt(j.job_max_salary)}`;
    } else if (j.job_min_salary) {
      salary = `$${Math.round(j.job_min_salary / 1000)}k+`;
    }

    // Skills / tags from highlights
    const skills = (j.job_required_skills || []).slice(0, 5);
    const quals  = (j.job_highlights?.Qualifications || [])
      .slice(0, 3)
      .map(q => q.replace(/^[^a-zA-Z]+/, '').split(/[\s,]/)[0])
      .filter(Boolean);
    const tags = [...new Set([...skills, ...quals])].slice(0, 5);

    // Full description (no truncation)
    const desc = (j.job_description || '').replace(/\s+/g, ' ').trim();

    // Structured highlights from JSearch
    const responsibilities = (j.job_highlights?.Responsibilities || []);
    const requirements     = (j.job_highlights?.Qualifications   || []);
    const benefits         = (j.job_highlights?.Benefits         || []);

    return {
      id:          nextId(),
      title:       j.job_title       || 'Untitled',
      company:     j.employer_name   || 'Unknown',
      location:    j.job_is_remote ? 'Remote' : loc,
      salary,
      salaryMin:   j.job_min_salary  || 0,
      tags,
      description: desc,
      responsibilities,
      requirements,
      benefits,
      applyUrl:    j.job_apply_link  || j.job_google_link || '#',
      jobBoardUrls:generateJobBoardUrls(j.job_title, j.employer_name || ''),
      source:      'JSearch',
      postedAt:    j.job_posted_at_datetime_utc || null,
      matchScore:  70,
      employmentType: j.job_employment_type || null,
    };
  });

  console.log(`[JSearch] Got ${jobs.length} jobs in ${Date.now() - start}ms`);
  return jobs;
}

// ── Greenhouse (multi-company) ────────────────────────────────────────────────

async function fetchGreenhouse(query) {
  const cfg = jobSources.greenhouse;
  const companies = cfg.companies || [];
  if (!companies.length) return [];

  console.log(`[Greenhouse] Fetching from ${companies.length} companies (query: "${query}")...`);
  const start = Date.now();

  const queryWords = (query || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);

  // Fan out to all companies in parallel; ignore individual failures
  const results = await Promise.allSettled(
    companies.map(({ token, name }) =>
      fetch(`${cfg.endpoint}/${token}/jobs?content=true`, {
        headers: { 'User-Agent': 'tulifo-ai/2.0 (job aggregator)' },
      })
        .then(r => r.ok ? r.json() : { jobs: [] })
        .then(data => (data.jobs || []).map(j => ({ ...j, _company: name, _token: token })))
        .catch(() => [])
    )
  );

  const allJobs = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  // Client-side keyword filter
  const filtered = queryWords.length
    ? allJobs.filter(j => queryWords.some(w =>
        `${j.title} ${(j.departments || []).map(d => d.name).join(' ')} ${j._company}`.toLowerCase().includes(w)
      ))
    : allJobs;

  const source = filtered.length >= 5 ? filtered : allJobs.slice(0, 60);

  const jobs = source.slice(0, 80).map(j => {
    const parsed = parseHtmlToSections(j.content || '');
    const location = j.offices?.map(o => o.name).join(', ') || j.location?.name || 'Remote';
    const departments = (j.departments || []).map(d => d.name).filter(Boolean);

    return {
      id:          nextId(),
      title:       j.title || 'Untitled',
      company:     j._company,
      location,
      salary:      'Not listed',
      salaryMin:   0,
      tags:        departments.slice(0, 4),
      ...parsed,
      applyUrl:    j.absolute_url || '#',
      jobBoardUrls: generateJobBoardUrls(j.title, j._company),
      source:      'Greenhouse',
      postedAt:    j.updated_at || null,
      matchScore:  70,
    };
  });

  console.log(`[Greenhouse] Got ${jobs.length} jobs from ${companies.length} companies in ${Date.now() - start}ms`);
  return jobs;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function deduplicateJobs(jobs) {
  const seen = new Set();
  return jobs.filter(job => {
    const key = `${(job.title || '').toLowerCase().trim()}|${(job.company || '').toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Supabase DB (direct PostgreSQL with full-text search) ────────────────────

async function fetchSupabaseJobs(query, location) {
  if (!supabaseDb.isAvailable()) {
    console.log('[SupabaseDB] Skipping — SUPABASE_DB_URL not configured');
    return [];
  }

  console.log(`[SupabaseDB] Searching "${query}" in "${location}"...`);
  const start = Date.now();

  try {
    let rows;
    const searchTerms = (query || '').trim();
    const locationTerm = (location || '').trim();

    if (searchTerms.length >= 3) {
      // Full-text search on title + description + company
      // plainto_tsquery handles natural language input safely
      let sql = `
        SELECT *, ts_rank(
          to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(company,'')),
          plainto_tsquery('english', $1)
        ) AS rank
        FROM jobs
        WHERE is_active = true
          AND to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(company,''))
              @@ plainto_tsquery('english', $1)
      `;
      const params = [searchTerms];

      if (locationTerm) {
        sql += ` AND location ILIKE $2`;
        params.push(`%${locationTerm}%`);
      }

      sql += ` ORDER BY rank DESC LIMIT 50`;
      rows = await supabaseDb.query(sql, params);
    } else {
      // Short or empty query — fetch recent active jobs with optional location filter
      let sql = `SELECT * FROM jobs WHERE is_active = true`;
      const params = [];

      if (locationTerm) {
        sql += ` AND location ILIKE $1`;
        params.push(`%${locationTerm}%`);
      }

      sql += ` ORDER BY posted_at DESC LIMIT 50`;
      rows = await supabaseDb.query(sql, params);
    }

    const jobs = rows.map(row => {
      const salaryDisplay = row.salary_range_display || row.salary || 'Not listed';
      return {
        id: nextId(),
        title: row.title || '',
        company: row.company || 'Unknown',
        location: row.location || 'Not specified',
        salary: salaryDisplay,
        salaryMin: row.salary_min || 0,
        salaryMax: row.salary_max || 0,
        tags: row.keywords || [],
        description: row.description || '',
        sections: {
          responsibilities: row.responsibilities
            ? row.responsibilities.split(/\n/).filter(s => s.trim().length > 5)
            : [],
          requirements: row.min_qualifications
            ? row.min_qualifications.split(/\n/).filter(s => s.trim().length > 5)
            : [],
          benefits: row.compensation_details
            ? row.compensation_details.split(/\n/).filter(s => s.trim().length > 5)
            : [],
        },
        applyUrl: row.apply_url || row.source_url || '',
        jobBoardUrls: generateJobBoardUrls(row.title || '', row.company || ''),
        source: 'Tulifo DB',
        sourceDetail: row.platform ? row.platform.charAt(0).toUpperCase() + row.platform.slice(1) : '',
        postedAt: row.posted_at || new Date().toISOString(),
        matchScore: 85,  // Higher default — these are direct company career page jobs
      };
    });

    console.log(`[SupabaseDB] Got ${jobs.length} jobs in ${Date.now() - start}ms`);
    return jobs;
  } catch (err) {
    console.error(`[SupabaseDB] Query failed: ${err.message}`);
    return [];
  }
}

// ── Main aggregator ───────────────────────────────────────────────────────────

async function aggregateJobs({ query = '', location = '', limit = 100 } = {}) {
  const totalStart = Date.now();
  console.log(`\n[Aggregator] Starting search: "${query}" in "${location}"`);

  const fetchers = [];

  // Supabase DB — highest priority source (direct company career pages)
  if (jobSources.supabasedb?.enabled) {
    fetchers.push(fetchSupabaseJobs(query, location).catch(err => { console.error(`[SupabaseDB] Failed: ${err.message}`); return []; }));
  }

  if (jobSources.jsearch.enabled) {
    fetchers.push(fetchJSearch(query, location).catch(err => { console.error(`[JSearch] Failed: ${err.message}`); return []; }));
  }

  if (jobSources.adzuna.enabled) {
    fetchers.push(fetchAdzuna(query, location).catch(err => { console.error(`[Adzuna] Failed: ${err.message}`); return []; }));
  }

  const hasUSAJobsCreds = !!(process.env.USAJOBS_API_KEY && process.env.USAJOBS_EMAIL);
  if (jobSources.usajobs.enabled || hasUSAJobsCreds) {
    fetchers.push(fetchUSAJobs(query, location).catch(err => { console.error(`[USAJobs] Failed: ${err.message}`); return []; }));
  }

  if (jobSources.remotive.enabled) {
    fetchers.push(fetchRemotive(query).catch(err => { console.error(`[Remotive] Failed: ${err.message}`); return []; }));
  }

  if (jobSources.remoteok.enabled) {
    fetchers.push(fetchRemoteOK(query).catch(err => { console.error(`[RemoteOK] Failed: ${err.message}`); return []; }));
  }

  if (jobSources.weworkremotely.enabled) {
    fetchers.push(fetchWeWorkRemotely(query).catch(err => { console.error(`[WeWorkRemotely] Failed: ${err.message}`); return []; }));
  }

  if (jobSources.hn.enabled) {
    fetchers.push(fetchHNJobs(query).catch(err => { console.error(`[HN] Failed: ${err.message}`); return []; }));
  }

  if (jobSources.greenhouse.enabled) {
    fetchers.push(fetchGreenhouse(query).catch(err => { console.error(`[Greenhouse] Failed: ${err.message}`); return []; }));
  }

  // Run all sources in parallel
  const results = await Promise.all(fetchers);
  const allJobs = results.flat();

  console.log(`[Aggregator] Raw total: ${allJobs.length} jobs from ${results.length} sources`);

  const unique = deduplicateJobs(allJobs);
  console.log(`[Aggregator] After dedup: ${unique.length} jobs`);

  // Apply trust scoring + drop obvious scams
  const trusted = enrichWithTrust(unique);
  console.log(`[Aggregator] After trust filter: ${trusted.length} jobs`);

  const sorted = trusted
    .sort((a, b) => {
      // 1. Highest priority: Tulifo DB jobs (vetted scraper data)
      if (a.source === 'Tulifo DB' && b.source !== 'Tulifo DB') return -1;
      if (b.source === 'Tulifo DB' && a.source !== 'Tulifo DB') return 1;

      // 2. Secondarily sort by date (newest first)
      return new Date(b.postedAt || 0) - new Date(a.postedAt || 0);
    })
    .slice(0, limit);

  console.log(`[Aggregator] Done — ${sorted.length} jobs in ${Date.now() - totalStart}ms\n`);
  return sorted;
}

module.exports = { aggregateJobs };
