"""Export every NAVO table to JSON files (one per table) using the service key.
Usage:  NAVO_SUPABASE_SERVICE_KEY=... python scripts/backup.py backup-dir
Run daily by .github/workflows/backup.yml; restore with scripts/restore.py."""
import json
import os
import sys
import urllib.error
import urllib.request

URL = os.environ.get("NAVO_SUPABASE_URL", "https://gvktcleqiidtmgqxbzsy.supabase.co")
TABLES = ["owner", "people", "projects", "members", "settings", "reports", "actions", "inspections", "activities", "reviews", "hsse_records", "navo_record_links"]
PAGE = 1000


def fetch(table, key):
    rows, start = [], 0
    while True:
        req = urllib.request.Request(f"{URL}/rest/v1/{table}?select=*", headers={"apikey": key, "Authorization": "Bearer " + key, "Range-Unit": "items", "Range": f"{start}-{start + PAGE - 1}"})
        with urllib.request.urlopen(req, timeout=60) as r:
            batch = json.loads(r.read() or b"[]")
        rows += batch
        if len(batch) < PAGE:
            return rows
        start += PAGE


def main(out):
    key = os.environ.get("NAVO_SUPABASE_SERVICE_KEY")
    if not key:
        sys.exit("NAVO_SUPABASE_SERVICE_KEY is not set (GitHub → Settings → Secrets and variables → Actions).")
    os.makedirs(out, exist_ok=True)
    summary = {}
    for t in TABLES:
        try:
            rows = fetch(t, key)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                summary[t] = "missing"
                continue
            raise
        with open(os.path.join(out, t + ".json"), "w") as f:
            json.dump(rows, f)
        summary[t] = len(rows)
    with open(os.path.join(out, "summary.json"), "w") as f:
        json.dump(summary, f, indent=1)
    print(json.dumps(summary))
    if not summary.get("projects"):
        sys.exit("Backup looks empty: no projects were exported.")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "backup")
