# Tulifo AI & Job Aggregator

Tulifo AI is a comprehensive job aggregation platform. It searches multiple APIs and career pages simultaneously, runs scam/trust detection, scores jobs against the user's profile using Anthropics' Claude Haiku, and presents a sorted, high-priority list of top-tier jobs.

This repository holds the **Frontend (React)** and **Backend (Node/Express)**.

## Architecture

*   **Frontend**: React (Create React App), styled with vanilla CSS.
*   **Backend**: Node.js, Express.js. Powers the AI scoring, trust calculation, analytics, and job aggregation.
*   **Database Setup**: The app actively manages *two* separate PostgreSQL / Supabase connections:
    1.  **Backend Auth & Tracking DB (`SUPABASE_URL`)**: Stores analytics, user profiles, tracking events, feedback, and handles Google OAuth.
    2.  **Scraper Jobs DB (`SCRAPER_DB_URL`)**: Direct PostgreSQL pool connection for querying full-text job results scraped directly from top-tier company career portals (Meta, Google, Apple, etc.) via the standalone `job-portal-scrapper` project.

---

## Environment Configuration

Copy the `.env.example` in both directories and add your keys.

### Backend (`server/.env`)
```env
# 1. Main Backend Database (Auth, Tracking, Events)
SUPABASE_URL=https://[YOUR-PROJECT].supabase.co
SUPABASE_SERVICE_ROLE_KEY=ey...

# 2. Scraper Database (Direct PostgreSQL - For fetching vetted company jobs)
# Get from Supabase -> Settings -> Database -> Connection string
SCRAPER_DB_URL=postgresql://postgres.[scraper-project]:[password]@aws-0-region.pooler.supabase.com:6543/postgres

# AI Scoring API
ANTHROPIC_API_KEY=sk-ant-api03-...

# Third-Party Job APIs
JSEARCH_API_KEY=...
ADZUNA_APP_ID=...
ADZUNA_APP_KEY=...

# Port definitions (Optional)
PORT=5050
ADMIN_PORT=5051
```

### Frontend (`.env`)
```env
REACT_APP_SUPABASE_URL=https://[YOUR-PROJECT].supabase.co
REACT_APP_SUPABASE_ANON_KEY=ey...
```

---

## How to Run Locally

We use `concurrently` to run both the React app and Node servers with a single command.

1.  **Install everything**:
    ```bash
    npm install
    cd server && npm install
    cd ..
    ```

2.  **Run frontend + backend simultaneously**:
    ```bash
    npm run dev
    ```
    *   *Frontend* starts on `http://localhost:3000`
    *   *Backend API* starts on `http://localhost:5050`
    *   *Admin UI API* starts on `http://localhost:5051`

---

## Key Features

1.  **AI Match Scoring**: Sends job descriptions and user profiles to Anthropics API, returning a match score (1-100) and pros/cons.
2.  **Trust Module**: Analyzes keywords to flag scams ("pay upfront", "wire transfer") and promotes vetted companies to the top.
3.  **High-Priority Scraped Jobs**: Jobs queried from the `SCRAPER_DB_URL` are inherently trusted (Default Score 99) and pinned to the very top of the search results.
4.  **Admin Panel**: Go to `/admin` or `/#admin` in the frontend (Default credentials: `admin`/`admin`). Configure sources, view metrics and API key management.
5.  **Google OAuth**: Login via Supabase integration.

## Database Migrations

For the **Scraper Database**, this backend requires the full-text search indexing on the `jobs` table to perform rapidly.
Run the file `supabase/fulltext-search-index.sql` against your scraper database to establish GIN indexes across job titles and descriptions.
