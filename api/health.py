"""GET /api/health — is the site up and can it reach the database? Used by the uptime check (.github/workflows/uptime.yml)."""
import json
import os
import time
import urllib.request
from http.server import BaseHTTPRequestHandler

URL = os.environ.get("NAVO_SUPABASE_URL", "https://gvktcleqiidtmgqxbzsy.supabase.co")
PUB = os.environ.get("NAVO_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_9N-3NV87mniwgZB0dw3IVA_bqK3ppNb")


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        t = time.time()
        try:
            urllib.request.urlopen(urllib.request.Request(URL + "/auth/v1/health", headers={"apikey": PUB}), timeout=8).read()
            ok, db = True, "ok"
        except Exception as e:
            ok, db = False, type(e).__name__
        b = json.dumps({"ok": ok, "database": db, "ms": round((time.time() - t) * 1000)}).encode()
        self.send_response(200 if ok else 503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)
