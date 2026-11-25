"""Sub-assemblies shared by several canonical machines."""

import math

from mathutils import Vector

from lib import v

TUBE = 0.075
PLATE_H = 0.042


def floor_foot(m, x, z, w=0.09, d=0.09, h=0.012):
    """Rubber leveling foot whose underside defines y = 0."""
    m.box((x, h / 2, z), (w, h, d), "mat_rubber", bevel=0.003)


def floor_beam_x(m, x0, x1, z, h=0.06, w=0.075, feet=True):
    m.beam((x0, 0.012 + h / 2, z), (x1, 0.012 + h / 2, z), w, h, extend=0.0)
    if feet:
        floor_foot(m, x0, z)
        floor_foot(m, x1, z)


def floor_beam_z(m, x, z0, z1, h=0.06, w=0.075, feet=True):
    m.beam((x, 0.012 + h / 2, z0), (x, 0.012 + h / 2, z1), w, h)
    if feet:
        floor_foot(m, x, z0)
        floor_foot(m, x, z1)


def post(m, x, z, y0, y1, w=TUBE, d=TUBE, part=None, node=None):
    m.box((x, (y0 + y1) / 2, z), (w, y1 - y0, d), "mat_frame", node=node, part=part)
    # Rubber cap so tube ends read as finished.
    m.box((x, y1 + 0.003, z), (w * 0.96, 0.006, d * 0.96), "mat_rubber", node=node, bevel=0.002)


def pop_pin(m, pos, axis, node=None, knob=0.016):
    """Spring pop-pin: accent knob on a short chrome barrel, pointing along `axis` away from the tube."""
    p = v(pos)
    a = v(axis).normalized()
    m.tube(p, p + a * 0.03, 0.009, "mat_chrome", node, 12)
    m.revolve(p + a * 0.03, a, [(0, 0), (knob, 0.003), (knob, 0.016), (knob * 0.7, 0.024), (0, 0.026)], "mat_accent", node, 16)


def sheave(m, center, axis, r=0.045, width=0.022, node=None):
    """Grooved pulley wheel with a chrome axle."""
    w = width / 2
    prof = [
        (0.008, -w),
        (r, -w),
        (r, -w * 0.55),
        (r - 0.012, -w * 0.15),
        (r - 0.012, w * 0.15),
        (r, w * 0.55),
        (r, w),
        (0.008, w),
    ]
    m.revolve(center, axis, prof, "mat_plate", node, 28, cap_start=True, cap_end=True)
    a = v(axis).normalized()
    c = v(center)
    m.tube(c - a * (w + 0.01), c + a * (w + 0.01), 0.008, "mat_chrome", node, 12)


def weight_stack(m, cx, cz, node, plates=15, width=0.27, depth=0.12, base_y=0.11, guide_top=1.78, guide_dx=None, part_prefix=None):
    """Selectorized stack between two guide rods. Moving top block lives under `node`.

    Returns the stack's max upward travel before the top block hits the guide-rod cap.
    """
    gx = guide_dx if guide_dx is not None else width / 2 - 0.035
    # Guide rods and their top cap / bottom bumpers stay static.
    for s in (1, -1):
        m.tube((cx + s * gx, base_y - 0.06, cz), (cx + s * gx, guide_top, cz), 0.0095, "mat_chrome", None, 14)
        m.revolve((cx + s * gx, base_y - 0.01, cz), (0, 1, 0), [(0, -0.05), (0.025, -0.05), (0.025, 0.0), (0, 0.0)], "mat_rubber", None, 16)
    m.box((cx, base_y - 0.065, cz), (width + 0.04, 0.02, depth + 0.02), "mat_frame", bevel=0.004)
    m.box((cx, guide_top + 0.012, cz), (width + 0.04, 0.024, depth + 0.02), "mat_frame", bevel=0.004)
    # Plates: everything rides on the selector rod, so the full stack lifts with the node.
    top_y = base_y + plates * PLATE_H
    pivot = Vector((cx, top_y, cz))
    m.node(node, pivot)
    for i in range(plates):
        y0 = base_y + i * PLATE_H
        m.box((cx, y0 + PLATE_H / 2 - 0.001, cz), (width, PLATE_H - 0.003, depth), "mat_stack", node=node, bevel=0.004)
        # Weight label recess, flush on the front face.
        m.box((cx, y0 + PLATE_H / 2 - 0.001, cz + depth / 2 + 0.0006), (0.05, 0.016, 0.0014), "mat_rubber", node=node, bevel=0.0)
    m.box((cx, top_y + 0.015, cz), (width, 0.03, depth), "mat_frame", node=node, bevel=0.006)
    m.tube((cx, base_y + 0.02, cz), (cx, top_y + 0.09, cz), 0.009, "mat_chrome", node, 12)
    m.revolve((cx, top_y + 0.09, cz), (0, 1, 0), [(0, 0), (0.016, 0), (0.016, 0.02), (0, 0.03)], "mat_chrome", node, 14)
    # Selector pin in the third plate from the top.
    pin_y = base_y + (plates - 3) * PLATE_H + PLATE_H / 2
    pop_pin(m, (cx, pin_y, cz + depth / 2), (0, 0, 1), node)
    if part_prefix:
        m.collider(f"{part_prefix}", "box", (width + 0.04, guide_top - base_y + 0.1, depth + 0.04), (cx, (guide_top + base_y) / 2, cz), mat="mat_stack", collide=False)
    return guide_top - (top_y + 0.12), top_y


def stack_tower(m, cx, cz, facing, node, height=2.0, plates=15, part=None, shroud=True):
    """Selectorized column: two corner posts, rear shroud panel, top cap, and the stack inside.

    `facing` (+1/-1) is the Z side the stack's open face looks toward.
    """
    f = facing
    w = 0.40
    d = 0.26
    for s in (1, -1):
        post(m, cx + s * (w / 2 - 0.03), cz + f * (d / 2 - 0.03), 0.07, height, 0.06, 0.06)
        post(m, cx + s * (w / 2 - 0.03), cz - f * (d / 2 - 0.03), 0.07, height, 0.06, 0.06)
    m.box((cx, 0.04, cz), (w + 0.06, 0.06, d + 0.08), "mat_frame", bevel=0.006)
    floor_foot(m, cx + w / 2, cz + d / 2)
    floor_foot(m, cx - w / 2, cz + d / 2)
    floor_foot(m, cx + w / 2, cz - d / 2)
    floor_foot(m, cx - w / 2, cz - d / 2)
    m.box((cx, height + 0.03, cz), (w + 0.04, 0.06, d + 0.04), "mat_frame", bevel=0.01)
    if shroud:
        m.box((cx, (0.07 + height) / 2, cz - f * (d / 2 - 0.005)), (w - 0.06, height - 0.07, 0.01), "mat_frame", bevel=0.002)
        for s in (1, -1):
            m.box((cx + s * (w / 2 - 0.005), (0.07 + height) / 2, cz), (0.01, height - 0.07, d - 0.12), "mat_frame", bevel=0.002)
    travel, top_y = weight_stack(m, cx, cz, node, plates=plates, base_y=0.13, guide_top=height - 0.08)
    if part:
        m.collider(part, "box", (w + 0.04, height, d + 0.04), (cx, height / 2, cz), collide=True)
    return travel, top_y
