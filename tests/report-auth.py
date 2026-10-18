"""Verify document exports require a valid signed-in session."""
import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api import report


class HandlerHarness(report.handler):
    def __init__(self, authorization="", body=b'{"title":"test"}'):
        self.path = "/api/report?fmt=pdf"
        self.headers = {"authorization": authorization, "content-length": str(len(body))}
        self.rfile = io.BytesIO(body)
        self.wfile = io.BytesIO()
        self.status = None
        self.response_headers = {}

    def send_response(self, status):
        self.status = status

    def send_header(self, name, value):
        self.response_headers[name] = value

    def end_headers(self):
        pass


class ReportAuthTests(unittest.TestCase):
    def test_unauthenticated_export_stops_before_report_generation(self):
        handler = HandlerHarness()
        with patch.object(report, "verify_user", return_value=None), patch.object(report, "make") as make:
            handler.do_POST()
        self.assertEqual(handler.status, 401)
        self.assertIn("Sign in", handler.wfile.getvalue().decode())
        make.assert_not_called()

    def test_authenticated_export_generates_document(self):
        handler = HandlerHarness("Bearer valid-session-token")
        with patch.object(report, "verify_user", return_value="user-id") as verify, patch.object(
            report, "make", return_value=(b"pdf-data", "application/pdf")
        ) as make:
            handler.do_POST()
        self.assertEqual(handler.status, 200)
        verify.assert_called_once_with("valid-session-token")
        make.assert_called_once_with("pdf", {"title": "test"})
        self.assertEqual(handler.wfile.getvalue(), b"pdf-data")


if __name__ == "__main__":
    unittest.main()
