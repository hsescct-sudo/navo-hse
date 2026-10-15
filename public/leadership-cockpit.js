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
      return `<tr><th><button data-co-scope="${s}">${s === "Non-Construction" ? "Operations" : s} ↗</button></th>${["ltifr", "ltisr", "trcf"].map((k) => `<td class="${m.hrs && m[k] > cfg[s][k] ? "co-red" : "co-green"}"><b>${m.hrs ? m[k].toFixed(2) : "—"}</b><small>target ${cfg[s][k].toFixed(2)}</small></td>`).join("")}</tr>`;
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
      return `<tr><th>${s === "Non-Construction" ? "Operations" : s}</th><td>${coN(v.manpower)}</td><td>${(Number(v.hrs || 0) / 1e6).toFixed(1)}M</td><td>${ps.length}</td></tr>`;
    })
    .join("")}</tbody></table>`;
  el.className = "cd-dashboard cl-analytics co-dashboard";
  el.innerHTML = `<header class="co-heading cd-heading"><div><span class="co-eyebrow">${esc(brand().name)} / LEADERSHIP OVERVIEW</span><h1>Your company. One clear view.</h1><p>${esc(hsTitle())}${hsIsSample() ? " · ILLUSTRATIVE DEMONSTRATION" : ""}</p></div><div class="cd-tools"><button data-ceo-downloads>Download reports ↓</button><button data-co-present>Present ↗</button>${cdAppearance()}<button data-co-filters>Filters</button><button data-co-dashboards>All dashboards ▾</button></div></header>
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
  requestAnimationFrame(() => {
    GM.map?.invalidateSize();
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
      !!document.querySelector(".co-dashboard"),
    );
    coNavigation();
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
        `<button class="cx-btn" data-go="casehome">Open reporting register ↗</button>`,
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
function coScopeTabs() {
  const h = hsInit(),
    offices = myProjects().some((p) => /office/i.test(p.platform || ""));
  return `<nav class="co-scope-tabs" aria-label="Platform and dashboard selection"><span>Reporting platform</span>${[
    ["", "Corporation"],
    ["Construction", "Construction"],
    ["Non-Construction", "Operations"],
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
      `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${values.map((r) => `<tr><th>${esc(r.name === "Non-Construction" ? "Operations" : r.name)}</th>${fields.map((k) => `<td>${k.includes("Hours") ? (r[k] / 1e6).toFixed(2) + "M" : coN(r[k])}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
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
  cxModal(
    "All dashboards",
    `<p>Every dashboard remains available. Select a view, then use Back or Leadership overview to return.</p><div class="co-dashboard-menu"><button data-co-view="overview">Leadership overview</button><button data-co-view="portfolio">Portfolio & safety cycle</button><button data-co-view="evidence">Risk & ESG evidence</button>${HSEC.map(([id, name]) => `<button data-co-view="${id}">${esc(name)}</button>`).join("")}<button data-co-view="scorecard">Project performance scorecards</button></div>`,
  );
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
  document.querySelectorAll(".co-return-nav").forEach((n) => n.remove());
  const main = document.querySelector("main");
  if (!main) return;
  const summary = !!document.querySelector(".co-dashboard");
  if (!summary) {
    const bar = document.createElement("nav");
    bar.className = "co-return-nav";
    bar.setAttribute("aria-label", "Return navigation");
    bar.innerHTML =
      "<button data-co-back>← Back</button><button data-co-home>Leadership overview</button><button data-co-dashboards>All dashboards ▾</button>";
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
    "Download complete report",
    `<p>Current filters: <b>${esc(hsTitle())}</b>. Each format contains the overview and the complete accessible supporting tables for this scope.</p><label>Platform<select id="co-export-scope">${["Corporation", "Construction", "Non-Construction"].map((s) => `<option ${s === (hsInit().plat || "Corporation") ? "selected" : ""}>${s}</option>`).join("")}</select></label><div class="cx-actions"><button data-co-export="docx">Word · full report</button><button data-co-export="xlsx">Excel · data & charts</button><button data-co-export="pptx">PowerPoint · full report</button><button data-co-export="pdf">PDF · one-page summary</button></div><label><input type="checkbox" id="co-export-registers" checked> Include complete source and action registers (may add many pages)</label><p>PowerPoint: cover → complete dashboard on slide 2 → detailed sections and registers. Historical demo data stays labelled.</p><div class="cx-actions"><button data-ceo-history>Five-year performance</button><button data-ceo-register>Record register CSV</button></div>`,
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
  const label = button.textContent,
    includeRegisters =
      document.getElementById("co-export-registers")?.checked !== false,
    saved = {
      hs: JSON.parse(JSON.stringify(hsInit())),
      view: st.view,
      detail: CD.detail,
      dashboard: CL.dashboard,
    };
  button.disabled = true;
  button.textContent = "Preparing full report…";
  try {
    document.getElementById("cx-modal")?.remove();
    hsInit().plat = scope === "Corporation" ? "" : scope;
    CD.detail = false;
    CL.dashboard = "summary";
    st.view = "exec";
    render();
    const payload = hsExecPayload(scope);
    payload.includeRegisters = includeRegisters;
    if (fmt !== "pdf") {
      await coLoadCapture();
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      const node = document.querySelector(".co-dashboard"),
        canvas = await html2canvas(node, {
          scale: 1,
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
    a.download = scope + "-Complete-HSSE-Report." + fmt;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast("Complete report downloaded");
  } catch (e) {
    toast("Report failed: " + e.message);
  } finally {
    st.hs = saved.hs;
    st.view = saved.view;
    CD.detail = saved.detail;
    CL.dashboard = saved.dashboard;
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
