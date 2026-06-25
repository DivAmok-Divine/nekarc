"""DXF parsing -> room geometry.

v1 reads *closed* LWPOLYLINEs (what a clean architectural export gives for
rooms/spaces). Detecting rooms from loose wall segments (closed-loop finding)
is a planned enhancement; until then, messy files fall back to PNG tracing.
"""
from app.services.geometry import polygon_area


def parse_dxf(path: str) -> dict:
    try:
        import ezdxf
    except ImportError:
        return {"ok": False, "error": "ezdxf is not installed", "layers": [], "rooms": []}

    try:
        doc = ezdxf.readfile(path)
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"Could not read DXF: {e}", "layers": [], "rooms": []}

    msp = doc.modelspace()
    layers = sorted({e.dxf.layer for e in msp})
    rooms: list[dict] = []

    for i, e in enumerate(msp.query("LWPOLYLINE")):
        if not e.closed:
            continue
        pts = [(round(float(p[0]), 3), round(float(p[1]), 3)) for p in e.get_points("xy")]
        if len(pts) < 3:
            continue
        rooms.append(
            {
                "index": i,
                "layer": e.dxf.layer,
                "polygon": pts,
                "area": round(polygon_area(pts), 3),
            }
        )

    return {
        "ok": True,
        "layers": layers,
        "rooms": rooms,
        "note": (
            "Closed polylines detected as rooms. If rooms are missing they may be drawn "
            "as separate wall segments — wall-loop detection is planned; trace on a PNG meanwhile."
        ),
    }
