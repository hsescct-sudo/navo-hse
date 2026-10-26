# NASS Safe Link — handover guide

NASS Safe Link is a complete digital HSE management platform, built around the NASS organisation structure (Construction and Non-Construction platforms, divisions, sub-divisions and projects in Bahrain, KSA and UAE). This package is the full source code. It is handed over as is, with no licence fee and no obligation.

---

## 1. What the platform does

**Analysis**
- HSE 360° Master Control: one command-centre screen, interactive, filtered to any site.
- Leadership overview with the lagging and leading indicator diamond.
- 20+ dashboards: executive summary, site health indicator, site dashboard, injuries and incidents, audits, accident analysis (decomposition tree), trend analysis (NCR, PFPI, near miss, top-3 risks), annual KPI, CEO bi-monthly report, environmental and social.
- Click any number to open the records behind it.

**Operations (12 modules)**
- Incidents and investigations: classification, involved persons, body map, root cause, review and approval.
- Observations and stop-work, inspections and audits with a checklist library, NCRs and findings.
- Action tracker with owners, due dates and escalation.
- Leadership engagement and scorecard.
- Training and competence: people with QR cards, matrix by position, plan against actual, training needs.
- Equipment and plant, scaffolds (tags, 7-day inspections), fleet and Central Garage.
- Food safety (HACCP): CCP logs, receiving and traceability, suppliers, hygiene audits, food handlers.
- Live monitoring: environmental sensors and CCTV analytics (ready for devices).

**Field**
- QR reporting for workers without an account or e-mail, in English and Arabic, with photo.
- Reports are saved on the phone when there is no signal and sent when it returns.
- Serious-event alarm with acknowledgement and escalation after 15 and 60 minutes.

**Control**
- Organisation and access by 14 positions, enforced in the database (row-level security).
- Accounts created in bulk from Excel; access requests approved by an administrator.
- Workflows, automations (daily e-mail digest, expiry reminders), monthly management review.
- Reports in PDF, PowerPoint, Word and Excel; CEO workbook import and export.
- Three display styles and background options per user.
- Sample data for every module, removed in one step.

A full page-by-page inventory is in `docs/FEATURES.md`.

---

## 2. How it is built

| Part | Technology | Folder |
|---|---|---|
| Web app | Plain HTML, CSS and JavaScript, no build step | `public/` |
| Server functions | Python on Vercel (reports, accounts, imports, QR, devices, e-mail, AI) | `api/` |
| Database, sign-in, file storage | Supabase (PostgreSQL) with row-level security | `supabase/` |
| Checks, uptime, daily backup | GitHub Actions | `.github/workflows/` |
| Browser tests | Playwright | `tests/` |
| Backup and restore scripts | Python | `scripts/` |

More detail: `docs/ARCHITECTURE.md` (structure) and `docs/RUNBOOK.md` (operations, releases, roll-back, backup).

---

## 3. Setting it up on NASS accounts

The copy running today at navo-hse.vercel.app uses a personal Supabase project and Vercel account. For NASS to own it fully, set it up on NASS accounts as follows (about one hour for a developer).

### 3.1 Database (Supabase)
1. Create a new Supabase project (choose the region NASS requires for data residency).
2. In **SQL Editor**, run the files in this order (each is safe to run again):
   1. `supabase/schema.sql`
   2. `supabase/002_…` to `supabase/008_…` in number order
   3. the four files in `supabase/migrations/` in date order
   4. `supabase/017_…` to `supabase/029_…` in number order
3. **Authentication → Providers → Email**: enabled. Set **URL Configuration → Site URL** to the new site address.
4. Copy the **Project URL** and the **publishable (anon) key** into `public/supabase-config.js`.
   The publishable key is meant to be public; protection comes from row-level security.
5. Keep the **service key** secret: it goes only into Vercel and GitHub secrets, never into the code or the browser.

### 3.2 Hosting (Vercel)
1. Put the source in a NASS GitHub repository.
2. In Vercel: **Add New → Project → Import** the repository. Framework: *Other*. Output directory: `public` (already set in `vercel.json`).
3. **Settings → Environment Variables** (Production):

| Name | Needed for |
|---|---|
| `NAVO_SUPABASE_URL` | Server functions: the new project URL |
| `NAVO_SUPABASE_PUBLISHABLE_KEY` | Server functions: the new publishable key |
| `NAVO_SUPABASE_SERVICE_KEY` | Accounts, QR reporting, access requests, e-mail automation |
| `RESEND_API_KEY`, `NAVO_MAIL_FROM` | E-mail alerts and the daily digest (optional) |
| `CRON_SECRET` | Protects the daily e-mail run (optional) |
| `ANTHROPIC_API_KEY`, `NAVO_AI_MODEL` | AI writing help (optional) |
| `NAVO_APP_URL` | Links in e-mails (the site address) |

4. Deploy. Check `https://<site>/api/health` returns `{"ok": true}`.
5. Update the addresses in `.github/workflows/uptime.yml` to the new site, and add `NAVO_SUPABASE_SERVICE_KEY` under **GitHub → Settings → Secrets → Actions** to turn on daily backups.

### 3.3 First use
1. Sign up with the first account; it becomes the owner and system administrator.
2. **Administration → Organisation & access**: check the structure and add people (one by one or from the Excel template).
3. **Administration → Settings**: the NASS logo and name, colours, KPI multipliers.
4. Optional: **Load sample data** to demonstrate every screen; **Remove sample data** before real use.
5. **Administration → QR reporting posters**: print a poster per project.

---

## 4. Making changes

- Work on a branch; Vercel gives a preview link for each branch.
- Run the browser test before merging:
  `cd tests && npm install && PLAYWRIGHT_PATH=$(dirname $(node -e "console.log(require.resolve('playwright'))")) node e2e/app.cjs`
- When changing a script or stylesheet, change the `?v=` date on the tags in `public/index.html` so browsers load the new version.
- Database changes go in a new numbered file in `supabase/`, run in the SQL Editor.
- Roll back in seconds from Vercel → Deployments → *Promote to Production* on the last good one.

---

## 5. Notes for the digital team

- Internal names in the code still use `navo` (file names, environment variables, database schema `navo_private`). The visible name is **NASS Safe Link**; it can be changed in Settings.
- The organisation, positions, workflows, numbering and audit trail are generic, so other departments (quality, document control, HR, procurement) can be added as further modules on the same base.
- To confirm with NASS: hosting region and data residency, single sign-on with the NASS directory, the e-mail sender domain, and retention periods.
