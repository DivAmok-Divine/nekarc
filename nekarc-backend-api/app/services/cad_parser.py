"""DXF -> floors & rooms.

Deterministic, offline (ezdxf + shapely). Extracts:
  - rooms      = closed polylines (area-filtered to drop noise)
  - room names = TEXT/MTEXT whose insertion point is inside a room
  - areas      = polygon area converted to m2 via the DXF unit header
  - devices    = furniture blocks (INSERT) inside a room, mapped by name keyword
  - floors     = grouped by layer name (FLOOR1 / LEVEL 2 / L3); else a single floor
"""
import re

DEVICE_KEYS = ["workstations", "wifi_devices", "printers", "cameras", "servers"]

# DXF $INSUNITS code -> metres per drawing unit
_UNIT_TO_M = {1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1.0, 8: 2.54e-5, 9: 1e-9, 14: 0.1, 21: 0.9144}


def _device_for_block(name: str) -> str | None:
    n = name.lower()
    if any(w in n for w in ("desk", "workstation", "cubicle", "computer", "pc-")):
        return "workstations"
    if any(w in n for w in ("wifi", "wi-fi", "wlan", "access point", "accesspoint", "ap_", "ap-")):
        return "wifi_devices"
    if any(w in n for w in ("printer", "copier", "mfp")):
        return "printers"
    if any(w in n for w in ("camera", "cctv", "cam_", "cam-")):
        return "cameras"
    if any(w in n for w in ("server", "rack", "nvr")):
        return "servers"
    return None


def _floor_key(layer: str) -> str | None:
    m = re.search(r"(?:floor|level|lvl|storey|story)[ _-]*([0-9]+)", layer, re.I)
    if m:
        return f"Floor {int(m.group(1))}"
    m = re.search(r"\bL([0-9]{1,2})\b", layer)
    if m:
        return f"Floor {int(m.group(1))}"
    return None


def _clean(text: str) -> str:
    # strip MTEXT formatting codes and whitespace
    text = re.sub(r"\\[A-Za-z][^;]*;|[{}]", "", text or "")
    return text.strip()


def _empty_counts() -> dict:
    return {k: 0 for k in DEVICE_KEYS}


def _wall_segments(msp) -> list:
    """Every straight wall segment in the drawing as ((x1,y1),(x2,y2)) — from
    LINEs and (open or closed) poly-lines. Used to rebuild rooms when a plan
    draws walls as loose segments rather than closed room polylines."""
    segs: list = []
    for e in msp.query("LINE"):
        try:
            a, b = e.dxf.start, e.dxf.end
            segs.append(((float(a[0]), float(a[1])), (float(b[0]), float(b[1]))))
        except Exception:  # noqa: BLE001
            continue
    for e in msp.query("LWPOLYLINE"):
        try:
            pts = [(float(p[0]), float(p[1])) for p in e.get_points("xy")]
        except Exception:  # noqa: BLE001
            continue
        if e.closed and len(pts) >= 3:
            pts = pts + [pts[0]]
        segs += [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    for e in msp.query("POLYLINE"):
        try:
            pts = [(float(v.dxf.location[0]), float(v.dxf.location[1])) for v in e.vertices]
        except Exception:  # noqa: BLE001
            continue
        segs += [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    return segs


def _rooms_from_walls(msp, scale: float) -> list:
    """Reconstruct rooms as the closed faces enclosed by wall segments.

    unary_union nodes the segments at every intersection; polygonize then finds
    the minimal enclosed faces. Area-filtered like the closed-polyline path to
    drop slivers (wall thickness) and page borders.
    """
    from shapely.geometry import LineString
    from shapely.ops import polygonize, unary_union

    segs = [(a, b) for (a, b) in _wall_segments(msp) if a != b]
    if len(segs) < 3:
        return []
    faces = polygonize(unary_union([LineString([a, b]) for (a, b) in segs]))

    rooms = []
    for poly in faces:
        if not poly.is_valid or poly.area <= 0:
            continue
        area_m2 = poly.area * scale * scale
        if not (1.0 <= area_m2 <= 20000):
            continue
        rooms.append({"layer": "", "poly": poly, "area_m2": round(area_m2, 1),
                      "name": None, "counts": _empty_counts()})
    return rooms


def parse_dxf(path: str) -> dict:
    try:
        import ezdxf
    except ImportError:
        return {"ok": False, "error": "ezdxf is not installed", "floors": []}
    try:
        from shapely.geometry import Point, Polygon
    except ImportError:
        return {"ok": False, "error": "shapely is not installed", "floors": []}

    try:
        doc = ezdxf.readfile(path)
    except Exception as e:  # noqa: BLE001
        return {"ok": False, "error": f"Could not read DXF: {e}", "floors": []}

    msp = doc.modelspace()
    warnings: list[str] = []

    insunits = int(doc.header.get("$INSUNITS", 0) or 0)
    scale = _UNIT_TO_M.get(insunits)
    if scale is None:
        scale = 0.001  # assume millimetres (most common CAD unit) when unspecified
        warnings.append("DXF units not specified; assumed millimetres — areas may be off.")

    # ── rooms: closed polylines ──
    rooms = []
    for e in msp.query("LWPOLYLINE"):
        if not e.closed:
            continue
        pts = [(float(p[0]), float(p[1])) for p in e.get_points("xy")]
        if len(pts) < 3:
            continue
        try:
            poly = Polygon(pts)
            if not poly.is_valid or poly.area <= 0:
                continue
        except Exception:  # noqa: BLE001
            continue
        area_m2 = poly.area * scale * scale
        if not (1.0 <= area_m2 <= 20000):  # drop noise / page borders
            continue
        rooms.append({"layer": e.dxf.layer, "poly": poly, "area_m2": round(area_m2, 1),
                      "name": None, "counts": _empty_counts()})

    # Fallback: no closed room polylines — rebuild rooms from wall segments.
    if not rooms:
        rooms = _rooms_from_walls(msp, scale)
        if rooms:
            warnings.append(f"No closed room polylines; reconstructed {len(rooms)} room(s) from wall segments.")
        else:
            return {"ok": True, "source": "dxf", "floors": [],
                    "warnings": warnings + ["No rooms found (no closed polylines or enclosed wall loops)."]}

    # ── names from TEXT/MTEXT inside a room ──
    labels = []
    for t in msp.query("TEXT MTEXT"):
        try:
            ip = t.dxf.insert
            content = t.plain_text() if hasattr(t, "plain_text") else t.dxf.text
            labels.append((Point(float(ip[0]), float(ip[1])), _clean(content)))
        except Exception:  # noqa: BLE001
            continue
    for r in rooms:
        for pt, txt in labels:
            if txt and r["poly"].contains(pt):
                r["name"] = txt
                break

    # ── device counts from furniture blocks (INSERT) inside a room ──
    for ins in msp.query("INSERT"):
        key = _device_for_block(getattr(ins.dxf, "name", "") or "")
        if not key:
            continue
        try:
            ip = ins.dxf.insert
            pt = Point(float(ip[0]), float(ip[1]))
        except Exception:  # noqa: BLE001
            continue
        for r in rooms:
            if r["poly"].contains(pt):
                r["counts"][key] += 1
                break

    # ── normalise geometry to a top-left, y-down display space (like image pixels) ──
    # so the traced-polygon format is identical to the PNG/JPG path.
    all_coords = [c for r in rooms for c in r["poly"].exterior.coords]
    min_x = min(c[0] for c in all_coords)
    max_y = max(c[1] for c in all_coords)

    def _display_poly(poly) -> list:
        # drop the duplicate closing vertex shapely appends
        pts = list(poly.exterior.coords)[:-1]
        return [[round(x - min_x, 2), round(max_y - y, 2)] for (x, y) in pts]

    # ── group into floors by layer ──
    keys = {_floor_key(r["layer"]) for r in rooms}
    keys.discard(None)

    def room_out(r: dict, idx: int) -> dict:
        return {"name": r["name"] or f"Room {idx + 1}", "area_m2": r["area_m2"],
                "polygon": _display_poly(r["poly"]), **r["counts"]}

    floors = []
    if not keys:
        floors.append({"name": "Floor 1", "rooms": [room_out(r, i) for i, r in enumerate(rooms)]})
    else:
        for k in sorted(keys):
            frooms = [r for r in rooms if _floor_key(r["layer"]) == k]
            floors.append({"name": k, "rooms": [room_out(r, i) for i, r in enumerate(frooms)]})
        orphan = [r for r in rooms if _floor_key(r["layer"]) is None]
        if orphan:
            base = len(floors[0]["rooms"])
            floors[0]["rooms"] += [room_out(r, base + i) for i, r in enumerate(orphan)]

    return {"ok": True, "source": "dxf", "floors": floors, "warnings": warnings}
