"""POST /api/xlimport  {"file": base64 .xlsx, "projects": [...], "monthly": [[key,label]], "env": [[key,label]]}
Reads the NAVO import template and returns validated rows for the page to preview and save.
Nothing is written here: the page saves through the signed-in person's own database permissions."""
import base64
import json
import logging
from http.server import BaseHTTPRequestHandler

from api.excel_io import parse_xlsx


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
            if n <= 0 or n > 8_000_000:
                return self._send(413, {"error": "The file must be smaller than 5 MB."})
            d = json.loads(self.rfile.read(n))
            if not isinstance(d, dict) or not isinstance(d.get("file"), str):
                return self._send(400, {"error": "No file received."})
            raw = base64.b64decode(d["file"].split(",")[-1])
            self._send(200, parse_xlsx(raw, d))
        except ValueError as e:
            self._send(400, {"error": str(e)})
        except Exception:
            logging.exception("NAVO import failed")
            self._send(500, {"error": "The file could not be read."})
