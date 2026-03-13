# Tulifo AI — Developer & DevOps Guide

> Complete handover documentation for developers and DevOps engineers.
> Project location: `tulifo_dev/tulifo-ai/`

---

## Table of Contents

1. [What is Tulifo AI?](#1-what-is-tulifo-ai)
2. [Architecture Overview](#2-architecture-overview)
3. [Folder Structure](#3-folder-structure)
4. [How to Run Locally](#4-how-to-run-locally)
5. [Environment Variables](#5-environment-variables)
6. [Ports & Services](#6-ports--services)
7. [Frontend (React)](#7-frontend-react)
8. [Backend (Node.js / Express)](#8-backend-nodejs--express)
9. [API Endpoints Reference](#9-api-endpoints-reference)
10. [Job Sources](#10-job-sources)
11. [AI & Trust Scoring System](#11-ai--trust-scoring-system)
12. [Admin Console](#12-admin-console)
13. [Database (Supabase)](#13-database-supabase)
14. [Deployment](#14-deployment)
15. [Adding a New Job Source](#15-adding-a-new-job-source)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. What is Tulifo AI?

Tulifo AI is an intelligent job search platform. Users describe what job they want in plain English via a chat interface, and the system:

1. Searches **7 live job boards simultaneously** (JSearch, Adzuna, Remotive, Remote OK, We Work Remotely, HN Who's Hiring, USAJobs)
2. **Deduplicates and scores** every result for scam risk and legitimacy (Trust Score)
3. Uses **Claude AI (Anthropic)** to match jobs against the user's profile and explain why each job is a good fit
4. Presents results as rich job cards with expandable details, save/discard actions, and direct apply links

The platform has two operational modes:
- **Guest mode** — anyone can search without signing in
- **Authenticated mode** — Supabase auth (Google OAuth or email), saves chat history and profile

---

## 2. Architecture Overview

```
Browser (localhost:3000)
        │
        │  React SPA (Create React App)
        │
        ├──► /api/*  ──► React Dev Proxy ──► localhost:5050  (Main API Server)
        │                                         │
        │                                         ├── POST /api/chat
        │                                         │     └── Claude Sonnet 4.6 (Anthropic)
        │                                         │     └── jobAggregator (7 sources)
        │                                         │     └── trustScoring
        │                                         │     └── aiScoring (Claude Haiku)
        │                                         │
        │                                         ├── POST /api/search-jobs
        │                                         └── POST /api/feedback
        │
        └──► /#admin ──────────────────────────► localhost:5051  (Admin API Server)
                                                      │
                                                      └── /api/admin/*
                                                           ├── Analytics
                                                           ├── Source toggles
                                                           ├── User sessions
                                                           ├── API key manager
                                                           └── Trust stats

                                Supabase (PostgreSQL)
                                      │
                              ├── User auth
                              ├── chat_messages
                              ├── profiles
                              ├── admin_search_events
                              └── admin_error_events
```

**Data flow for a job search:**
```
User types "React developer in New York"
    → /api/chat (Express)
    → Extract skill: "React developer", location: "New York"
    → jobAggregator: fetch from 7 sources in parallel
    → deduplicateJobs (title+company key)
    → enrichWithTrust (6-factor trust score per job)
    → scoreJobs (Claude Haiku: match %, reasoning, pros/cons)
    → Return sorted jobs to React frontend
    → normalizeJob() maps backend fields to JobCard props
    → JobCard renders with trust header, metrics, expandable details
```

---

## 3. Folder Structure

```
tulifo-ai/
│
├── src/                          # React frontend source
│   ├── App.js                    # Root component, all app state & views
│   ├── App.css                   # Global styles, shared classes
│   ├── AdminPanel.js             # Full admin dashboard UI
│   ├── index.js                  # React DOM entry point
│   ├── index.css                 # Base CSS reset
│   ├── supabase.js               # Supabase client initialization
│   ├── tracker.js                # Client-side event tracking
│   └── components/
│       ├── JobCard.jsx           # Job listing card (main UI component)
│       └── JobCard.css           # Job card styles
│
├── server/                       # Node.js backend
│   ├── index.js                  # Express app entry point (ports 5050 + 5051)
│   ├── jobAggregator.js          # Fetches & parses jobs from all sources
│   ├── aiScoring.js              # Claude Haiku job matching scorer
│   ├── trustScoring.js           # Scam detection + trust score engine
│   ├── trustStats.js             # Trust score metrics tracker
│   ├── analytics.js              # In-memory analytics (synced to Supabase)
│   ├── adminRoutes.js            # Admin API route handlers
│   ├── trackingRoutes.js         # User behavior tracking endpoints
│   ├── trackingStore.js          # In-memory session/event store
│   ├── feedbackStore.js          # User feedback (bug/praise/feature)
│   ├── apiKeyStore.js            # API key CRUD (reads/writes data/apiKeys.json)
│   ├── perfMiddleware.js         # Request timing middleware
│   ├── perfStore.js              # Performance metrics store
│   ├── supabaseAdmin.js          # Supabase service-role client
│   ├── config/
│   │   └── jobSources.js         # Master config for all 45+ job sources
│   ├── data/
│   │   └── apiKeys.json          # Persisted API keys (gitignored)
│   ├── .env                      # Server environment variables (gitignored)
│   ├── .env.example              # Template for required variables
│   └── package.json
│
├── public/                       # Static assets (favicon, index.html)
├── build/                        # Production build output (npm run build)
├── .env                          # Frontend environment variables (gitignored)
├── package.json                  # Frontend dependencies + proxy config
├── DEVELOPER_GUIDE.md            # ← This file
└── .gitignore
```

---

## 4. How to Run Locally

### Prerequisites

- Node.js v18+ and npm
- API keys (see Section 5 — at minimum `ANTHROPIC_API_KEY` and one job source key)

### Step 1 — Install dependencies

```bash
# Frontend dependencies
cd tulifo-ai
npm install

# Backend dependencies
cd server
npm install
```

### Step 2 — Configure environment variables

```bash
# Copy the server template
cp server/.env.example server/.env
# Fill in your API keys in server/.env

# Create frontend env file
cp .env.example .env   # or create manually (see Section 5)
```

### Step 3 — Start the backend server

```bash
cd server
npm start          # production mode
# OR
npm run dev        # development mode with auto-reload (nodemon)
```

You should see:
```
Admin console API running on http://localhost:5051
Tulifo AI server v2.0.0 running on http://localhost:5050
AI (Claude):   enabled
JSearch:       ✓ enabled
Adzuna:        ✓ enabled
Remotive:      ✓ enabled
...
```

### Step 4 — Start the frontend

```bash
# In a separate terminal, from the tulifo-ai/ root
npm start
```

Opens `http://localhost:3000` in your browser automatically.

### Step 5 — Access the admin console

Navigate to: `http://localhost:3000/#admin`
- Username: `admin`
- Password: `admin`

> ⚠️ Change these credentials before any production deployment. Edit `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `server/adminRoutes.js` lines 11–12.

---

## 5. Environment Variables

### Backend — `server/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Main API port (default: `5050`) |
| `ADMIN_PORT` | No | Admin API port (default: `5051`) |
| `ANTHROPIC_API_KEY` | Yes* | Claude AI key from console.anthropic.com. Without this, chat still works but jobs won't be AI-scored |
| `JSEARCH_API_KEY` | Recommended | OpenWebNinja key — aggregates LinkedIn/Indeed/Glassdoor |
| `ADZUNA_APP_ID` | Recommended | Adzuna API credentials |
| `ADZUNA_APP_KEY` | Recommended | Adzuna API credentials |
| `USAJOBS_API_KEY` | Optional | USA government jobs |
| `USAJOBS_EMAIL` | Optional | Required alongside USAJOBS_API_KEY |
| `SUPABASE_URL` | Optional | Supabase project URL (analytics persistence) |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Supabase service role key (admin writes) |

### Frontend — `.env` (in tulifo-ai root)

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_API_URL` | Yes | Main backend URL e.g. `http://localhost:5050` |
| `REACT_APP_ADMIN_URL` | Yes | Admin backend URL e.g. `http://localhost:5051` |
| `REACT_APP_SUPABASE_URL` | Optional | Supabase project URL (user auth) |
| `REACT_APP_SUPABASE_ANON_KEY` | Optional | Supabase anon/public key |

> Without Supabase vars, the app runs in **guest-only mode** with no authentication.

---

## 6. Ports & Services

| Service | Port | Start Command |
|---------|------|---------------|
| React frontend (dev) | `3000` | `npm start` (in tulifo-ai/) |
| Main API server | `5050` | `npm start` (in server/) |
| Admin console API | `5051` | Started automatically alongside main server |

The React dev server proxies all `/api/*` requests to `http://localhost:5050` (configured in root `package.json` → `"proxy"` field).

The admin panel (`AdminPanel.js`) makes direct HTTP calls to `http://localhost:5051` (via `REACT_APP_ADMIN_URL`).

---

## 7. Frontend (React)

### Key Files

**`src/App.js`** — The entire frontend application lives here. Contains:
- `App()` — Root component managing which view is shown (`landing`, `auth`, `dashboard`, `admin`)
- `Dashboard()` — Main job search interface with chat panel + job list
- `LandingPage()` — Marketing landing page
- `AuthPage()` — Sign in / sign up
- `ProfileSetup()` — First-time user job preference setup
- `normalizeJob()` — Maps raw backend job objects to the props JobCard expects
- `sendMessage()` — Handles chat submission and API calls

**`src/AdminPanel.js`** — Full admin dashboard, self-contained component. Tabs: Overview, Searches, Sources, Health, Users, Performance, Feedback, Trust, Engagement, API Keys.

**`src/components/JobCard.jsx`** — The job listing card component. Displays:
- Trust score header (color-coded gradient by score)
- Company logo, title, location, salary
- AI match percentage badge
- Trust metric bars (Freshness, Source, Safety, Company, Transparency)
- Strengths & Watch Out sections
- Expandable full job description (accordion)
- Apply Now / Save / View Details buttons

### App State (key pieces in Dashboard)
```js
jobs          // Array of normalized job objects
savedIds      // Set of saved job IDs
expandedJobId // Which job card is expanded (accordion — only one at a time)
messages      // Chat conversation history
chatCollapsed // Whether the chat panel is minimized
view          // 'all' | 'saved'
filters       // { remote, salary, verified }
```

### Job Card Accordion
Only one card is expanded at a time. When a card's "View Details" is clicked:
- If it's not expanded → set `expandedJobId` to that job's id
- If it's already expanded → set `expandedJobId` to null (collapse)
- Any previously expanded card auto-collapses

---

## 8. Backend (Node.js / Express)

### `server/index.js`
Main entry point. Spins up two Express apps:
1. **Main app** on `PORT` (5050) — handles all user-facing endpoints
2. **Admin app** on `ADMIN_PORT` (5051) — mounts admin routes only

### `server/jobAggregator.js`
Fetches jobs from all enabled sources in parallel using `Promise.all`. Each source has its own `fetch*` function:

| Function | Source | Type | Notes |
|----------|--------|------|-------|
| `fetchJSearch()` | JSearch/OpenWebNinja | REST API | Aggregates LinkedIn, Indeed, Glassdoor. Returns structured highlights |
| `fetchAdzuna()` | Adzuna | REST API | US jobs with salary. 250 free calls/month |
| `fetchRemotive()` | Remotive | REST API | Remote jobs, category-filtered |
| `fetchRemoteOK()` | Remote OK | JSON feed | Keyword-filtered from full feed |
| `fetchWeWorkRemotely()` | We Work Remotely | RSS | Parses XML feed |
| `fetchHNJobs()` | Hacker News | Firebase API | Parses freeform "Who's Hiring" posts |
| `fetchUSAJobs()` | USAJobs.gov | REST API | US government positions |

After fetching, `deduplicateJobs()` removes duplicates using a `"title|company"` key.

**HTML Description Parsing** — For sources that return HTML descriptions (Remotive, Remote OK, WWR, HN), `parseHtmlToSections()` extracts structured data:
- Identifies section headers (`<h2>`, `<h3>`, `<strong>`) by keyword matching
- Populates: `responsibilities`, `requirements`, `benefits`, `how_to_apply`, `company_culture`

### `server/trustScoring.js`
Scores every job on a 0–100 scale across 6 categories. Jobs scoring below the threshold (~55) are filtered out entirely.

### `server/aiScoring.js`
Sends jobs to Claude Haiku in batches of 5 with the user's profile. Returns:
- `matchScore` (0–100)
- `reasoning` (1–2 sentence explanation)
- `pros` (array of strengths)
- `cons` (array of concerns)

### `server/adminRoutes.js`
All routes under `/api/admin/`. Protected by a session token header (`X-Admin-Secret`). Login returns the token; all subsequent calls must include it.

The source toggle (`POST /api/admin/sources/:key/toggle`) mutates the in-memory `jobSources` object. **This resets on server restart.** To persist toggles permanently, edit `server/config/jobSources.js` directly.

---

## 9. API Endpoints Reference

### Main Server (port 5050)

#### `POST /api/chat`
Conversational job search. Main endpoint used by the chat UI.

**Request body:**
```json
{
  "text": "React developer in Austin",
  "messages": [{ "role": "user", "content": "..." }, ...],
  "userProfile": {
    "skills": ["React", "JavaScript"],
    "location": "Austin",
    "jobTitle": "Frontend Engineer"
  }
}
```

**Response:**
```json
{
  "reply": "Found **47 React developer jobs** in Austin...",
  "jobs": [...],
  "jobCount": 47,
  "searchQuery": "React developer",
  "searchLocation": "Austin"
}
```

#### `POST /api/search-jobs`
Direct job search, bypasses AI chat layer.

**Request body:**
```json
{
  "query": "software engineer",
  "location": "remote",
  "limit": 100
}
```

**Response:**
```json
{
  "jobs": [...],
  "total": 84,
  "sources": ["JSearch", "Remotive", "Adzuna"],
  "durationMs": 3421
}
```

#### `POST /api/feedback`
Collect user feedback.

**Request body:**
```json
{
  "type": "bug",
  "rating": 3,
  "message": "The salary filter doesn't work"
}
```

#### `GET /api/health`
Returns server status. No auth required.

**Response:**
```json
{
  "ok": true,
  "env": {
    "hasAnthropicKey": true,
    "hasAdzunaKeys": true,
    "hasUSAJobsKey": false
  },
  "sources": {
    "jsearch": true,
    "adzuna": true,
    "remotive": true,
    ...
  }
}
```

### Admin Server (port 5051)

All admin endpoints except `/api/admin/login` require the header:
```
X-Admin-Secret: tulifo-admin-authenticated
```

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/login` | POST | `{ username, password }` → `{ token }` |
| `/api/admin/overview` | GET | Aggregate stats (searches, errors, uptime) |
| `/api/admin/searches` | GET | Recent searches list (`?limit=50`) |
| `/api/admin/errors` | GET | Recent error log |
| `/api/admin/sources` | GET | All source configs + live stats |
| `/api/admin/sources/:key/toggle` | POST | Enable/disable a source in-memory |
| `/api/admin/health` | GET | Server health + env check |
| `/api/admin/users` | GET | User session stats |
| `/api/admin/performance` | GET | API timing metrics |
| `/api/admin/behavior` | GET | Click/scroll/rage-click events |
| `/api/admin/feedback` | GET | All user feedback submissions |
| `/api/admin/trust` | GET | Trust score distribution stats |
| `/api/admin/engagement` | GET | Apply clicks, saves, top companies |
| `/api/admin/apikeys` | GET | List stored API keys |
| `/api/admin/apikeys` | POST | Add/update an API key |
| `/api/admin/apikeys/:envKey` | DELETE | Remove an API key |

---

## 10. Job Sources

Configured in `server/config/jobSources.js`. Each source object has:

```js
{
  name: 'JSearch',
  emoji: '🌐',
  type: 'api',            // 'api' | 'rss' | 'scrape'
  status: 'active',       // 'active' | 'ready' | 'restricted' | 'no-api' | 'dead'
  enabled: true,          // Toggle this to enable/disable
  endpoint: 'https://...',
  requiresAuth: true,
  notes: 'Description...'
}
```

### Active Sources (enabled by default)

| Key | Name | Free? | Notes |
|-----|------|-------|-------|
| `jsearch` | JSearch | 100/month free | Aggregates LinkedIn, Indeed, Glassdoor via OpenWebNinja |
| `adzuna` | Adzuna | 250/month free | Strong salary data for US |
| `remotive` | Remotive | Unlimited | Curated remote jobs |
| `remoteok` | Remote OK | Unlimited | Tech-heavy remote feed |
| `weworkremotely` | We Work Remotely | Unlimited | RSS feed |
| `hn` | HN Who's Hiring | Unlimited | Startup/tech jobs from HN monthly thread |
| `usajobs` | USAJobs | Unlimited | US federal government jobs (needs API key) |

### Enabling a New Source
1. Find the source in `server/config/jobSources.js`
2. Change `enabled: false` to `enabled: true`
3. If it requires auth, add the API key to `server/.env`
4. Add a `fetch*()` function in `server/jobAggregator.js`
5. Add it to the `fetchers` array inside `aggregateJobs()`

---

## 11. AI & Trust Scoring System

### Trust Scoring (trustScoring.js)

Every job gets a composite trust score (0–100) from 6 weighted factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| Source Reliability | 22% | How trustworthy is the job board? (JSearch/USAJobs = 88–98, HN = 78) |
| Freshness | 18% | How recently was it posted? (Today = 100, 2+ months = 15) |
| Scam Risk | 28% | 50+ patterns detected: payment requests, MLM signals, fake promises |
| Company Legitimacy | 15% | 150+ known companies list + legal entity suffix detection |
| Transparency | 10% | Has salary, location, apply URL, description length |
| Description Quality | 7% | Length and professional terminology count |

**Score tiers:**
- **88+** → ✓ Verified Job (green header)
- **72–87** → ✓ Trusted Job (blue header)
- **55–71** → ⚠ Review Carefully (yellow header)
- **< 55** → Filtered out entirely (never shown to users)

### AI Scoring (aiScoring.js)

Uses **Claude Haiku** (fast, cheap) to score jobs against user profile. Processes 5 jobs per API call.

Returns per job:
- `matchScore` — 0–100, how well it matches the user's skills/preferences
- `reasoning` — 1–2 sentence explanation shown in the AI Match Analysis box
- `pros` — 2–3 strengths (shown in green "Strengths" box)
- `cons` — 1–2 concerns (shown in yellow "Watch Out" box)

If Anthropic API key is missing or the call fails, jobs are still shown but with default `matchScore: 70` and no reasoning.

### Chat AI (server/index.js)

Uses **Claude Sonnet 4.6** for the conversational interface. System prompt instructs it to:
- Accept any job title or skill the user provides without correction
- Ask only for missing info (skill and/or location)
- Trigger a job search as soon as both are available
- Keep responses to 1–2 sentences
- Never ask about name, age, experience level, or salary preferences

The server injects actual job counts into Claude's reply (`ACTUAL_JOB_COUNT` placeholder) to prevent hallucination.

---

## 12. Admin Console

**URL:** `http://localhost:3000/#admin`
**Credentials:** username `admin` / password `admin`

The admin console has 10 tabs:

| Tab | What it shows |
|-----|--------------|
| **Overview** | Total searches, jobs found, avg response time, error count, uptime |
| **Searches** | Log of every search query with timestamp, source breakdown, result count |
| **Sources** | All job sources with ON/OFF toggle, type, stats (calls, jobs, avg ms) |
| **Health** | Server status, API key status, memory usage, recent errors |
| **Users** | Session count, device breakdown, recent sessions |
| **Performance** | API endpoint timing, percentiles, Web Vitals |
| **Feedback** | All user feedback submissions with type, rating, message |
| **Trust** | Distribution of trust scores, scam flag frequency |
| **Engagement** | Apply clicks, saves, top applied companies, top saved sources |
| **API Keys** | View and update API keys without touching the .env file |

> **Source toggles are in-memory only.** Toggling a source OFF in the admin console disables it until the server restarts. To permanently disable a source, edit `enabled: false` in `server/config/jobSources.js`.

> **Changing admin credentials:** Edit `ADMIN_USERNAME` and `ADMIN_PASSWORD` constants in `server/adminRoutes.js` (lines 11–12). Do this before production deployment.

---

## 13. Database (Supabase)

Supabase is optional. Without it, the app works in guest-only mode with in-memory analytics only.

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User job preferences (skills, location, job title) |
| `chat_messages` | Persisted chat history per user |
| `admin_search_events` | Search analytics (synced from in-memory on interval) |
| `admin_error_events` | Error log (synced from in-memory on interval) |

### Two Supabase clients

1. **Frontend client** (`src/supabase.js`) — Uses anon key. Handles auth (Google OAuth + email), reads/writes `profiles` and `chat_messages`.
2. **Backend client** (`server/supabaseAdmin.js`) — Uses service role key. Writes analytics events.

### Setting up Supabase

1. Create a project at supabase.com
2. Create the tables above (schema inferred from code)
3. Enable Google OAuth in Authentication → Providers if needed
4. Add credentials to both `.env` files (see Section 5)

---

## 14. Deployment

### Production build

```bash
# Build the React frontend
cd tulifo-ai
npm run build
# Output goes to: tulifo-ai/build/

# Serve the build folder with your web server (nginx, Vercel, etc.)
```

### Backend deployment (any Node host — Render, Railway, Fly.io, EC2, etc.)

```bash
cd server
npm start
```

Ensure these environment variables are set on the host:
- All keys from `server/.env` (see Section 5)
- `PORT` — main API port
- `ADMIN_PORT` — admin API port

### Important before going live

1. **Change admin credentials** in `server/adminRoutes.js` lines 11–12
2. **Update CORS** in `server/index.js` line 14 — replace `http://localhost:3000` with your production domain
3. **Update `REACT_APP_API_URL`** in the frontend `.env` to your production API URL
4. **Update `REACT_APP_ADMIN_URL`** to your production admin API URL
5. **Secure the admin port** — consider placing `5051` behind a VPN or firewall; it should not be publicly accessible

---

## 15. Adding a New Job Source

1. **Add config** to `server/config/jobSources.js`:
```js
mynewsource: {
  name: 'My New Source',
  emoji: '🆕',
  type: 'api',
  status: 'active',
  enabled: true,
  endpoint: 'https://api.mynewsource.com/jobs',
  requiresAuth: true,
  notes: 'Description of the source.',
}
```

2. **Write the fetch function** in `server/jobAggregator.js`:
```js
async function fetchMyNewSource(query, location) {
  const response = await fetch(`${jobSources.mynewsource.endpoint}?q=${query}`);
  const data = await response.json();
  return data.results.map(j => ({
    id: nextId(),
    title: j.title,
    company: j.company,
    location: j.location || 'Remote',
    salary: j.salary || 'Not listed',
    salaryMin: 0,
    tags: j.tags || [],
    description: j.description || '',
    responsibilities: [],
    requirements: [],
    benefits: [],
    applyUrl: j.url,
    source: 'My New Source',
    postedAt: j.posted_at,
    matchScore: 70,
  }));
}
```

3. **Add to the fetchers array** inside `aggregateJobs()`:
```js
if (jobSources.mynewsource.enabled) {
  fetchers.push(fetchMyNewSource(query, location).catch(err => {
    console.error(`[MyNewSource] Failed: ${err.message}`);
    return [];
  }));
}
```

4. **Add source reliability score** in `server/trustScoring.js` in the `SOURCE_SCORES` object.

5. **Add logo** in `src/App.js` in the `SOURCE_LOGOS` object.

---

## 16. Troubleshooting

### "I couldn't reach the AI server"
- Check that the backend is running: `curl http://localhost:5050/api/health`
- Check `REACT_APP_API_URL` in `.env` matches the running port
- Restart the React dev server after any `.env` change

### Admin console shows landing page instead of login
- Use the hash URL: `http://localhost:3000/#admin` (not `/admin`)

### Admin console API calls fail
- Check `REACT_APP_ADMIN_URL` in `.env` is set to `http://localhost:5051`
- Verify admin server is running: `curl -X POST http://localhost:5051/api/admin/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin"}'`

### No jobs returned
- Check at least one source is enabled and has valid credentials
- Call `GET /api/health` to see which sources are active
- Check server console for `[Source] Failed:` error messages

### Source toggle resets after restart
- Toggles in the admin console are in-memory only
- To permanently disable a source, set `enabled: false` in `server/config/jobSources.js`

### Trust scores seem wrong / jobs filtered too aggressively
- Edit the `WEIGHTS` object and threshold in `server/trustScoring.js`
- Default threshold: jobs below ~55 are removed from results

### AI scoring not working (all jobs show 70% match)
- Check `ANTHROPIC_API_KEY` is set in `server/.env`
- Check server logs for `[AI Scoring]` errors
- The system falls back gracefully — jobs still appear without AI scores

### CORS errors in browser console
- Ensure `server/index.js` CORS origin matches the frontend URL exactly (including protocol and port)

---

*Generated for Tulifo AI v2.0.0 — March 2026*
