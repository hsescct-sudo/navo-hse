"""Authentication helpers shared by NAVO API handlers."""
import json
import os
import urllib.request


SUPABASE_URL = os.environ.get("NAVO_SUPABASE_URL", "https://gvktcleqiidtmgqxbzsy.supabase.co")
SUPABASE_KEY = os.environ.get("NAVO_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_9N-3NV87mniwgZB0dw3IVA_bqK3ppNb")


def verify_user(token):
    """Return the authenticated Supabase user id, or None for invalid tokens."""
    if not token:
        return None
    request = urllib.request.Request(
        SUPABASE_URL + "/auth/v1/user",
        headers={"apikey": SUPABASE_KEY, "Authorization": "Bearer " + token},
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            return json.loads(response.read()).get("id")
    except Exception:
        return None
