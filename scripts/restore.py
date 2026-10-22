"""Put a backup made by scripts/backup.py back into a Supabase project.
Rows are upserted (existing rows with the same key are overwritten; nothing is deleted).

Usage:  NAVO_SUPABASE_URL=https://<project>.supabase.co NAVO_SUPABASE_SERVICE_KEY=... python scripts/restore.py backup-dir [--yes]
Always try a restore on the STAGING project first."""
import json
import os
import sys
import urllib.request

ORDER = ["owner", "people", "projects", "members", "settings", "reports", "actions", "inspections", "activities", "reviews", "hsse_records", "navo_record_links"]
KEYS = {"owner": "user_id", "people": "user_id", "members": "user_id"}


def main(src, yes):
    url, key = os.environ.get("NAVO_SUPABASE_URL"), os.environ.get("NAVO_SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("Set NAVO_SUPABASE_URL and NAVO_SUPABASE_SERVICE_KEY for the project you are restoring INTO.")
    if not yes:
        if input(f"Restore {src} into {url}? Type RESTORE: ") != "RESTORE":
            sys.exit("Cancelled.")
    for t in ORDER:
        p = os.path.join(src, t + ".json")
        if not os.path.exists(p):
            continue
        rows = json.load(open(p))
        for i in range(0, len(rows), 500):
            q = f"?on_conflict={KEYS[t]}" if t in KEYS else ""
            req = urllib.request.Request(f"{url}/rest/v1/{t}{q}", method="POST", data=json.dumps(rows[i:i + 500]).encode(),
                                         headers={"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"})
            urllib.request.urlopen(req, timeout=120).read()
        print(t, len(rows))


if __name__ == "__main__":
    main(sys.argv[1], "--yes" in sys.argv)
