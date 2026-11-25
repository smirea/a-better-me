"""Builds every canonical machine and prop GLB plus `src/machines/anchors.json`.

    blender -b --factory-startup -P exercise-motion/scripts/machines/build_machines.py [-- --only id,id]

Deterministic: the same Blender version writes byte-identical GLBs and anchors.
"""

import json
import os
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import lib  # noqa: E402
from machines import MACHINES  # noqa: E402
from props import PROPS  # noqa: E402

OUT_DIR = os.path.join(lib.MOTION_ROOT, "models", "machines")
ANCHORS = os.path.join(lib.MOTION_ROOT, "src", "machines", "anchors.json")


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    only = None
    if "--only" in argv:
        only = set(argv[argv.index("--only") + 1].split(","))
    return only


def check(m):
    lo, hi = m.bounds()
    if m.kind == "machine":
        if abs(lo.y) > 0.001:
            raise SystemExit(f"{m.id}: min y {lo.y:.4f} is not on the floor")
        cx = (lo.x + hi.x) / 2
        if abs(cx) > 0.001 and not m.params.get("asymmetric"):
            raise SystemExit(f"{m.id}: not centered on x = 0 (center {cx:.4f})")


def main():
    only = args()
    os.makedirs(OUT_DIR, exist_ok=True)
    existing = {}
    if only and os.path.exists(ANCHORS):
        with open(ANCHORS) as f:
            existing = {e["id"]: e for e in json.load(f)}
    entries = dict(existing)
    for build in [*MACHINES, *PROPS]:
        lib.reset_scene()
        mats = lib.ensure_materials()
        m = build()
        if only and m.id not in only:
            continue
        check(m)
        m.separate_overlays()
        m.snap_surfaces()
        _, tris = m.realise(mats)
        path = os.path.join(OUT_DIR, f"{m.id}.glb")
        lib.export_glb(path)
        entries[m.id] = m.summary(tris, os.path.getsize(path))
        print(f"built {m.id}: {tris} tris, {os.path.getsize(path) / 1024:.0f} KB")
    ordered = sorted(entries.values(), key=lambda e: (e["kind"] != "machine", e["id"]))
    with open(ANCHORS, "w") as f:
        json.dump(ordered, f, indent=1)
        f.write("\n")
    print(f"wrote {ANCHORS} ({len(ordered)} entries)")


main()
