"""NAVO email automation (Vercel Python function).

GET  /api/notify            Daily run from Vercel Cron. Requires "Authorization: Bearer <CRON_SECRET>".
POST /api/notify?test=1     Send the daily digest now. Requires a signed-in HSE Admin.

Sends, to the recipients saved in Automations → Email delivery:
  - every day: overdue and escalated actions, actions due within 3 days, serious and high-potential incidents;
  - on the 1st and 15th (Riyadh time): CEO HSSE summary with year-to-date rates against target;
  - on the 1st: environmental summary for the previous month.

Environment variables (Vercel → Settings → Environment Variables):
  RESEND_API_KEY, NAVO_MAIL_FROM, NAVO_SUPABASE_SERVICE_KEY, CRON_SECRET
  optional: NAVO_SUPABASE_URL, NAVO_SUPABASE_PUBLISHABLE_KEY, NAVO_APP_URL
The service key stays on the server. Nothing is sent until all required variables are set.
"""
import html
import json
import logging
import os
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler

URL = os.environ.get("NAVO_SUPABASE_URL", "https://gvktcleqiidtmgqxbzsy.supabase.co")
PUB = os.environ.get("NAVO_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_9N-3NV87mniwgZB0dw3IVA_bqK3ppNb")
APP = os.environ.get("NAVO_APP_URL", "https://navo-hse.vercel.app")
RIYADH = timezone(timedelta(hours=3))
DAY_MS = 86_400_000
LTI = ("Fatality", "Serious Injury", "Lost Time (> 7 days)", "Lost Time")
REC = LTI + ("Restricted Work", "Medical Treatment")
DEFAULT_TARGETS = {"ltifr": 0.13, "ltisr": 2.33, "trcf": 0.11}


def _http(url, method="GET", headers=None, body=None, timeout=20):
    req = urllib.request.Request(url, method=method, headers=headers or {}, data=None if body is None else json.dumps(body).encode())
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def db(table, query):
    """Read with the service key (server only). query is a PostgREST query string."""
    key = os.environ["NAVO_SUPABASE_SERVICE_KEY"]
    return _http(f"{URL}/rest/v1/{table}?{query}", headers={"apikey": key, "Authorization": "Bearer " + key}) or []


def send(to, subject, body_html):
    return _http("https://api.resend.com/emails", "POST", {"Authorization": "Bearer " + os.environ["RESEND_API_KEY"], "Content-Type": "application/json"},
                 {"from": os.environ["NAVO_MAIL_FROM"], "to": to, "subject": subject, "html": body_html})


def missing_config():
    return [k for k in ("RESEND_API_KEY", "NAVO_MAIL_FROM", "NAVO_SUPABASE_SERVICE_KEY") if not os.environ.get(k)]


# ------------------------------------------------------------------ content
def _e(s):
    return html.escape(str(s if s is not None else ""))


def _day(ms):
    return datetime.fromtimestamp(ms / 1000, RIYADH).strftime("%d %b %Y") if ms else "—"


def _shell(title, intro, blocks):
    rows = "".join(blocks)
    return f"""<div style="font-family:Arial,sans-serif;background:#eef2f8;padding:24px"><div style="max-width:680px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #dfe5ee">
<div style="background:#0b1a31;color:#fff;padding:22px 26px"><div style="color:#7ee8d8;font-size:11px;letter-spacing:2px;font-weight:bold">NAVO HSE</div><div style="font-size:22px;font-weight:bold;margin-top:6px">{_e(title)}</div><div style="color:#a9bdd3;font-size:13px;margin-top:4px">{_e(intro)}</div></div>
<div style="padding:8px 26px 22px">{rows}<p style="margin-top:22px"><a href="{_e(APP)}" style="background:#0e9e8e;color:#fff;padding:11px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Open NAVO</a></p>
<p style="color:#8a99ad;font-size:11px">Automatic message from NAVO. Manage recipients in Administration → Automations.</p></div></div></div>"""


def _section(title, items, color="#122033"):
    if not items:
        return ""
    lis = "".join(f'<li style="margin:0 0 8px">{i}</li>' for i in items)
    return f'<h3 style="color:{color};font-size:15px;margin:20px 0 8px">{_e(title)}</h3><ul style="padding-left:18px;margin:0;color:#33465e;font-size:13px;line-height:1.45">{lis}</ul>'


def digest(now_ms, actions, incidents, projects):
    name = {p["id"]: p.get("name") or p["id"] for p in projects}
    over = [a for a in actions if a.get("due") and a["due"] < now_ms]
    soon = [a for a in actions if a.get("due") and now_ms <= a["due"] < now_ms + 3 * DAY_MS]
    lvl = lambda d: "Division director" if d > 14 else "Project manager" if d > 7 else "Action owner"
    over.sort(key=lambda a: a["due"])
    o_items = [f"<b>{_e(a.get('title'))}</b> · {_e(name.get(a.get('project'), ''))} · owner {_e(a.get('owner') or '—')} · overdue {(now_ms - a['due']) // DAY_MS} days → <b>{lvl((now_ms - a['due']) // DAY_MS)}</b>" for a in over[:25]]
    s_items = [f"<b>{_e(a.get('title'))}</b> · {_e(name.get(a.get('project'), ''))} · owner {_e(a.get('owner') or '—')} · due {_day(a['due'])}" for a in soon[:25]]
    week = [r for r in incidents if (r.get("event_ts") or r.get("ts") or 0) > now_ms - 7 * DAY_MS]
    serious = [f"<b>{_e(r.get('severity'))}</b> · {_e(r.get('description') or r.get('kind'))} · {_e(name.get(r.get('project'), ''))} · {_day(r.get('event_ts') or r.get('ts'))}" for r in week if r.get("severity") in LTI]
    hipo = [f"<b>{_e(r.get('inc_class') or r.get('kind'))}</b> · {_e(r.get('description'))} · {_e(name.get(r.get('project'), ''))}" for r in incidents
            if (r.get("event_ts") or r.get("ts") or 0) > now_ms - 30 * DAY_MS and (r.get("inc_class") in ("Class A", "Class B") or r.get("kind") == "Dangerous Occurrence") and not ((r.get("investigation") or {}).get("root") or "").strip()]
    esc = sum(1 for a in over if (now_ms - a["due"]) // DAY_MS > 7)
    summary = f'<p style="font-size:14px;color:#122033"><b>{len(over)}</b> overdue actions ({esc} escalated beyond the owner) · <b>{len(soon)}</b> due within 3 days · <b>{len(serious)}</b> serious incidents this week · <b>{len(hipo)}</b> high-potential events without a root cause.</p>'
    blocks = [summary, _section("Serious incidents in the last 7 days", serious, "#c42b30"), _section("High-potential events needing investigation", hipo, "#b45309"),
              _section(f"Overdue actions ({len(over)})", o_items + ([f"… and {len(over) - 25} more"] if len(over) > 25 else []), "#c42b30"), _section(f"Due within 3 days ({len(soon)})", s_items)]
    return len(over) + len(soon) + len(serious) + len(hipo), blocks


def ceo_summary(now, reports, monthly, targets):
    y = now.year
    start = int(datetime(y, 1, 1, tzinfo=RIYADH).timestamp() * 1000)
    hours = sum((float((r.get("data") or {}).get("empHours") or 0) + float((r.get("data") or {}).get("conHours") or 0)) for r in monthly if str((r.get("data") or {}).get("month", "")).startswith(str(y)))
    yr = [r for r in reports if r.get("rt") == "Incident" and (r.get("event_ts") or r.get("ts") or 0) >= start]
    lti = sum(1 for r in yr if r.get("severity") in LTI)
    rec = sum(1 for r in yr if r.get("severity") in REC)
    fat = sum(1 for r in yr if r.get("severity") == "Fatality")
    days = sum(int(r.get("lost_days") or 0) for r in yr if r.get("severity") in ("Lost Time (> 7 days)", "Lost Time")) + fat * 6000
    rtac = sum(1 for r in yr if r.get("kind") == "Road Traffic Accident")
    rate = lambda n: n * 1_000_000 / hours if hours else None
    rows = []
    for lbl, k, v in (("LTIFR", "ltifr", rate(lti)), ("TRCF", "trcf", rate(rec)), ("LTISR", "ltisr", rate(days))):
        t = float(targets.get(k, DEFAULT_TARGETS[k]))
        ok = v is not None and v <= t
        rows.append(f'<td style="padding:12px;border:1px solid #dfe5ee;text-align:center"><div style="color:#5f6f84;font-size:12px;font-weight:bold">{lbl}</div><div style="font-size:26px;font-weight:bold;color:{"#16774a" if ok else "#c42b30"}">{"—" if v is None else f"{v:.2f}"}</div><div style="color:#8a99ad;font-size:11px">target {t:.2f}</div></td>')
    table = f'<table style="width:100%;border-collapse:collapse;margin:16px 0"><tr>{"".join(rows)}</tr></table>'
    facts = [f"Man-hours year to date: <b>{hours:,.0f}</b>", f"Fatalities: <b>{fat}</b> · lost time injuries: <b>{lti}</b> · recordable cases: <b>{rec}</b>", f"Road traffic accidents: <b>{rtac}</b>"]
    return [table, _section("Year to date", facts), '<p style="color:#5f6f84;font-size:13px">Download the full CEO bi-monthly report (PowerPoint, Word or Excel) from CEO & environment → CEO bi-monthly report.</p>']


def env_summary(now, monthly, env, structure):
    first = now.replace(day=1) - timedelta(days=1)
    m = first.strftime("%Y-%m")
    e = (structure.get("env") or {})
    fe, fd = float(e.get("elec") or 0.630), float(e.get("diesel") or 2.68)
    M = [r for r in monthly if (r.get("data") or {}).get("month") == m]
    E = [r for r in env if (r.get("data") or {}).get("month") == m]
    s = lambda rows, k: sum(float((r.get("data") or {}).get(k) or 0) for r in rows)
    elec = s(E, "electricity")
    diesel = s(E, "dieselL") if any((r.get("data") or {}).get("dieselL") not in (None, "") for r in E) else s(M, "diesel") * 1190
    water = s(E, "waterPotable") + s(E, "waterNonPotable") if E else s(M, "water")
    div = s(M, "nhRecycled") + s(M, "nhReused") + s(M, "hzRecycled") + s(M, "faRecycled")
    disp = s(M, "nhDisposed") + s(M, "hzDisposed") + s(M, "hzIncinerated") + s(M, "faDisposed")
    ghg = (diesel * fd + elec * fe) / 1000
    facts = [f"Electricity: <b>{elec:,.0f} kWh</b>", f"Diesel: <b>{diesel:,.0f} L</b>", f"Water: <b>{water:,.0f} m³</b>", f"GHG (scope 1 + 2): <b>{ghg:,.1f} tCO₂e</b>",
             f"Waste diversion: <b>{(div / (div + disp) * 100):.1f}%</b>" if div + disp else "Waste diversion: not reported"]
    return datetime.strptime(m, "%Y-%m").strftime("%B %Y"), [_section("Last month", facts), '<p style="color:#5f6f84;font-size:13px">Full report: CEO & environment → Environmental performance → Download report.</p>']


def run(now=None, force_digest=False, test=False):
    now = now or datetime.now(RIYADH)
    now_ms = int(now.timestamp() * 1000)
    srow = db("settings", "id=eq.structure&select=data")
    structure = (srow[0]["data"] if srow else {}) or {}
    auto = structure.get("automation") or {}
    em = {"recipients": [], "daily": True, "ceo": True, "env": True, **(auto.get("email") or {})}
    to = [r for r in em["recipients"] if "@" in r]
    if not to:
        return {"sent": [], "message": "No recipients saved in Automations → Email delivery."}
    projects = db("projects", "select=id,name")
    sent = []
    tag = "[Test] " if test else ""
    if em.get("daily") or force_digest:
        actions = db("actions", "select=id,title,project,owner,due,priority&closed_at=is.null")
        incidents = db("reports", f"select=id,rt,kind,severity,description,project,ts,event_ts,inc_class,investigation&rt=eq.Incident&ts=gte.{now_ms - 31 * DAY_MS}")
        n, blocks = digest(now_ms, actions, incidents, projects)
        if n or test:
            send(to, f"{tag}NAVO daily HSE digest · {now.strftime('%d %b %Y')}", _shell("Daily HSE digest", now.strftime("%A %d %B %Y"), blocks))
            sent.append("daily digest")
    if (em.get("ceo") and now.day in (1, 15)) or (test and em.get("ceo")):
        start = int(datetime(now.year, 1, 1, tzinfo=RIYADH).timestamp() * 1000)
        reports = db("reports", f"select=rt,kind,severity,lost_days,ts,event_ts&rt=eq.Incident&ts=gte.{start - 31 * DAY_MS}")
        monthly = db("hsse_records", "select=data&kind=eq.monthly")
        targets = ((structure.get("kpi") or {}).get("targets") or {}).get("Corporation") or DEFAULT_TARGETS
        send(to, f"{tag}NAVO CEO HSSE summary · {now.strftime('%d %b %Y')}", _shell("CEO HSSE summary", f"Year to date · {now.strftime('%d %B %Y')}", ceo_summary(now, reports, monthly, targets)))
        sent.append("CEO summary")
    if (em.get("env") and now.day == 1) or (test and em.get("env")):
        monthly = db("hsse_records", "select=data&kind=eq.monthly")
        env = db("hsse_records", "select=data&kind=eq.env")
        label, blocks = env_summary(now, monthly, env, structure)
        send(to, f"{tag}NAVO environmental summary · {label}", _shell("Environmental summary", label, blocks))
        sent.append("environmental summary")
    return {"sent": sent, "message": ("Sent: " + ", ".join(sent) + f" to {len(to)} recipient(s).") if sent else "Nothing to send today."}


def _admin_token_ok(token):
    if not token:
        return False
    try:
        user = _http(URL + "/auth/v1/user", headers={"apikey": PUB, "Authorization": "Bearer " + token}, timeout=8)
    except Exception:
        return False
    uid = (user or {}).get("id")
    if not uid:
        return False
    q = urllib.parse.quote(uid)
    return bool(db("owner", f"user_id=eq.{q}&select=user_id")) or bool(db("members", f"user_id=eq.{q}&role=eq.admin&select=user_id"))


class handler(BaseHTTPRequestHandler):
    def _send(self, status, payload):
        b = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        secret = os.environ.get("CRON_SECRET")
        if not secret or self.headers.get("authorization", "") != "Bearer " + secret:
            return self._send(401, {"error": "Not authorised."})
        miss = missing_config()
        if miss:
            return self._send(200, {"sent": [], "message": "Email is not configured: " + ", ".join(miss)})
        try:
            self._send(200, run())
        except Exception:
            logging.exception("NAVO notify failed")
            self._send(500, {"error": "The automation run failed."})

    def do_POST(self):
        miss = missing_config()
        if miss:
            return self._send(200, {"message": "Email is not set up yet. Add " + ", ".join(miss) + " in Vercel, then redeploy."})
        auth = self.headers.get("authorization", "")
        if not _admin_token_ok(auth[7:] if auth.lower().startswith("bearer ") else ""):
            return self._send(401, {"error": "Only an HSE Admin can send a test."})
        try:
            self._send(200, run(force_digest=True, test=True))
        except Exception:
            logging.exception("NAVO notify test failed")
            self._send(500, {"error": "The test could not be sent. Check the email settings."})
