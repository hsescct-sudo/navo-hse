"""NAVO public endpoints that need no account (Vercel Python function).

POST /api/public {"op": "access_request", name, email, phone?, company?, position?, project?, manager?, reason?}
     Stores a request for an administrator to approve (Organisation & access -> Accounts & passwords).
POST /api/public {"op": "projects"}                      -> project names for the request form
POST /api/public {"op": "qr_info", "p": project, "t": token}   -> {"project": name}
POST /api/public {"op": "qr_report", "p", "t", "type", "desc", "loc"?, "name"?, "phone"?, "company"?, "photo"? (data URL)}
     Files a report for a worker without an account. The token printed in the project QR code is checked.

The service key stays on the server (NAVO_SUPABASE_SERVICE_KEY). Requests are size-limited and validated.
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler

URL = os.environ.get("NAVO_SUPABASE_URL", "https://gvktcleqiidtmgqxbzsy.supabase.co")
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TYPES = {
    "unsafe": ("Hazard", "Unsafe condition"),
    "act": ("Hazard", "Unsafe act"),
    "nearmiss": ("Incident", "Near Miss"),
    "injury": ("Incident", "Injury"),
    "damage": ("Incident", "Property Damage"),
    "env": ("Incident", "Environmental"),
    "good": ("Good practice", "Positive"),
}


class ApiError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status = status


def _key():
    k = os.environ.get("NAVO_SUPABASE_SERVICE_KEY") or next((v for n, v in os.environ.items() if n.strip() == "NAVO_SUPABASE_SERVICE_KEY"), None)
    k = (k or "").strip()
    if not k:
        raise ApiError(503, "This service is not set up yet.")
    return k


def qr_token(project):
    """Short signature printed in a project's QR code; changes only if the service key changes."""
    return hmac.new(_key().encode(), ("navo-qr:" + str(project)).encode(), hashlib.sha256).hexdigest()[:20]


def _http(path, method="GET", body=None, extra=None, raw=None, ctype="application/json"):
    key = _key()
    h = {"apikey": key, "Authorization": "Bearer " + key, "Content-Type": ctype}
    h.update(extra or {})
    data = raw if raw is not None else (None if body is None else json.dumps(body).encode())
    req = urllib.request.Request(URL + path, method=method, headers=h, data=data)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            b = r.read()
            return json.loads(b) if b else None
    except urllib.error.HTTPError as e:
        logging.error("supabase %s %s: %s", method, path, e.read()[:300])
        raise ApiError(502, "The request could not be saved. Please try again.")


def _s(d, k, n=300):
    return str(d.get(k) or "").strip()[:n]


def _project(pid):
    rows = _http("/rest/v1/projects?select=id,name&id=eq." + urllib.parse.quote(pid))
    if not rows:
        raise ApiError(404, "Unknown project.")
    return rows[0]


def access_request(d):
    if d.get("website"):  # honeypot
        return {"ok": True}
    name, email = _s(d, "name", 120), _s(d, "email", 160).lower()
    if len(name) < 3 or not EMAIL.match(email):
        raise ApiError(400, "Enter your full name and a valid email.")
    recent = _http("/rest/v1/access_requests?select=id&status=eq.Pending&email=eq." + urllib.parse.quote(email))
    if recent:
        return {"ok": True, "already": True}
    _http("/rest/v1/access_requests", "POST", {
        "name": name, "email": email, "phone": _s(d, "phone", 40), "company": _s(d, "company", 120),
        "position": _s(d, "position", 120), "project": _s(d, "project", 80), "manager": _s(d, "manager", 120),
        "reason": _s(d, "reason", 600)}, {"Prefer": "return=minimal"})
    return {"ok": True}


def projects():
    rows = _http("/rest/v1/projects?select=id,name&order=name") or []
    return {"projects": [{"id": r["id"], "name": r["name"]} for r in rows if not str(r["id"]).startswith("demo-")]}


def _check(d):
    pid, tok = _s(d, "p", 80), _s(d, "t", 40)
    if not pid or not hmac.compare_digest(tok, qr_token(pid)):
        raise ApiError(403, "This QR code is not valid. Ask your supervisor for the current site poster.")
    return _project(pid)


def _photo(pid, data_url):
    m = re.match(r"^data:(image/(?:jpeg|png|webp));base64,(.+)$", data_url or "", re.S)
    if not m:
        return None
    raw = base64.b64decode(m.group(2))
    if len(raw) > 4_000_000:
        raise ApiError(413, "The photo is too large.")
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[m.group(1)]
    path = f"{pid}/qr/{uuid.uuid4()}.{ext}"
    _http("/storage/v1/object/photos/" + urllib.parse.quote(path), "POST", raw=raw, ctype=m.group(1))
    return path


def qr_report(d):
    p = _check(d)
    if d.get("website"):
        return {"ok": True}
    rt, kind = TYPES.get(_s(d, "type", 20), (None, None))
    desc = _s(d, "desc", 2000)
    if not rt or len(desc) < 5:
        raise ApiError(400, "Choose what you are reporting and describe it.")
    who = ", ".join(x for x in [_s(d, "name", 80), _s(d, "company", 80), _s(d, "phone", 40)] if x) or "Anonymous"
    now = int(time.time() * 1000)
    photo = _photo(p["id"], d.get("photo")) if d.get("photo") else None
    row = {"rt": rt, "kind": kind, "project": p["id"], "description": desc, "photo": photo,
           "loc": _s(d, "loc", 160), "ts": now, "event_ts": now, "status": "Open",
           "history": [{"ts": now, "by": "QR report", "what": "Reported by QR code (no account) · " + who}]}
    if kind == "Injury":
        row["severity"] = "Not classified"
    res = _http("/rest/v1/reports", "POST", row, {"Prefer": "return=representation"})
    rid = res[0]["id"] if res else ""
    return {"ok": True, "ref": "QR-" + rid[:8].upper()}


def handle(d):
    op = d.get("op")
    if op == "access_request":
        return access_request(d)
    if op == "projects":
        return projects()
    if op == "qr_info":
        return {"project": _check(d)["name"]}
    if op == "qr_report":
        return qr_report(d)
    raise ApiError(400, "Unknown request.")


class handler(BaseHTTPRequestHandler):
    def _send(self, status, payload):
        b = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        try:
            n = int(self.headers.get("content-length") or 0)
            if n <= 0 or n > 6_000_000:
                raise ApiError(413, "Request too large.")
            d = json.loads(self.rfile.read(n) or b"{}")
            self._send(200, handle(d))
        except ApiError as e:
            self._send(e.status, {"error": str(e)})
        except Exception:
            logging.exception("public api")
            self._send(500, {"error": "Something went wrong. Please try again."})
