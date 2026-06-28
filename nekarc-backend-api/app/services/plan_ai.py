"""Read an image/PDF building plan with Gemini vision -> floors & rooms JSON.

Uses the REST API with the free-tier key (header auth). No SDK dependency.
"""
import base64
import json
import ssl
import urllib.error
import urllib.request

from app.config import settings

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# Use certifi's CA bundle so HTTPS verification works on macOS Python builds.
try:
    import certifi

    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:  # noqa: BLE001
    _SSL_CTX = ssl.create_default_context()

PROMPT = (
    "You read architectural floor plans and extract a structured model for network planning.\n"
    "First, extract building_name: the overall project/building name from the title block or sheet header "
    "(e.g. 'Construction Project of a Low Villa'). Do NOT use a floor/drawing name like 'Ground Floor' — "
    "that's a floor, not the building. If there is no clear title, leave it empty.\n"
    "The document may contain one or more floors/levels. For EACH floor, list its rooms.\n"
    "For each room provide:\n"
    '- name: from its label if present, else a sensible name (e.g. "Office 1", "Meeting Room").\n'
    "- area_m2: approximate floor area in square metres if derivable, else 0.\n"
    "- workstations: number of desks/workstations/cubicles visible (or a reasonable estimate for an office of that size).\n"
    "- wifi_devices: wireless clients; if not indicated, estimate ~1-2 per workstation for offices, else 0.\n"
    "- printers, cameras, servers: count visible printer/copier, CCTV/camera, and server/rack symbols.\n"
    "If the plan shows no furniture, set counts to 0. Do not invent unrealistic numbers.\n"
    "Return ONLY JSON for the given schema."
)

_ROOM = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "area_m2": {"type": "number"},
        "workstations": {"type": "integer"},
        "wifi_devices": {"type": "integer"},
        "printers": {"type": "integer"},
        "cameras": {"type": "integer"},
        "servers": {"type": "integer"},
    },
    "required": ["name", "workstations", "wifi_devices", "printers", "cameras", "servers"],
}
SCHEMA = {
    "type": "object",
    "properties": {
        "building_name": {"type": "string"},
        "floors": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "rooms": {"type": "array", "items": _ROOM},
                },
                "required": ["name", "rooms"],
            },
        }
    },
    "required": ["floors"],
}


def extract_from_plan(file_bytes: bytes, mime_type: str) -> dict:
    if not settings.GEMINI_API_KEY:
        return {"ok": False, "error": "Gemini is not configured (set GEMINI_API_KEY).", "floors": []}

    body = {
        "contents": [
            {
                "parts": [
                    {"text": PROMPT},
                    {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(file_bytes).decode()}},
                ]
            }
        ],
        "generationConfig": {"responseMimeType": "application/json", "responseSchema": SCHEMA},
    }
    url = GEMINI_URL.format(model=settings.GEMINI_MODEL)
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": settings.GEMINI_API_KEY},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120, context=_SSL_CTX) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:300]
        return {"ok": False, "error": f"Gemini error {e.code}: {detail}", "floors": []}
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"Gemini request failed: {e}", "floors": []}

    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
        floors = parsed.get("floors", [])
        building_name = parsed.get("building_name", "")
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"Could not parse AI response: {e}", "floors": []}

    return {"ok": True, "source": "ai", "floors": floors, "building_name": building_name}
