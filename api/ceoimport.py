"""POST /api/ceoimport  {"file": base64 .xlsx}  with a signed-in token.
Reads the client's CEO bi-monthly HSSE workbook and returns the figures for the page to preview and save.
Nothing is written here: saving goes through the signed-in person's own database permissions."""
import base64
import json
import logging
import os
import urllib.request
from http.server import BaseHTTPRequestHandler

from api.ceo_xlsx import parse

URL = os.environ.get("NAVO_SUPABASE_URL", "https://gvktcleqiidtmgqxbzsy.supabase.co")
PUB = os.environ.get("NAVO_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_9N-3NV87mniwgZB0dw3IVA_bqK3ppNb")


def signed_in(token):
    if not token:
        return False
    try:
        req = urllib.request.Request(URL + "/auth/v1/user", headers={"apikey": PUB, "Authorization": "Bearer " + token})
        with urllib.request.urlopen(req, timeout=8) as r:
            return bool(json.loads(r.read() or b"{}").get("id"))
    except Exception:
        return False


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
            auth = self.headers.get("authorization", "")
            if not signed_in(auth[7:] if auth.lower().startswith("bearer ") else ""):
                return self._send(401, {"error": "Please sign in again."})
            n = int(self.headers.get("content-length") or 0)
            if n <= 0 or n > 14_000_000:
                return self._send(413, {"error": "The file must be smaller than 10 MB."})
            d = json.loads(self.rfile.read(n))
            if not isinstance(d, dict) or not isinstance(d.get("file"), str):
                return self._send(400, {"error": "No file received."})
            self._send(200, parse(base64.b64decode(d["file"].split(",")[-1])))
        except ValueError as e:
            self._send(400, {"error": str(e)})
        except Exception:
            logging.exception("NAVO CEO import failed")
            self._send(500, {"error": "The file could not be read."})
