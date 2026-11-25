"""Canonical free-weight and cable-attachment props.

Each prop's origin is its grip reference, matching `propParts` in `src/equipment.ts`:
bars and handles run along local X through the origin; kettlebells hang their bell
below the handle; cable attachments put their cable eye above (+Y) or ahead (+Z).
"""

import math

from mathutils import Vector

from lib import Machine

# Kept identical to PLATES in src/equipment.ts: [kg, radius, thickness].
PLATES = [
    (25, 0.225, 0.045),
    (20, 0.225, 0.038),
    (15, 0.2, 0.034),
    (10, 0.16, 0.03),
    (5, 0.115, 0.024),
    (2.5, 0.095, 0.018),
    (1.25, 0.08, 0.014),
]


def prop_barbell():
    m = Machine("prop-barbell", "Olympic Barbell (20 kg)", kind="prop", facing="Shaft along X through the origin.")
    collar_x, half_len, r = 0.655, 1.10, 0.0145
    m.params.update({"barKg": 20, "collarX": collar_x, "length": 2 * half_len, "radius": r})
    m.tube((-collar_x, 0, 0), (collar_x, 0, 0), r, "mat_chrome", None, 22, part="shaft")
    for s in (1, -1):
        # Knurl from the center gap to the collars, broken by the 81 cm ring marks.
        m.tube((s * 0.085, 0, 0), (s * 0.40, 0, 0), r + 0.0006, "mat_grip", None, 22)
        m.tube((s * 0.415, 0, 0), (s * (collar_x - 0.05), 0, 0), r + 0.0006, "mat_grip", None, 22)
        m.disc((s * (collar_x + 0.01), 0, 0), (1, 0, 0), 0.04, 0.02, "mat_chrome", None, 32, chamfer=0.003, part=f"collar_{'L' if s > 0 else 'R'}")
        m.tube((s * (collar_x + 0.02), 0, 0), (s * half_len, 0, 0), 0.025, "mat_chrome", None, 28, chamfer=0.003, part=f"sleeve_{'L' if s > 0 else 'R'}")
        m.disc((s * (half_len - 0.004), 0, 0), (1, 0, 0), 0.0255, 0.008, "mat_accent", None, 28, chamfer=0.002)
    m.handle("grip", (0, 0, 0), (1, 0, 0), (0, -1, 0), r, 2 * collar_x, "bar")
    return m


def prop_plate(kg, radius, thick):
    pid = f"prop-plate-{str(kg).replace('.', '_')}"
    m = Machine(pid, f"Weight Plate {kg} kg", kind="prop", facing="Disc axis along X so it slides onto a bar sleeve.")
    m.params.update({"kg": kg, "radius": radius, "thickness": thick})
    t = thick / 2
    hub = 0.0255
    prof = [
        (hub, -t * 0.75),
        (hub + 0.012, -t),
        (radius * 0.30, -t),
        (radius * 0.33, -t * 0.55),
        (radius * 0.84, -t * 0.55),
        (radius * 0.88, -t),
        (radius - 0.004, -t),
        (radius, -t + 0.004),
        (radius, t - 0.004),
        (radius - 0.004, t),
        (radius * 0.88, t),
        (radius * 0.84, t * 0.55),
        (radius * 0.33, t * 0.55),
        (radius * 0.30, t),
        (hub + 0.012, t),
        (hub, t * 0.75),
    ]
    m.revolve((0, 0, 0), (1, 0, 0), prof, "mat_plate", None, 48, closed=True)
    m.collider("disc", "cylinder", (radius, thick, 0), (0, 0, 0), mat="mat_plate")
    return m


def prop_dumbbell():
    m = Machine("prop-dumbbell", "Hex Dumbbell", kind="prop", facing="Handle along X through the origin; hex heads rest flat.", notes="Modeled at 22.5 kg.")
    kg = 22.5
    head_r = 0.045 + 0.0016 * kg
    head_t = 0.04 + 0.0025 * kg
    handle = 0.13
    off = handle / 2 + head_t / 2
    m.params.update({"kg": kg, "handleLength": handle, "headRadius": head_r, "headThickness": head_t})
    m.tube((-off, 0, 0), (off, 0, 0), 0.012, "mat_chrome", None, 18)
    m.tube((-handle / 2, 0, 0), (handle / 2, 0, 0), 0.016, "mat_grip", None, 22, part="handle")
    for s, tag in ((1, "L"), (-1, "R")):
        c = Vector((s * off, 0, 0))
        hex_r = head_r / math.cos(math.pi / 6)
        verts_prof = [(0, -head_t / 2), (hex_r - 0.006, -head_t / 2), (hex_r, -head_t / 2 + 0.006), (hex_r, head_t / 2 - 0.006), (hex_r - 0.006, head_t / 2), (0, head_t / 2)]
        m.revolve(c, (s, 0, 0), verts_prof, "mat_rubber", None, 6)
        m.disc(c + Vector((s * (head_t / 2 + 0.002), 0, 0)), (1, 0, 0), 0.03, 0.004, "mat_chrome", None, 24)
        m.disc(c - Vector((s * (head_t / 2 + 0.003), 0, 0)), (1, 0, 0), 0.026, 0.006, "mat_chrome", None, 24)
        m.collider(f"head_{tag}", "cylinder", (head_r, head_t, 0), c, mat="mat_plate")
    m.handle("grip", (0, 0, 0), (1, 0, 0), (0, -1, 0), 0.016, handle, "bar")
    return m


def prop_kettlebell():
    m = Machine("prop-kettlebell", "Kettlebell", kind="prop", facing="Handle along X at the origin; bell hangs below (-Y).", notes="Modeled at 16 kg.")
    kg = 16
    r = min(0.12, max(0.055, 0.055 + 0.0022 * kg))
    post_h = 0.075
    half_w = r * 1.4 / 2
    cy = -post_h - r * 0.72
    m.params.update({"kg": kg, "bellRadius": r, "bellCenterY": cy, "handleWidth": 2 * half_w})
    prof = []
    for k in range(17):
        a = -math.pi / 2 + math.pi * k / 16
        rr = r * math.cos(a)
        y = r * math.sin(a)
        if k == 0:
            rr, y = 0.0, -r * 0.88
        elif y < -r * 0.88:
            y = -r * 0.88
        prof.append((max(rr, 0.0), y))
    prof[-1] = (0.0, r)
    m.revolve((0, cy, 0), (0, 1, 0), prof, "mat_plate", None, 36)
    pts = [(-half_w, cy + r * 0.55, 0), (-half_w, -0.01, 0), (-half_w * 0.75, 0.0, 0), (half_w * 0.75, 0.0, 0), (half_w, -0.01, 0), (half_w, cy + r * 0.55, 0)]
    m.sweep(pts, 0.016, "mat_grip", None, 18, fillet=0.03)
    m.collider("bell", "sphere", (r, 0, 0), (0, cy, 0), mat="mat_plate")
    m.collider("handle", "cylinder", (0.016, 2 * half_w, 0), (0, 0, 0), mat="mat_grip")
    m.handle("grip", (0, 0, 0), (1, 0, 0), (0, -1, 0), 0.016, 2 * half_w, "hook")
    return m


def prop_ez_bar():
    m = Machine("prop-ez-bar", "EZ Curl Bar", kind="prop", facing="Shaft along X; cambers bend toward +Z.")
    collar_x, half_len = 0.42, 0.625
    m.params.update({"barKg": 10, "collarX": collar_x, "length": 2 * half_len})
    xs = [collar_x, 0.33, 0.27, 0.19, 0.12, 0.05]
    zs = [0.0, 0.0, 0.038, 0.038, 0.0, 0.0]
    pts = [(-x, 0, z) for x, z in zip(xs, zs)] + [(x, 0, z) for x, z in reversed(list(zip(xs, zs)))]
    m.sweep(pts, 0.0145, "mat_chrome", None, 18, fillet=0.03)
    for s, tag in ((1, "L"), (-1, "R")):
        m.sweep([(s * 0.315, 0, 0.004), (s * 0.27, 0, 0.038), (s * 0.20, 0, 0.038)], 0.0152, "mat_grip", None, 18, fillet=0.02)
        m.disc((s * (collar_x + 0.01), 0, 0), (1, 0, 0), 0.038, 0.02, "mat_chrome", None, 28, chamfer=0.003)
        m.tube((s * (collar_x + 0.02), 0, 0), (s * half_len, 0, 0), 0.025, "mat_chrome", None, 24, chamfer=0.003, part=f"sleeve_{tag}")
        m.handle(f"outer_{tag}", (s * 0.235, 0, 0.038), (1, 0, 0), (0, -1, 0), 0.0152, 0.07, "bar")
        m.handle(f"inner_{tag}", (s * 0.155, 0, 0.019), (s * -0.07, 0, -0.038), (0, -1, 0), 0.0145, 0.06, "bar")
    m.collider("shaft", "cylinder", (0.0145, 2 * collar_x, 0), (0, 0, 0.02), mat="mat_chrome")
    return m


def prop_d_handle():
    m = Machine("prop-d-handle", "Cable D-Handle", kind="prop", facing="Grip along X at the origin; cable eye above (+Y).")
    m.tube((-0.07, 0, 0), (0.07, 0, 0), 0.009, "mat_chrome", None, 14)
    m.tube((-0.058, 0, 0), (0.058, 0, 0), 0.0155, "mat_grip", None, 22, chamfer=0.003, part="grip")
    m.sweep([(-0.072, -0.004, 0), (-0.07, 0.05, 0), (0, 0.125, 0), (0.07, 0.05, 0), (0.072, -0.004, 0)], 0.007, "mat_chrome", None, 12, fillet=0.03)
    m.torus((0, 0.147, 0), (0, 0, 1), 0.017, 0.005, "mat_chrome", None, 24, 10)
    m.point("eye", (0, 0.16, 0))
    m.handle("grip", (0, 0, 0), (1, 0, 0), (0, -1, 0), 0.0155, 0.116, "bar")
    return m


def prop_lat_bar():
    m = Machine("prop-lat-bar", "Lat Pulldown Bar", kind="prop", facing="Bar along X at the origin; ends bend down; cable eye above.")
    pts = [(-0.60, -0.085, 0), (-0.40, 0.0, 0), (0.40, 0.0, 0), (0.60, -0.085, 0)]
    m.sweep(pts, 0.0145, "mat_chrome", None, 18, fillet=0.06)
    d = Vector((0.20, -0.085, 0)).normalized()
    for s, tag in ((1, "L"), (-1, "R")):
        a = Vector((s * 0.44, -0.015, 0))
        b = Vector((s * 0.598, -0.084, 0))
        m.tube(a, b, 0.0158, "mat_grip", None, 18, chamfer=0.003)
        m.disc(b + Vector((s * 0.005, -0.002, 0)), (s * d.x, d.y, 0), 0.02, 0.012, "mat_rubber", None, 18)
        m.handle(f"grip_{tag}", (a + b) / 2, (s * d.x, d.y, 0), (0, -1, 0), 0.0158, (b - a).length, "bar")
        m.tube((s * 0.12, 0, 0), (s * 0.36, 0, 0), 0.0152, "mat_grip", None, 18)
    m.box((0, 0.025, 0), (0.05, 0.03, 0.012), "mat_frame", bevel=0.004)
    m.torus((0, 0.055, 0), (0, 0, 1), 0.016, 0.005, "mat_chrome", None, 24, 10)
    m.point("eye", (0, 0.07, 0))
    m.handle("grip", (0, 0, 0), (1, 0, 0), (0, -1, 0), 0.0152, 0.72, "bar")
    m.collider("bar", "cylinder", (0.0145, 1.0, 0), (0, -0.02, 0), mat="mat_chrome")
    return m


def prop_v_bar():
    m = Machine("prop-v-bar", "Close-Grip V-Handle", kind="prop", facing="Twin neutral grips along Y at x = ±0.055; cable eye ahead (+Z).")
    gx, gh = 0.055, 0.13
    for s, tag in ((1, "L"), (-1, "R")):
        m.tube((s * gx, -gh / 2 - 0.01, 0), (s * gx, gh / 2 + 0.01, 0), 0.009, "mat_chrome", None, 12)
        m.tube((s * gx, -gh / 2, 0), (s * gx, gh / 2, 0), 0.0155, "mat_grip", None, 20, chamfer=0.003, part=f"grip_{tag}")
        m.handle(f"grip_{tag}", (s * gx, 0, 0), (0, 1, 0), (-s, 0, 0), 0.0155, gh, "neutral")
        for sy in (1, -1):
            m.sweep([(s * gx, sy * (gh / 2 + 0.008), 0), (s * gx, sy * (gh / 2 + 0.02), 0.03), (0, sy * 0.03, 0.20)], 0.0075, "mat_chrome", None, 12, fillet=0.03)
    m.box((0, 0, 0.20), (0.03, 0.08, 0.02), "mat_frame", bevel=0.005)
    m.torus((0, 0, 0.225), (1, 0, 0), 0.016, 0.005, "mat_chrome", None, 24, 10)
    m.point("eye", (0, 0, 0.24))
    return m


def prop_rope():
    m = Machine("prop-rope", "Triceps Rope", kind="prop", facing="Hands at x = ±0.065 on the grip line y = 0; cable eye above (+Y).")
    m.revolve((0, 0.20, 0), (0, 1, 0), [(0, -0.03), (0.016, -0.03), (0.018, 0.0), (0.016, 0.02), (0, 0.02)], "mat_chrome", None, 18)
    m.torus((0, 0.235, 0), (0, 0, 1), 0.015, 0.005, "mat_chrome", None, 24, 10)
    for s, tag in ((1, "L"), (-1, "R")):
        m.sweep([(0, 0.18, 0), (s * 0.03, 0.12, 0), (s * 0.065, 0.02, 0), (s * 0.07, -0.05, 0)], 0.0135, "mat_cable", None, 16, fillet=0.08)
        m.revolve((s * 0.07, -0.05, 0), (0, -1, 0), [(0, 0), (0.026, 0.0), (0.03, 0.02), (0.022, 0.04), (0, 0.042)], "mat_rubber", None, 20)
        m.handle(f"grip_{tag}", (s * 0.066, 0.0, 0), (s * 0.05, -0.99, 0), (-s, 0, 0), 0.0135, 0.09, "neutral")
    m.point("eye", (0, 0.25, 0))
    return m


def prop_medicine_ball():
    m = Machine("prop-medicine-ball", "Medicine Ball", kind="prop", facing="Centered at the origin.", notes="0.14 m radius (about 6 kg).")
    r = 0.14
    prof = [(r * math.cos(-math.pi / 2 + math.pi * k / 20), r * math.sin(-math.pi / 2 + math.pi * k / 20)) for k in range(21)]
    prof[0] = (0.0, -r)
    prof[-1] = (0.0, r)
    m.revolve((0, 0, 0), (0, 1, 0), prof, "mat_rubber", None, 40, cap_start=False, cap_end=False)
    m.torus((0, 0, 0), (0, 1, 0), r, 0.004, "mat_accent", None, 48, 8)
    m.torus((0, 0, 0), (1, 0, 0), r, 0.004, "mat_accent", None, 48, 8)
    m.collider("ball", "sphere", (r, 0, 0), (0, 0, 0), mat="mat_rubber")
    return m


def _sleeves(m, collar_x, half_len, r_collar=0.04):
    for s, tag in ((1, "L"), (-1, "R")):
        m.disc((s * (collar_x + 0.01), 0, 0), (1, 0, 0), r_collar, 0.02, "mat_chrome", None, 28, chamfer=0.003)
        m.tube((s * (collar_x + 0.02), 0, 0), (s * half_len, 0, 0), 0.025, "mat_chrome", None, 24, chamfer=0.003, part=f"sleeve_{tag}")
        m.disc((s * (half_len - 0.004), 0, 0), (1, 0, 0), 0.0255, 0.008, "mat_accent", None, 24, chamfer=0.002)


def prop_trap_bar():
    m = Machine("prop-trap-bar", "Trap Bar", kind="prop", facing="Lifter stands inside the hex; handles at x = ±0.31 run along Z through y = 0.")
    collar_x, half_len = 0.46, 0.925
    m.params.update({"barKg": 25, "collarX": collar_x, "length": 2 * half_len})
    hexagon = [(0.24, 0, 0.32), (0.42, 0, 0), (0.24, 0, -0.32), (-0.24, 0, -0.32), (-0.42, 0, 0), (-0.24, 0, 0.32), (0.24, 0, 0.32), (0.42, 0, 0)]
    m.sweep(hexagon, 0.017, "mat_frame", None, 14, fillet=0.03)
    for s, tag in ((1, "L"), (-1, "R")):
        m.tube((s * 0.31, 0, -0.20), (s * 0.31, 0, 0.20), 0.0145, "mat_chrome", None, 18)
        m.tube((s * 0.31, 0, -0.07), (s * 0.31, 0, 0.07), 0.0155, "mat_grip", None, 20)
        m.handle(f"grip_{tag}", (s * 0.31, 0, 0), (0, 0, 1), (-s, 0, 0), 0.0155, 0.14, "neutral")
        m.tube((s * 0.42, 0, 0), (s * collar_x, 0, 0), 0.02, "mat_frame", None, 18)
    _sleeves(m, collar_x, half_len)
    return m


def prop_safety_squat_bar():
    m = Machine("prop-safety-squat-bar", "Safety Squat Bar", kind="prop", facing="Shaft along X through the yoke at the origin; handles reach forward (+Z) and down.")
    collar_x, half_len = 0.68, 1.125
    m.params.update({"barKg": 25, "collarX": collar_x, "length": 2 * half_len})
    m.tube((-collar_x, 0, 0), (collar_x, 0, 0), 0.016, "mat_chrome", None, 20, part="shaft")
    m.revolve((-0.17, 0, -0.01), (1, 0, 0), [(0, 0), (0.044, 0.0), (0.05, 0.012), (0.05, 0.328), (0.044, 0.34), (0, 0.34)], "mat_pad", None, 28)
    for s, tag in ((1, "L"), (-1, "R")):
        m.sweep([(s * 0.13, 0.0, 0.02), (s * 0.15, -0.05, 0.16), (s * 0.16, -0.10, 0.34)], 0.016, "mat_chrome", None, 14, fillet=0.06)
        m.tube((s * 0.158, -0.085, 0.27), (s * 0.161, -0.103, 0.35), 0.022, "mat_pad", None, 18)
        m.handle(f"grip_{tag}", (s * 0.16, -0.095, 0.31), (0, -0.2, 1), (0, 1, 0), 0.022, 0.08, "bar")
    m.collider("yoke", "capsule", (0.05, 0.34, 0), (0, 0, -0.01), mat="mat_pad")
    _sleeves(m, collar_x, half_len)
    return m


def prop_axle_bar():
    m = Machine("prop-axle-bar", "Axle Bar", kind="prop", facing="Thick un-knurled shaft along X through the origin.")
    collar_x, half_len, r = 0.655, 1.075, 0.025
    m.params.update({"barKg": 15, "collarX": collar_x, "length": 2 * half_len, "radius": r})
    m.tube((-collar_x, 0, 0), (collar_x, 0, 0), r, "mat_chrome", None, 28, part="shaft")
    _sleeves(m, collar_x, half_len, 0.045)
    m.handle("grip", (0, 0, 0), (1, 0, 0), (0, -1, 0), r, 2 * collar_x, "bar")
    return m


def _sphere_profile(r, n=24):
    prof = [(r * math.cos(-math.pi / 2 + math.pi * k / n), r * math.sin(-math.pi / 2 + math.pi * k / n)) for k in range(n + 1)]
    prof[0] = (0.0, -r)
    prof[-1] = (0.0, r)
    return prof


def prop_stability_ball():
    m = Machine("prop-stability-ball", "Stability Ball", kind="prop", facing="Centered at the origin.", notes="65 cm.")
    r = 0.325
    m.params["radius"] = r
    m.revolve((0, 0, 0), (0, 1, 0), _sphere_profile(r, 28), "mat_pad", None, 48)
    m.collider("ball", "sphere", (r, 0, 0), (0, 0, 0), mat="mat_pad")
    m.surface("top", (0, r, 0), (0, 1, 0), (0, 0, 1))
    return m


def prop_ab_wheel():
    m = Machine("prop-ab-wheel", "Ab Wheel", kind="prop", facing="Handles along X through the axle at the origin.")
    r, wdt = 0.09, 0.06
    m.revolve((0, 0, 0), (1, 0, 0), [(0.012, -wdt / 2), (r - 0.012, -wdt / 2), (r, -wdt / 2 + 0.012), (r, wdt / 2 - 0.012), (r - 0.012, wdt / 2), (0.012, wdt / 2)], "mat_rubber", None, 40)
    m.disc((0, 0, 0), (1, 0, 0), r * 0.72, wdt + 0.004, "mat_frame", None, 32)
    m.tube((-0.18, 0, 0), (0.18, 0, 0), 0.008, "mat_chrome", None, 14)
    for s, tag in ((1, "L"), (-1, "R")):
        m.tube((s * 0.05, 0, 0), (s * 0.17, 0, 0), 0.016, "mat_grip", None, 20, chamfer=0.004, part=f"handle_{tag}")
        m.handle(f"grip_{tag}", (s * 0.11, 0, 0), (1, 0, 0), (0, -1, 0), 0.016, 0.12, "bar")
    m.collider("wheel", "cylinder", (r, wdt, 0), (0, 0, 0), mat="mat_rubber")
    return m


PROPS = [
    prop_barbell,
    *[(lambda kg=kg, rr=rr, t=t: prop_plate(kg, rr, t)) for kg, rr, t in PLATES],
    prop_dumbbell,
    prop_kettlebell,
    prop_ez_bar,
    prop_d_handle,
    prop_lat_bar,
    prop_v_bar,
    prop_rope,
    prop_medicine_ball,
    prop_trap_bar,
    prop_safety_squat_bar,
    prop_axle_bar,
    prop_stability_ball,
    prop_ab_wheel,
]
