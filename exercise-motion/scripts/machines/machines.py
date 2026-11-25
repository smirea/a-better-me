"""Canonical Tier-1 machines.

Coordinates are glTF space in meters: +Y up, floor at y = 0, centered on x = 0, and the
lifter's primary stance faces +Z (their left is +X). Every articulated node's pivot is
where its hinge or slide reference sits, with identity rotation, so a TypeScript
`rotOffset: [a, 0, 0]` turns it about world X and `posOffset` slides it in machine space.
"""

import math

from mathutils import Vector

import assemblies as A
from lib import Machine, frame_quat, quat_from_to

S2 = math.sqrt(0.5)


# ---------------------------------------------------------------------------
# 1. Adjustable bench
# ---------------------------------------------------------------------------


def adjustable_bench():
    m = Machine(
        "adjustable-bench",
        "Adjustable Bench",
        facing="Lies or sits along Z: seat toward +Z, backrest toward -Z (head end).",
        notes="Flat 0°, incline 15–60°, upright 75–85°; seat tilts 0–20°. Covers flat, incline, seated, and bench-supported rows.",
    )
    hinge = Vector((0, 0.375, 0.0))
    top = 0.445
    pad_t = 0.07
    m.params.update({"seatTopY": top, "hinge": list(hinge), "padThickness": pad_t, "strutLength": 0.40, "ladderY": 0.31})

    # Static chassis.
    spine_y = 0.26
    m.beam((0, spine_y, -0.76), (0, spine_y, 0.5), 0.08, 0.05, part="spine")
    m.beam((0, 0.012 + 0.03, -0.70), (0, spine_y - 0.025, -0.70), 0.06, 0.06, part="leg_rear", up=(0, 0, 1))
    m.beam((0, 0.012 + 0.03, 0.45), (0, spine_y - 0.025, 0.45), 0.06, 0.06, part="leg_front", up=(0, 0, 1))
    m.beam((-0.26, 0.042, -0.70), (0.26, 0.042, -0.70), 0.07, 0.06, part="foot_rear")
    m.beam((-0.20, 0.042, 0.45), (0.20, 0.042, 0.45), 0.07, 0.06, part="foot_front")
    for x in (0.26, -0.26):
        A.floor_foot(m, x, -0.70, 0.07, 0.08)
    for x in (0.215, -0.215):
        m.disc((x * 1.12, 0.045, 0.45), (1, 0, 0), 0.045, 0.03, "mat_rubber", segments=24, chamfer=0.006)
    m.box((0, 0.006, 0.45), (0.06, 0.012, 0.06), "mat_rubber", bevel=0.002)
    # Rear carry handle.
    m.sweep([(0, spine_y, -0.75), (0, spine_y + 0.02, -0.82), (0, spine_y + 0.12, -0.86)], 0.016, "mat_grip", fillet=0.04)
    # Ladder (backrest stops) on top of the spine.
    m.box((0, 0.296, -0.48), (0.1, 0.022, 0.40), "mat_frame", bevel=0.003)
    for k in range(7):
        m.box((0, 0.31, -0.66 + k * 0.06), (0.1, 0.012, 0.012), "mat_chrome", bevel=0.002)
    # Hinge bracket and knuckle.
    for s in (1, -1):
        m.box((s * 0.05, 0.32, 0.0), (0.012, 0.13, 0.09), "mat_frame", bevel=0.003)
    m.tube((-0.075, hinge.y, 0), (0.075, hinge.y, 0), 0.016, "mat_chrome", None, 16)
    # Seat height post sleeve.
    m.box((0, 0.31, 0.30), (0.055, 0.07, 0.055), "mat_frame", bevel=0.004)
    A.pop_pin(m, (0, 0.31, 0.3275), (0, 0, 1))

    # Backrest: pivots about world X at the hinge; +angle raises the head end.
    m.node("backrest", hinge)
    back_len = 0.86
    m.pad((0, top - pad_t / 2, -0.015 - back_len / 2), (0.29, pad_t, back_len), node="backrest", part="back_pad")
    m.box((0, 0.369, -0.015 - back_len / 2), (0.25, 0.012, back_len - 0.04), "mat_frame", node="backrest", bevel=0.002)
    m.beam((0, 0.345, -0.03), (0, 0.345, -0.80), 0.06, 0.035, node="backrest")
    m.surface("back", (0, top, -0.015), (0, 1, 0), (0, 0, -1), node="backrest")
    m.pivot("backrest", hinge, (1, 0, 0), 0, 85, node="backrest")

    # Strut: hangs from the backrest, its foot rides the ladder. Bind lies flat toward -Z.
    strut_pivot = Vector((0, 0.33, -0.25))
    m.node("back_strut", strut_pivot, parent="backrest")
    for s in (1, -1):
        m.box((s * 0.045, 0.33, -0.25 - 0.20), (0.012, 0.03, 0.42), "mat_chrome", node="back_strut", bevel=0.004)
    m.tube((-0.06, 0.33, -0.65), (0.06, 0.33, -0.65), 0.009, "mat_chrome", "back_strut", 12)
    m.tube((-0.06, 0.33, -0.25), (0.06, 0.33, -0.25), 0.01, "mat_chrome", "back_strut", 12)
    m.point("strut_foot", (0, 0.33, -0.65), node="back_strut")

    # Seat: pivots about its rear edge; negative X rotation lifts the knee end.
    seat_pivot = Vector((0, 0.375, 0.025))
    m.node("seat", seat_pivot)
    seat_len = 0.36
    m.pad((0, top - pad_t / 2, 0.025 + seat_len / 2), (0.30, pad_t, seat_len), node="seat", part="seat_pad")
    m.box((0, 0.369, 0.025 + seat_len / 2), (0.26, 0.012, seat_len - 0.04), "mat_frame", node="seat", bevel=0.002)
    m.box((0, 0.34, 0.30), (0.04, 0.05, 0.04), "mat_chrome", node="seat", bevel=0.004)
    m.surface("seat", (0, top, 0.025), (0, 1, 0), (0, 0, 1), node="seat")
    m.pivot("seat", seat_pivot, (1, 0, 0), -20, 0, node="seat")
    return m


# ---------------------------------------------------------------------------
# 2. Power rack
# ---------------------------------------------------------------------------


def power_rack():
    m = Machine(
        "power-rack",
        "Power Rack",
        facing="Lifter stands inside facing +Z; J-hooks on the front uprights' inner face, safeties run front to back.",
        notes="Also stands in for half racks and squat stands.",
    )
    ux, uz, h = 0.60, 0.45, 2.30
    t = A.TUBE
    hook_y, safety_y = 1.30, 0.70
    m.params.update({"uprightX": ux, "depthZ": uz, "height": h, "hookY": hook_y, "safetyY": safety_y})
    for sx, tag in ((1, "L"), (-1, "R")):
        for sz, fb in ((1, "front"), (-1, "back")):
            A.post(m, sx * ux, sz * uz, 0.072, h - t, part=f"upright_{fb}_{tag}")
            # Hole pattern on the inner and front faces.
            for k in range(30):
                y = 0.36 + k * 0.05
                m.box((sx * (ux - t / 2 - 0.0004), y, sz * uz), (0.0012, 0.022, 0.022), "mat_rubber", bevel=0.0)
                m.box((sx * ux, y, sz * (uz + t / 2 + 0.0004)), (0.022, 0.022, 0.0012), "mat_rubber", bevel=0.0)
        A.floor_beam_z(m, sx * ux, -0.66, 0.66, h=0.06, w=t)
        m.beam((sx * ux, h - t / 2, -uz - t / 2), (sx * ux, h - t / 2, uz + t / 2), t, t, part=f"top_side_{tag}")
    m.beam((-ux, 0.042, -uz), (ux, 0.042, -uz), t, 0.06, part="base_back")
    m.beam((-ux - t / 2, h - t / 2, -uz), (ux + t / 2, h - t / 2, -uz), t, t, part="top_back")
    m.beam((-ux - t / 2, h - t / 2, uz), (ux + t / 2, h - t / 2, uz), t, t, part="top_front")

    # Pull-up bar on forward brackets.
    bar_y, bar_z = h - 0.09, uz + 0.14
    m.node("pullup_bar", (0, bar_y, bar_z))
    for sx in (1, -1):
        m.box((sx * ux, bar_y + 0.01, uz + 0.08), (0.06, 0.08, 0.16), "mat_frame", node="pullup_bar", bevel=0.006)
    m.tube((-ux - 0.04, bar_y, bar_z), (ux + 0.04, bar_y, bar_z), 0.016, "mat_chrome", "pullup_bar", 20, part="pullup_bar")
    for sx in (1, -1):
        m.tube((sx * 0.12, bar_y, bar_z), (sx * 0.52, bar_y, bar_z), 0.0168, "mat_grip", "pullup_bar", 20)
    m.handle("pullup", (0, bar_y, bar_z), (1, 0, 0), (0, 0, 1), 0.016, 1.04, "hang")

    # J-hooks on the front uprights' rear face.
    face_z = uz - t / 2
    for sx, tag in ((1, "L"), (-1, "R")):
        n = f"jhook_{tag}"
        cradle = Vector((sx * ux, hook_y, face_z - 0.06))
        m.node(n, cradle)
        m.box((sx * ux, hook_y + 0.01, face_z - 0.006), (0.075, 0.16, 0.012), "mat_frame", node=n, bevel=0.003)
        m.box((sx * ux, hook_y - 0.012, face_z - 0.05), (0.06, 0.016, 0.09), "mat_frame", node=n, bevel=0.004)
        m.box((sx * ux, hook_y - 0.002, face_z - 0.05), (0.056, 0.004, 0.082), "mat_rubber", node=n, bevel=0.001)
        m.box((sx * ux, hook_y + 0.022, face_z - 0.098), (0.06, 0.06, 0.012), "mat_frame", node=n, bevel=0.004)
        A.pop_pin(m, (sx * (ux + t / 2), hook_y + 0.05, face_z + t / 2), (sx, 0, 0), node=n, knob=0.012)
        m.collider(f"jhook_{tag}", "box", (0.06, 0.03, 0.10), (sx * ux, hook_y - 0.015, face_z - 0.05), node=n)
        m.hook(f"jhook_{tag}", cradle, node=n)
        m.rail(f"jhook_{tag}", cradle, (0, 1, 0), 0.35 - hook_y, 1.85 - hook_y, node=n)

    # Pin-pipe safeties spanning front to back, just inside the uprights.
    for sx, tag in ((1, "L"), (-1, "R")):
        n = f"safety_{tag}"
        sxp = sx * (ux - t / 2 - 0.028)
        m.node(n, (sxp, safety_y, 0))
        m.box((sxp, safety_y - 0.025, 0), (0.05, 0.05, 2 * uz + 0.16), "mat_frame", node=n, bevel=0.006)
        m.box((sxp, safety_y - 0.002, 0), (0.046, 0.004, 2 * uz - 0.1), "mat_rubber", node=n, bevel=0.001)
        for sz in (1, -1):
            m.tube((sxp, safety_y - 0.025, sz * (uz + t / 2 + 0.005)), (sxp, safety_y - 0.025, sz * (uz + t / 2 + 0.04)), 0.011, "mat_chrome", n, 12)
        m.collider(f"safety_{tag}", "box", (0.05, 0.05, 2 * uz - 0.08), (sxp, safety_y - 0.025, 0), node=n)
        m.hook(f"safety_{tag}", (sxp, safety_y, 0), node=n)
        m.rail(f"safety_{tag}", (sxp, safety_y, 0), (0, 1, 0), 0.2 - safety_y, 1.5 - safety_y, node=n)
    return m


# ---------------------------------------------------------------------------
# 3. Olympic incline bench
# ---------------------------------------------------------------------------


def olympic_incline_bench():
    m = Machine(
        "olympic-incline-bench",
        "Olympic Incline Bench",
        facing="Lifter sits facing +Z, back on the 45° pad rising toward -Z; bar racks behind the head.",
        notes="Fixed 45° press station with head-height backrest, open floor for the feet, and two J-cradle heights.",
    )
    seat_top = 0.50
    hinge = Vector((0, seat_top, -0.02))
    a = math.radians(45)
    up = Vector((0, math.sin(a), -math.cos(a)))
    nrm = Vector((0, math.cos(a), math.sin(a)))
    back_len = 0.84
    pad_t = 0.07
    m.params.update({"seatTopY": seat_top, "backAngleDeg": 45})
    # Seat tilted 10° up toward the knees.
    st = math.radians(10)
    seat_up = Vector((0, math.sin(st), math.cos(st)))
    seat_n = Vector((0, math.cos(st), -math.sin(st)))
    seat_len = 0.34
    seat_c = hinge + Vector((0, 0, 0.02)) + seat_up * (seat_len / 2) - seat_n * (pad_t / 2)
    m.pad(seat_c, (0.32, pad_t, seat_len), rot=frame_quat(seat_up, seat_n), part="seat_pad")
    m.surface("seat", hinge + Vector((0, 0, 0.02)), seat_n, seat_up)
    back_c = hinge + up * (back_len / 2 + 0.01) - nrm * (pad_t / 2)
    m.pad(back_c, (0.30, pad_t, back_len), rot=frame_quat(up, nrm), part="back_pad")
    m.box(hinge + up * (back_len / 2 + 0.01) - nrm * (pad_t + 0.006), (0.26, 0.012, back_len - 0.04), "mat_frame", rot=frame_quat(up, nrm), bevel=0.002)
    m.surface("back", hinge + up * 0.01, nrm, up)

    # Chassis: center spine, seat post, back struts, rear U-base, uprights.
    m.beam((0, 0.042, -0.80), (0, 0.042, 0.34), 0.08, 0.06, part="spine")
    m.beam((-0.26, 0.042, 0.34), (0.26, 0.042, 0.34), 0.07, 0.06)
    for x in (0.26, -0.26):
        A.floor_foot(m, x, 0.34, 0.07, 0.08)
    m.beam((0, 0.07, 0.18), (0, seat_top - 0.09, 0.15), 0.07, 0.07, up=(0, 0, 1), part="seat_post")
    under = hinge + up * 0.62 - nrm * (pad_t + 0.03)
    m.beam((0, 0.07, -0.62), under, 0.07, 0.06, up=(1, 0, 0))
    m.beam((0, 0.07, -0.16), hinge + up * 0.18 - nrm * (pad_t + 0.03), 0.07, 0.06, up=(1, 0, 0))
    m.beam((0, under.y - 0.01, under.z), hinge + up * 0.18 - nrm * (pad_t + 0.03), 0.05, 0.04, up=(1, 0, 0))
    ux, uzp = 0.58, -0.17
    m.beam((-ux, 0.042, -0.80), (ux, 0.042, -0.80), 0.075, 0.06, part="base_rear")
    for sx, tag in ((1, "L"), (-1, "R")):
        A.floor_beam_z(m, sx * ux, -0.80, 0.10, w=0.075)
        A.post(m, sx * ux, uzp, 0.072, 1.52, part=f"upright_{tag}")
        m.beam((sx * ux, 0.10, -0.78), (sx * ux, 1.0, uzp - 0.04), 0.06, 0.06, up=(1, 0, 0))
    m.beam((-ux, 1.46, uzp), (ux, 1.46, uzp), 0.06, 0.06)

    # J-cradles: welded at two heights; node marks the primary (upper) rack position.
    for sx, tag in ((1, "L"), (-1, "R")):
        for k, hy in enumerate((1.18, 1.36)):
            primary = k == 1
            n = f"jhook_{tag}" if primary else None
            cz = uzp + 0.075
            if primary:
                m.node(n, (sx * ux, hy, cz))
            m.box((sx * ux, hy - 0.012, uzp + 0.06), (0.06, 0.016, 0.10), "mat_frame", node=n, bevel=0.004)
            m.box((sx * ux, hy - 0.002, uzp + 0.065), (0.056, 0.004, 0.08), "mat_rubber", node=n, bevel=0.001)
            m.box((sx * ux, hy + 0.025, uzp + 0.112), (0.06, 0.065, 0.012), "mat_frame", node=n, bevel=0.004)
            m.hook(f"{'jhook' if primary else 'lowhook'}_{tag}", (sx * ux, hy, cz), node=n)
        # Spotter catch horns below the cradles.
        m.box((sx * ux, 0.97, uzp + 0.16), (0.05, 0.05, 0.28), "mat_frame", bevel=0.006, part=f"catch_{tag}")
        m.box((sx * ux, 0.997, uzp + 0.17), (0.046, 0.004, 0.24), "mat_rubber", bevel=0.001)
    return m


# ---------------------------------------------------------------------------
# 4/5. Cable columns
# ---------------------------------------------------------------------------


def _cable_column(m, x, z, f, tag, height=2.24, bind_exit_y=1.20, stack_side=1):
    """One adjustable column. `f` is the Z direction the pulley faces; stack sits behind (-f)."""
    sfx = f"_{tag}" if tag else ""
    post_w = 0.09
    A.post(m, x, z, 0.072, height, post_w, post_w, part=f"column{sfx}")
    m.box((x, (0.35 + height - 0.1) / 2, z + f * (post_w / 2 + 0.006)), (0.03, height - 0.45, 0.012), "mat_chrome", bevel=0.003)
    for k in range(22):
        y = 0.32 + k * 0.08
        m.box((x + 0.03, y, z + f * (post_w / 2 + 0.0006)), (0.012, 0.012, 0.0012), "mat_rubber", bevel=0.0)
    stack_z = z - f * 0.30
    A.floor_beam_z(m, x, z + f * 0.30, z - f * 0.48, w=0.08)
    travel, stack_top = A.weight_stack(m, x, stack_z, f"stack{sfx}", plates=16, width=0.25, depth=0.11, base_y=0.13, guide_top=1.98)
    for s in (1, -1):
        A.post(m, x + s * 0.17, stack_z, 0.072, height, 0.05, 0.05)
    m.box((x, height + 0.02, (z + stack_z) / 2 - f * 0.02), (0.40, 0.05, 0.50), "mat_frame", bevel=0.01)
    m.collider(f"stack_guard{sfx}", "box", (0.40, height, 0.18), (x, height / 2, stack_z), collide=True)
    sheave_top = Vector((x, height - 0.05, z))
    A.sheave(m, sheave_top, (1, 0, 0), 0.05)
    # Static cable run: over the column sheave, back to a sheave above the stack, then down to the
    # selector rod. When the stack lifts, the lower end disappears into the rod.
    A.sheave(m, (x, height - 0.05, stack_z), (1, 0, 0), 0.04)
    m.tube((x, height - 0.005, z), (x, height - 0.005, stack_z), 0.004, "mat_cable", None, 8)
    m.tube((x, height - 0.09, stack_z), (x, stack_top + 0.06, stack_z), 0.004, "mat_cable", None, 8)

    # Carriage slides on the column front; the pulley housing swivels on it about Y.
    car = Vector((x, bind_exit_y + 0.09, z + f * (post_w / 2 + 0.035)))
    cn = f"carriage{sfx}"
    m.node(cn, car)
    m.box(car + Vector((0, 0, -f * 0.03)), (0.13, 0.20, 0.13), "mat_frame", node=cn, bevel=0.012)
    m.box(car + Vector((0, 0.0, f * 0.037)), (0.11, 0.17, 0.008), "mat_accent", node=cn, bevel=0.003)
    A.pop_pin(m, car + Vector((stack_side * 0.065, 0.05, -f * 0.03)), (stack_side, 0, 0), node=cn)
    m.tube(car + Vector((-0.03, 0.06, f * 0.04)), car + Vector((0.03, 0.06, f * 0.04)), 0.012, "mat_grip", cn, 14)
    pn = f"pulley{sfx}"
    swivel = car + Vector((0, -0.07, f * 0.045))
    m.node(pn, swivel, parent=cn)
    m.tube(swivel + Vector((0, 0.02, 0)), swivel + Vector((0, -0.02, 0)), 0.014, "mat_chrome", pn, 14)
    sc = swivel + Vector((0, -0.03, f * 0.055))
    for s in (1, -1):
        m.box(sc + Vector((s * 0.019, 0.0, -f * 0.01)), (0.008, 0.11, 0.12), "mat_frame", node=pn, bevel=0.004)
    A.sheave(m, sc, (1, 0, 0), 0.042, 0.022, node=pn)
    exit_pt = sc + Vector((0, -0.042, f * 0.03))
    m.revolve(exit_pt + Vector((0, -0.012, 0)), (0, 1, 0), [(0, -0.018), (0.016, -0.014), (0.018, 0.0), (0.01, 0.012), (0, 0.012)], "mat_rubber", pn, 16)
    m.tube(sc + Vector((0, 0.0, f * 0.042)), exit_pt + Vector((0, -0.02, 0)), 0.0035, "mat_cable", pn, 8)
    m.point(f"exit{sfx}", exit_pt, node=pn)
    return {
        "exit": exit_pt,
        "exit_dir": (exit_pt + Vector((0, -0.02, 0)) - (sc + Vector((0, 0.0, f * 0.042)))).normalized(),
        "carriage": car,
        "travel": travel,
        "min_exit": 0.28,
        "max_exit": height - 0.30,
        "stack_top": stack_top,
    }


def dual_adjustable_pulley():
    m = Machine(
        "dual-adjustable-pulley",
        "Dual Adjustable Pulley",
        facing="Lifter stands between the columns facing +Z; pulleys face +Z and swivel toward the handle.",
        notes="One rig for crossovers, functional trainers, dual cable towers, and motorized dual cables.",
    )
    hx = 0.80
    h = 2.24
    cols = {}
    for sx, tag in ((1, "L"), (-1, "R")):
        cols[tag] = _cable_column(m, sx * hx, 0.0, 1, tag, h, stack_side=sx)
    m.beam((-hx, h - 0.03, 0), (hx, h - 0.03, 0), 0.08, 0.08, part="top_beam")
    m.beam((-hx, 0.042, -0.48), (hx, 0.042, -0.48), 0.08, 0.06, part="base_rear")
    # Chin-up bar across the front of the top beam.
    m.node("pullup_bar", (0, h - 0.12, 0.17))
    for sx in (1, -1):
        m.box((sx * 0.55, h - 0.08, 0.09), (0.05, 0.08, 0.17), "mat_frame", node="pullup_bar", bevel=0.006)
    m.tube((-0.62, h - 0.12, 0.17), (0.62, h - 0.12, 0.17), 0.016, "mat_chrome", "pullup_bar", 20, part="pullup_bar")
    for sx in (1, -1):
        m.tube((sx * 0.10, h - 0.12, 0.17), (sx * 0.50, h - 0.12, 0.17), 0.0168, "mat_grip", "pullup_bar", 20)
    m.handle("pullup", (0, h - 0.12, 0.17), (1, 0, 0), (0, 0, 1), 0.016, 1.0, "hang")
    for tag, sx in (("L", 1), ("R", -1)):
        c = cols[tag]
        m.pulley(f"pulley_{tag}", c["exit"], c["exit_dir"], node=f"pulley_{tag}", stack=f"stack_{tag}", ratio=0.5, stack_travel=c["travel"])
        m.rail(f"carriage_{tag}", c["exit"], (0, 1, 0), c["min_exit"] - c["exit"].y, c["max_exit"] - c["exit"].y, node=f"carriage_{tag}")
    m.params.update({"halfWidth": hx, "bindExitY": cols["L"]["exit"].y, "stackTravel": cols["L"]["travel"]})
    return m


def single_cable_tower():
    m = Machine(
        "single-cable-tower",
        "Single Cable Tower",
        facing="Lifter stands at -Z facing the tower (+Z); the pulley faces -Z toward them.",
        notes="Single column with a height-adjustable swivel pulley; covers single cable machines and high/low pulleys.",
    )
    h = 2.24
    c = _cable_column(m, 0.0, -0.10, -1, "", h, stack_side=1)
    m.beam((-0.30, 0.042, 0.30), (0.30, 0.042, 0.30), 0.08, 0.06, part="base_rear")
    m.beam((-0.30, 0.042, -0.36), (0.30, 0.042, -0.36), 0.08, 0.06, part="base_front")
    for sx in (1, -1):
        A.floor_foot(m, sx * 0.30, 0.30)
        A.floor_foot(m, sx * 0.30, -0.36)
    m.pulley("pulley", c["exit"], c["exit_dir"], node="pulley", stack="stack", ratio=0.5, stack_travel=c["travel"])
    m.rail("carriage", c["exit"], (0, 1, 0), c["min_exit"] - c["exit"].y, c["max_exit"] - c["exit"].y, node="carriage")
    m.params.update({"bindExitY": c["exit"].y, "stackTravel": c["travel"]})
    return m


# ---------------------------------------------------------------------------
# 6. Lat pulldown
# ---------------------------------------------------------------------------


def lat_pulldown():
    m = Machine(
        "lat-pulldown",
        "Lat Pulldown",
        facing="Lifter sits facing +Z toward the column, knees under the thigh rollers; cable drops from the boom above the head.",
    )
    seat_top = 0.47
    m.params["seatTopY"] = seat_top
    m.pad((0, seat_top - 0.035, -0.34), (0.38, 0.07, 0.36), part="seat_pad")
    m.box((0, seat_top - 0.076, -0.34), (0.30, 0.012, 0.30), "mat_frame", bevel=0.002)
    m.surface("seat", (0, seat_top, -0.52), (0, 1, 0), (0, 0, 1))
    m.beam((0, 0.07, -0.34), (0, seat_top - 0.08, -0.34), 0.07, 0.07, up=(0, 0, 1), part="seat_post")
    A.floor_beam_z(m, 0, -0.62, 0.62, w=0.09)
    m.beam((-0.26, 0.042, -0.58), (0.26, 0.042, -0.58), 0.07, 0.06)
    for x in (0.26, -0.26):
        A.floor_foot(m, x, -0.58, 0.07, 0.08)
    # Column with the stack.
    col_z = 0.50
    travel, stack_top = A.stack_tower(m, 0, col_z, -1, "stack", height=2.10, plates=15, part="column")
    m.beam((0, 2.17, col_z + 0.12), (0, 2.17, -0.30), 0.09, 0.09, part="boom")
    m.beam((0, 1.55, col_z - 0.13), (0, 2.12, col_z - 0.13), 0.06, 0.06)
    A.sheave(m, (0, 2.10, col_z), (1, 0, 0), 0.05)
    A.sheave(m, (0, 2.10, -0.26), (1, 0, 0), 0.05)
    for s in (1, -1):
        m.box((s * 0.02, 2.10, -0.26), (0.008, 0.12, 0.12), "mat_frame", bevel=0.004)
    exit_pt = Vector((0, 2.04, -0.26))
    m.revolve(exit_pt + Vector((0, -0.01, 0)), (0, 1, 0), [(0, -0.02), (0.018, -0.016), (0.02, 0.0), (0.012, 0.01), (0, 0.01)], "mat_rubber", None, 16)
    m.tube((0, 2.12, -0.26), (0, 2.12, col_z), 0.004, "mat_cable", None, 8)
    m.pulley("pulley", exit_pt, (0, -1, 0), stack="stack", ratio=1.0, stack_travel=travel)

    # Thigh rollers: height-adjustable post in front of the seat.
    m.beam((0, 0.07, 0.02), (0, 0.50, 0.02), 0.07, 0.07, up=(0, 0, 1))
    roll_y, roll_z = 0.69, -0.12
    m.node("thigh_pad", (0, roll_y, roll_z))
    m.beam((0, 0.42, 0.02), (0, roll_y + 0.0, 0.02), 0.055, 0.055, node="thigh_pad", up=(0, 0, 1))
    m.beam((0, roll_y, 0.02), (0, roll_y, roll_z), 0.05, 0.05, node="thigh_pad")
    A.pop_pin(m, (0, 0.47, 0.055), (0, 0, 1), node="thigh_pad")
    for s in (1, -1):
        m.revolve((s * 0.035, roll_y, roll_z), (s, 0, 0), [(0, 0), (0.052, 0.0), (0.058, 0.01), (0.058, 0.17), (0.05, 0.19), (0, 0.19)], "mat_pad", "thigh_pad", 28)
    m.tube((-0.04, roll_y, roll_z), (0.04, roll_y, roll_z), 0.02, "mat_chrome", "thigh_pad", 14)
    m.collider("thigh_pad", "capsule", (0.058, 0.32, 0), (0, roll_y, roll_z), node="thigh_pad")
    # One contact per roller, under the middle of each thigh; the rollers leave a gap on the centreline.
    for s, tag in ((1, "L"), (-1, "R")):
        m.surface(f"thigh_pad_{tag}", (s * 0.12, roll_y - 0.058, roll_z), (0, -1, 0), (0, 0, 1), node="thigh_pad")
    m.rail("thigh_pad", (0, roll_y, roll_z), (0, 1, 0), -0.10, 0.12, node="thigh_pad")
    m.params["stackTravel"] = travel
    return m


# ---------------------------------------------------------------------------
# 7. Seated cable row
# ---------------------------------------------------------------------------


def seated_cable_row():
    m = Machine(
        "seated-cable-row",
        "Seated Cable Row",
        facing="Lifter sits facing +Z with feet on the footplates; low pulley exits toward -Z between the plates.",
    )
    seat_top = 0.44
    m.params["seatTopY"] = seat_top
    m.pad((0, seat_top - 0.035, -0.50), (0.32, 0.07, 0.80), part="seat_pad")
    m.box((0, seat_top - 0.076, -0.50), (0.26, 0.012, 0.74), "mat_frame", bevel=0.002)
    m.surface("seat", (0, seat_top, -0.80), (0, 1, 0), (0, 0, 1))
    for z in (-0.80, -0.22):
        m.beam((0, 0.07, z), (0, seat_top - 0.08, z), 0.07, 0.07, up=(0, 0, 1))
    A.floor_beam_z(m, 0, -0.95, 0.85, w=0.10)
    m.beam((-0.28, 0.042, -0.90), (0.28, 0.042, -0.90), 0.07, 0.06)
    for x in (0.28, -0.28):
        A.floor_foot(m, x, -0.90, 0.07, 0.08)
    # Footplates angled 20° back from vertical, toward the lifter.
    tilt = math.radians(20)
    fn = Vector((0, math.sin(tilt), -math.cos(tilt)))
    fu = Vector((0, math.cos(tilt), math.sin(tilt)))
    m.beam((0, 0.07, 0.30), (0, 0.24, 0.30), 0.06, 0.06, up=(0, 0, 1))
    m.beam((-0.26, 0.24, 0.32), (0.26, 0.24, 0.32), 0.05, 0.05)
    for sx, tag in ((1, "L"), (-1, "R")):
        c = Vector((sx * 0.15, 0.30, 0.30))
        m.box(c, (0.17, 0.30, 0.02), "mat_frame", rot=frame_quat(-fn, fu), bevel=0.005, part=f"footplate_{tag}")
        m.box(c + fn * 0.012, (0.15, 0.28, 0.004), "mat_tread", rot=frame_quat(-fn, fu), bevel=0.001)
        m.box(c - fu * 0.15 + fn * 0.03, (0.17, 0.02, 0.06), "mat_frame", rot=frame_quat(-fn, fu), bevel=0.004)
        bottom = c - fu * 0.15 + fn * 0.012
        m.footplate(f"foot_{tag}", bottom, fn, fu, 0.15, 0.0, 0.30)
    col_z = 0.70
    travel, _ = A.stack_tower(m, 0, col_z, -1, "stack", height=1.60, plates=15, part="column")
    exit_pt = Vector((0, 0.60, 0.50))
    A.sheave(m, (0, 0.62, 0.53), (1, 0, 0), 0.045)
    for s in (1, -1):
        m.box((s * 0.02, 0.62, 0.53), (0.008, 0.11, 0.11), "mat_frame", bevel=0.004)
    m.beam((0, 0.07, 0.56), (0, 0.58, 0.56), 0.05, 0.05, up=(0, 0, 1))
    m.revolve(exit_pt, (0, 0, -1), [(0, -0.01), (0.02, -0.01), (0.02, 0.008), (0.012, 0.016), (0, 0.016)], "mat_rubber", None, 16)
    m.pulley("pulley", exit_pt, (0, 0, -1), stack="stack", ratio=1.0, stack_travel=travel)
    m.params["stackTravel"] = travel
    return m


# ---------------------------------------------------------------------------
# 8. Smith machine
# ---------------------------------------------------------------------------


def smith_machine():
    m = Machine(
        "smith-machine",
        "Smith Machine",
        facing="Lifter stands under the bar facing +Z; the bar rides vertical rails in the plane z = 0.",
    )
    rx, px, pz, h = 0.62, 0.80, 0.36, 2.25
    bar_y = 1.30
    m.params.update({"railX": rx, "barY": bar_y, "safetyY": 0.60})
    for sx, tag in ((1, "L"), (-1, "R")):
        for sz in (1, -1):
            A.post(m, sx * px, sz * pz, 0.072, h - 0.075, part=f"post_{tag}{'f' if sz > 0 else 'b'}")
        A.floor_beam_z(m, sx * px, -0.62, 0.62, w=0.075)
        m.beam((sx * px, h - 0.0375, -pz - 0.0375), (sx * px, h - 0.0375, pz + 0.0375), 0.075, 0.075)
        # Rail brackets and rail.
        m.beam((sx * px, h - 0.09, 0), (sx * (rx - 0.03), h - 0.09, 0), 0.06, 0.05)
        m.beam((sx * px, 0.06, 0), (sx * (rx - 0.03), 0.06, 0), 0.06, 0.05)
        m.tube((sx * rx, 0.06, 0), (sx * rx, h - 0.09, 0), 0.016, "mat_chrome", None, 20, part=f"rail_{tag}")
        # Rack slot strip behind each rail.
        m.box((sx * rx, 1.17, -0.055), (0.05, 1.86, 0.012), "mat_frame", bevel=0.003)
        for k in range(16):
            m.box((sx * rx, 0.38 + k * 0.11, -0.046), (0.03, 0.012, 0.008), "mat_accent", bevel=0.001)
    m.beam((-px, h - 0.0375, pz), (px, h - 0.0375, pz), 0.075, 0.075, part="top_front")
    m.beam((-px, h - 0.0375, -pz), (px, h - 0.0375, -pz), 0.075, 0.075, part="top_back")
    m.beam((-px, 0.042, -pz), (px, 0.042, -pz), 0.075, 0.06)

    m.node("carriage", (0, bar_y, 0))
    _bar(m, "carriage", (0, bar_y, 0), shaft_half=rx - 0.045, sleeve_from=rx + 0.045, sleeve_to=rx + 0.38, knurl=True)
    for sx in (1, -1):
        m.box((sx * rx, bar_y, 0), (0.07, 0.11, 0.07), "mat_frame", node="carriage", bevel=0.01)
        m.tube((sx * rx, bar_y + 0.03, 0.035), (sx * rx, bar_y + 0.03, 0.11), 0.01, "mat_accent", "carriage", 12)
        m.box((sx * rx, bar_y + 0.03, -0.045), (0.02, 0.03, 0.03), "mat_frame", node="carriage", bevel=0.004)
    m.collider("bar", "cylinder", (0.0145, 2 * (rx - 0.045), 0), (0, bar_y, 0), quat=None, mat="mat_chrome", node="carriage")
    m.handle("bar", (0, bar_y, 0), (1, 0, 0), (0, -1, 0), 0.0145, 2 * (rx - 0.045), "bar", node="carriage")
    m.rail("carriage", (0, bar_y, 0), (0, 1, 0), 0.25 - bar_y, 2.02 - bar_y, node="carriage")

    for sx, tag in ((1, "L"), (-1, "R")):
        n = f"safety_{tag}"
        top = 0.60
        m.node(n, (sx * rx, top, 0))
        m.revolve((sx * rx, top - 0.07, 0), (0, 1, 0), [(0.017, 0), (0.04, 0), (0.04, 0.05), (0.036, 0.054), (0.017, 0.054)], "mat_frame", n, 24, cap_start=True, cap_end=True)
        m.revolve((sx * rx, top - 0.016, 0), (0, 1, 0), [(0.017, 0), (0.034, 0), (0.034, 0.016), (0.017, 0.016)], "mat_rubber", n, 24)
        A.pop_pin(m, (sx * (rx + 0.04), top - 0.045, 0), (sx, 0, 0), node=n, knob=0.012)
        m.hook(n, (sx * rx, top, 0), node=n)
        m.rail(n, (sx * rx, top, 0), (0, 1, 0), 0.2 - top, 1.4 - top, node=n)
    return m


def _bar(m, node, center, shaft_half, sleeve_from, sleeve_to, knurl=True, r=0.0145):
    c = Vector(center)
    m.tube(c + Vector((-shaft_half, 0, 0)), c + Vector((shaft_half, 0, 0)), r, "mat_chrome", node, 20)
    if knurl:
        for s in (1, -1):
            m.tube(c + Vector((s * 0.09, 0, 0)), c + Vector((s * (shaft_half - 0.03), 0, 0)), r + 0.0006, "mat_grip", node, 20)
    for s in (1, -1):
        m.tube(c + Vector((s * sleeve_from, 0, 0)), c + Vector((s * sleeve_to, 0, 0)), 0.025, "mat_chrome", node, 24, chamfer=0.003)
        m.disc(c + Vector((s * (sleeve_from + 0.01), 0, 0)), (1, 0, 0), 0.04, 0.02, "mat_chrome", node, 28, chamfer=0.003)


# ---------------------------------------------------------------------------
# 9. 45° leg press
# ---------------------------------------------------------------------------


def leg_press_45():
    m = Machine(
        "leg-press-45",
        "45° Leg Press",
        facing="Lifter reclines facing +Z, feet on the sled's footplate; the sled rides two rails up and away at 45°.",
        notes="Sled bind is the bottom stop; travel is along `rails.sled` (0 to 0.62 m).",
    )
    d = Vector((0, S2, S2))
    u = Vector((0, S2, -S2))
    nrm = -d
    p0 = Vector((0, 0.86, -0.12))
    seat_j = Vector((0, 0.42, -0.42))
    st = math.radians(18)
    seat_up = Vector((0, math.sin(st), math.cos(st)))
    seat_n = Vector((0, math.cos(st), -math.sin(st)))
    ba = math.radians(42)
    back_up = Vector((0, math.sin(ba), -math.cos(ba)))
    back_n = Vector((0, math.cos(ba), math.sin(ba)))
    pad_t = 0.075
    m.pad(seat_j + Vector((0, 0, 0.02)) + seat_up * 0.17 - seat_n * pad_t / 2, (0.42, pad_t, 0.34), rot=frame_quat(seat_up, seat_n), part="seat_pad")
    m.pad(seat_j + back_up * 0.42 - back_n * pad_t / 2, (0.42, pad_t, 0.82), rot=frame_quat(back_up, back_n), part="back_pad")
    m.box(seat_j + back_up * 0.42 - back_n * (pad_t + 0.008), (0.36, 0.014, 0.78), "mat_frame", rot=frame_quat(back_up, back_n), bevel=0.003)
    m.box(seat_j + Vector((0, 0, 0.02)) + seat_up * 0.17 - seat_n * (pad_t + 0.008), (0.36, 0.014, 0.30), "mat_frame", rot=frame_quat(seat_up, seat_n), bevel=0.003)
    m.surface("seat", seat_j + Vector((0, 0, 0.02)), seat_n, seat_up)
    m.surface("back", seat_j, back_n, back_up)
    # Seat frame.
    for sx in (1, -1):
        m.beam((sx * 0.16, 0.07, -0.30), seat_j + Vector((sx * 0.16, -pad_t - 0.03, 0.10)), 0.06, 0.06, up=(1, 0, 0))
        m.beam((sx * 0.16, 0.07, -1.05), seat_j + back_up * 0.62 + Vector((sx * 0.16, 0, 0)) - back_n * (pad_t + 0.03), 0.06, 0.06, up=(1, 0, 0))
        m.beam(seat_j + Vector((sx * 0.16, -pad_t - 0.03, 0.10)), seat_j + back_up * 0.62 + Vector((sx * 0.16, 0, 0)) - back_n * (pad_t + 0.03), 0.05, 0.05, up=(1, 0, 0))
    # Side handles beside the seat.
    for sx, tag in ((1, "L"), (-1, "R")):
        hy, z0, z1 = 0.47, -0.48, -0.18
        m.beam((sx * 0.30, 0.07, -0.28), (sx * 0.30, hy - 0.02, -0.28), 0.045, 0.045, up=(0, 0, 1))
        m.tube((sx * 0.30, hy, z0 - 0.02), (sx * 0.30, hy, z1 + 0.02), 0.012, "mat_chrome", None, 14)
        m.tube((sx * 0.30, hy, z0), (sx * 0.30, hy, z0 + 0.20), 0.016, "mat_grip", None, 18, chamfer=0.003)
        m.handle(f"handle_{tag}", (sx * 0.30, hy, z0 + 0.10), (0, 0, 1), (-sx, 0, 0), 0.016, 0.20, "neutral")

    # Base.
    for sx in (1, -1):
        A.floor_beam_z(m, sx * 0.34, -1.10, 0.95, w=0.08)
    m.beam((-0.34, 0.042, -1.10), (0.34, 0.042, -1.10), 0.08, 0.06)
    m.beam((-0.34, 0.042, 0.95), (0.34, 0.042, 0.95), 0.08, 0.06)
    m.beam((-0.34, 0.042, -0.30), (0.34, 0.042, -0.30), 0.08, 0.06)

    # Rails beneath the sled path, offset along -u.
    rail_off = 0.31
    r0 = p0 + d * (0.12 - 0.14) - u * rail_off
    r1 = p0 + d * (0.12 + 0.80) - u * rail_off
    for sx, tag in ((1, "L"), (-1, "R")):
        a = r0 + Vector((sx * 0.32, 0, 0))
        b = r1 + Vector((sx * 0.32, 0, 0))
        m.tube(a, b, 0.024, "mat_chrome", None, 20, part=f"rail_{tag}")
        m.beam(a - u * 0.06, b - u * 0.06, 0.07, 0.06, up=u)
        m.beam((sx * 0.34, 0.07, b.z + 0.02), b - u * 0.08, 0.07, 0.07, up=(0, 0, 1))
        m.beam((sx * 0.34, 0.07, a.z + 0.12), a - u * 0.08 + d * 0.06, 0.07, 0.07, up=(0, 0, 1))
        m.revolve(a + d * 0.03, d, [(0.0, 0.0), (0.045, 0.0), (0.045, 0.05), (0.0, 0.05)], "mat_rubber", None, 20)
    m.beam(r1 - u * 0.08 + Vector((-0.34, 0, 0)), r1 - u * 0.08 + Vector((0.34, 0, 0)), 0.07, 0.07)

    # Sled.
    m.node("sled", p0)
    plate_c = p0 + d * 0.012
    q = frame_quat(u, nrm)
    m.box(plate_c, (0.76, 0.024, 0.62), "mat_frame", node="sled", rot=q, bevel=0.008, part="footplate")
    m.box(p0 - d * 0.0015, (0.72, 0.004, 0.58), "mat_tread", node="sled", rot=q, bevel=0.002)
    for k in range(9):
        m.box(p0 - d * 0.004 + u * (-0.26 + k * 0.065), (0.70, 0.003, 0.012), "mat_tread", node="sled", rot=q, bevel=0.001)
    body_c = p0 + d * 0.11 - u * 0.10
    m.box(body_c, (0.70, 0.16, 0.36), "mat_frame", node="sled", rot=q, bevel=0.012)
    for sx in (1, -1):
        bearing = p0 + d * 0.12 - u * rail_off + Vector((sx * 0.32, 0, 0))
        m.box(bearing, (0.08, 0.14, 0.09), "mat_frame", node="sled", rot=frame_quat(d, -u), bevel=0.01)
        m.beam(bearing + u * 0.04, body_c + Vector((sx * 0.30, 0, 0)), 0.06, 0.06, node="sled", up=(1, 0, 0))
        horn_base = body_c + Vector((sx * 0.35, 0, 0)) - u * 0.04
        m.tube(horn_base, horn_base + Vector((sx * 0.26, 0, 0)), 0.025, "mat_chrome", "sled", 22, chamfer=0.003)
        m.disc(horn_base + Vector((sx * 0.012, 0, 0)), (1, 0, 0), 0.04, 0.025, "mat_frame", "sled", 24)
    for sx, tag in ((1, "L"), (-1, "R")):
        # Release levers the lifter can reach from the seat.
        lever0 = body_c + Vector((sx * 0.35, 0, 0)) + u * 0.20
        m.tube(lever0, lever0 + Vector((sx * 0.06, 0, 0)) + u * 0.10, 0.014, "mat_grip", "sled", 14)
    m.footplate("sled", p0 - u * 0.31, nrm, u, 0.72, 0.0, 0.62, node="sled")
    m.rail("sled", p0, d, 0.0, 0.62, node="sled")
    m.params.update({"railDir": list(d), "footplateCenter": list(p0)})
    return m


# ---------------------------------------------------------------------------
# 10/11. Leg extension and seated leg curl
# ---------------------------------------------------------------------------


def _seated_frame(m, seat_top, seat_z0, seat_z1, back_bottom_z, back_angle_deg):
    m.pad((0, seat_top - 0.035, (seat_z0 + seat_z1) / 2), (0.38, 0.07, seat_z1 - seat_z0), part="seat_pad")
    m.box((0, seat_top - 0.076, (seat_z0 + seat_z1) / 2), (0.30, 0.012, seat_z1 - seat_z0 - 0.06), "mat_frame", bevel=0.002)
    m.surface("seat", (0, seat_top, seat_z0), (0, 1, 0), (0, 0, 1))
    ba = math.radians(back_angle_deg)
    bu = Vector((0, math.sin(ba), -math.cos(ba)))
    bn = Vector((0, math.cos(ba), math.sin(ba)))
    b0 = Vector((0, seat_top + 0.03, back_bottom_z))
    m.pad(b0 + bu * 0.32 - bn * 0.035, (0.36, 0.07, 0.62), rot=frame_quat(bu, bn), part="back_pad")
    m.box(b0 + bu * 0.32 - bn * 0.076, (0.30, 0.012, 0.58), "mat_frame", rot=frame_quat(bu, bn), bevel=0.002)
    m.surface("back", b0, bn, bu)
    m.beam((0, 0.07, (seat_z0 + seat_z1) / 2), (0, seat_top - 0.085, (seat_z0 + seat_z1) / 2), 0.08, 0.08, up=(0, 0, 1), part="seat_post")
    m.beam((0, seat_top - 0.10, back_bottom_z - 0.06), b0 + bu * 0.55 - bn * 0.10, 0.06, 0.06, up=(1, 0, 0))
    m.beam((0, 0.07, back_bottom_z - 0.06), (0, seat_top - 0.09, back_bottom_z - 0.06), 0.07, 0.07, up=(0, 0, 1))
    A.floor_beam_z(m, 0, back_bottom_z - 0.36, seat_z1 + 0.30, w=0.09)
    m.beam((-0.28, 0.042, seat_z1 + 0.30), (0.28, 0.042, seat_z1 + 0.30), 0.07, 0.06)
    for x in (0.28, -0.28):
        A.floor_foot(m, x, seat_z1 + 0.30, 0.07, 0.08)
    for sx, tag in ((1, "L"), (-1, "R")):
        y = seat_top - 0.05
        z0, z1 = seat_z0 + 0.06, seat_z0 + 0.24
        m.beam((sx * 0.20, y, z0 - 0.02), (sx * 0.27, y, z0 - 0.02), 0.03, 0.03)
        m.tube((sx * 0.27, y, z0 - 0.05), (sx * 0.27, y, z1), 0.016, "mat_grip", None, 18, chamfer=0.003)
        m.handle(f"handle_{tag}", (sx * 0.27, y, (z0 + z1) / 2), (0, 0, 1), (-sx, 0, 0), 0.016, z1 - z0, "neutral")


def _lever_hub(m, node, hub, arm_to, cross_to, pad_c, pad_len=0.36, pad_r=0.055, pad_axis=(1, 0, 0)):
    m.disc(hub, (1, 0, 0), 0.10, 0.05, "mat_frame", node, 32, chamfer=0.006)
    m.disc(hub + Vector((-0.03, 0, 0)), (1, 0, 0), 0.03, 0.012, "mat_accent", node, 20)
    m.beam(hub, arm_to, 0.06, 0.04, node=node, up=(1, 0, 0))
    m.beam(arm_to, cross_to, 0.04, 0.04, node=node)
    ax = Vector(pad_axis).normalized()
    c = Vector(pad_c)
    m.tube(c - ax * (pad_len / 2 + 0.03), c + ax * (pad_len / 2 + 0.02), 0.016, "mat_chrome", node, 14)
    half = pad_len / 2
    m.revolve(c - ax * half, ax, [(0, 0), (pad_r - 0.008, 0), (pad_r, 0.012), (pad_r, pad_len - 0.012), (pad_r - 0.008, pad_len), (0, pad_len)], "mat_pad", node, 28)


def leg_extension():
    m = Machine(
        "leg-extension",
        "Leg Extension",
        facing="Lifter sits facing +Z; knee axis aligns with the lever pivot at the seat's front edge.",
        notes="`lever_arm` rotates about world X at the knee axis; negative X rotation extends the knee.",
    )
    seat_top = 0.50
    m.params.update({"seatTopY": seat_top, "asymmetric": "Lever and cam sit on the lifter's right; x = 0 is the lifter's midline."})
    _seated_frame(m, seat_top, -0.12, 0.30, -0.14, 100)
    travel, _ = A.stack_tower(m, 0, -0.66, -1, "stack", height=1.50, plates=14, part="stack_tower")
    pivot = Vector((0, 0.57, 0.34))
    hub = Vector((-0.30, pivot.y, pivot.z))
    m.beam((-0.30, 0.07, 0.40), (-0.30, pivot.y - 0.06, pivot.z), 0.07, 0.07, up=(0, 0, 1))
    m.beam((-0.30, 0.042, 0.40), (-0.30, 0.042, -0.40), 0.07, 0.06)
    m.beam((0, 0.042, -0.40), (-0.30, 0.042, -0.40), 0.07, 0.06)
    m.tube((-0.36, pivot.y, pivot.z), (-0.22, pivot.y, pivot.z), 0.022, "mat_chrome", None, 16)
    m.disc((-0.31, pivot.y, pivot.z), (1, 0, 0), 0.025, 0.06, "mat_accent", None, 16)
    m.sweep([(-0.30, pivot.y + 0.10, pivot.z), (-0.30, 1.42, -0.40), (-0.30, 1.47, -0.66), (0, 1.47, -0.66)], 0.004, "mat_cable", None, 8)
    m.beam((-0.30, 0.07, -0.40), (-0.30, 1.47, -0.40), 0.05, 0.05, up=(0, 0, 1))
    m.beam((-0.30, 1.47, -0.40), (-0.18, 1.47, -0.66), 0.05, 0.05)
    # Thigh hold-down roller.
    m.beam((0.24, seat_top - 0.05, 0.18), (0.24, 0.76, 0.18), 0.04, 0.04, up=(0, 0, 1))
    m.beam((0.24, 0.76, 0.18), (0.18, 0.76, 0.18), 0.04, 0.04)
    m.revolve((0.18, 0.74, 0.18), (-1, 0, 0), [(0, 0), (0.045, 0), (0.05, 0.01), (0.05, 0.36), (0.045, 0.37), (0, 0.37)], "mat_pad", None, 24)
    m.collider("thigh_pad", "capsule", (0.05, 0.27, 0), (0, 0.74, 0.18))
    m.surface("thigh_pad", (0, 0.69, 0.18), (0, -1, 0), (0, 0, 1))

    m.node("lever_arm", pivot)
    arm_to = Vector((-0.30, 0.17, 0.43))
    pad_c = Vector((0, 0.17, 0.43))
    _lever_hub(m, "lever_arm", hub, arm_to, Vector((-0.22, 0.17, 0.43)), pad_c, 0.40, 0.058)
    m.collider("ankle_pad", "capsule", (0.058, 0.30, 0), pad_c, mat="mat_pad", node="lever_arm")
    m.surface("ankle_pad", pad_c - Vector((0, 0, 0.058)), (0, 0, -1), (0, 1, 0), node="lever_arm")
    m.pivot("lever_arm", pivot, (1, 0, 0), -95, 5, node="lever_arm")
    m.params["stackTravel"] = travel
    return m


def seated_leg_curl():
    m = Machine(
        "seated-leg-curl",
        "Seated Leg Curl",
        facing="Lifter sits facing +Z with legs out on the calf pad; the thigh pad locks the thighs down.",
        notes="`lever_arm` rotates about world X at the knee axis; positive X rotation curls the pad down and back.",
    )
    seat_top = 0.50
    m.params.update({"seatTopY": seat_top, "asymmetric": "Lever and cam sit on the lifter's right; x = 0 is the lifter's midline."})
    _seated_frame(m, seat_top, -0.12, 0.30, -0.14, 102)
    travel, _ = A.stack_tower(m, 0, -0.66, -1, "stack", height=1.50, plates=14, part="stack_tower")
    pivot = Vector((0, 0.57, 0.34))
    hub = Vector((-0.30, pivot.y, pivot.z))
    m.beam((-0.30, 0.07, 0.25), (-0.30, pivot.y - 0.06, pivot.z), 0.07, 0.07, up=(0, 0, 1))
    m.beam((-0.30, 0.042, 0.25), (-0.30, 0.042, -0.40), 0.07, 0.06)
    m.beam((0, 0.042, -0.40), (-0.30, 0.042, -0.40), 0.07, 0.06)
    m.tube((-0.36, pivot.y, pivot.z), (-0.22, pivot.y, pivot.z), 0.022, "mat_chrome", None, 16)
    m.sweep([(-0.30, pivot.y + 0.10, pivot.z), (-0.30, 1.42, -0.40), (-0.30, 1.47, -0.66), (0, 1.47, -0.66)], 0.004, "mat_cable", None, 8)
    m.beam((-0.30, 0.07, -0.40), (-0.30, 1.47, -0.40), 0.05, 0.05, up=(0, 0, 1))
    m.beam((-0.30, 1.47, -0.40), (-0.18, 1.47, -0.66), 0.05, 0.05)
    # Thigh pad: a padded bar across the lower thighs, on a swing arm from the lever side.
    tp = Vector((0, 0.735, 0.20))
    m.beam((-0.30, pivot.y + 0.05, pivot.z - 0.06), (-0.30, tp.y + 0.04, tp.z), 0.05, 0.05, up=(1, 0, 0))
    m.beam((-0.30, tp.y + 0.04, tp.z), (-0.20, tp.y + 0.04, tp.z), 0.04, 0.04)
    m.pad(tp, (0.40, 0.08, 0.16), part="thigh_pad")
    m.surface("thigh_pad", tp - Vector((0, 0.04, 0)), (0, -1, 0), (0, 0, 1))

    m.node("lever_arm", pivot)
    leg = Vector((0, -math.sin(math.radians(15)), math.cos(math.radians(15))))
    down = Vector((0, -math.cos(math.radians(15)), -math.sin(math.radians(15))))
    pad_c = pivot + leg * 0.40 + down * 0.115
    arm_to = Vector((-0.30, pad_c.y, pad_c.z))
    _lever_hub(m, "lever_arm", hub, arm_to, Vector((-0.22, pad_c.y, pad_c.z)), Vector((0, pad_c.y, pad_c.z)), 0.40, 0.058)
    m.collider("calf_pad", "capsule", (0.058, 0.30, 0), (0, pad_c.y, pad_c.z), mat="mat_pad", node="lever_arm")
    m.surface("calf_pad", (0, pad_c.y + 0.058, pad_c.z), (0, 1, 0), (0, 0, 1), node="lever_arm")
    m.pivot("lever_arm", pivot, (1, 0, 0), -5, 110, node="lever_arm")
    m.params["stackTravel"] = travel
    return m


# ---------------------------------------------------------------------------
# 12. Chest press
# ---------------------------------------------------------------------------


def chest_press_machine():
    m = Machine(
        "chest-press-machine",
        "Chest Press Machine",
        facing="Lifter sits facing +Z against the upright back pad; arms swing forward from overhead pivots.",
        notes="Each arm rotates about world X at its overhead pivot; negative X rotation presses forward.",
    )
    seat_top = 0.46
    m.params["seatTopY"] = seat_top
    m.pad((0, seat_top - 0.035, 0.18), (0.40, 0.07, 0.38), part="seat_pad")
    m.box((0, seat_top - 0.076, 0.18), (0.32, 0.012, 0.32), "mat_frame", bevel=0.002)
    m.surface("seat", (0, seat_top, -0.01), (0, 1, 0), (0, 0, 1))
    ba = math.radians(82)
    bu = Vector((0, math.sin(ba), -math.cos(ba)))
    bn = Vector((0, math.cos(ba), math.sin(ba)))
    b0 = Vector((0, seat_top + 0.04, -0.03))
    m.pad(b0 + bu * 0.37 - bn * 0.04, (0.40, 0.08, 0.72), rot=frame_quat(bu, bn), part="back_pad")
    m.box(b0 + bu * 0.37 - bn * 0.086, (0.32, 0.012, 0.68), "mat_frame", rot=frame_quat(bu, bn), bevel=0.002)
    m.surface("back", b0, bn, bu)
    m.beam((0, 0.07, 0.18), (0, seat_top - 0.085, 0.18), 0.08, 0.08, up=(0, 0, 1), part="seat_post")
    A.floor_beam_z(m, 0, -0.80, 0.52, w=0.09)
    m.beam((-0.30, 0.042, 0.52), (0.30, 0.042, 0.52), 0.07, 0.06)
    for x in (0.30, -0.30):
        A.floor_foot(m, x, 0.52, 0.07, 0.08)
    m.beam((0, 0.07, -0.20), (0, 1.30, -0.20), 0.08, 0.08, up=(0, 0, 1), part="back_post")
    travel, _ = A.stack_tower(m, 0, -0.55, -1, "stack", height=1.90, plates=15, part="stack_tower")
    # Overhead frame with the arm pivots.
    py, pz, px = 1.86, 0.40, 0.33
    for sx in (1, -1):
        m.beam((sx * 0.22, 1.90, -0.55), (sx * 0.22, 1.90, pz + 0.06), 0.07, 0.07)
        m.beam((sx * 0.22, 1.90, pz), (sx * (px + 0.05), py, pz), 0.06, 0.06)
    m.beam((-0.22, 1.90, -0.20), (0.22, 1.90, -0.20), 0.07, 0.07)
    m.beam((0, 1.30, -0.20), (0, 1.87, -0.20), 0.07, 0.07, up=(0, 0, 1))
    for sx, tag in ((1, "L"), (-1, "R")):
        n = f"arm_{tag}"
        pivot = Vector((sx * px, py, pz))
        m.node(n, pivot)
        m.disc(pivot, (1, 0, 0), 0.06, 0.05, "mat_frame", n, 28, chamfer=0.005)
        m.disc(pivot + Vector((sx * 0.03, 0, 0)), (1, 0, 0), 0.025, 0.012, "mat_accent", n, 20)
        hand = Vector((sx * px, 1.00, 0.20))
        m.beam(pivot, hand + Vector((0, 0.03, 0.04)), 0.06, 0.045, node=n, up=(1, 0, 0))
        g0 = hand.copy()
        g1 = Vector((sx * 0.19, hand.y, hand.z))
        m.tube(g0 + Vector((sx * 0.02, 0, 0)), g1 - Vector((sx * 0.015, 0, 0)), 0.016, "mat_grip", n, 18, chamfer=0.003)
        m.tube(g0 + Vector((sx * 0.03, 0, 0)), g0, 0.012, "mat_chrome", n, 12)
        m.disc(g1, (1, 0, 0), 0.022, 0.012, "mat_rubber", n, 18)
        m.handle(f"handle_{tag}", (g0 + g1) / 2, (1, 0, 0), (0, 0, 1), 0.016, abs(g1.x - g0.x), "press", node=n)
        # Neutral grip hanging just behind the horizontal one.
        ng = hand + Vector((0, -0.02, -0.07))
        m.tube(ng + Vector((0, -0.08, 0)), ng + Vector((0, 0.08, 0)), 0.016, "mat_grip", n, 18, chamfer=0.003)
        m.beam(ng + Vector((0, 0.08, 0)), hand + Vector((0, 0.05, 0.0)), 0.03, 0.03, node=n)
        m.handle(f"neutral_{tag}", ng, (0, 1, 0), (-sx, 0, 0), 0.016, 0.15, "neutral", node=n)
        m.pivot(n, pivot, (1, 0, 0), -40, 10, node=n)
    m.params["stackTravel"] = travel
    return m


# ---------------------------------------------------------------------------
# 13. Dip / pull-up station
# ---------------------------------------------------------------------------


def dip_pullup_station():
    m = Machine(
        "dip-pullup-station",
        "Dip & Pull-up Station",
        facing="Lifter faces +Z between the dip handles (back to the tower) or hangs from the pull-up bar.",
        notes="Also covers captain's-chair leg raises via the back pad and dip handles.",
    )
    px, pz, h = 0.40, -0.32, 2.30
    for sx, tag in ((1, "L"), (-1, "R")):
        A.post(m, sx * px, pz, 0.072, h - 0.04, part=f"post_{tag}")
        A.floor_beam_z(m, sx * px, -0.70, 0.62, w=0.075)
    m.beam((-px, 0.042, -0.70), (px, 0.042, -0.70), 0.075, 0.06)
    m.beam((-px, 0.50, pz), (px, 0.50, pz), 0.06, 0.06)
    m.beam((-px, 1.60, pz), (px, 1.60, pz), 0.06, 0.06)
    for sx in (1, -1):
        m.beam((sx * px, 0.07, -0.66), (sx * px, 1.0, pz - 0.04), 0.05, 0.05, up=(1, 0, 0))
    # Back pad.
    m.pad((0, 1.15, pz + 0.07), (0.30, 0.50, 0.07), part="back_pad")
    m.surface("back", (0, 0.90, pz + 0.105), (0, 0, 1), (0, 1, 0))
    # Dip handles.
    dy, dx = 1.22, 0.275
    for sx, tag in ((1, "L"), (-1, "R")):
        m.beam((sx * px, dy, pz + 0.04), (sx * dx, dy, pz + 0.04), 0.05, 0.05)
        m.tube((sx * dx, dy, pz + 0.02), (sx * dx, dy, 0.33), 0.019, "mat_chrome", None, 20, chamfer=0.003, part=f"dip_{tag}")
        m.tube((sx * dx, dy, 0.02), (sx * dx, dy, 0.31), 0.0198, "mat_grip", None, 20, chamfer=0.003)
        m.handle(f"dip_{tag}", (sx * dx, dy, 0.165), (0, 0, 1), (-sx, 0, 0), 0.0198, 0.29, "neutral")
        # Step for mounting.
        m.box((sx * px * 0.75, 0.40, pz + 0.12), (0.18, 0.02, 0.16), "mat_frame", bevel=0.004)
        m.box((sx * px * 0.75, 0.411, pz + 0.12), (0.16, 0.003, 0.14), "mat_tread", bevel=0.001)
        m.beam((sx * px, 0.38, pz + 0.04), (sx * px * 0.75, 0.38, pz + 0.12), 0.03, 0.03)
    # Pull-up bar on forward cantilever arms (the arms double as wide neutral grips).
    by, bz = h - 0.04, 0.20
    for sx, tag in ((1, "L"), (-1, "R")):
        m.beam((sx * px, h - 0.04, pz - 0.04), (sx * px, h - 0.04, bz + 0.04), 0.06, 0.06)
        m.tube((sx * px, h - 0.105, -0.15), (sx * px, h - 0.105, 0.12), 0.0168, "mat_grip", None, 18)
        m.beam((sx * px, h - 0.07, -0.16), (sx * px, h - 0.105, -0.15), 0.02, 0.02)
        m.beam((sx * px, h - 0.07, 0.13), (sx * px, h - 0.105, 0.12), 0.02, 0.02)
        m.handle(f"neutral_{tag}", (sx * px, h - 0.105, -0.015), (0, 0, 1), (-sx, 0, 0), 0.0168, 0.25, "hang")
    m.node("pullup_bar", (0, by, bz + 0.09))
    m.tube((-0.62, by, bz + 0.09), (0.62, by, bz + 0.09), 0.016, "mat_chrome", "pullup_bar", 20, part="pullup_bar")
    for sx in (1, -1):
        m.box((sx * px, by, bz + 0.05), (0.05, 0.05, 0.09), "mat_frame", node="pullup_bar", bevel=0.005)
        m.tube((sx * 0.08, by, bz + 0.09), (sx * 0.37, by, bz + 0.09), 0.0168, "mat_grip", "pullup_bar", 20)
        m.tube((sx * 0.43, by, bz + 0.09), (sx * 0.60, by, bz + 0.09), 0.0168, "mat_grip", "pullup_bar", 20)
    m.handle("pullup", (0, by, bz + 0.09), (1, 0, 0), (0, 0, 1), 0.016, 1.2, "hang")
    m.beam((-px, h - 0.04, pz), (px, h - 0.04, pz), 0.06, 0.06)
    m.params.update({"dipY": dy, "dipHalfWidth": dx, "pullupY": by})
    return m


# ---------------------------------------------------------------------------
# 14. Preacher bench
# ---------------------------------------------------------------------------


def preacher_bench():
    m = Machine(
        "preacher-bench",
        "Preacher Curl Bench",
        facing="Lifter sits facing +Z with the backs of the upper arms on the 45° pad; bar rests sit in front of the pad.",
    )
    seat_top = 0.52
    m.params["seatTopY"] = seat_top
    m.pad((0, seat_top - 0.035, -0.26), (0.34, 0.07, 0.30), part="seat_pad")
    m.box((0, seat_top - 0.076, -0.26), (0.28, 0.012, 0.26), "mat_frame", bevel=0.002)
    m.surface("seat", (0, seat_top, -0.41), (0, 1, 0), (0, 0, 1))
    a = math.radians(45)
    up = Vector((0, math.sin(a), -math.cos(a)))
    nrm = Vector((0, math.cos(a), math.sin(a)))
    top = Vector((0, 0.96, 0.0))
    pad_len = 0.40
    m.pad(top - up * (pad_len / 2) - nrm * 0.035, (0.60, 0.07, pad_len), rot=frame_quat(up, nrm), radius=0.028, part="arm_pad")
    m.box(top - up * (pad_len / 2) - nrm * 0.076, (0.50, 0.012, pad_len - 0.05), "mat_frame", rot=frame_quat(up, nrm), bevel=0.002)
    m.surface("arm_pad", top, nrm, -up)
    under = top - up * 0.22 - nrm * 0.09
    m.beam((0, 0.07, 0.05), under, 0.07, 0.07, up=(0, 0, 1), part="pad_post")
    m.beam((0, 0.07, -0.26), (0, seat_top - 0.085, -0.26), 0.07, 0.07, up=(0, 0, 1), part="seat_post")
    m.beam((0, 0.80, 0.0), (0, 0.80, -0.08), 0.05, 0.05)
    A.floor_beam_z(m, 0, -0.50, 0.55, w=0.09)
    m.beam((-0.32, 0.042, 0.55), (0.32, 0.042, 0.55), 0.07, 0.06)
    m.beam((-0.26, 0.042, -0.50), (0.26, 0.042, -0.50), 0.07, 0.06)
    for x in (0.32, -0.32):
        A.floor_foot(m, x, 0.55, 0.07, 0.08)
    for x in (0.26, -0.26):
        A.floor_foot(m, x, -0.50, 0.07, 0.08)
    # Bar rests in front of the pad's low edge.
    for sx, tag in ((1, "L"), (-1, "R")):
        rz, ry = 0.40, 0.70
        m.beam((sx * 0.32, 0.07, 0.55), (sx * 0.32, ry - 0.01, rz), 0.05, 0.05, up=(0, 0, 1))
        m.box((sx * 0.32, ry - 0.008, rz - 0.01), (0.05, 0.016, 0.10), "mat_frame", bevel=0.004)
        m.box((sx * 0.32, ry + 0.002, rz - 0.01), (0.046, 0.004, 0.08), "mat_rubber", bevel=0.001)
        m.box((sx * 0.32, ry + 0.03, rz + 0.035), (0.05, 0.07, 0.012), "mat_frame", bevel=0.004)
        m.box((sx * 0.32, ry + 0.03, rz - 0.055), (0.05, 0.05, 0.012), "mat_frame", bevel=0.004)
        m.hook(f"rest_{tag}", (sx * 0.32, ry + 0.004, rz - 0.01))
    return m


# ---------------------------------------------------------------------------
# 15. Back extension bench
# ---------------------------------------------------------------------------


def back_extension_bench():
    m = Machine(
        "back-extension-bench",
        "45° Back Extension",
        facing="Lifter faces down the slope toward +Z: feet on the rear footplate, thighs on the hip pads.",
        notes="`hip_pad` slides along the 45° body line (`rails.hip_pad`).",
    )
    b = Vector((0, S2, S2))
    dorsal = Vector((0, S2, -S2))
    ventral = -dorsal
    foot = Vector((0, 0.20, -0.56))
    # Footplate perpendicular to the body line.
    q = frame_quat(dorsal, b)
    m.box(foot - b * 0.015, (0.50, 0.03, 0.30), "mat_frame", rot=q, bevel=0.006, part="footplate")
    m.box(foot - b * 0.0005, (0.46, 0.003, 0.26), "mat_tread", rot=q, bevel=0.001)
    m.footplate("feet", foot - dorsal * 0.12, b, dorsal, 0.46, 0.0, 0.24)
    ankle = foot + b * 0.09
    roller = ankle + dorsal * 0.115
    for s in (1, -1):
        m.revolve((s * 0.02, roller.y, roller.z), (s, 0, 0), [(0, 0), (0.05, 0.0), (0.056, 0.01), (0.056, 0.17), (0.05, 0.18), (0, 0.18)], "mat_pad", None, 24)
    m.tube((-0.05, roller.y, roller.z), (0.05, roller.y, roller.z), 0.016, "mat_chrome", None, 12)
    m.collider("ankle_roller", "capsule", (0.056, 0.30, 0), roller, mat="mat_pad")
    for s, tag in ((1, "L"), (-1, "R")):
        m.surface(f"ankle_roller_{tag}", roller + Vector((s * 0.1, 0, 0)) - dorsal * 0.056, -dorsal, b)
    # Main beam on the ventral side, base, and pad support.
    beam0 = Vector((0, 0.07, -0.74))
    beam1 = foot + b * 0.62 + ventral * 0.22
    m.beam(beam0, beam1, 0.08, 0.08, up=(1, 0, 0), part="main_beam")
    m.beam(foot - b * 0.03 + ventral * 0.05, roller + ventral * 0.25, 0.05, 0.05, up=(1, 0, 0))
    m.beam(roller + ventral * 0.25, (0, roller.y - 0.02, roller.z), 0.04, 0.04, up=(1, 0, 0))
    A.floor_beam_z(m, 0, -0.80, 0.75, w=0.09)
    m.beam((-0.30, 0.042, -0.80), (0.30, 0.042, -0.80), 0.07, 0.06)
    m.beam((-0.34, 0.042, 0.70), (0.34, 0.042, 0.70), 0.07, 0.06)
    for x in (0.30, -0.30):
        A.floor_foot(m, x, -0.80, 0.07, 0.08)
    for x in (0.34, -0.34):
        A.floor_foot(m, x, 0.70, 0.07, 0.08)
    m.beam((0, 0.07, 0.45), beam1 - b * 0.05, 0.07, 0.07, up=(0, 0, 1))
    m.beam(foot - b * 0.03 + ventral * 0.05, (0, 0.07, -0.62), 0.05, 0.05, up=(1, 0, 0))
    # Hip pads slide along the body line.
    hip_c = foot + b * 0.76 + ventral * 0.16
    m.node("hip_pad", hip_c)
    q2 = frame_quat(b, dorsal)
    for s in (1, -1):
        m.pad(hip_c + Vector((s * 0.105, 0, 0)), (0.19, 0.075, 0.30), node="hip_pad", rot=q2, radius=0.03)
    m.box(hip_c - dorsal * 0.045, (0.40, 0.012, 0.26), "mat_frame", node="hip_pad", rot=q2, bevel=0.002)
    m.beam(hip_c - dorsal * 0.05, hip_c - dorsal * 0.05 + ventral * 0.04, 0.06, 0.06, node="hip_pad", up=(1, 0, 0))
    m.box(beam1, (0.10, 0.10, 0.20), "mat_frame", node="hip_pad", rot=q2, bevel=0.008)
    m.beam(hip_c - dorsal * 0.05, beam1, 0.06, 0.06, node="hip_pad", up=(1, 0, 0))
    A.pop_pin(m, beam1 + Vector((0.05, 0, 0)), (1, 0, 0), node="hip_pad")
    m.collider("hip_pad", "box", (0.40, 0.075, 0.30), hip_c, quat=q2, mat="mat_pad", node="hip_pad")
    for s, tag in ((1, "L"), (-1, "R")):
        m.surface(f"hip_pad_{tag}", hip_c + Vector((s * 0.105, 0, 0)) + dorsal * 0.0375, dorsal, b, node="hip_pad")
    m.rail("hip_pad", hip_c, b, -0.10, 0.12, node="hip_pad")
    # Grab handles beside the pads.
    for sx, tag in ((1, "L"), (-1, "R")):
        g0 = hip_c + Vector((sx * 0.30, 0, 0)) - dorsal * 0.04 - b * 0.10
        m.beam(beam1, g0 - b * 0.02 + Vector((-sx * 0.02, 0, 0)), 0.03, 0.03, up=(1, 0, 0))
        m.tube(g0, g0 + b * 0.18, 0.016, "mat_grip", None, 18, chamfer=0.003)
        m.handle(f"handle_{tag}", g0 + b * 0.09, b, (-sx, 0, 0), 0.016, 0.18, "neutral")
    return m


# ---------------------------------------------------------------------------
# 16. Plyo box and aerobic step
# ---------------------------------------------------------------------------


def plyo_box():
    m = Machine(
        "plyo-box",
        "Plyo Box",
        facing="Square to +Z. Rests on any face: 0.51, 0.61, or 0.76 m tall (rotate the GlbRef).",
    )
    w, hgt, dep = 0.76, 0.51, 0.61
    m.params.update({"heights": [0.51, 0.61, 0.76], "size": [w, hgt, dep]})
    m.box((0, hgt / 2, 0), (w, hgt, dep), "mat_wood", bevel=0.012, segments=3, part="box")
    # Hand-hold slots on the left and right faces.
    for sx in (1, -1):
        m.box((sx * (w / 2 - 0.004), hgt * 0.72, 0), (0.012, 0.04, 0.16), "mat_rubber", bevel=0.008, segments=3)
    # Edge-grain bands so the faces read as plywood panels.
    for sx in (1, -1):
        for sz in (1, -1):
            m.box((sx * (w / 2 - 0.009), hgt / 2, sz * (dep / 2 - 0.009)), (0.02, hgt - 0.03, 0.02), "mat_wood", bevel=0.006)
    # One landing face per resting orientation; the factory exposes the one on top as `top`.
    m.surface("face_0.51", (0, hgt, 0), (0, 1, 0), (0, 0, 1))
    m.surface("face_0.61", (0, hgt / 2, -dep / 2), (0, 0, -1), (0, 1, 0))
    m.surface("face_0.76", (w / 2, hgt / 2, 0), (1, 0, 0), (0, 0, 1))
    return m


def aerobic_step():
    m = Machine("aerobic-step", "Aerobic Step", facing="Long axis along X; step up toward +Z or -Z.", notes="Fixed 0.15 m deck.")
    top = 0.15
    m.params["topY"] = top
    m.box((0, top - 0.035, 0), (0.92, 0.05, 0.36), "mat_frame", bevel=0.02, segments=3, part="deck")
    m.box((0, top - 0.004, 0), (0.86, 0.008, 0.31), "mat_tread", bevel=0.004)
    for sx in (1, -1):
        m.box((sx * 0.36, (top - 0.06) / 2, 0), (0.16, top - 0.06, 0.38), "mat_frame", bevel=0.012, segments=3)
        m.box((sx * 0.36, 0.004, 0), (0.15, 0.008, 0.36), "mat_rubber", bevel=0.003)
    m.surface("top", (0, top, 0), (0, 1, 0), (0, 0, 1))
    return m


# ---------------------------------------------------------------------------
# Tier-1 additions driven by catalog coverage: landmine, decline bench, GHD
# ---------------------------------------------------------------------------


def landmine():
    m = Machine(
        "landmine",
        "Landmine",
        facing="Pivot at the origin; the sleeve points toward -Z where the lifter stands facing +Z.",
        notes="`yaw` turns about +Y, its child `sleeve` pitches about X (+ raises the bar end). A barbell prop slides into the sleeve.",
    )
    pivot = Vector((0, 0.11, 0))
    m.box((0, 0.006, 0), (0.56, 0.012, 0.56), "mat_rubber", bevel=0.004, part="base")
    m.box((0, 0.018, 0), (0.42, 0.012, 0.42), "mat_frame", bevel=0.004)
    m.box((0, 0.055, 0), (0.12, 0.07, 0.12), "mat_frame", bevel=0.008)
    m.node("yaw", pivot)
    m.disc((0, 0.085, 0), (0, 1, 0), 0.06, 0.012, "mat_chrome", "yaw", 28, chamfer=0.002)
    for s in (1, -1):
        m.box((s * 0.05, pivot.y, 0), (0.012, 0.07, 0.07), "mat_frame", node="yaw", bevel=0.004)
    m.node("sleeve", pivot, parent="yaw")
    m.tube((-0.044, pivot.y, 0), (0.044, pivot.y, 0), 0.012, "mat_chrome", "sleeve", 14)
    m.tube(pivot + Vector((0, 0, -0.02)), pivot + Vector((0, 0, -0.30)), 0.034, "mat_frame", "sleeve", 24, chamfer=0.004)
    m.disc(pivot + Vector((0, 0, -0.30)), (0, 0, 1), 0.038, 0.012, "mat_rubber", "sleeve", 24)
    m.point("sleeve_mouth", pivot + Vector((0, 0, -0.30)), node="sleeve")
    m.collider("sleeve", "cylinder", (0.034, 0.28, 0), pivot + Vector((0, 0, -0.16)), quat=quat_from_to((1, 0, 0), (0, 0, -1)), node="sleeve")
    m.pivot("yaw", pivot, (0, 1, 0), -90, 90, node="yaw")
    m.pivot("sleeve", pivot, (1, 0, 0), -2, 70, node="sleeve")
    return m


def decline_bench():
    m = Machine(
        "decline-bench",
        "Decline Bench Press Station",
        facing="Lifter lies head-down toward -Z at 20°, knees hooked over the rollers at +Z; bar racks above the chest.",
        notes="Also the plain decline bench for sit-ups and dumbbell work.",
    )
    a = math.radians(20)
    hip = Vector((0, 0.56, 0.0))
    up = Vector((0, -math.sin(a), -math.cos(a)))
    nrm = Vector((0, math.cos(a), -math.sin(a)))
    pad_t = 0.07
    m.pad(hip + up * 0.47 - nrm * pad_t / 2, (0.30, pad_t, 0.94), rot=frame_quat(up, nrm), part="back_pad")
    m.box(hip + up * 0.47 - nrm * (pad_t + 0.007), (0.24, 0.012, 0.90), "mat_frame", rot=frame_quat(up, nrm), bevel=0.002)
    m.surface("back", hip, nrm, up)
    ta = math.radians(28)
    tu = Vector((0, math.sin(ta), math.cos(ta)))
    tn = Vector((0, math.cos(ta), -math.sin(ta)))
    m.pad(hip + Vector((0, 0, 0.02)) + tu * 0.17 - tn * pad_t / 2, (0.30, pad_t, 0.34), rot=frame_quat(tu, tn), part="seat_pad")
    m.surface("seat", hip + Vector((0, 0, 0.02)), tn, tu)
    knee = hip + Vector((0, 0, 0.02)) + tu * 0.40
    for k, off in enumerate((Vector((0, 0.06, 0.05)), Vector((0, -0.12, 0.15)))):
        c = knee + off
        for s in (1, -1):
            m.revolve((s * 0.02, c.y, c.z), (s, 0, 0), [(0, 0), (0.05, 0.0), (0.056, 0.01), (0.056, 0.17), (0.05, 0.18), (0, 0.18)], "mat_pad", None, 24)
        m.collider(f"roller_{k}", "capsule", (0.056, 0.30, 0), c, mat="mat_pad")
    m.beam((0, 0.07, knee.z + 0.12), (0, knee.y + 0.06, knee.z + 0.05), 0.05, 0.05, up=(0, 0, 1))
    m.beam((0, knee.y - 0.12, knee.z + 0.15), (0, knee.y - 0.12, knee.z + 0.10), 0.04, 0.04)
    m.beam((0, 0.07, -0.78), hip + up * 0.80 - nrm * (pad_t + 0.03), 0.07, 0.06, up=(1, 0, 0))
    m.beam((0, 0.07, 0.05), hip - nrm * (pad_t + 0.03), 0.07, 0.07, up=(0, 0, 1), part="seat_post")
    m.beam(hip - nrm * (pad_t + 0.03), hip + up * 0.80 - nrm * (pad_t + 0.03), 0.06, 0.05, up=(1, 0, 0))
    A.floor_beam_z(m, 0, -0.95, knee.z + 0.20, w=0.09)
    ux, uz = 0.56, -0.74
    m.beam((-ux, 0.042, -0.95), (ux, 0.042, -0.95), 0.075, 0.06, part="base_rear")
    m.beam((-0.30, 0.042, knee.z + 0.20), (0.30, 0.042, knee.z + 0.20), 0.07, 0.06)
    for x in (0.30, -0.30):
        A.floor_foot(m, x, knee.z + 0.20, 0.07, 0.08)
    for sx, tag in ((1, "L"), (-1, "R")):
        A.floor_beam_z(m, sx * ux, -0.95, -0.45, w=0.075)
        A.post(m, sx * ux, uz, 0.072, 1.26, part=f"upright_{tag}")
        m.beam((sx * ux, 0.10, -0.50), (sx * ux, 0.80, uz + 0.04), 0.05, 0.05, up=(1, 0, 0))
        hy = 1.12
        n = f"jhook_{tag}"
        m.node(n, (sx * ux, hy, uz + 0.075))
        m.box((sx * ux, hy - 0.012, uz + 0.06), (0.06, 0.016, 0.10), "mat_frame", node=n, bevel=0.004)
        m.box((sx * ux, hy - 0.002, uz + 0.065), (0.056, 0.004, 0.08), "mat_rubber", node=n, bevel=0.001)
        m.box((sx * ux, hy + 0.025, uz + 0.112), (0.06, 0.065, 0.012), "mat_frame", node=n, bevel=0.004)
        m.hook(n, (sx * ux, hy, uz + 0.075), node=n)
    m.beam((-ux, 1.20, uz), (ux, 1.20, uz), 0.06, 0.06)
    return m


def ghd():
    m = Machine(
        "ghd",
        "Glute-Ham Developer",
        facing="Lifter lies prone along Z, head toward +Z, thighs on the round hip pad, feet against the rear footplate.",
        notes="`foot_carriage` slides along Z to fit the lifter's thigh length (`rails.foot_carriage`).",
    )
    pad_y, pad_z = 1.02, 0.05
    m.revolve((0.0, pad_y, pad_z), (1, 0, 0), [(0, -0.20), (0.11, -0.20), (0.13, -0.18), (0.13, 0.18), (0.11, 0.20), (0, 0.20)], "mat_pad", None, 40)
    m.collider("hip_pad", "cylinder", (0.13, 0.40, 0), (0, pad_y, pad_z), mat="mat_pad")
    m.surface("hip_pad", (0, pad_y + 0.13, pad_z), (0, 1, 0), (0, 0, 1))
    m.box((0, pad_y - 0.12, pad_z), (0.30, 0.04, 0.16), "mat_frame", bevel=0.006)
    m.beam((0, 0.07, pad_z), (0, pad_y - 0.14, pad_z), 0.08, 0.08, up=(0, 0, 1), part="pad_post")
    A.floor_beam_z(m, 0, -1.05, 0.65, w=0.09)
    m.beam((-0.32, 0.042, 0.65), (0.32, 0.042, 0.65), 0.07, 0.06)
    m.beam((-0.32, 0.042, -1.05), (0.32, 0.042, -1.05), 0.07, 0.06)
    for x in (0.32, -0.32):
        A.floor_foot(m, x, 0.65, 0.07, 0.08)
        A.floor_foot(m, x, -1.05, 0.07, 0.08)
    m.beam((0, 0.62, -0.95), (0, 0.62, pad_z - 0.05), 0.08, 0.08, part="rail_beam")
    m.beam((0, 0.07, -0.95), (0, 0.62, -0.95), 0.08, 0.08, up=(0, 0, 1))
    m.beam((0, 0.07, -0.62), (0, 0.58, -0.25), 0.06, 0.06, up=(1, 0, 0))
    car = Vector((0, 0.66, -0.62))
    m.node("foot_carriage", car)
    m.box(car + Vector((0, 0.0, 0)), (0.12, 0.10, 0.20), "mat_frame", node="foot_carriage", bevel=0.01)
    A.pop_pin(m, car + Vector((0.06, 0, 0.05)), (1, 0, 0), node="foot_carriage")
    m.beam(car, car + Vector((0, 0.52, -0.08)), 0.06, 0.06, node="foot_carriage", up=(0, 0, 1))
    plate_c = car + Vector((0, 0.48, -0.14))
    m.box(car + Vector((0, 0.50, -0.115)), (0.08, 0.08, 0.075), "mat_frame", node="foot_carriage", bevel=0.006)
    m.box(plate_c + Vector((0, -0.05, 0.05)), (0.03, 0.24, 0.09), "mat_frame", node="foot_carriage", bevel=0.004)
    m.box(plate_c, (0.44, 0.30, 0.025), "mat_frame", node="foot_carriage", bevel=0.006, part="footplate")
    m.box(plate_c + Vector((0, 0, 0.014)), (0.40, 0.26, 0.004), "mat_tread", node="foot_carriage", bevel=0.001)
    m.footplate("feet", plate_c + Vector((0, -0.13, 0.0145)), (0, 0, 1), (0, 1, 0), 0.40, 0.0, 0.26, node="foot_carriage")
    for k, off in enumerate((Vector((0, 0.22, -0.02)), Vector((0, 0.40, -0.02)))):
        c = plate_c + Vector((0, -0.36, 0.11)) + off
        for s in (1, -1):
            m.revolve((s * 0.02, c.y, c.z), (s, 0, 0), [(0, 0), (0.045, 0.0), (0.05, 0.01), (0.05, 0.15), (0.045, 0.16), (0, 0.16)], "mat_pad", "foot_carriage", 24)
        m.tube((-0.03, c.y, c.z), (0.03, c.y, c.z), 0.014, "mat_chrome", "foot_carriage", 12)
        m.collider(f"ankle_roller_{k}", "capsule", (0.05, 0.26, 0), c, mat="mat_pad", node="foot_carriage")
    m.rail("foot_carriage", car, (0, 0, 1), -0.15, 0.20, node="foot_carriage")
    for sx, tag in ((1, "L"), (-1, "R")):
        g = Vector((sx * 0.28, pad_y - 0.05, pad_z - 0.05))
        m.beam((0, pad_y - 0.12, pad_z), g - Vector((sx * 0.02, 0, 0)), 0.03, 0.03)
        m.tube(g + Vector((0, 0, -0.08)), g + Vector((0, 0, 0.08)), 0.016, "mat_grip", None, 18, chamfer=0.003)
        m.handle(f"handle_{tag}", g, (0, 0, 1), (-sx, 0, 0), 0.016, 0.16, "neutral")
    return m


def slant_board():
    m = Machine(
        "slant-board",
        "Slant Board",
        facing="Long side across X; the deck rises toward -Z, so a lifter facing +Z stands heels-up.",
        notes="25° incline; turn it 180° (yawDeg) for toes-up calf stretches.",
    )
    w, d = 0.46, 0.50
    a = math.radians(25)
    hi = d * math.tan(a)
    m.params.update({"angleDeg": 25, "highY": hi})
    x0, x1 = -w / 2, w / 2
    z0, z1 = d / 2, -d / 2
    verts = [(x0, 0, z0), (x1, 0, z0), (x1, 0, z1), (x0, 0, z1), (x0, hi, z1), (x1, hi, z1)]
    faces = [(0, 3, 2, 1), (0, 1, 5, 4), (1, 2, 5), (0, 4, 3), (3, 4, 5, 2)]
    m._emit(verts, faces, "mat_wood", None, None, (0, 0, 0))
    up = Vector((0, math.sin(a), -math.cos(a)))
    nrm = Vector((0, math.cos(a), math.sin(a)))
    mid = Vector((0, hi / 2, 0))
    for k in range(6):
        m.box(mid + up * (-0.20 + k * 0.08) + nrm * 0.002, (w - 0.06, 0.004, 0.035), "mat_tread", rot=frame_quat(up, nrm), bevel=0.001)
    m.collider("deck", "box", (w, 0.02, d / math.cos(a)), mid - nrm * 0.01, quat=frame_quat(up, nrm), mat="mat_wood")
    m.surface("deck", mid, nrm, up)
    return m


MACHINES = [
    adjustable_bench,
    power_rack,
    olympic_incline_bench,
    dual_adjustable_pulley,
    single_cable_tower,
    lat_pulldown,
    seated_cable_row,
    smith_machine,
    leg_press_45,
    leg_extension,
    seated_leg_curl,
    chest_press_machine,
    dip_pullup_station,
    preacher_bench,
    back_extension_bench,
    plyo_box,
    aerobic_step,
    landmine,
    decline_bench,
    ghd,
    slant_board,
]
