"""Renders contact sheets of the exported canonical GLBs on a pure white stage.

    blender -b --factory-startup -P exercise-motion/scripts/machines/render_sheets.py [-- --only id,id] [--out DIR]

It imports each GLB back (so it checks the exported file, not the build scene), recolors
only by semantic material name, and writes per-machine sheets, an overview, a props sheet,
a rig sheet (articulated nodes driven off bind), and a skin-swap sheet.
"""

import json
import math
import os
import subprocess
import sys

import bpy
from mathutils import Matrix, Vector

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402

MODELS = os.path.join(lib.MOTION_ROOT, "models", "machines")
ANCHORS = os.path.join(lib.MOTION_ROOT, "src", "machines", "anchors.json")

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = argv[argv.index("--out") + 1] if "--out" in argv else "/tmp/motion-inspect"
ONLY = set(argv[argv.index("--only") + 1].split(",")) if "--only" in argv else None
RAW = os.path.join(OUT, "machines-raw")
TILE = (640, 480)

VIEWS = {
    "angle": ((-0.62, 0.42, 0.66), False),
    "back-angle": ((0.66, 0.5, -0.58), False),
    "front": ((0, 0.04, 1), True),
    "side": ((-1, 0.02, 0), True),
    "top": ((0.0001, 1, 0.02), True),
}

# Node poses used to prove every articulated node turns about its pivot and slides on its rail.
RIG = {
    "adjustable-bench": {"backrest": ("rot", 45), "seat": ("rot", -12), "back_strut": ("strut", None)},
    "power-rack": {"jhook_L": ("off", (0, -0.25, 0)), "jhook_R": ("off", (0, -0.25, 0)), "safety_L": ("off", (0, 0.2, 0)), "safety_R": ("off", (0, 0.2, 0))},
    "dual-adjustable-pulley": {"carriage_L": ("off", (0, 0.7, 0)), "carriage_R": ("off", (0, -0.8, 0)), "pulley_L": ("yaw", -35), "pulley_R": ("yaw", 35), "stack_L": ("off", (0, 0.35, 0))},
    "single-cable-tower": {"carriage": ("off", (0, 0.7, 0)), "stack": ("off", (0, 0.3, 0))},
    "lat-pulldown": {"stack": ("off", (0, 0.4, 0)), "thigh_pad": ("off", (0, 0.08, 0))},
    "seated-cable-row": {"stack": ("off", (0, 0.4, 0))},
    "smith-machine": {"carriage": ("off", (0, -0.55, 0)), "safety_L": ("off", (0, -0.1, 0)), "safety_R": ("off", (0, -0.1, 0))},
    "leg-press-45": {"sled": ("rail", 0.45)},
    "leg-extension": {"lever_arm": ("rot", -80), "stack": ("off", (0, 0.25, 0))},
    "seated-leg-curl": {"lever_arm": ("rot", 90), "stack": ("off", (0, 0.25, 0))},
    "chest-press-machine": {"arm_L": ("rot", -27), "arm_R": ("rot", -27), "stack": ("off", (0, 0.3, 0))},
    "back-extension-bench": {"hip_pad": ("rail", 0.1)},
}


def gltf_to_blender(p):
    return Vector((p[0], -p[2], p[1]))


def setup_stage():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type == "METAL"
        scene.cycles.device = "GPU"
    except Exception:
        scene.cycles.device = "CPU"
    scene.cycles.samples = 20
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.render.resolution_x, scene.render.resolution_y = TILE
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    world = bpy.data.worlds.new("white")
    scene.world = world
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (1, 1, 1, 1)
    bg.inputs["Strength"].default_value = 0.55
    for name, loc, energy, size in (
        ("key", (-3.5, 4.5, 6.0), 900, 3.0),
        ("fill", (4.5, 3.0, 3.5), 350, 4.0),
        ("rim", (1.5, -5.0, 4.0), 400, 3.0),
    ):
        light = bpy.data.lights.new(name, "AREA")
        light.energy = energy
        light.size = size
        obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj)
        obj.location = gltf_to_blender(loc)
        direction = -obj.location
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.name = "floor"
    floor.is_shadow_catcher = True
    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return cam


def import_glb(mid):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, f"{mid}.glb"))
    objs = [o for o in bpy.data.objects if o not in before]
    return objs


def clear(objs):
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def apply_skin(skin):
    for mat in bpy.data.materials:
        style = skin["materials"].get(mat.name)
        if not style:
            continue
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = lib.hex_rgba(style["color"])
        bsdf.inputs["Roughness"].default_value = style["roughness"]
        bsdf.inputs["Metallic"].default_value = style["metalness"]


def world_bounds(objs):
    lo = Vector((1e9, 1e9, 1e9))
    hi = -lo
    bpy.context.view_layer.update()
    for o in objs:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


def frame(cam, objs, view_dir, ortho):
    lo, hi = world_bounds(objs)
    center = (lo + hi) / 2
    size = hi - lo
    d = gltf_to_blender(view_dir).normalized()
    radius = size.length / 2
    cam.data.type = "ORTHO" if ortho else "PERSP"
    if ortho:
        # Fit the bounding box's projection onto the image plane.
        up = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((0, 1, 0))
        right = d.cross(up).normalized()
        up2 = right.cross(d).normalized()
        corners = [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
        w = max(abs((c - center).dot(right)) for c in corners) * 2
        h = max(abs((c - center).dot(up2)) for c in corners) * 2
        aspect = TILE[0] / TILE[1]
        cam.data.ortho_scale = max(w, h * aspect) * 1.12
        cam.location = center + d * (radius + 3)
        cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    else:
        cam.data.lens = 40
        fov = cam.data.angle
        dist = radius / math.sin(fov / 2) * 1.0
        cam.location = center + d * dist
        cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_end = 100


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def node_obj(name):
    return bpy.data.objects.get(name)


def pose_rig(mid, entry):
    for node, (kind, val) in RIG.get(mid, {}).items():
        obj = node_obj(node)
        if obj is None:
            raise SystemExit(f"{mid}: node {node} missing from GLB")
        if kind == "rot":
            obj.matrix_basis = obj.matrix_basis @ Matrix.Rotation(math.radians(val), 4, "X")
        elif kind == "yaw":
            obj.matrix_basis = obj.matrix_basis @ Matrix.Rotation(math.radians(val), 4, "Z")
        elif kind == "off":
            obj.location = obj.location + gltf_to_blender(val)
        elif kind == "rail":
            rail = entry["anchors"]["rails"][node]
            obj.location = obj.location + gltf_to_blender([c * val for c in rail["dir"]])
        elif kind == "strut":
            # Same closure the TypeScript factory solves: strut foot on the ladder line.
            p = entry["params"]
            hinge = Vector(p["hinge"])
            theta = math.radians(RIG[mid]["backrest"][1])
            a0 = Vector(entry["nodes"]["back_strut"]["pivot"]) - hinge
            ay = hinge.y + a0.y * math.cos(theta) - a0.z * math.sin(theta)
            dy = p["ladderY"] - ay
            L = p["strutLength"]
            dz = -math.sqrt(max(L * L - dy * dy, 0))
            phi = math.atan2(dy, -dz) - theta
            obj.matrix_basis = obj.matrix_basis @ Matrix.Rotation(phi, 4, "X")


def montage(tiles, labels, out, cols):
    args = ["magick", "montage"]
    for t, lab in zip(tiles, labels):
        args += ["-label", lab, t]
    args += ["-tile", f"{cols}x", "-geometry", f"{TILE[0]}x{TILE[1]}+6+6", "-background", "white", "-pointsize", "20", "-font", "/System/Library/Fonts/Supplemental/Arial.ttf", out]
    subprocess.run(args, check=True)
    subprocess.run(["magick", out, "-background", "white", "-flatten", out], check=True)


def main():
    os.makedirs(RAW, exist_ok=True)
    with open(ANCHORS) as f:
        entries = {e["id"]: e for e in json.load(f)}
    skins = json.load(open(lib.SKINS_PATH))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    cam = setup_stage()
    machines = [e for e in entries.values() if e["kind"] == "machine" and (not ONLY or e["id"] in ONLY)]
    props = [e for e in entries.values() if e["kind"] == "prop" and (not ONLY or e["id"] in ONLY)]
    overview, overview_labels = [], []
    rig_tiles, rig_labels = [], []
    for e in machines:
        objs = import_glb(e["id"])
        tiles, labels = [], []
        for view, (d, ortho) in VIEWS.items():
            frame(cam, objs, d, ortho)
            path = os.path.join(RAW, f"{e['id']}-{view}.png")
            render(path)
            tiles.append(path)
            labels.append(f"{e['id']} · {view}")
        if e["id"] in RIG:
            pose_rig(e["id"], e)
            frame(cam, objs, VIEWS["angle"][0], False)
            path = os.path.join(RAW, f"{e['id']}-rig.png")
            render(path)
            tiles.append(path)
            labels.append(f"{e['id']} · rig pose")
            rig_tiles += [os.path.join(RAW, f"{e['id']}-angle.png"), path]
            rig_labels += [f"{e['id']} · bind", f"{e['id']} · articulated"]
        montage(tiles, labels, os.path.join(OUT, f"machines-{e['id']}.png"), 3)
        overview.append(os.path.join(RAW, f"{e['id']}-angle.png"))
        overview_labels.append(e["name"])
        clear(objs)
    if machines and not ONLY:
        montage(overview, overview_labels, os.path.join(OUT, "machines-overview.png"), 4)
    if rig_tiles and not ONLY:
        montage(rig_tiles, rig_labels, os.path.join(OUT, "machines-rig.png"), 4)
    prop_tiles = []
    for e in props:
        objs = import_glb(e["id"])
        # Props are origin-centered on their grip; rest them on the floor for the picture only.
        lo, _ = world_bounds(objs)
        for o in objs:
            if o.parent is None:
                o.location.z -= lo.z
        frame(cam, objs, (-0.55, 0.55, 0.62), False)
        path = os.path.join(RAW, f"{e['id']}-angle.png")
        render(path)
        prop_tiles.append(path)
        clear(objs)
    if prop_tiles and not ONLY:
        montage(prop_tiles, [e["name"] for e in props], os.path.join(OUT, "machines-props.png"), 5)
    if not ONLY:
        skin_tiles, skin_labels = [], []
        for skin in skins:
            for mid in ("adjustable-bench", "dual-adjustable-pulley", "leg-press-45", "chest-press-machine"):
                objs = import_glb(mid)
                apply_skin(skin)
                frame(cam, objs, VIEWS["angle"][0], False)
                path = os.path.join(RAW, f"skin-{skin['id']}-{mid}.png")
                render(path)
                skin_tiles.append(path)
                skin_labels.append(f"{skin['label']} · {mid}")
                clear(objs)
        montage(skin_tiles, skin_labels, os.path.join(OUT, "machines-skin-test.png"), 4)
    print("sheets written to", OUT)


main()
