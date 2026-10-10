"""NAVO AI service (Vercel Python function).

POST /api/ai with {"action": "analyze" | "translate" | "outlook", ...} and the
signed-in user's Supabase access token as a Bearer token. Calls the Claude API
with the key stored in the Vercel environment variable ANTHROPIC_API_KEY.

The AI suggests; people decide. Every result is shown to the reporter or HSE
team for confirmation before anything is saved or acted on.
"""
import json
import os
import re
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler

SUPABASE_URL = os.environ.get("NAVO_SUPABASE_URL", "https://gvktcleqiidtmgqxbzsy.supabase.co")
SUPABASE_KEY = os.environ.get("NAVO_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_9N-3NV87mniwgZB0dw3IVA_bqK3ppNb")
MODEL = os.environ.get("NAVO_AI_MODEL", "claude-sonnet-5-5")
CATEGORIES = ["Work at Height", "Lifting Operations", "Excavation", "Confined Space", "Moving Equipment",
              "Energized Systems", "Stored Energy", "Hazardous Substances"]

ANALYZE_PROMPT = """You are an experienced HSE engineer reviewing a field safety report from a construction or industrial site in the GCC.
The worker may have written in any language and may have attached a photo.

Report type chosen by the worker: {rtype}
Business: {business}. Country: {country}.
Worker's words (may be empty, may not be English): \"\"\"{text}\"\"\"

Tasks:
1. Translate the worker's words to clear English and name the language they used.
2. Look at the photo (if any) and the words. List the hazards you can actually see or that are described. Do not invent hazards that are not supported by the photo or text; if the photo shows nothing unsafe, say so.
3. Pick the single best high-energy category from this list, or null if none applies: {cats}.
4. Rate the risk if nothing is done: likelihood 1-5 and severity 1-5 (5 = fatality). Score = likelihood x severity.
   Level: 1-4 Low, 5-9 Medium, 10-16 High, 20-25 Critical.
5. Say whether this has potential for fatality or permanent impairment (PFPI), with a one-line reason.
6. Suggest immediate actions (make safe now) and corrective actions (stop it recurring), practical for a site supervisor.

Reply with JSON only, no prose, in exactly this shape:
{{"english_text": str, "language": str, "summary": str, "hazards": [str], "category": str or null,
 "suggested_type": "Unsafe Act" | "Unsafe Condition" | "Equipment defect" | "Near Miss" | "Injury" | "Property Damage" | "Environmental" | "Safe behaviour",
 "likelihood": int, "severity": int, "risk_score": int, "risk_level": "Low" | "Medium" | "High" | "Critical",
 "pfpi": bool, "pfpi_reason": str,
 "immediate_actions": [str],
 "corrective_actions": [{{"title": str, "owner_role": str, "due_days": int, "priority": "High" | "Normal"}}],
 "confidence": "low" | "medium" | "high"}}"""

TRANSLATE_PROMPT = """Translate this site safety note to clear English. Keep technical meaning exact.
Text: \"\"\"{text}\"\"\"
Reply with JSON only: {{"english_text": str, "language": str}}"""

OUTLOOK_PROMPT = """You are an HSE analytics lead. Using only the data below for {level}, give a predictive risk outlook for the next 30 days.
Base it on trends, high-energy categories, overdue actions, near-miss reporting rate and leadership engagement. Do not invent numbers.

Data (JSON): {data}

Reply with JSON only:
{{"rating": "Low" | "Moderate" | "High" | "Critical", "score": int (0-100, higher = more risk),
 "headline": str, "drivers": [str], "watch_projects": [str], "recommended_focus": [str], "confidence": "low" | "medium" | "high"}}"""


def verify_user(token):
    if not token:
        return None
    req = urllib.request.Request(SUPABASE_URL + "/auth/v1/user", headers={"apikey": SUPABASE_KEY, "Authorization": "Bearer " + token})
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.loads(r.read()).get("id")
    except Exception:
        return None


def claude(content, max_tokens=1600):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("AI is not set up yet: add ANTHROPIC_API_KEY in the Vercel project settings.")
    body = json.dumps({"model": MODEL, "max_tokens": max_tokens, "messages": [{"role": "user", "content": content}]}).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=body, method="POST", headers={
        "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=55) as r:
            out = json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="ignore")[:300]
        raise RuntimeError(f"The AI service returned an error ({e.code}). {detail}")
    text = "".join(b.get("text", "") for b in out.get("content", []) if b.get("type") == "text")
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise RuntimeError("The AI reply could not be read. Try again.")
    return json.loads(m.group(0))


def clean_analysis(a):
    lk = max(1, min(5, int(a.get("likelihood") or 1)))
    sv = max(1, min(5, int(a.get("severity") or 1)))
    score = lk * sv
    level = "Low" if score <= 4 else "Medium" if score <= 9 else "High" if score <= 16 else "Critical"
    cat = a.get("category")
    a.update({"likelihood": lk, "severity": sv, "risk_score": score, "risk_level": level,
              "category": cat if cat in CATEGORIES else None, "model": MODEL})
    a["corrective_actions"] = [c for c in (a.get("corrective_actions") or []) if isinstance(c, dict) and c.get("title")][:6]
    a["immediate_actions"] = [str(x) for x in (a.get("immediate_actions") or [])][:6]
    a["hazards"] = [str(x) for x in (a.get("hazards") or [])][:8]
    return a


def run(action, p):
    if action == "analyze":
        prompt = ANALYZE_PROMPT.format(rtype=p.get("rtype", ""), business=p.get("business", ""), country=p.get("country", ""),
                                       text=(p.get("text") or "")[:3000], cats=", ".join(CATEGORIES))
        content = []
        img = p.get("image")
        if img:
            if len(img) > 6_000_000:
                raise ValueError("The photo is too large.")
            content.append({"type": "image", "source": {"type": "base64", "media_type": p.get("mediaType", "image/jpeg"), "data": img}})
        content.append({"type": "text", "text": prompt})
        return clean_analysis(claude(content))
    if action == "translate":
        return claude([{"type": "text", "text": TRANSLATE_PROMPT.format(text=(p.get("text") or "")[:3000])}], 600)
    if action == "outlook":
        data = json.dumps(p.get("data") or {})[:20000]
        return claude([{"type": "text", "text": OUTLOOK_PROMPT.format(level=p.get("level", "this level"), data=data)}], 1200)
    raise ValueError("Unknown action")


class handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        try:
            auth = self.headers.get("authorization", "")
            uid = verify_user(auth[7:] if auth.lower().startswith("bearer ") else "")
            if not uid:
                return self._send(401, {"error": "Sign in to use AI features."})
            n = int(self.headers.get("content-length") or 0)
            if n > 8_000_000:
                return self._send(413, {"error": "Request too large."})
            p = json.loads(self.rfile.read(n) or b"{}")
            self._send(200, run(p.get("action"), p))
        except Exception as e:
            self._send(400, {"error": str(e)})
