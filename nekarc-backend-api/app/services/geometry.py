"""Geometry helpers backed by shapely, with a pure-python fallback."""
from math import hypot

Point = tuple[float, float]


def polygon_area(points: list[Point]) -> float:
    """Area of a simple polygon (shapely if available, else shoelace)."""
    if len(points) < 3:
        return 0.0
    try:
        from shapely.geometry import Polygon

        return float(Polygon(points).area)
    except Exception:  # noqa: BLE001  (shapely missing or degenerate ring)
        s = 0.0
        n = len(points)
        for i in range(n):
            x1, y1 = points[i]
            x2, y2 = points[(i + 1) % n]
            s += x1 * y2 - x2 * y1
        return abs(s) / 2.0


def centroid(points: list[Point]) -> Point:
    if not points:
        return (0.0, 0.0)
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return (sum(xs) / len(xs), sum(ys) / len(ys))


def distance(a: Point, b: Point) -> float:
    return hypot(a[0] - b[0], a[1] - b[1])
