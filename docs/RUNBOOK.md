# NAVO runbook

## Environment variables
**Vercel → Settings → Environment Variables** (Production; repeat for Preview with the staging values):
| Name | Needed for |
|---|---|
| `NAVO_SUPABASE_SERVICE_KEY` | Accounts & passwords, email automation, error log table |
| `RESEND_API_KEY`, `NAVO_MAIL_FROM` | Emails |
| `CRON_SECRET` | Daily email run |
| `ANTHROPIC_API_KEY` | AI help |
| `NAVO_SUPABASE_URL`, `NAVO_SUPABASE_PUBLISHABLE_KEY` | Only for Preview, pointing at staging |

**GitHub → Settings → Secrets and variables → Actions:** `NAVO_SUPABASE_SERVICE_KEY` (turns on daily backups).

## Database changes
Run new files in `supabase/` in number order in Supabase → SQL Editor. Current: `021_scope_access.sql`, `022_client_errors.sql`.
Try every change on staging first.

## Release
1. Work on a branch → Vercel gives a preview link (uses staging data once staging is set up).
2. Checks must be green (GitHub → Actions → Checks).
3. Change the `?v=` date on the script tags in `public/index.html`.
4. Merge to `main` → live in about a minute.

## Roll back
Vercel → Deployments → pick the last good one → ⋯ → **Promote to Production**. Takes seconds; no data is touched.
Then fix on a branch and release again.

## Backup and restore
- Daily at 04:17 Riyadh: GitHub → Actions → **Daily backup** → the run → Artifacts → download `navo-backup-…` (kept 30 days).
- Also turn on Supabase → Database → Backups (Point-in-time recovery on paid plans).
- Restore (staging first!):
  ```
  NAVO_SUPABASE_URL=https://<project>.supabase.co NAVO_SUPABASE_SERVICE_KEY=... python scripts/restore.py <backup-folder>
  ```
- Test a restore into staging once a quarter.

## When something breaks
1. Is the site up? `https://navo-hse.vercel.app/api/health` → `{"ok": true}`. The **Uptime check** workflow fails (GitHub emails you) when it is not.
2. Browser errors: Vercel → Logs → search `NAVO client error`; or table `client_errors` in Supabase.
3. Server errors: Vercel → Logs → filter by the function (`/api/report`, `/api/users` …).
4. If a release caused it: roll back (above).

## Staging (one-time setup)
1. Supabase → New project `navo-staging` (same region).
2. Run `supabase/schema.sql` then every numbered file in order.
3. Copy its URL and publishable key into `STAGING` in `public/supabase-config.js`.
4. In Vercel, add `NAVO_SUPABASE_URL`, `NAVO_SUPABASE_PUBLISHABLE_KEY` and its own `NAVO_SUPABASE_SERVICE_KEY` for **Preview** only.
5. Preview links now show a purple **STAGING** strip and never touch live data. Until then they show a red **PREVIEW · LIVE data** strip.
