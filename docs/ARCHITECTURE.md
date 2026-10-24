# NAVO — how the front end is organised

## Load order
`public/index.html` loads the core app (inline script: state `st`, data `L`, `render()`), then feature files in a fixed order. The last two files are the final word:
- `navo-v2.js` — body map, trend summary, decomposition tree, project pickers grouped by organisation, involved persons, readable dark style
- `navo-core.js` — the menu (three sections) and the one organisation filter

## Rules (v3)
1. **Never wrap `render()`.** Use `onBeforeRender(fn)` (return `false` to skip drawing) or `onAfterRender(fn)`. Before-hooks run newest first, after-hooks oldest first; one failing hook is logged and does not break the page.
2. **Settings panels**: `addSettingsPanel(fn)` — never wrap `settings()`.
3. **Organisation & access**: `addOrgTab(id, label, () => page())` and `addOrgPanel(fn)` — never wrap `access()`. Pass a function that calls the page by name so later changes to that page are picked up.
4. **Scope**: every page reads projects through `myProjects()`, which applies the user's access and the organisation filter. Do not add page-level platform/division/project pickers.
5. **New modules** use the registry engine (`navo-reg.js`: `regModule`, `rgNav`) — forms, documents with expiry, QR, history, Excel import/export and bell alerts come with it.
6. **One definition per function.** If a later file must change a function, change the original instead of redefining it.

## Still layered (to clean next)
- `go` (3 files), `soon` (3), `cmSet` (3), `hsse` (3), `cxOpen` (3), `clLib` (3), `moPicker` (2), `auAlerts` (2), `accountsPage` (2)
- CSS: 22 files and ~750 `!important` rules; the dark style still uses a small JS pass (`v2Lift`) to brighten dark text
- Two report entry points (quick report wizard and the case register) by design: the wizard is for the field, the case register for investigation

## Checks
- `scratchpad` harness (Playwright) opens all 98 pages and tabs in each style and reports script errors and unreadable text
- `tests/` — unit and UI tests (`cases-ui`, `cockpit-ui` fail on main too: they predate the current layout and need updating)
