# NAVO — how it is built

## Pieces
| Part | Where | What it does |
|---|---|---|
| Web app | `public/` | One page (`index.html`) plus feature scripts. No build step. Later scripts extend earlier ones by wrapping global functions (`render`, `soon`, `access`, `ceoPage` …). |
| Database & sign-in | Supabase (`supabase/*.sql`) | Postgres with Row Level Security. Every rule about who sees what lives in the database, not only in the page. |
| Server functions | `api/*.py` (Vercel Python) | Reports (PowerPoint/Word/Excel/PDF), Excel imports, account management, email automation, health, error log. |
| Hosting | Vercel | Every push to `main` deploys the live site. Pushes to other branches get a preview link. |
| Checks | `.github/workflows/` | `checks.yml` on every push; `backup.yml` daily; `uptime.yml` every 30 minutes. |

## Script order (public/index.html)
`supabase-config.js` → `navo-supabase.js` (database adapter) → `navo-ops.js` (adds sign-in to /api calls, error reporting) → core and features → `navo-ceo.js` → `navo-ceo-dash.js` → … → `navo-access.js` → `navo-users.js` → theme and motion.
Each script tag carries `?v=<date>`; change it on every release so phones load the new files.

## Data
- `reports`, `actions`, `inspections`, `activities`: the HSE records.
- `hsse_records`: several kinds in one table — `monthly` (man-hours, waste, fuel), `env`, `ceo` (fortnight figures; `data.opening` = workbook year-to-date; `data.tables` = division tables), `training`, `walkthrough`.
- `settings` (`admin/structure`): KPI basis (1,000,000 man-hours), targets, brand, optional modules, environmental factors, automation rules.
- `members`: role (`admin`, `hse`, `supervisor`, `worker`, `viewer`) and scope (`corporate`, `platform`, `division`, `cluster`, `project`).
- `people`: names and emails. `owner`: the account that owns the installation.

## Security
- Browser uses the publishable key only. RLS functions `in_project()` and `is_staff()` decide access.
- Server functions that read or build files require a signed-in token (`api/auth.py`). Account management additionally requires a System admin.
- The service key exists only in Vercel and GitHub secrets.

## Rates
Per 1,000,000 man-hours. LTIFR = (fatalities + SI + RLTA + RLTI). TRCF adds RWC and MTC. LTISR = days lost + 6,000 per fatality.
