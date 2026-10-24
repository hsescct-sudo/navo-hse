# NAVO — feature inventory

Every page and tab in NAVO, generated from the running app (branch v3). Use it as the checklist when changing the menu or rebuilding a page: nothing on this list may disappear.

## Menu

### Analysis

- **Dashboards**: Executive dashboard, Project scorecards, How the dashboards work
- **Trend analysis**: Trend analysis
- **CEO & environment**: CEO bi-monthly report, Environmental performance

### Operations

- **Incidents & investigations**: Incident register
- **Observations & records**: Observations (field reports), Search all records
- **Inspections & audits**: Inspections, Checklist library
- **Actions**: Action tracker
- **Leadership**: Leadership scorecard, Engagement targets, HSE walkthroughs, Activities log
- **Training & competence**: Training dashboard & matrix, Monthly training sessions
- **Equipment & plant**: Equipment register, Scaffolds, Fleet & Central Garage
- **Food safety (HACCP)**: Food safety (HACCP)
- **Live monitoring**: Environmental sensors, CCTV analytics

### Administration

- **Administration**: Performance data, Automations, Monthly review, Workflows, Organisation & access, Connected devices, QR reporting posters, Settings

## Dashboards (Dashboards › …)

- **Executive Dashboards**: Corporation, Construction, Non-Construction
- **Executive Summary**: Executive Summary, Closure Rate, Safety Statistics, Waste Management
- **Site Health Indicator**: Site Score Card, Actual Values, Indicator-wise Scores, Project Detail
- **Site Dashboard**: Site Dashboard
- **Injuries & Incidents**: Injuries, Incidents
- **Audits**: Corporate Audit, Process Safety, OSHE Audit
- **Accident Analysis**: Accident Analysis, Audit Analysis
- **Annual KPI**: Corporate, Construction Sites, Non-Construction Sites
- **E&S Dashboard**: Grievances Management, Worker Accommodation Assessments

## Modules and their tabs

- **Training & competence**: Dashboard, People, Training matrix, Training records, Plan · target vs actual, Training needs (TNA), Courses
- **Equipment**: Dashboard, Register, Documents & expiry, Inspections, Maintenance, Settings
- **Scaffolds**: Dashboard, Scaffold register, Inspections, Erectors & inspectors
- **Food safety**: Dashboard, Food units, HACCP plan, Temperature & CCP logs, Receiving & traceability, Suppliers, Hygiene audits, Food handlers
- **Fleet & garage**: Dashboard, Vehicles, Drivers, Journey management, Telematics events
- **Environmental monitoring**: Dashboard, Stations, Readings
- **CCTV safety analytics**: Live view, Emergency headcount, Detections, Cameras & zones
- **Connected devices**: Device keys
- **Leadership scorecard**: Scorecard
- **Trend analysis**: Trends
- **How the dashboards work**: Guide
- **QR reporting**: QR posters

## Pages without an account

- `/report?p=<project>&t=<token>` — worker QR report (English / Arabic, photo)
- `/request` — request access (an administrator approves)

## Server functions (`api/`)

- `users.py` — accounts: Excel template and upload, create, update, delete, access requests, QR tokens (admin only)
- `public.py` — access requests and QR reports (no account; validated, size-limited)
- `notify.py` — daily email digest (Vercel cron)
- `ingest.py` — device data (telematics, sensors, CCTV) with device keys
- `ceo_xlsx.py`, `ceoimport.py` — CEO bi-monthly workbook import
- `report*.py`, `excel_io.py`, `xlimport.py` — Word / PowerPoint / Excel exports and imports
- `ai.py`, `auth.py`, `health.py`, `log.py` — AI assist, auth helpers, health check, client error log

## Cross-cutting

- One organisation filter (Platform › Division › Sub-division › Project) at the top of every page; saved per device
- Three styles (Classic, Cinematic 3D, Report) + accent colour + background colour, in **Look**
- Serious-event alarm with acknowledge and escalation; bell alerts for expiries and overdue actions
- Sample data for every module, attached to sample projects only (removed in one step)
