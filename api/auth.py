"""Shared sign-in check for NAVO server functions: the caller must send a valid Supabase session token."""
import json
import os
import urllib.request

URL = os.environ.get("NAVO_SUPABASE_URL", "https://gvktcleqiidtmgqxbzsy.supabase.co")
PUB = os.environ.get("NAVO_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_9N-3NV87mniwgZB0dw3IVA_bqK3ppNb")


def token_from(headers):
    a = headers.get("authorization", "") or ""
    return a[7:].strip() if a.lower().startswith("bearer ") else ""


def user_id(token):
    """Return the signed-in user's id, or None."""
    if not token or len(token) > 4096:
        return None
    try:
        req = urllib.request.Request(URL + "/auth/v1/user", headers={"apikey": PUB, "Authorization": "Bearer " + token})
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.loads(r.read() or b"{}").get("id")
    except Exception:
        return None
