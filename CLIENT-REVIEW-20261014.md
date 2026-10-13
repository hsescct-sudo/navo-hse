# Client review release — 14 October 2026

## Implemented
- Optional Google Maps link, free-text site and precise area in case forms; location links in walkthrough/inspection tools and the existing site-report wizard. Links are stored with the record and opened explicitly, without an API key or automatic location collection.
- Clickable risk donut and percentages: Positive, High (includes Critical), Medium, Low, plus Unassessed. Observations, incidents, near misses, inspection checklist findings, audit findings and walkthrough findings feed it. Source copies are deduplicated. Unknown risk stays unknown. Safe checklist checks are positive findings; declared critical walkthrough items are High. Division cells and chart segments open source records in Records with the same project/time/scope filters.
- Recordable injury counts by division and existing recorded severity categories. First aid and near misses remain outside recordable injury counts.
- Observation photo upload and preview, private project storage, photo-to-AI analysis request, review/apply of description, category, rating, immediate controls, close-out deadline and corrective draft actions. Staff draft actions receive a responsible user and department, remaining editable before submission. No automatic closure.
- Deadline suggestions bounded to Critical 1, High 3, Medium 7 and Low 14 days. These are workflow proposals, not permission to continue unsafe work.
- ESG/SDG/ISO/Tier-1 evidence matrix with clickable real evidence counts, official legal links for KSA/UAE/Bahrain, and explicit applicability gaps for other jurisdictions. Environmental rows require relevant recorded monthly fields. Evidence availability does not certify compliance or guarantee tender wins.
- Readable chart labels, donut centre numbers, pyramid labels and numbers on pale bands.
- Installable PWA manifest, 192/512 icons, installation guidance for Android/iOS, standalone mode and connection-required offline page. The service worker caches only public assets; private API/storage responses bypass its cache. App-store publishing is a separate task.

## Validation
Core risk percentages, unrated items, draft exclusion, map URL allowlist, deadline bounds; photo upload/review/apply and named draft actions with a mocked AI provider; dashboard-to-source drill-down; matrix and install help; seven case forms, SQL projections and identity/privacy rules; public-only cache and offline fallback. Existing AI provider credits are required for an actual generated photo analysis; mock tests prove the integration path, not provider availability.

## Sources
- [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)
- [UN Sustainable Development Goals](https://sdgs.un.org/goals)
- [ISO 45001](https://www.iso.org/standard/45001)
- [Saudi workplace protection duties](https://www.hrsd.gov.sa/en/care-about-you/health-and-safety)
- [UAE Labour Law and amendments](https://uaelegislation.gov.ae/en/legislations/1541)
- [Bahrain Labour Law 36/2012](https://www.legalaffairs.gov.bh/En/Legislation/id/K3612)
- [PWA installation requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
