"use strict";
const CO = { demoHistory: null, back: [], restoring: false, cache: null };
const coMetricBase = hsExecMetrics;
hsExecMetrics = function (P, cut) {
  if (!CO.cache) return coMetricBase(P, cut);
  const h = hsInit(),
    key = JSON.stringify([
      P.map((p) => p.id),
      cut,
      h.y,
      h.m,
      h.plat,
      h.con,
      st.country,
    ]);
  if (!CO.cache.has(key)) CO.cache.set(key, coMetricBase(P, cut));
  return CO.cache.get(key);
};
const coHsseBase = hsse;
hsse = function () {
  if (
    CL.dashboard !== "summary" ||
    !L.ready ||
    !CX.loaded ||
    CD.detail ||
    hsInit().sec !== "exe"
  )
    return coHsseBase();
  return nxLoading() || '<div class="cd-dashboard"></div>';
};
const coStoredHistory = ceoHistoryData;
ceoHistoryData = function () {
  const d = coStoredHistory();
  if (!(CO.demoHistory ?? hsIsSample())) return d;
  const P = hsP().filter((p) => String(p.id).startsWith("demo-"));
  if (!P.length) return d;
  d.illustrative = true;
  d.demoHistory = true;
  d.historyNote = `${d.rows[0].year}–${d.rows[3].year} are simulated demonstration data; ${d.rows[4].year} uses stored dashboard figures. Not company performance or tender evidence.`;
  d.rows = d.rows.map((r, i) => {
    if (i === 4) return r;
    const hours = P.length * (900000 + i * 110000),
      lti = Math.max(1, Math.round(P.length * (0.22 - i * 0.045))),
      lost = lti * (13 - i * 2),
      recordable = Math.max(lti, Math.round(P.length * (0.9 - i * 0.14)));
    return {
      ...r,
      hours,
      lti,
      lost,
      recordable,
      ltifr: (lti * 1e6) / hours,
      ltisr: (lost * 1e6) / hours,
      trcf: (recordable * 1e6) / hours,
      coverage: "SIMULATED DEMO HISTORY",
      simulated: true,
    };
  });
  return d;
};
const coHistoryBase = ceoHistory;
ceoHistory = function () {
  coHistoryBase();
  const p =
    document.querySelector("#cx-modal .cx-modal-body") ||
    document.querySelector('#cx-modal [role="dialog"]') ||
    document.querySelector("#cx-modal .cx");
  const d = ceoHistoryData();
  const source = document.querySelector("[data-ceo-history-sources]");
  if (source && d.demoHistory)
    source.textContent = "Open stored source reports (current data)";
  if (p)
    p.insertAdjacentHTML(
      "afterbegin",
      `<div class="co-history-mode"><label>History data <select data-co-history-mode><option value="stored" ${!d.demoHistory ? "selected" : ""}>Stored company records</option><option value="demo" ${d.demoHistory ? "selected" : ""} ${!hsIsSample() ? "disabled" : ""}>Illustrative five-year demonstration</option></select></label><p>${esc(d.historyNote || "Only stored records are shown. Missing years remain unavailable.")}</p></div>`,
    );
};
function coN(n) {
  return Number(n || 0).toLocaleString();
}
function coCard(title, body, cls = "") {
  return `<section class="co-panel ${cls}"><header><h3>${title}</h3></header>${body}</section>`;
}
function coRates(P) {
  const cfg = hsKpiCfg().targets;
  return `<table class="co-table"><thead><tr><th>Platform</th><th>LTIFR</th><th>LTISR</th><th>TRCF</th></tr></thead><tbody>${[
    "Corporation",
    "Construction",
    "Non-Construction",
  ]
    .map((s) => {
      const m = hsExecMetrics(ceoScope(P, s), hsCutoff());
      return `<tr><th><button data-co-scope="${s}">${coPlatformLabel(s)} ↗</button></th>${["ltifr", "ltisr", "trcf"].map((k) => `<td class="${m.hrs && m[k] > cfg[s][k] ? "co-red" : "co-green"}"><b>${m.hrs ? m[k].toFixed(2) : "—"}</b><small>target ${cfg[s][k].toFixed(2)}</small></td>`).join("")}</tr>`;
    })
    .join(
      "",
    )}</tbody></table><footer>Per 1,000,000 hours · click a platform for evidence</footer>`;
}
function coHipo(P) {
  const v = SC.hipoGroups(frRows(P), P, "country");
  return `<div class="co-bar-list">${
    v.groups
      .slice(0, 4)
      .map(
        (g) =>
          `<button data-cl-hipo-ids="${esc(JSON.stringify(g.ids))}" aria-label="${esc(g.label)} high potential source records"><span>${esc(g.label)}</span><i><em style="width:${g.percent}%"></em></i><b>${g.count} <small>${g.percent.toFixed(0)}%</small></b></button>`,
      )
      .join("") || "<p>No assessed high-potential events.</p>"
  }</div><footer>${v.total} high potential · ${v.unassessed} awaiting assessment</footer>`;
}
const coArrangeBase = clArrangeDashboard;
clArrangeDashboard = function () {
  if (CL.dashboard !== "summary") {
    coArrangeBase();
    return;
  }
  const el = document.querySelector(".cd-dashboard");
  if (!el) return;
  if (GM.map) {
    GM.map.remove();
    GM.map = null;
  }
  const P = hsP(),
    e = ceoEvidence(P, "Corporation"),
    m = e.m,
    rows = frRows(P).filter((r) => r.status !== "Draft"),
    actions = L.actions.filter((a) => hsIds(P).has(a.project)),
    closed = actions.filter((a) => a.closedAt).length,
    hist = ceoHistoryData(),
    entries = gmEntries(P),
    programs = clProgramStats(P),
    corp = { cur: m };
  const table = `<table class="co-table"><thead><tr><th>Platform</th><th>People</th><th>Hours</th><th>Projects</th></tr></thead><tbody>${[
    "Construction",
    "Non-Construction",
  ]
    .map((s) => {
      const ps = ceoScope(P, s),
        v = hsExecMetrics(ps, hsCutoff());
      return `<tr><th>${coPlatformLabel(s)}</th><td>${coN(v.manpower)}</td><td>${(Number(v.hrs || 0) / 1e6).toFixed(1)}M</td><td>${ps.length}</td></tr>`;
    })
    .join("")}</tbody></table>`;
  el.className = "cd-dashboard cl-analytics co-dashboard";
  el.innerHTML = `<header class="co-heading cd-heading"><div><span class="co-eyebrow">${esc(brand().name)} / LEADERSHIP OVERVIEW</span><h1>Your company. One clear view.</h1><p>${esc(hsTitle())}${hsIsSample() ? " · ILLUSTRATIVE DEMONSTRATION" : ""}</p></div><div class="cd-tools"><button data-ceo-downloads>Download reports ↓</button><button data-co-present>Present ↗</button>${cdAppearance()}<button data-co-filters>Filters</button><button data-co-dashboards>Dashboards ☰</button></div></header>
${coScopeTabs()}${coExposure(P)}<div class="co-kpis">${[
    ["Projects", P.length, "sc"],
    ["People", corp.cur.manpower, "sc"],
    ["Exposure hours", (m.hrs / 1e6).toFixed(1) + "M", "sc"],
    ["Records", rows.length, "casehome"],
    ["Recordable cases", m.trc, "casehome"],
    ["Overdue actions", e.overdue.length, "lactions"],
  ]
    .map(
      ([n, v, r]) =>
        `<button data-go="${r}"><span>${n}</span><b>${typeof v === "number" ? coN(v) : v}</b></button>`,
    )
    .join("")}</div>
<div class="co-grid"><div class="co-map-slot">${cdMap(P)}</div>${coCard("Safety performance · actual / target", coRates(P), "co-rates")}${coCard("Risk profile · click to review", frDonut(frFindings(P)), "co-risk")}${coCard(
    "Five-year performance <button data-ceo-history>Explore ↗</button>",
    hLine(
      hist.rows.map((r) => String(r.year)),
      [
        ["ltifr", "LTIFR", HC.blue],
        ["ltisr", "LTISR", "#bb701d"],
        ["trcf", "TRCF", HC.green],
      ].map(([key, n, c]) => ({ n, c, v: hist.rows.map((r) => r[key]) })),
      { h: 110, vals: 1 },
    ) +
      `<footer>${hist.demoHistory ? `DEMO history ${hist.rows[0].year}–${hist.rows[3].year} · ${hist.rows[4].year} stored` : "Stored rates · gaps = missing exposure"} · per 1M hours</footer>`,
    "co-trend",
  )}${coCard("High potential · country", coHipo(P), "co-hipo")}${coCard(
    "Projects & workforce",
    table +
      `<div class="co-health">${[
        ["green", "Within targets"],
        ["yellow", "Follow-up"],
        ["red", "Intervention"],
      ]
        .map(
          ([c, n]) =>
            `<span><i style="background:${PC.colors[c]}"></i>${entries.filter((x) => x.state.color === c).length} ${n}</span>`,
        )
        .join("")}</div>`,
    "co-workforce",
  )}${coCard("Action & leadership assurance", `<div class="co-assurance"><button data-go="lactions"><b>${actions.length ? Math.round((closed / actions.length) * 100) : 0}%</b><span>actions closed</span></button><button data-go="leaders"><b>${coN(programs.reduce((s, p) => s + p.count, 0))}</b><span>leadership engagements</span></button><button data-go="inspm"><b>${coN(e.critical)}</b><span>open critical controls</span></button></div><footer><button data-co-outlook>Predictive · preventive · protective ↗</button><button data-co-esg>ESG / ISO evidence ↗</button></footer>`, "co-control")}</div><div class="co-foot">${hsIsSample() ? "DEMO records / locations included. " : ""}Health colours reflect recorded indicators, not certification. <button data-cl-dashboard="portfolio">Safety cycle & portfolio ↗</button><button data-go="casehome">All source records ↗</button></div>`;
  gmMount();
  const mountedMap=GM.map;
  requestAnimationFrame(() => {
    if(!mountedMap || GM.map!==mountedMap || !mountedMap.getContainer()?.isConnected)return;
    mountedMap.invalidateSize();
    gmMountFit();
  });
};
const coRenderBase = render;
render = function () {
  CO.cache = new Map();
  try {
    coRenderBase();
    document.body.classList.toggle(
      "co-active",
      !!document.querySelector(".co-detail-screen, .co-dashboard, .hs-main-wrap, .cd-dashboard"),
    );
    coNavigation();
    if(st.view==='exec') { coLabelDashboard(); coOrganizeDetail(); }
  } finally {
    CO.cache = null;
  }
};
document.addEventListener("change", (e) => {
  if (e.target.matches("[data-co-history-mode]")) {
    CO.demoHistory = e.target.value === "demo";
    document.getElementById("cx-modal")?.remove();
    render();
    ceoHistory();
  }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest(
    "[data-co-scope],[data-co-filters],[data-co-present],[data-co-outlook],[data-co-esg]",
  );
  if (!b) return;
  if (b.dataset.coScope) {
    const s = b.dataset.coScope;
    cxModal(
      s + " · performance",
      ceoFrequencyBox(ceoScope(hsP(), s)) +
        `<button class="cx-btn" data-co-register-scope="${s}">Open reporting register ↗</button>`,
    );
  }
  if (b.hasAttribute("data-co-filters"))
    cxModal("Dashboard filters", hsFilters());
  if (b.hasAttribute("data-co-outlook"))
    cxModal(
      "Leadership risk outlook",
      ceoProtectionPanel(hsP(), "Corporation"),
    );
  if (b.hasAttribute("data-co-esg"))
    cxModal("HSSE evidence and business assurance", frEvidenceMatrix(hsP()));
  if (b.hasAttribute("data-co-present")) {
    document.documentElement
      .requestFullscreen?.()
      .catch(() => toast("Use browser full screen (F11)."));
  }
});
const coReportPayload = hsExecPayload;
hsExecPayload = function (scope) {
  const d = coReportPayload(scope),
    P = ceoScope(hsP(), scope);
  d.history = ceoHistoryData();
  d.riskDistribution = FR.distribution(frFindings(P)).map((x) => ({
    label: x.level,
    count: x.count,
    color: x.color,
  }));
  d.platformRates = ["Corporation", "Construction", "Non-Construction"].map(
    (s) => {
      const m = hsExecMetrics(ceoScope(P, s), hsCutoff());
      return {
        name: s,
        hours: m.hrs,
        ltifr: m.hrs ? m.ltifr : null,
        ltisr: m.hrs ? m.ltisr : null,
        trcf: m.hrs ? m.trcf : null,
        targets: hsKpiCfg().targets[s],
      };
    },
  );
  d.sourceUrl = location.origin;
  d.workforce = coWorkforce(P);
  d.geography = Object.entries(hsGroup(P, "country")).map(([country, ps]) => ({
    country,
    ...coWorkRow(ps),
  }));
  d.register = frRows(P)
    .filter((r) => r.status !== "Draft")
    .map((r) => ({
      reference: r.case_no,
      id: r.id,
      title: r.title,
      type: r.body.formName || r.case_type,
      project: projName(r.project),
      status: r.status,
      date: r.created_at,
    }));
  d.actionRegister = L.actions
    .filter((a) => hsIds(P).has(a.project))
    .map((a) => ({
      reference: a.caseNo,
      title: a.title,
      project: projName(a.project),
      owner: a.ownerName || a.owner,
      due: a.due ? new Date(a.due).toISOString().slice(0, 10) : "",
      status: a.closedAt ? "Closed" : a.status || "Open",
      priority: a.priority,
    }));
  d.projects = P.map((p) => {
    const m = hsExecMetrics([p], hsCutoff()),
      state = gmState(p, frFindings([p]), frRows([p]));
    return {
      name: p.name,
      division: p.division || "",
      platform: p.platform || "Construction",
      country: p.country || "",
      hours: m.hrs,
      trcf: m.hrs ? m.trcf : null,
      over: m.over,
      closure: m.closePct,
      health: state.label,
    };
  });
  return d;
};

function coWorkRow(P) {
  const m = hsExecMetrics(P, hsCutoff()),
    lm = m.M.filter((r) => r.data.month === m.lastM),
    safe = hsSafe(P);
  return {
    employees: hsSum(lm, "empHead"),
    contractors: hsSum(lm, "conHead"),
    employeeHours: hsSum(m.M, "empHours"),
    contractorHours: hsSum(m.M, "conHours"),
    safeHours: safe.hours,
    safeDays: safe.days,
    projects: P.length,
  };
}
function coWorkforce(P) {
  return [
    "Corporation",
    "Construction",
    "Non-Construction",
    ...(P.some((p) => /office/i.test(p.platform || "")) ? ["Offices"] : []),
  ].map((name) => ({
    name,
    ...coWorkRow(
      name === "Corporation"
        ? P
        : name === "Offices"
          ? P.filter((p) => /office/i.test(p.platform || ""))
          : ceoScope(P, name),
    ),
  }));
}
function coPlatformLabel(s) { if(s==='Corporate')return 'Corporation';if(s==='Construction Sites')return 'Construction platform';if(s==='Non-Construction Sites')return 'Nonconstruction platform';return s==='Construction'?'Construction platform':s==='Non-Construction'||s==='Operations'?'Nonconstruction platform':s; }
function coScopeTabs() {
  const h = hsInit(),
    offices = myProjects().some((p) => /office/i.test(p.platform || ""));
  return `<nav class="co-scope-tabs" aria-label="Platform and dashboard selection"><span>Reporting platform</span>${[
    ["", "Corporation"],
    ["Construction", "Construction platform"],
    ["Non-Construction", "Nonconstruction platform"],
    ["Offices", "Offices"],
  ]
    .map(
      ([id, label]) =>
        `<button data-co-platform="${id}" aria-pressed="${h.plat === id}" ${id === "Offices" && !offices ? 'disabled title="No office projects configured"' : ""}>${label}</button>`,
    )
    .join("")}</nav>`;
}
function coExposure(P) {
  const rows = coWorkforce(P),
    table = (headers, fields, values = rows) =>
      `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${values.map((r) => `<tr><th>${esc(coPlatformLabel(r.name))}</th>${fields.map((k) => `<td>${k.includes("Hours") ? (r[k] / 1e6).toFixed(2) + "M" : coN(r[k])}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
    geo = Object.entries(hsGroup(P, "country")).map(([name, ps]) => ({
      name,
      ...coWorkRow(ps),
    }));
  return `<section class="co-exposure" aria-label="Manpower and exposure overview">${[
    [
      "Manpower",
      table(
        ["Company", "Employees", "Contractors"],
        ["employees", "contractors"],
      ),
    ],
    [
      "Hours worked",
      table(
        ["Company", "Employees", "Contractors"],
        ["employeeHours", "contractorHours"],
      ),
    ],
    [
      "Safe work hours",
      table(["Company", "Safe hours", "Safe days"], ["safeHours", "safeDays"]),
    ],
    [
      "Geo-wise",
      table(
        ["Country", "Safe hours", "Safe days"],
        ["safeHours", "safeDays"],
        geo,
      ),
    ],
  ]
    .map(([title, html]) => `<section><h3>${title}</h3>${html}</section>`)
    .join("")}</section>`;
}
function coDashboards() {
  CO.railOpen = !CO.railOpen; document.body.classList.toggle('co-rail-open',CO.railOpen);
}
function coDashboardTitle() {
  if (!CD.detail && hsInit().sec==='exe') return CL.dashboard==='summary'?'Leadership overview':CL.dashboard==='portfolio'?'Portfolio & safety cycle':'Risk & ESG evidence';
  return HSEC.find(x=>x[0]===hsInit().sec)?.[1] || 'Executive dashboard';
}
function coRemember() {
  if (CO.restoring) return;
  const v = {
    view: st.view,
    hs: JSON.parse(JSON.stringify(hsInit())),
    detail: CD.detail,
    dashboard: CL.dashboard,
    country: st.country,
    filter: JSON.parse(JSON.stringify(CX.filter || {})),
    row: CX.row?.id,
  };
  const old = CO.back.at(-1);
  if (JSON.stringify(old) !== JSON.stringify(v)) CO.back.push(v);
  if (CO.back.length > 30) CO.back.shift();
}
const coGoBase = go;
go = function (view) {
  if (view !== st.view) coRemember();
  return coGoBase(view);
};
function coHome() {
  document.getElementById("cx-modal")?.remove();
  CD.detail = false;
  CL.dashboard = "summary";
  hsInit().sec = "exe";
  go("exec");
}
async function coBack() {
  if (st.view === "caseedit" && CX.editing && CX.dirty) {
    try {
      await cxSave();
      CX.editing = false;
    } catch (e) {
      cxFail(e);
      return;
    }
  }
  const v = CO.back.pop();
  if (!v) return coHome();
  CO.restoring = true;
  try {
    document.getElementById("cx-modal")?.remove();
    st.hs = v.hs;
    st.country = v.country;
    CD.detail = v.detail;
    CL.dashboard = v.dashboard;
    CX.filter = v.filter;
    if (v.view === "caseedit" && v.row) await cxOpen(v.row);
    else coGoBase(v.view);
  } finally {
    CO.restoring = false;
  }
}
function coNavigation() {
  document.querySelectorAll(".co-mobile-menu").forEach(n=>n.remove());
  document.querySelectorAll(".co-return-nav").forEach((n) => n.remove());
  const main = document.querySelector("main");
  if (!main) return;
  document.querySelectorAll('.co-side-rail').forEach(n=>n.remove());
  document.body.classList.toggle('co-has-rail', st.view==='exec');
  if(st.view==='exec') {
    const rail=document.createElement('nav');rail.className='co-side-rail';rail.setAttribute('aria-label','Dashboard views');
    const selected=!CD.detail&&hsInit().sec==='exe'?(CL.dashboard==='summary'?'overview':CL.dashboard):hsInit().sec;
    const views=[['overview','Leadership overview'],...HSEC.filter(x=>x[0]!=='exe').map(x=>[x[0],x[1]]),['portfolio','Portfolio & safety cycle'],['evidence','Risk & ESG evidence'],['scorecard','Project scorecards']];
    rail.innerHTML='<strong>Dashboards</strong><button class=co-mobile-close data-co-dashboards>Close menu ×</button><label class=co-agenda-search>Find a dashboard<input data-co-agenda-search placeholder=Search… aria-label="Search dashboards"></label><div class=co-quick-links><button data-co-search>⌕ Search records</button><button data-co-checklists>☑ Checklists</button></div>'+views.map(([id,name])=>`<button data-co-view="${id}" aria-current="${id===selected?'page':'false'}">${esc(name)}</button>`).join('');main.prepend(rail);const menu=document.createElement('button');menu.className='co-mobile-menu';menu.dataset.coDashboards='';menu.textContent='☰ Dashboards & checklists';rail.after(menu);document.body.classList.toggle('co-rail-open',!!CO.railOpen);
  }
  const summary = !!document.querySelector(".co-dashboard");
  if (!summary) {
    const bar = document.createElement("nav");
    bar.className = "co-return-nav";
    bar.setAttribute("aria-label", "Return navigation");
    bar.innerHTML =
      "<button data-co-back>← Back</button><button data-co-home>Leadership overview</button><button data-co-dashboards>Dashboards ☰</button>";
    main.prepend(bar);
  }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest(
    "[data-co-platform],[data-co-dashboards],[data-co-view],[data-co-back],[data-co-home]",
  );
  if (!b) return;
  if (b.hasAttribute("data-co-platform")) {
    coRemember();
    hsInit().plat = b.dataset.coPlatform;
    hsInit().proj = "";
    render();
  }
  if (b.hasAttribute("data-co-dashboards")) coDashboards();
  if (b.hasAttribute("data-co-back")) void coBack();
  if (b.hasAttribute("data-co-home")) coHome();
  if (b.dataset.coView) {
    coRemember();
    document.getElementById("cx-modal")?.remove();
    const v = b.dataset.coView;
    CO.railOpen=false;document.body.classList.remove("co-rail-open");
    if (v === "scorecard") go("sc");
    else {
      if (["overview", "portfolio", "evidence"].includes(v)) {
        CD.detail = false;
        hsInit().sec = "exe";
        CL.dashboard = v === "overview" ? "summary" : v;
      } else {
        CD.detail = true;
        hsInit().sec = v;
      }
      go("exec");
      render();
    }
  }
});
ceoDownloads = function () {
  if (nxLoading()) return;
  cxModal(
    "Download dashboard brief",
    `<p>Current filters: <b>${esc(hsTitle())}</b>. A short summary of the selected dashboard. Source registers are downloaded separately.</p><label>Platform<select id="co-export-scope">${["Corporation", "Construction", "Non-Construction"].map((s) => `<option value="${s}" ${s === (hsInit().plat || "Corporation") ? "selected" : ""}>${coPlatformLabel(s)}</option>`).join("")}</select></label><div class="cx-actions"><button data-co-export="docx">Word · short brief</button><button data-co-export="xlsx">Excel · data & charts</button><button data-co-export="pptx">PowerPoint · 3 slides</button><button data-co-export="pdf">PDF · one-page summary</button></div><p>PowerPoint: cover → selected dashboard on slide 2 → concise summary. No long appendices. Historical demo data stays labelled.</p><div class="cx-actions"><button data-ceo-history>Five-year performance</button><button data-ceo-register>Record register CSV</button></div>`,
  );
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-co-export]");
  if (b)
    void coDownload(
      document.getElementById("co-export-scope").value,
      b.dataset.coExport,
      b,
    );
});
function coLoadCapture() {
  if (window.html2canvas) return Promise.resolve();
  if (CO.captureLoader) return CO.captureLoader;
  CO.captureLoader = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "vendor/html2canvas-1.4.1.min.js";
    s.onload = resolve;
    s.onerror = () => {
      CO.captureLoader = null;
      reject(Error("Dashboard capture could not load. Please retry."));
    };
    document.head.appendChild(s);
  });
  return CO.captureLoader;
}
async function coDownload(scope, fmt, button) {
  if (CO.exporting)
    return toast(
      "A report is already being prepared. Please wait for its download.",
    );
  CO.exporting = true;
  window.navoExporting = true;
  const label = button.textContent,
    includeRegisters =
      false,
    saved = {
      hs: JSON.parse(JSON.stringify(hsInit())),
      view: st.view,
      detail: CD.detail,
      dashboard: CL.dashboard,
    };
  button.disabled = true;
  button.textContent = "Preparing dashboard brief…";
  try {
    document.getElementById("cx-modal")?.remove();
    hsInit().plat = scope === "Corporation" ? "" : scope;
    st.view = "exec";
    render();
    const payload = hsExecPayload(scope);
    payload.includeRegisters = includeRegisters;
    payload.dashboardTitle = coDashboardTitle();
    payload.dashboardId = !CD.detail && hsInit().sec==='exe' ? CL.dashboard : hsInit().sec;
    payload.brief = true;
    payload.dashboardTab=coCurrentTab()[0];
    payload.dashboardTitle=coViewTitle();
    payload.reportSections=coBriefSections(hsP());
    payload.scope=coPlatformLabel(payload.scope);
    [payload.workforce,payload.platformRates].forEach(rows=>rows?.forEach(r=>r.name=coPlatformLabel(r.name)));
    payload.projects?.forEach(r=>r.platform=coPlatformLabel(r.platform));
    if (["pdf", "docx", "xlsx", "pptx"].includes(fmt)) {
      await coLoadCapture();
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      await new Promise((resolve) => {
        const loading = [];
        GM.map?.eachLayer((layer) => {
          if (typeof layer.isLoading === "function" && layer.isLoading())
            loading.push(layer);
        });
        if (!loading.length) return resolve();
        const deadline = setTimeout(resolve, 3500);
        Promise.all(
          loading.map(
            (layer) => new Promise((done) => layer.once("load", done)),
          ),
        ).then(() => {
          clearTimeout(deadline);
          resolve();
        });
      });
      const node = document.querySelector(".co-detail-screen") || document.querySelector(".co-dashboard") || document.querySelector(".hs-main-wrap, .cd-dashboard"),
        canvas = await html2canvas(node, {
          scale: 1,
          ignoreElements: element=>element.matches?.(".co-detail-screen > header button, .co-detail-screen > header .cd-tools"),
          useCORS: true,
          logging: false,
          backgroundColor:
            getComputedStyle(document.documentElement)
              .getPropertyValue("--cd-bg")
              .trim() || "#f0f4fa",
          imageTimeout: 10000,
        });
      payload.dashboardImage = canvas.toDataURL("image/jpeg", 0.85);
    }
    const r = await fetch("/api/report?fmt=" + fmt, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw Error((await r.text()).slice(0, 200));
    const url = URL.createObjectURL(await r.blob()),
      a = document.createElement("a");
    a.href = url;
    a.download = scope + "-" + payload.dashboardTitle.replace(/[^a-z0-9]+/gi,"-") + "-Brief." + fmt;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast("Dashboard brief downloaded");
  } catch (e) {
    toast("Report failed: " + e.message);
  } finally {
    st.hs = saved.hs;
    st.view = saved.view;
    CD.detail = saved.detail;
    CL.dashboard = saved.dashboard;
    window.navoExporting = false;
    render();
    button.disabled = false;
    button.textContent = label;
    CO.exporting = false;
  }
}
const coCaseOpenBase = cxOpen;
cxOpen = async function (id) {
  if (st.view !== "caseedit" || CX.row?.id !== id) coRemember();
  return coCaseOpenBase(id);
};
window.addEventListener(
  "click",
  (e) => {
    if (
      e.target.closest(
        "[data-hsec],[data-cl-dashboard],[data-cd-detail],[data-cd-compact]",
      )
    )
      coRemember();
  },
  true,
);
const coLegacyExport = hsExport;
hsExport = function (scope, format, button) {
  return format === "pdf"
    ? coLegacyExport(scope, format, button)
    : coDownload(scope, format, button);
};
render();

function coLabelDashboard(){
 document.querySelectorAll('.hs-tabs [data-htab], button[data-hx=plat]').forEach(n=>n.textContent=coPlatformLabel(n.textContent.trim()));
 document.querySelectorAll('tr[data-hx=plat]').forEach(tr=>{const cell=tr.cells[0];if(cell)cell.textContent=coPlatformLabel(cell.textContent.trim());});
 document.querySelectorAll('select[data-hf=plat] option').forEach(o=>{const v=o.value;o.textContent=coPlatformLabel(o.textContent);o.value=v;});
}
document.addEventListener('input',e=>{if(e.target.matches('[data-co-agenda-search]')){const q=e.target.value.trim().toLowerCase();document.querySelectorAll('.co-side-rail [data-co-view]').forEach(b=>b.hidden=!b.textContent.toLowerCase().includes(q));}});
document.addEventListener('click',e=>{
 if(e.target.closest('[data-co-search]'))cxModal('Search records','<p>Search across accessible case references, titles and descriptions.</p><label>Search<input id=co-record-query placeholder="Case number, title or description"></label><button data-co-run-search>Search all records</button>');
 if(e.target.closest('[data-co-run-search]')){CX.filter={...CX.filter,q:document.getElementById('co-record-query').value};document.getElementById('cx-modal')?.remove();CO.railOpen=false;go('casehome');}
});

function coChecklistLibrary(){
 const lib=clLib().filter(c=>c.active!==false);
 cxModal('Checklist library',`<p>Find a checklist, review its questions, then open Inspections to choose the project and start reporting.</p><label>Search checklists<input data-co-checklist-search placeholder="Name or platform"></label><div class=co-checklist-library>${lib.map(c=>`<details data-co-checklist-item><summary>${esc(c.name)} <small>· ${(c.q||[]).filter(q=>q.on!==false).length} questions · ${esc((c.platforms||[]).map(coPlatformLabel).join(', ')||'All platforms')}</small></summary><ol>${(c.q||[]).filter(q=>q.on!==false).map(q=>`<li>${esc(q.t)}${q.c?' · Critical control':''}</li>`).join('')}</ol></details>`).join('')||'<p>No active checklists are configured.</p>'}</div><div class=cx-actions><button data-co-inspections>Open inspections</button>${myRole()==='admin'?'<button data-co-manage-checklists>Manage checklist templates</button>':''}</div>`);
}
document.addEventListener('input',e=>{if(e.target.matches('[data-co-checklist-search]')){const q=e.target.value.toLowerCase().trim();document.querySelectorAll('[data-co-checklist-item]').forEach(n=>n.hidden=!n.textContent.toLowerCase().includes(q));}});
document.addEventListener('click',e=>{if(e.target.closest('[data-co-checklists]'))coChecklistLibrary();for(const [sel,route] of [['[data-co-inspections]','inspm'],['[data-co-manage-checklists]','chk']])if(e.target.closest(sel)){document.getElementById('cx-modal')?.remove();CO.railOpen=false;go(route);}});

function coCurrentTab(){const h=hsInit(),sec=HSEC.find(x=>x[0]===h.sec);return sec?.[2].find(x=>x[0]===(h.tab[h.sec]||sec[2][0][0]))||['',''];}
function coViewTitle(){const title=coDashboardTitle(),tab=coCurrentTab();return CD.detail&&tab[1]&&tab[1]!==title?title+' / '+coPlatformLabel(tab[1]):title;}
function coBriefSections(P){
 const h=hsInit(),tab=coCurrentTab()[0],m=hsExecMetrics(P,hsCutoff());let headers=['Indicator','Value'],rows=[];
 if(h.sec==='es'&&tab==='griev'){
  const G=hsRec(P,'grievance');rows=[['Total grievances',G.length],['New',G.filter(r=>r.data.status==='New').length],['In progress',G.filter(r=>r.data.status==='In progress').length],['Closed',G.filter(r=>r.data.status==='Closed').length],['Open over 28 days',G.filter(r=>r.data.status!=='Closed'&&Date.now()-r.ts>28*864e5).length]];
 }else if(h.sec==='es'){
  const A=hsRec(P,'accommodation'),latest=new Map();A.forEach(r=>{if(!latest.has(r.project)||r.ts>latest.get(r.project).ts)latest.set(r.project,r);});const X=[...latest.values()],sum=k=>X.reduce((t,r)=>t+(+r.data[k]||0),0);rows=[['Assessments in period',A.length],['Projects with assessments',X.length],['Workers assessed',sum('workers')],['Compliant items',sum('compliant')],['Non-compliant items',sum('nonCompliant')],['Partially compliant items',sum('partial')]];
 }else if(h.sec==='health'){
  const C=hsDivCards(P);headers=['Division','Quantitative','Qualitative','Overall','Health'];rows=C.slice(0,6).map(r=>[r.p.name,r.score==null?null:r.c.quant,r.score==null||!r.c.hasQual?null:r.c.qual,r.score,r.status||'No data']);
  if(tab==='actual'||tab==='ind'){const table=document.querySelector('.hs-body table');if(table){headers=[...table.querySelectorAll('thead th')].slice(0,7).map(n=>n.textContent.trim());rows=[...table.querySelectorAll('tbody tr')].slice(0,6).map(tr=>[...tr.cells].slice(0,7).map(n=>n.textContent.trim()));}}
 }else if(h.sec==='aud'){
  const kind={corp:'Corporate',psm:'Process Safety',oshe:'OSHE'}[tab]||'Corporate',F=hsRec(P,'finding').filter(r=>r.data.audit===kind),A=hsRec(P,'audit').filter(r=>r.data.audit===kind),scored=A.filter(r=>r.data.score!==null&&r.data.score!==undefined&&r.data.score!==''&&Number.isFinite(Number(r.data.score)));rows=[['Audit type',kind],['Recorded audits',A.length],['Findings',F.length],['Closed findings',F.filter(r=>r.data.status==='Closed').length],['Overdue open findings',F.filter(r=>r.data.status!=='Closed'&&r.data.due&&r.data.due<Date.now()).length],['Average recorded score',scored.length?scored.reduce((t,r)=>t+Number(r.data.score),0)/scored.length:null]];
 }else if(h.sec==='exec'&&tab==='waste'){
  const M=hsMon(P),sum=k=>M.length?hsSum(M,k):null;rows=[['Non-hazardous disposed',sum('nhDisposed')],['Non-hazardous recycled',sum('nhRecycled')],['Hazardous disposed',sum('hzDisposed')],['Hazardous recycled',sum('hzRecycled')],['Construction waste disposed',sum('faDisposed')],['Construction waste recycled',sum('faRecycled')]];headers=['Reported waste measure','Recorded quantity (source units)'];
 }else if(h.sec==='exec'&&tab==='close'){
  rows=[['Actions',m.acts],['Open',m.open],['Closed',m.closed],['Overdue',m.over],['Closure %',m.closePct]];
 }else if((h.sec==='inj'&&tab==='inc')||(h.sec==='acc'&&tab==='aud')){
  const R=h.sec==='acc'?hsRec(P,'finding'):hsR(P),groups=new Map();R.forEach(r=>{const k=h.sec==='acc'?(r.data.audit||'Unclassified audit'):(incCat(r)||'Unclassified incident');groups.set(k,(groups.get(k)||0)+1);});const items=[...groups].sort((a,b)=>b[1]-a[1]);rows=items.slice(0,5);if(items.length>5)rows.push(['Other categories',items.slice(5).reduce((t,r)=>t+r[1],0)]);if(!rows.length)rows=[['Recorded cases',0]];
 }else if(h.sec==='inj'||h.sec==='acc'){
  rows=[['Fatalities',m.fat],['Lost time injuries',m.lti],['Lost workdays',m.lost],['Recordables',m.trc],['First aid',m.fac],['Near misses',m.nm]];
 }else if(h.sec==='kpi'){
  const scopes=tab==='all'?['Corporation','Construction','Non-Construction']:[tab];headers=['Platform','LTIFR','LTISR','TRCF'];rows=scopes.map(scope=>{const v=hsExecMetrics(ceoScope(P,scope),hsCutoff());return[coPlatformLabel(scope),v.hrs?v.ltifr:null,v.hrs?v.ltisr:null,v.hrs?v.trcf:null];});
 }else if(!CD.detail&&CL.dashboard==='evidence'){rows=FR.distribution(frFindings(P)).map(r=>[r.label||r.level,r.count]);
 }else if(!CD.detail&&CL.dashboard==='portfolio'){headers=['Project','Platform','Country','Health'];rows=P.slice(0,6).map(p=>[p.name,coPlatformLabel(p.platform||'Construction'),p.country,gmState(p,frFindings([p]),frRows([p])).label]);
 }else{rows=[['Projects',P.length],['Exposure hours',m.hrs],['Recordable cases',m.trc],['Open actions',m.open],['Overdue actions',m.over],['Closure %',m.closePct]];}
 return [{title:coViewTitle(),headers,rows}];
}
function coOrganizeDetail(){
 if(!CD.detail){coOrganizePortfolio();return;}const body=document.querySelector('.hs-body'),wrap=document.querySelector('.hs-main-wrap');if(!body||!wrap)return;
 document.querySelectorAll('.nx-executive-hero,.nx-dashboard-tabs,.cd-return,.nx-data-note').forEach(n=>n.remove());
 const tabs=wrap.querySelector('.hs-tabs'),band=wrap.querySelector('.hs-band');if(tabs&&band)band.after(tabs);
 const sec=coBriefSections(hsP())[0],screen=document.createElement('section');screen.className='co-detail-screen';screen.setAttribute('aria-label',coViewTitle());
 screen.innerHTML=`<header><div><span class=co-eyebrow>${esc(brand().name)} / ANALYTICS</span><h1>${esc(coViewTitle())}</h1><p>${esc(hsTitle())}${hsIsSample()?' · ILLUSTRATIVE DEMONSTRATION':''}</p></div><button data-co-filters>Filters</button></header><div class=co-detail-metrics>${sec.headers.length===2?sec.rows.slice(0,6).map(([k,v])=>`<div><span>${esc(k)}</span><b>${v==null?'Not recorded':typeof v==='number'?coN(v):esc(String(v))}</b></div>`).join(''):`<div class=co-detail-table><table class=co-table><thead><tr>${sec.headers.map(n=>`<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>${sec.rows.map(r=>`<tr>${r.map(v=>`<td>${v==null?'—':esc(typeof v==='number'?v.toFixed(2):String(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}</div><div class=co-detail-charts></div><footer>Selected view and current filters · open supporting detail for the remaining breakdowns and source evidence.</footer>`;
 const grid=screen.querySelector('.co-detail-charts');const cards=[...body.querySelectorAll('.hc')].filter(n=>!n.parentElement.closest('.hc'));
 cards.slice(0,2).forEach(n=>grid.append(n));
 if(!grid.children.length)grid.innerHTML='<p class=co-detail-empty>No chart data is available for this selection. Review the recorded indicators above or open supporting detail.</p>';
 const detail=document.createElement('details');detail.className='co-supporting';detail.open=!!CO.supportingOpen;detail.innerHTML='<summary>Supporting detail & source evidence</summary>';const content=document.createElement('div');while(body.firstChild)content.append(body.firstChild);detail.append(content);body.append(screen,detail);
 if(hsInit().sec==='health'&&!hsDivCards(hsP()).some(r=>r.score!=null))grid.innerHTML='<div class=co-detail-empty><h3>Site health is not calculated yet</h3><p>Add the required performance data and qualitative review for the selected period. Missing data is not a zero score.</p><button data-go=hdata>Open performance data</button></div>';
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-co-register-scope]');if(!b)return;coRemember();const P=ceoScope(hsP(),b.dataset.coRegisterScope);const ids=new Set(P.map(p=>p.id));const records=cxAll().filter(r=>ids.has(r.project)&&r.status!=='Draft'&&hsIn(new Date(r.created_at).getTime()));document.getElementById('cx-modal')?.remove();NX.quick='';NX.page=1;CX.filter={recordIds:records.map(r=>r.id)};CX.drillLabel=coPlatformLabel(b.dataset.coRegisterScope)+' · '+hsTitle();go('casehome');});

function coOrganizePortfolio(){
 if(CL.dashboard==='summary')return;const root=document.querySelector('.cd-dashboard');if(!root)return;
 const evidence=CL.dashboard==='evidence',cards=evidence?[root.querySelector('.fr-risk'),[...root.querySelectorAll('.xsec')].find(n=>n.querySelector('h3')?.textContent.startsWith('Recordable incidents'))]:[root.querySelector('.gm-card'),root.querySelector('.cd-portfolio')];
 const selected=cards.filter(Boolean);selected.forEach(n=>n.remove());root.querySelector('.cl-dashboard-tabs')?.remove();
 const screen=document.createElement('section');screen.className='co-detail-screen co-portfolio-screen';screen.innerHTML=`<header><div><span class=co-eyebrow>${esc(brand().name)} / ANALYTICS</span><h1>${esc(coViewTitle())}</h1><p>${esc(hsTitle())}${hsIsSample()?' · ILLUSTRATIVE DEMONSTRATION':''}</p></div><div><button data-ceo-downloads>Download brief</button><button data-co-filters>Filters</button></div></header><div class=co-detail-charts></div><footer>${evidence?'Percentages use eligible findings in the current filters.':'Project locations and first six projects in the export summary.'} Open supporting detail for all breakdowns and source evidence.</footer>`;
 const grid=screen.querySelector('.co-detail-charts');selected.forEach(card=>{card.classList.add('co-standalone-card');grid.append(card);});
 const detail=document.createElement('details');detail.className='co-supporting';detail.open=!!CO.supportingOpen;detail.innerHTML='<summary>Supporting detail & source evidence</summary>';const content=document.createElement('div');while(root.firstChild)content.append(root.firstChild);detail.append(content);root.append(screen,detail);
 if(evidence){const matrix=selected[0]?.querySelector('.tbl');if(matrix)content.prepend(matrix);}
 const map=GM.map;if(map)requestAnimationFrame(()=>{if(GM.map===map&&map.getContainer()?.isConnected){map.invalidateSize();gmMountFit();}});
}

document.addEventListener('toggle',e=>{if(e.target.matches?.('.co-supporting')&&e.target.isConnected)CO.supportingOpen=e.target.open;},true);
