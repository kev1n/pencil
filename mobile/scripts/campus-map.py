#!/usr/bin/env python3
"""Builds src/data/campus-map.ts: the Evanston campus as SVG path data.

The app draws its own map from these shapes, in its own colours, and never
fetches map tiles. Geometry is from OpenStreetMap (ODbL), fetched once here:

    python3 scripts/campus-map.py            # fetch and rebuild
    python3 scripts/campus-map.py osm.json   # rebuild from a saved answer
"""
import json, math, re, sys, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NORTH, SOUTH, WEST, EAST = 42.0622, 42.0488, -87.6812, -87.6680
HEIGHT = 560
SCALE = HEIGHT / (NORTH - SOUTH)
LON_SCALE = SCALE * math.cos(math.radians(42.055))
WIDTH = round((EAST - WEST) * LON_SCALE)
QUERY = f"""[out:json][timeout:90][bbox:{SOUTH},{WEST},{NORTH},{EAST}];
(way[building];relation[building];way[highway];relation[natural=water];way[natural=water];way[leisure=pitch];);
out geom;"""


def xy(p):
    return ((p["lon"] - WEST) * LON_SCALE, (NORTH - p["lat"]) * SCALE)


def simplify(points, tol):
    """Douglas-Peucker."""
    if len(points) < 3:
        return points
    if math.hypot(points[0][0] - points[-1][0], points[0][1] - points[-1][1]) < 1e-6:
        # A closed ring: cut at the point farthest from the start, do each half.
        cut = max(range(len(points)), key=lambda i: math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]))
        if cut in (0, len(points) - 1):
            return points
        return simplify(points[: cut + 1], tol)[:-1] + simplify(points[cut:], tol)
    (ax, ay), (bx, by) = points[0], points[-1]
    length = math.hypot(bx - ax, by - ay) or 1e-9
    far, index = 0.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        d = abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length
        if d > far:
            far, index = d, i
    if far <= tol:
        return [points[0], points[-1]]
    return simplify(points[: index + 1], tol)[:-1] + simplify(points[index:], tol)


def num(v):
    return f"{v:.1f}".rstrip("0").rstrip(".")


def path(points, close):
    return "M" + "L".join(f"{num(x)} {num(y)}" for x, y in points) + ("Z" if close else "")


def inside(pt, poly):
    x, y = pt
    hit = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            hit = not hit
    return hit


def onmap(points, pad=0):
    return any(-pad <= x <= WIDTH + pad and -pad <= y <= HEIGHT + pad for x, y in points)


def main():
    if len(sys.argv) > 1:
        data = json.loads(Path(sys.argv[1]).read_text())
    else:
        req = urllib.request.Request(
            "https://overpass-api.de/api/interpreter",
            data=urllib.parse.urlencode({"data": QUERY}).encode(),
            headers={"User-Agent": "campus-map-builder"},
        )
        data = json.loads(urllib.request.urlopen(req, timeout=150).read())

    buildings, streets, walks, fields, shore = [], [], [], [], []
    for el in data["elements"]:
        tags = el.get("tags", {})
        if "building" in tags:
            rings = [el["geometry"]] if el["type"] == "way" else [m["geometry"] for m in el["members"] if m.get("role") == "outer" and m.get("geometry")]
            for ring in rings:
                pts = simplify([xy(p) for p in ring], 0.5)
                if len(pts) >= 4 and onmap(pts):
                    buildings.append(pts)
        elif "highway" in tags and el["type"] == "way":
            kind = tags["highway"]
            pts = simplify([xy(p) for p in el["geometry"]], 0.6)
            if not onmap(pts):
                continue
            if kind in ("secondary", "tertiary", "residential", "unclassified"):
                streets.append(pts)
            elif kind in ("footway", "pedestrian", "path", "cycleway") and tags.get("footway") not in ("sidewalk", "crossing"):
                walks.append(pts)
        elif tags.get("leisure") == "pitch" and el["type"] == "way":
            pts = simplify([xy(p) for p in el["geometry"]], 0.6)
            if onmap(pts):
                fields.append(pts)
        elif tags.get("natural") == "water":
            ways = [el["geometry"]] if el["type"] == "way" else [m["geometry"] for m in el["members"] if m.get("geometry")]
            for way in ways:
                pts = [xy(p) for p in way]
                if onmap(pts, 40):
                    shore.append(pts)

    # The shore: the lake's edge pieces joined end to end where they meet.
    chains = [list(s) for s in shore]
    joined = True
    while joined:
        joined = False
        for i, a in enumerate(chains):
            for j, b in enumerate(chains):
                if i == j:
                    continue
                close = lambda p, q: math.hypot(p[0] - q[0], p[1] - q[1]) < 0.01
                if close(a[-1], b[0]):
                    chains[i] = a + b[1:]
                elif close(a[-1], b[-1]):
                    chains[i] = a + b[-2::-1]
                elif close(a[0], b[-1]):
                    chains[i] = b + a[1:]
                elif close(a[0], b[0]):
                    chains[i] = b[::-1] + a[1:]
                else:
                    continue
                del chains[j]
                joined = True
                break
            if joined:
                break
    pad = 60
    water = []
    for chain in chains:
        kept = [p for p in chain if -pad <= p[0] <= WIDTH + pad and -pad <= p[1] <= HEIGHT + pad]
        if len(kept) < 2:
            continue
        kept = simplify(kept, 0.5)
        closed = math.hypot(kept[0][0] - kept[-1][0], kept[0][1] - kept[-1][1]) < 0.01
        if not closed:
            # The open lake: closed off around the east edge of the map.
            north_first = kept[0][1] < kept[-1][1]
            line = kept if not north_first else kept[::-1]  # south end first
            kept = line + [(WIDTH + pad, line[-1][1]), (WIDTH + pad, -pad), (WIDTH + 2 * pad, -pad), (WIDTH + 2 * pad, HEIGHT + pad), (WIDTH + pad, HEIGHT + pad), (WIDTH + pad, line[0][1])]
        water.append(kept)

    # Each classroom building in data/buildings.ts gets its own outline, so a
    # stop on the walk can be filled in.
    table = re.findall(r'\{ name: "([^"]+)", lat: ([\d.]+), lon: (-[\d.]+)', (ROOT / "src/data/buildings.ts").read_text())
    named, used = {}, set()
    for name, lat, lon in table:
        pt = xy({"lat": float(lat), "lon": float(lon)})
        best, best_d = None, 1e9
        for i, poly in enumerate(buildings):
            if inside(pt, poly):
                best, best_d = i, 0
                break
            cx = sum(p[0] for p in poly) / len(poly)
            cy = sum(p[1] for p in poly) / len(poly)
            d = math.hypot(cx - pt[0], cy - pt[1])
            if d < best_d:
                best, best_d = i, d
        if best is not None and best_d < 16:
            named[name] = path(buildings[best], True)
            used.add(best)
    rest = "".join(path(b, True) for i, b in enumerate(buildings) if i not in used)

    out = [
        "// Generated by scripts/campus-map.py: do not edit by hand.",
        "// The Evanston campus as SVG path data, north up. Geometry © OpenStreetMap",
        "// contributors (ODbL); the app draws it in its own colours.",
        "",
        f"export const MAP = {{ north: {NORTH}, west: {WEST}, width: {WIDTH}, height: {HEIGHT}, latScale: {SCALE:.3f}, lonScale: {LON_SCALE:.3f} }};",
        f"export const WATER = {json.dumps(''.join(path(w, True) for w in water))};",
        f"export const FIELDS = {json.dumps(''.join(path(f, True) for f in fields))};",
        f"export const STREETS = {json.dumps(''.join(path(s, False) for s in streets))};",
        f"export const WALKS = {json.dumps(''.join(path(w, False) for w in walks))};",
        f"export const OTHER_BUILDINGS = {json.dumps(rest)};",
        "// Outlines of the buildings in data/buildings.ts, by name.",
        f"export const BUILDING_SHAPES: Record<string, string> = {json.dumps(named, indent=2)};",
        "",
    ]
    target = ROOT / "src/data/campus-map.ts"
    target.write_text("\n".join(out))
    missing = [n for n, _, _ in table if n not in named]
    print(f"{target.name}: {target.stat().st_size // 1024} KB, {len(buildings)} buildings, {len(named)} named, water chains {len(water)}; no outline for {missing}")


main()
