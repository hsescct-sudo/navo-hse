"""POST /api/log — browser error reports. Written to the Vercel function log (Vercel → Logs, search "NAVO client error")
and, when NAVO_SUPABASE_SERVICE_KEY is set and supabase/022_client_errors.sql has been run, to the client_errors table."""
import json
import logging
import os
import urllib.request
from http.server import BaseHTTPRequestHandler

URL = os.environ.get("NAVO_SUPABASE_URL", "https://gvktcleqiidtmgqxbzsy.supabase.co")
FIELDS = ("kind", "msg", "src", "line", "stack", "view", "env", "ua", "at")


def clean(d):
    out = {}
    for k in FIELDS:
        v = d.get(k)
        if v is None:
            continue
        out[k] = v if k == "line" and isinstance(v, int) else str(v)[:1500]
    return out


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            n = int(self.headers.get("content-length") or 0)
            if 0 < n <= 8000:
                d = clean(json.loads(self.rfile.read(n)))
                if d.get("msg"):
                    print("NAVO client error " + json.dumps(d))
                    key = os.environ.get("NAVO_SUPABASE_SERVICE_KEY")
                    if key:
                        try:
                            req = urllib.request.Request(URL + "/rest/v1/client_errors", method="POST", data=json.dumps([d]).encode(),
                                                         headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json", "Prefer": "return=minimal"})
                            urllib.request.urlopen(req, timeout=5).read()
                        except Exception:
                            pass  # the table is optional; the log line above is always written
        except Exception:
            logging.exception("NAVO log endpoint failed")
        self.send_response(204)
        self.end_headers()
