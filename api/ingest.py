"""POST /api/ingest — the door for connected devices: vehicle telematics, environmental sensors and CCTV analytics.

Authorization: Bearer <integration key>   (created by a System admin in NAVO → Connected devices; only its SHA-256 is stored)
Body: {"source": "telematics" | "sensor" | "cctv", "project": "<project code>", "events": [ {...}, ... ]}   up to 500 events

Each event is stored as it arrives (hsse_records kind r:tele / r:envr / r:cev) with the time received.
Fields NAVO reads (others are kept):
  telematics  device, at, type (speeding | harsh_braking | harsh_acceleration | fatigue | seatbelt | idling | trip),
              speed, limit, lat, lng, km, driver
  sensor      device, at, pm10, pm25, noise_db, co2, nox, so2, kwh, temp, humidity, wind
  cctv        device (camera id), at, type (no_helmet | no_vest | exclusion_zone | intrusion | headcount | fire_smoke | fall),
              zone, count, confidence, snapshot_url
Needs NAVO_SUPABASE_SERVICE_KEY in Vercel.
"""
import hashlib
import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler

URL = os.environ.get("NAVO_SUPABASE_URL", "https://gvktcleqiidtmgqxbzsy.supabase.co")
KIND = {"telematics": "r:tele", "sensor": "r:envr", "cctv": "r:cev"}


def _key():
    k = os.environ.get("NAVO_SUPABASE_SERVICE_KEY") or next((v for n, v in os.environ.items() if n.strip() == "NAVO_SUPABASE_SERVICE_KEY"), "")
    return k.strip()


def _http(path, method="GET", body=None, extra=None):
    k = _key()
    h = {"apikey": k, "Authorization": "Bearer " + k, "Content-Type": "application/json"}
    h.update(extra or {})
    req = urllib.request.Request(URL + path, method=method, headers=h, data=None if body is None else json.dumps(body).encode())
    with urllib.request.urlopen(req, timeout=20) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def find_integration(token):
    if not token:
        return None
    h = hashlib.sha256(token.encode()).hexdigest()
    rows = _http("/rest/v1/settings?id=eq.structure&select=data") or []
    keys = (((rows[0] or {}).get("data") or {}).get("integrations") or {}).get("keys") or [] if rows else []
    return next((k for k in keys if k.get("hash") == h and not k.get("revoked")), None)


def clean(events, source, now):
    out = []
    for e in events[:500]:
        if not isinstance(e, dict):
            continue
        d = {k: v for k, v in e.items() if isinstance(k, str) and len(k) < 40 and isinstance(v, (str, int, float, bool, type(None)))}
        d = {k: (v[:500] if isinstance(v, str) else v) for k, v in d.items()}
        d["source"] = source
        d["received"] = now
        d.setdefault("at", time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(now / 1000)))
        out.append(d)
    return out


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
            if not _key():
                return self._send(503, {"error": "NAVO is not configured to receive device data yet."})
            auth = self.headers.get("authorization", "")
            integ = find_integration(auth[7:].strip() if auth.lower().startswith("bearer ") else "")
            if not integ:
                return self._send(401, {"error": "Unknown or revoked integration key."})
            n = int(self.headers.get("content-length") or 0)
            if n <= 0 or n > 2_000_000:
                return self._send(413, {"error": "Body too large (max 2 MB, 500 events)."})
            d = json.loads(self.rfile.read(n))
            source = d.get("source") or integ.get("type")
            if source not in KIND or (integ.get("type") and integ["type"] != source):
                return self._send(400, {"error": "source must be telematics, sensor or cctv and match the key."})
            project = d.get("project") or integ.get("project")
            if not project or (integ.get("project") and integ["project"] != project):
                return self._send(400, {"error": "project missing or not allowed for this key."})
            now = int(time.time() * 1000)
            rows = [{"project": project, "kind": KIND[source], "ts": now, "data": e} for e in clean(d.get("events") or [], source, now)]
            if not rows:
                return self._send(400, {"error": "No events."})
            _http("/rest/v1/hsse_records", "POST", rows, {"Prefer": "return=minimal"})
            self._send(200, {"stored": len(rows)})
        except urllib.error.HTTPError as e:
            logging.error("ingest db error %s", e.read()[:300])
            self._send(502, {"error": "Could not store the events (check the project code)."})
        except Exception:
            logging.exception("NAVO ingest failed")
            self._send(500, {"error": "Ingest failed."})
