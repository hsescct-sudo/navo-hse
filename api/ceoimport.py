"""POST /api/ceoimport  {"file": base64 .xlsx}  with a signed-in token.
Reads the client's CEO bi-monthly HSSE workbook and returns the figures for the page to preview and save.
Nothing is written here: saving goes through the signed-in person's own database permissions."""
import base64
import json
import logging
from http.server import BaseHTTPRequestHandler

from api.ceo_xlsx import parse

from api.auth import token_from, user_id


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
            if not user_id(token_from(self.headers)):
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
