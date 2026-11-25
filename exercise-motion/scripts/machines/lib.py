"""Geometry kit for the canonical machine library.

Everything here is authored in glTF/three.js space (meters, +Y up, the lifter's
primary stance facing +Z, the lifter's left at +X) and converted to Blender's Z-up
space only when objects are created, so the numbers in machine modules read the
same as the TypeScript factories that consume `anchors.json`.
"""

import json
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.geometry import intersect_ray_tri

HERE = os.path.dirname(os.path.abspath(__file__))
MOTION_ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
SKINS_PATH = os.path.join(MOTION_ROOT, "src", "machines", "skins.json")

SEMANTIC = [
    "mat_frame",
    "mat_pad",
    "mat_chrome",
    "mat_grip",
    "mat_plate",
    "mat_stack",
    "mat_accent",
    "mat_cable",
    "mat_rubber",
    "mat_wood",
    "mat_tread",
]

# Collision material tags understood by `src/equipment.ts` (`Material`).
PART_MATERIAL = {
    "mat_frame": "steel",
    "mat_pad": "pad",
    "mat_chrome": "chrome",
    "mat_grip": "rubber",
    "mat_plate": "plate",
    "mat_stack": "plate",
    "mat_accent": "accent",
    "mat_cable": "cable",
    "mat_rubber": "rubber",
    "mat_wood": "wood",
    "mat_tread": "rubber",
}

# glTF (x, y, z) -> Blender (x, -z, y), the inverse of the exporter's +Y-up conversion.
TO_BLENDER = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))

X = Vector((1, 0, 0))
Y = Vector((0, 1, 0))
Z = Vector((0, 0, 1))


# Faces of different materials closer than this along a shared normal z-fight at viewing distance.
COPLANAR = 0.0011
# How far an overlay is lifted off the surface it sits on, so depth precision always separates them.
OVERLAY_LIFT = 0.0015
# Which of two coplanar materials is the overlay: it moves out, the higher rank wins.
OVERLAY_RANK = {"mat_grip": 6, "mat_tread": 6, "mat_accent": 5, "mat_rubber": 4, "mat_pad": 3, "mat_cable": 3, "mat_chrome": 2, "mat_stack": 1, "mat_plate": 1, "mat_frame": 0, "mat_wood": 0}


def _overlap(t1, t2):
    n = t1[3]
    u = n.orthogonal().normalized()
    w = n.cross(u)
    polys = [[(p.dot(u), p.dot(w)) for p in t[:3]] for t in (t1, t2)]
    for poly in polys:
        for i in range(3):
            (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % 3]
            ax, ay = -(y2 - y1), x2 - x1
            length = (ax * ax + ay * ay) ** 0.5
            if length < 1e-9:
                continue
            ax, ay = ax / length, ay / length
            p0 = [x * ax + y * ay for x, y in polys[0]]
            p1 = [x * ax + y * ay for x, y in polys[1]]
            if max(p0) < min(p1) + 0.0008 or max(p1) < min(p0) + 0.0008:
                return False
    return True


# Materials a body rests on; a surface snaps to these before bare frame.
CONTACT = {"mat_pad", "mat_rubber", "mat_wood", "mat_grip", "mat_tread"}


def v(p):
    return Vector((float(p[0]), float(p[1]), float(p[2])))


def r6(x):
    return round(float(x), 6)


def vec_list(p):
    return [r6(p[0]), r6(p[1]), r6(p[2])]


def quat_list(q):
    q = q.normalized()
    if q.w < 0:
        q = -q
    return [r6(q.x), r6(q.y), r6(q.z), r6(q.w)]


def rot_x(deg):
    return Quaternion(X, math.radians(deg))


def rot_y(deg):
    return Quaternion(Y, math.radians(deg))


def rot_z(deg):
    return Quaternion(Z, math.radians(deg))


def quat_from_to(a, b):
    a = v(a).normalized()
    b = v(b).normalized()
    return a.rotation_difference(b)


def frame_quat(along, up_hint=(0, 1, 0)):
    """Rotation whose local +Z points along `along` and local +Y as close to `up_hint` as possible."""
    zz = v(along).normalized()
    hint = v(up_hint).normalized()
    if abs(zz.dot(hint)) > 0.98:
        hint = Vector((1, 0, 0)) if abs(zz.x) < 0.9 else Vector((0, 0, 1))
    xx = hint.cross(zz).normalized()
    yy = zz.cross(xx).normalized()
    m = Matrix((xx, yy, zz)).transposed()
    return m.to_quaternion()


def load_skin(skin_id=None):
    with open(SKINS_PATH) as f:
        skins = json.load(f)
    if skin_id is None:
        return skins[0]
    for skin in skins:
        if skin["id"] == skin_id:
            return skin
    raise KeyError(skin_id)


def hex_rgba(h):
    h = h.lstrip("#")
    srgb = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (lin[0], lin[1], lin[2], 1.0)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects, bpy.data.images):
        for item in list(block):
            block.remove(item)


def ensure_materials(skin_id=None):
    skin = load_skin(skin_id)
    mats = {}
    for name in SEMANTIC:
        style = skin["materials"][name]
        mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = hex_rgba(style["color"])
        bsdf.inputs["Roughness"].default_value = style["roughness"]
        bsdf.inputs["Metallic"].default_value = style["metalness"]
        mat.diffuse_color = hex_rgba(style["color"])
        mat.roughness = style["roughness"]
        mat.metallic = style["metalness"]
        mats[name] = mat
    return mats


# ---------------------------------------------------------------------------
# Primitive mesh generators. Each returns (verts, faces) in a local frame.
# ---------------------------------------------------------------------------


def _extract(bm):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    verts = [tuple(vt.co) for vt in bm.verts]
    index = {vt: i for i, vt in enumerate(bm.verts)}
    faces = [tuple(index[vt] for vt in f.verts) for f in bm.faces]
    bm.free()
    return verts, faces


def gen_box(size, bevel=0.0, segments=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for vt in bm.verts:
        vt.co = Vector((vt.co.x * size[0], vt.co.y * size[1], vt.co.z * size[2]))
    if bevel > 0:
        b = min(bevel, min(size) * 0.49)
        bmesh.ops.bevel(
            bm,
            geom=list(bm.edges),
            offset=b,
            segments=segments,
            affect="EDGES",
            profile=0.5,
            clamp_overlap=True,
        )
    return _extract(bm)


def gen_revolve(profile, segments=32, cap_start=True, cap_end=True, closed=False):
    """Revolves `[(radius, y), ...]` around local +Y. Zero radius collapses a ring to a pole."""
    bm = bmesh.new()
    rings = []
    for radius, y in profile:
        if radius <= 1e-6:
            rings.append([bm.verts.new((0, y, 0))])
            continue
        ring = []
        for k in range(segments):
            a = 2 * math.pi * k / segments
            ring.append(bm.verts.new((radius * math.cos(a), y, -radius * math.sin(a))))
        rings.append(ring)
    pairs = list(zip(rings, rings[1:]))
    if closed:
        pairs.append((rings[-1], rings[0]))
        cap_start = cap_end = False
    for r0, r1 in pairs:
        if len(r0) == 1 and len(r1) == 1:
            continue
        for k in range(segments):
            k1 = (k + 1) % segments
            if len(r0) == 1:
                bm.faces.new((r0[0], r1[k], r1[k1]))
            elif len(r1) == 1:
                bm.faces.new((r0[k], r1[0], r0[k1]))
            else:
                bm.faces.new((r0[k], r1[k], r1[k1], r0[k1]))
    if cap_start and len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])))
    if cap_end and len(rings[-1]) > 1:
        bm.faces.new(rings[-1])
    return _extract(bm)


def gen_cylinder(radius, length, segments=24, chamfer=0.0):
    h = length / 2
    if chamfer > 0:
        c = min(chamfer, radius * 0.4, h * 0.4)
        prof = [(0, -h), (radius - c, -h), (radius, -h + c), (radius, h - c), (radius - c, h), (0, h)]
    else:
        prof = [(0, -h), (radius, -h), (radius, h), (0, h)]
    return gen_revolve(prof, segments, cap_start=False, cap_end=False)


def gen_torus(major, minor, segments=32, minor_segments=12):
    """Torus around local +Y."""
    bm = bmesh.new()
    rings = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        ca, sa = math.cos(a), math.sin(a)
        ring = []
        for j in range(minor_segments):
            b = 2 * math.pi * j / minor_segments
            rr = major + minor * math.cos(b)
            ring.append(bm.verts.new((rr * ca, minor * math.sin(b), -rr * sa)))
        rings.append(ring)
    for i in range(segments):
        r0, r1 = rings[i], rings[(i + 1) % segments]
        for j in range(minor_segments):
            j1 = (j + 1) % minor_segments
            bm.faces.new((r0[j], r1[j], r1[j1], r0[j1]))
    return _extract(bm)


def rounded_polyline(points, radius, steps=6):
    """Replaces each interior corner of a polyline with a circular fillet of `radius`."""
    pts = [v(p) for p in points]
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = pts[i - 1], pts[i], pts[i + 1]
        d0 = (b - a).normalized()
        d1 = (c - b).normalized()
        cos_t = max(-0.999, min(0.999, d0.dot(d1)))
        theta = math.acos(cos_t)
        if theta < 1e-3:
            out.append(b)
            continue
        cut = min(radius * math.tan(theta / 2), (b - a).length * 0.45, (c - b).length * 0.45)
        p0 = b - d0 * cut
        p1 = b + d1 * cut
        for k in range(steps + 1):
            t = k / steps
            q0 = p0.lerp(b, t)
            q1 = b.lerp(p1, t)
            out.append(q0.lerp(q1, t))
    out.append(pts[-1])
    return out


def gen_sweep(points, radius, sides=12):
    """Round tube swept along a polyline (parallel-transported frames, capped ends)."""
    pts = [v(p) for p in points]
    n = len(pts)
    bm = bmesh.new()
    rings = []
    xx = None
    for i in range(n):
        if i == 0:
            t = (pts[1] - pts[0]).normalized()
        elif i == n - 1:
            t = (pts[-1] - pts[-2]).normalized()
        else:
            t = ((pts[i] - pts[i - 1]).normalized() + (pts[i + 1] - pts[i]).normalized()).normalized()
        if xx is None:
            hint = Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((1, 0, 0))
            xx = hint.cross(t).normalized()
        else:
            xx = (xx - t * xx.dot(t)).normalized()
        yy = t.cross(xx).normalized()
        ring = []
        for k in range(sides):
            ang = 2 * math.pi * k / sides
            ring.append(bm.verts.new(pts[i] + xx * math.cos(ang) * radius + yy * math.sin(ang) * radius))
        rings.append(ring)
    for i in range(n - 1):
        r0, r1 = rings[i], rings[i + 1]
        for k in range(sides):
            k1 = (k + 1) % sides
            bm.faces.new((r0[k], r0[k1], r1[k1], r1[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    return _extract(bm)


# ---------------------------------------------------------------------------
# Machine builder
# ---------------------------------------------------------------------------


class Machine:
    def __init__(self, mid, name, kind="machine", facing="", notes=""):
        self.id = mid
        self.name = name
        self.kind = kind
        self.facing = facing
        self.notes = notes
        self.nodes = {}
        self.geo = {}
        self.parts = []
        self.anchors = {
            "handles": {},
            "surfaces": {},
            "footplates": {},
            "pulleys": {},
            "rails": {},
            "pivots": {},
            "hooks": {},
            "points": {},
        }
        self.params = {}

    # -- rig ---------------------------------------------------------------
    def node(self, name, pivot, parent=None):
        if name in self.nodes:
            raise ValueError(f"{self.id}: duplicate node {name}")
        if parent is not None and parent not in self.nodes:
            raise ValueError(f"{self.id}: unknown parent {parent}")
        self.nodes[name] = {"pivot": v(pivot), "parent": parent}
        return name

    # -- geometry ------------------------------------------------------------
    def _emit(self, verts, faces, mat, node, rot, pos):
        if mat not in SEMANTIC:
            raise ValueError(f"{self.id}: non-semantic material {mat}")
        if node is not None and node not in self.nodes:
            raise ValueError(f"{self.id}: unknown node {node}")
        key = (node, mat)
        bucket = self.geo.setdefault(key, ([], []))
        base = len(bucket[0])
        rot = rot if rot is not None else Quaternion()
        pv = v(pos)
        for co in verts:
            bucket[0].append(rot @ Vector(co) + pv)
        for f in faces:
            bucket[1].append(tuple(i + base for i in f))

    def _part(self, pid, shape, size, pos, quat, mat, collide, node):
        if pid is None:
            return
        if any(p["id"] == pid for p in self.parts):
            raise ValueError(f"{self.id}: duplicate part {pid}")
        self.parts.append(
            {
                "id": pid,
                "shape": shape,
                "size": vec_list(size),
                "pos": vec_list(pos),
                "quat": quat_list(quat),
                "material": PART_MATERIAL[mat],
                "collide": collide,
                **({"node": node} if node else {}),
            }
        )

    def box(self, center, size, mat, node=None, rot=None, bevel=0.006, segments=2, part=None, collide=True):
        verts, faces = gen_box(size, bevel, segments)
        self._emit(verts, faces, mat, node, rot, center)
        self._part(part, "box", size, center, rot or Quaternion(), mat, collide, node)

    def pad(self, center, size, mat="mat_pad", node=None, rot=None, radius=0.022, part=None, collide=True):
        """Upholstered pad: a rounded box with soft, well-segmented edges."""
        self.box(center, size, mat, node, rot, bevel=radius, segments=4, part=part, collide=collide)

    def beam(self, a, b, w, h, mat="mat_frame", node=None, up=(0, 1, 0), bevel=0.006, part=None, collide=True, extend=0.0):
        """Rectangular tube from `a` to `b` (w across, h along `up`)."""
        a, b = v(a), v(b)
        d = b - a
        length = d.length + 2 * extend
        q = frame_quat(d, up)
        center = (a + b) / 2
        self.box(center, (w, h, length), mat, node, q, bevel, 2, part, collide)

    def tube(self, a, b, r, mat="mat_chrome", node=None, segments=20, chamfer=0.0, part=None, collide=True):
        """Round tube/shaft from `a` to `b`."""
        a, b = v(a), v(b)
        d = b - a
        verts, faces = gen_cylinder(r, d.length, segments, chamfer)
        q = quat_from_to((0, 1, 0), d)
        center = (a + b) / 2
        self._emit(verts, faces, mat, node, q, center)
        qx = quat_from_to((1, 0, 0), d)
        self._part(part, "cylinder", (r, d.length, 0), center, qx, mat, collide, node)

    def disc(self, center, axis, r, thickness, mat, node=None, segments=32, chamfer=0.0, part=None, collide=True):
        c = v(center)
        a = v(axis).normalized() * (thickness / 2)
        self.tube(c - a, c + a, r, mat, node, segments, chamfer, part, collide)

    def revolve(self, center, axis, profile, mat, node=None, segments=32, cap_start=True, cap_end=True, closed=False):
        verts, faces = gen_revolve(profile, segments, cap_start, cap_end, closed)
        q = quat_from_to((0, 1, 0), axis)
        self._emit(verts, faces, mat, node, q, center)

    def torus(self, center, axis, major, minor, mat, node=None, segments=32, minor_segments=12):
        verts, faces = gen_torus(major, minor, segments, minor_segments)
        q = quat_from_to((0, 1, 0), axis)
        self._emit(verts, faces, mat, node, q, center)

    def sweep(self, points, r, mat="mat_chrome", node=None, sides=14, fillet=0.0):
        pts = rounded_polyline(points, fillet) if fillet > 0 else points
        verts, faces = gen_sweep(pts, r, sides)
        self._emit(verts, faces, mat, node, None, (0, 0, 0))

    def collider(self, pid, shape, size, pos, quat=None, mat="mat_frame", node=None, collide=True):
        """A collision/contact shape with no visible mesh (e.g. a simplified envelope)."""
        self._part(pid, shape, size, pos, quat or Quaternion(), mat, collide, node)

    # -- anchors -------------------------------------------------------------
    def handle(self, name, pos, axis, palm, radius, length, grip, node=None):
        self._part(f"grip_{name}", "cylinder", (radius, length, 0), v(pos), quat_from_to((1, 0, 0), axis), "mat_grip", True, node)
        self.anchors["handles"][name] = {
            "pos": vec_list(pos),
            "axis": vec_list(v(axis).normalized()),
            "palmNormal": vec_list(v(palm).normalized()),
            "radius": r6(radius),
            "length": r6(length),
            "grip": grip,
            **({"node": node} if node else {}),
        }

    def surface(self, name, origin, normal, up, node=None):
        self.anchors["surfaces"][name] = {
            "origin": vec_list(origin),
            "normal": vec_list(v(normal).normalized()),
            "up": vec_list(v(up).normalized()),
            **({"node": node} if node else {}),
        }

    def footplate(self, name, origin, normal, up, width, min_along, max_along, node=None):
        self.surface(name, origin, normal, up, node)
        self.anchors["footplates"][name] = {
            "surface": name,
            "width": r6(width),
            "minAlong": r6(min_along),
            "maxAlong": r6(max_along),
        }

    def pulley(self, name, pos, exit_dir, node=None, stack=None, ratio=1.0, stack_travel=0.0):
        self.anchors["pulleys"][name] = {
            "pos": vec_list(pos),
            "exitDir": vec_list(v(exit_dir).normalized()),
            **({"nodeName": node} if node else {}),
            **({"stackNode": stack} if stack else {}),
            "travelRatio": r6(ratio),
            "stackTravel": r6(stack_travel),
        }

    def rail(self, name, origin, direction, lo, hi, node=None):
        self.anchors["rails"][name] = {
            "origin": vec_list(origin),
            "dir": vec_list(v(direction).normalized()),
            "minTravel": r6(lo),
            "maxTravel": r6(hi),
            **({"nodeName": node} if node else {}),
        }

    def pivot(self, name, origin, axis, lo_deg, hi_deg, node=None):
        self.anchors["pivots"][name] = {
            "origin": vec_list(origin),
            "axis": vec_list(v(axis).normalized()),
            "minAngleRad": r6(math.radians(lo_deg)),
            "maxAngleRad": r6(math.radians(hi_deg)),
            **({"nodeName": node} if node else {}),
        }

    def hook(self, name, pos, node=None):
        self.anchors["hooks"][name] = {"pos": vec_list(pos), **({"node": node} if node else {})}

    def point(self, name, pos, node=None):
        self.anchors["points"][name] = {"pos": vec_list(pos), **({"node": node} if node else {})}

    # -- realisation -----------------------------------------------------------
    def realise(self, mats):
        root = bpy.data.objects.new(self.id, None)
        bpy.context.scene.collection.objects.link(root)
        empties = {None: (root, Vector((0, 0, 0)))}
        for name in self._node_order():
            info = self.nodes[name]
            parent_obj, parent_pivot = empties[info["parent"]]
            empty = bpy.data.objects.new(name, None)
            empty.empty_display_size = 0.05
            bpy.context.scene.collection.objects.link(empty)
            empty.parent = parent_obj
            empty.matrix_parent_inverse = Matrix.Identity(4)
            empty.location = (TO_BLENDER @ (info["pivot"] - parent_pivot).to_4d()).to_3d()
            empties[name] = (empty, info["pivot"])
        tris = 0
        for (node, mat), (verts, faces) in sorted(self.geo.items(), key=lambda kv: (kv[0][0] or "", kv[0][1])):
            parent_obj, pivot = empties[node]
            local = [(TO_BLENDER @ (co - pivot).to_4d()).to_3d() for co in verts]
            label = f"{node or 'frame'}.{mat[4:]}"
            mesh = bpy.data.meshes.new(label)
            mesh.from_pydata(local, [], faces)
            mesh.validate(clean_customdata=False)
            mesh.materials.append(mats[mat])
            mesh.shade_smooth()
            mesh.set_sharp_from_angle(angle=math.radians(36))
            obj = bpy.data.objects.new(label, mesh)
            bpy.context.scene.collection.objects.link(obj)
            obj.parent = parent_obj
            obj.matrix_parent_inverse = Matrix.Identity(4)
            tris += sum(len(f) - 2 for f in faces)
        return root, tris

    def _node_order(self):
        order, seen = [], set()

        def visit(n):
            if n in seen:
                return
            parent = self.nodes[n]["parent"]
            if parent:
                visit(parent)
            seen.add(n)
            order.append(n)

        for n in self.nodes:
            visit(n)
        return order

    def bounds(self):
        lo = Vector((1e9, 1e9, 1e9))
        hi = Vector((-1e9, -1e9, -1e9))
        for verts, _ in self.geo.values():
            for co in verts:
                lo = Vector(map(min, lo, co))
                hi = Vector(map(max, hi, co))
        return lo, hi

    def coplanar_overlaps(self):
        """Pairs of same-facing faces of different materials within COPLANAR of one plane and overlapping: they z-fight."""
        tris = []
        for key, (verts, faces) in self.geo.items():
            for fi, f in enumerate(faces):
                for k in range(1, len(f) - 1):
                    a, b, c = verts[f[0]], verts[f[k]], verts[f[k + 1]]
                    n = (b - a).cross(c - a)
                    if n.length < 2e-7:
                        continue
                    n.normalize()
                    tris.append((a, b, c, n, n.dot(a), key, fi))
        buckets = {}
        for t in tris:
            n = t[3]
            buckets.setdefault((round(n.x * 50), round(n.y * 50), round(n.z * 50), round(t[4] / COPLANAR)), []).append(t)
        out = []
        for key, group in buckets.items():
            near = [t for dd in (-1, 0, 1) for t in buckets.get(key[:3] + (key[3] + dd,), [])]
            for t1 in group:
                for t2 in near:
                    if t1[5][1] == t2[5][1] or abs(t1[4] - t2[4]) > COPLANAR or t1[3].dot(t2[3]) < 0.999:
                        continue
                    if _overlap(t1, t2):
                        out.append((t1, t2))
        return out

    def separate_overlays(self):
        """Lifts every overlay face that shares a plane with a different material OVERLAY_LIFT proud of it, so a grip
        sleeve, tread skin, rubber cap or collar draws on top instead of flickering against the steel under it."""
        for _ in range(4):
            pairs = self.coplanar_overlaps()
            if not pairs:
                return
            self._lift(pairs)
        left = self.coplanar_overlaps()
        if left:
            t1, t2 = left[0]
            raise ValueError(f"{self.id}: {len(left)} coplanar faces still overlap, e.g. {t1[5]} vs {t2[5]} near {tuple(round(x, 3) for x in t1[0])}")

    def _lift(self, pairs):
        lift = {}
        for t1, t2 in pairs:
            top, base = (t1, t2) if OVERLAY_RANK.get(t1[5][1], 0) >= OVERLAY_RANK.get(t2[5][1], 0) else (t2, t1)
            # A face on the floor can't drop below it: sink the base into the part instead.
            on_floor = top[3].y < -0.5 and min(p.y for p in top[:3]) < 0.002
            face, sign = (base, -1) if on_floor else (top, 1)
            verts, faces = self.geo[face[5]]
            for vi in faces[face[6]]:
                lift.setdefault((face[5], vi), set()).add(tuple(round(sign * x, 4) for x in face[3]))
        for (key, vi), normals in lift.items():
            d = Vector((0, 0, 0))
            for n in normals:
                d += Vector(n)
            if d.length > 1e-9:
                self.geo[key][0][vi] = self.geo[key][0][vi] + d.normalized() * OVERLAY_LIFT

    def snap_surfaces(self):
        """Moves every surface origin onto the mesh along its normal, so a body resting on it touches what renders.

        Authors place a surface roughly; the ray from just outside it decides where the upholstery or tread really is.
        A surface whose ray misses the mesh is a modelling error, and the build stops on it.
        """
        tris = []
        for (_, mat), (verts, faces) in self.geo.items():
            if mat == "mat_cable":
                continue
            for f in faces:
                for k in range(1, len(f) - 1):
                    tris.append((verts[f[0]], verts[f[k]], verts[f[k + 1]], mat in CONTACT))
        for name, s in self.anchors["surfaces"].items():
            n = Vector(s["normal"])
            up = Vector(s["up"])
            origin = Vector(s["origin"])
            # The origin may sit on the pad's edge (a backrest's hinge), so probe a little way up the surface too and
            # move the origin only along its normal: its place on the surface stays where the author put it.
            # The contact face is the outermost upholstery or tread a few probes up the surface find: past a pad's
            # rounded edge, at a roller's tangent line, and never a steel lip or a support beam running in front of it.
            found = {True: None, False: None}
            for along in (0.0, 0.03, 0.06, 0.1):
                start = origin + up * along + n * 0.12
                for a, b, c, soft in tris:
                    hit = intersect_ray_tri(a, b, c, -n, start, True)
                    if hit is not None:
                        d = (hit - start).length - 0.12
                        if abs(d) <= 0.05 and (found[soft] is None or d < found[soft]):
                            found[soft] = d
            gap = found[True] if found[True] is not None else found[False]
            if gap is None:
                raise ValueError(f"{self.id}: surface {name} at {s['origin']} has no mesh within 5 cm along its normal")
            s["origin"] = vec_list(origin - n * gap)

    def summary(self, tris, file_bytes):
        lo, hi = self.bounds()
        return {
            "id": self.id,
            "name": self.name,
            "kind": self.kind,
            "file": f"machines/{self.id}",
            "facing": self.facing,
            "notes": self.notes,
            "bounds": {"min": vec_list(lo), "max": vec_list(hi)},
            "tris": tris,
            "bytes": file_bytes,
            "materials": sorted({m for (_, m) in self.geo}),
            "params": self.params,
            "nodes": {
                n: {"pivot": vec_list(i["pivot"]), "parent": i["parent"]} for n, i in self.nodes.items()
            },
            "parts": self.parts,
            "anchors": {k: val for k, val in self.anchors.items() if val},
        }


def export_glb(path):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_extras=False,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_attributes=False,
        export_draco_mesh_compression_enable=False,
    )
