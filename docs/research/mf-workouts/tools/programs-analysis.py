"""Calibration evidence for MF Smart Generation, computed from generated-programs.json.

Prints the tables behind milestone-2-generation-analysis.md.

Usage: python3 -I programs-analysis.py [app_file.json]
"""
import sys

sys.dont_write_bytecode = True

import itertools
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
APP_FILE = (
    "/Applications/Runner.app/Wrapper/Runner.app/Frameworks/App.framework/"
    "flutter_assets/packages/macrofactor/assets/import/app_file.json"
)
PULLS = {"Horizontal Pull", "Vertical Pull"}
SHORT_PATTERN = {
    "Horizontal Push": "HPush", "Vertical Push": "VPush", "Horizontal Pull": "HPull",
    "Vertical Pull": "VPull", "Squat": "Squat", "Hip Hinge": "Hinge",
    "Lunge/Split Squat/Step Up/Single Leg Squat": "Lunge",
}
BAND_MAX = {"0-20": 20, "20-40": 40, "40-60": 60, "60-90": 90, "90-120": 120, "120+": None}
BAND_MIN = {"0-20": 0, "20-40": 20, "40-60": 40, "60-90": 60, "90-120": 90, "120+": 120}
SLOT_FIELD = {"primary": "PrimaryCompound", "secondary": "SecondaryCompound", "accessory": "Accessory", "core": "Accessory"}


def rr(s):
    return f"{s['repsMin']}-{s['repsMax']}"


def pid(p):
    return p["output"]["name"].split()[1]


def rir_track(rirs):
    """A = push/leg compound (last set 1 RIR), B = pull compound (last set 0), C = accessory (0,0 tail)."""
    if len(rirs) == 1:
        return {2: "A", 1: "B", 0: "C"}[rirs[0]]
    if rirs[-1] == 1:
        return "A"
    return "C" if rirs[-2] == 0 else "B"


def table(header, rows):
    print("| " + " | ".join(header) + " |")
    print("|" + "---|" * len(header))
    for r in rows:
        print("| " + " | ".join(str(c) for c in r) + " |")
    print()


def load_rows(programs):
    """One row per exercise occurrence, with inferred slot."""
    rows = []
    for p in programs:
        inp = p["inputs"]
        work = [d for d in p["output"]["days"] if not d.get("rest")]
        prog_rows = []
        for di, day in enumerate(work):
            for pos, e in enumerate(day["exercises"]):
                c1 = e["setsPerCycle"][0]
                rirs = tuple(s["rir"] for s in c1)
                prog_rows.append({
                    "p": p, "pid": pid(p), "inp": inp, "day": di, "dayName": day["name"], "pos": pos, "e": e,
                    "track": rir_track(rirs), "rirs": rirs, "n": len(c1), "tier": rr(c1[0]),
                    "lo": c1[0]["repsMin"], "seq": tuple(rr(c[0]) for c in e["setsPerCycle"]),
                    "rirByCycle": [tuple(s["rir"] for s in c) for c in e["setsPerCycle"]],
                    "isPull": e["movementPattern"][0] in PULLS,
                })
        lows = {t: sorted({r["lo"] for r in prog_rows if r["track"] == t}) for t in "AB"}
        for r in prog_rows:
            if r["track"] == "C":
                r["slot"] = "core" if "Core" in r["e"]["classification"]["hypertrophy"] else "accessory"
                r["role"] = "accessory"
            elif len(lows[r["track"]]) == 1 and r["track"] == "B":
                r["slot"] = "pull?"
                r["role"] = "pull P/S (tied)"
            else:
                r["slot"] = "primary" if r["lo"] == lows[r["track"]][0] else "secondary"
                r["role"] = ("pull " if r["track"] == "B" else "") + r["slot"]
        rows += prog_rows
    return rows


def load_gym():
    """Equipment names from equipment.md: True in the gym, False marked 'not in this gym'."""
    gym = {}
    for line in (HERE / "equipment.md").read_text().splitlines():
        m = re.match(r"- (.+?) — .*", line)
        if m:
            gym[m.group(1).lower()] = "(not in this gym)" not in line
    return gym


def availability(ex, U, gym):
    """True/False when the gym list decides it, None when an item is missing from the gym list."""
    def group_ok(gid):
        g = U[gid]
        items = g.get("equipment", [gid]) if g["type"] != "equipment" else [gid]
        states = [gym.get(str(U[i]["name"]).lower()) for i in items]
        if all(s is True for s in states):
            return True
        if any(s is False for s in states):
            return False
        return None

    def any_ok(gids):
        if not gids:
            return True
        states = [group_ok(g) for g in gids]
        if True in states:
            return True
        return None if None in states else False

    r, s = any_ok(ex["resistanceEquipmentGroupIds"]), any_ok(ex["supportEquipmentGroupIds"])
    if r is False or s is False:
        return False
    return None if None in (r, s) else True


def level_field(goal, slot):
    g = "strength" if goal == "strength" or (goal == "both" and slot == "primary") else "hypertrophy"
    return f"{g}{SLOT_FIELD[slot]}RecommendationLevel"


def main():
    data = json.loads((HERE / "generated-programs.json").read_text())
    programs = data["programs"]
    app = json.load(open(sys.argv[1] if len(sys.argv) > 1 else APP_FILE))
    U, EX = app["uuidIndex"], {e["id"]: e for e in app["exercises"]}
    rows = load_rows(programs)
    byp = defaultdict(list)
    for r in rows:
        byp[r["pid"]].append(r)
    P = {pid(p): p for p in programs}

    print("## 1. Program shape\n")
    table(["prog", "goal", "days", "split", "session", "prog.", "exp", "deload in", "cycles", "deload out",
           "cycleBlocks", "setsPerCycle len", "day pattern", "day names"],
          [(pid(p), p["inputs"]["goal"], p["inputs"]["daysPerWeek"], p["inputs"]["split"], p["inputs"]["sessionMinutes"],
            p["inputs"]["repProgression"], p["inputs"]["experience"], p["inputs"]["deload"], p["output"]["cycles"],
            p["output"]["deload"], "".join(map(str, p["output"]["cycleBlocks"])),
            sorted({len(r["e"]["setsPerCycle"]) for r in byp[pid(p)]}),
            "".join("R" if d.get("rest") else "W" for d in p["output"]["days"]),
            ", ".join(d["name"] for d in p["output"]["days"] if not d.get("rest"))) for p in programs])

    print("## 2. Slots\n")
    print("Compound skeleton per day (slot letter: P primary, S secondary, ? pull with tied tier; accessory count):\n")
    for p in programs:
        print(f"- {pid(p)} ({p['inputs']['daysPerWeek']}x {p['inputs']['split']} {p['inputs']['sessionMinutes']}):")
        for di in sorted({r["day"] for r in byp[pid(p)]}):
            day = [r for r in byp[pid(p)] if r["day"] == di]
            comp = [f"{SHORT_PATTERN.get(r['e']['movementPattern'][0], r['e']['movementPattern'][0])}"
                    f":{ {'primary': 'P', 'secondary': 'S', 'pull?': '?'}[r['slot']] }{r['n']}"
                    for r in day if r["track"] != "C"]
            acc = [r for r in day if r["track"] == "C"]
            order = "".join("C" if r["track"] == "C" else "K" for r in day)
            ordered = re.fullmatch(r"K*C*", order) is not None
            print(f"    {day[0]['dayName']}: {' '.join(comp)} + {len(acc)} acc x{sorted({r['n'] for r in acc})}"
                  f"{'' if ordered else '  ORDER BREAK ' + order}")
    print()

    print("Slot order check: compound block before accessory block in every day ->",
          all(re.fullmatch(r"K*C*", "".join("C" if r["track"] == "C" else "K" for r in byp[k] if r["day"] == di))
              for k in byp for di in {r["day"] for r in byp[k]}))
    prim_first = []
    for k in byp:
        for di in {r["day"] for r in byp[k]}:
            seq = [r["slot"] for r in byp[k] if r["day"] == di and r["slot"] in ("primary", "secondary")]
            prim_first.append(seq == sorted(seq, key=lambda s: s != "primary"))
    print(f"Days where every determinable primary precedes every secondary: {sum(prim_first)}/{len(prim_first)}\n")

    print("Exercises and sets per training day (cycle 1):\n")
    tm_rows = []
    for p in programs:
        days = defaultdict(list)
        for r in byp[pid(p)]:
            days[r["day"]].append(r)
        ex = [len(v) for v in days.values()]
        sets = [sum(r["n"] for r in v) for v in days.values()]
        ksets = [sum(r["n"] for r in v if r["track"] != "C") for v in days.values()]
        asets = [sum(r["n"] for r in v if r["track"] == "C") for v in days.values()]
        tm_rows.append((p, ksets, asets))
        print(f"- {pid(p)} {p['inputs']['daysPerWeek']}x {p['inputs']['sessionMinutes']}: exercises {ex}, sets {sets}, "
              f"compound sets {ksets}, accessory sets {asets}")
    print()

    print("Time model search: minutes = a * compound sets + b * accessory sets, every day inside its band:\n")
    fits = []
    for a2 in range(4, 21):
        for b2 in range(4, 21):
            a, b = a2 / 4, b2 / 4
            inside = 0
            total = 0
            for p, ks, accs in tm_rows:
                band = p["inputs"]["sessionMinutes"]
                for k, c in zip(ks, accs):
                    t = a * k + b * c
                    total += 1
                    hi = BAND_MAX[band]
                    inside += BAND_MIN[band] <= t <= (hi if hi else 1e9)
            fits.append((inside, a, b, total))
    best = max(f[0] for f in fits)
    print(f"Best fit puts {best}/{fits[0][3]} days inside their band, achieved by (a, b): "
          f"{[(a, b) for n, a, b, _ in fits if n == best]}\n")
    for a, b in [(3, 2)]:
        out = []
        for p, ks, accs in tm_rows:
            out.append(f"{pid(p)} {p['inputs']['sessionMinutes']}: {[a * k + b * c for k, c in zip(ks, accs)]}")
        print(f"(a, b) = ({a}, {b}) minutes per day: " + "; ".join(out) + "\n")

    print("Set count per slot by session band (cycle 1, count of exercises):\n")
    sc = defaultdict(Counter)
    for r in rows:
        sc[(r["inp"]["sessionMinutes"], r["slot"])][r["n"]] += 1
    bands = ["0-20", "20-40", "40-60", "60-90", "90-120", "120+"]
    table(["band"] + ["primary", "secondary", "pull?", "accessory", "core"],
          [(b, *[" ".join(f"{n}x{c}" for n, c in sorted(sc[(b, s)].items())) or "-"
                 for s in ["primary", "secondary", "pull?", "accessory", "core"]]) for b in bands])

    print("## 3. Rep sequences per (goal, progression, role)\n")
    seqs = defaultdict(Counter)
    for r in rows:
        goal = r["inp"]["goal"]
        seqs[(goal, r["inp"]["repProgression"], r["role"])][r["seq"]] += 1
    table(["goal", "progression", "role", "cycle sequence (c1..c7)", "exercises", "distinct sequences"],
          [(g, pr, role, " / ".join(next(iter(c.most_common(1)))[0]), sum(c.values()), len(c))
           for (g, pr, role), c in sorted(seqs.items())])
    print("Static P7, hypertrophy pull tiers by day position (resolves the tie that linear hides):")
    for r in byp["P7"]:
        if r["track"] == "B":
            print(f"    {r['dayName']} pos {r['pos']} {r['e']['name']}: {r['tier']}")
    print()
    print("Cycle 1 equals cycle 2 and cycle 6 equals cycle 7 in every 7-cycle exercise:",
          all(r["seq"][0] == r["seq"][1] and r["seq"][5] == r["seq"][6] for r in rows if len(r["seq"]) == 7
              and r["inp"]["repProgression"] in ("noPreference", "linear")))
    lin = {r["seq"] for r in rows if r["inp"]["repProgression"] in ("noPreference", "linear")}
    for name, perm in [("undulating", "P9"), ("reverseLinear", "P10")]:
        mapping = Counter()
        for r in byp[perm]:
            ref = [q for q in lin if q[0] == r["seq"][0] or sorted(q) == sorted(r["seq"])]
            match = [q for q in lin if sorted(q) == sorted(r["seq"])]
            if match:
                q = match[0]
                distinct = list(dict.fromkeys(q))
                mapping[tuple(distinct.index(x) for x in r["seq"])] += 1
        print(f"{name} as indexes into the linear distinct values v0..v4: {dict(mapping)}")
    print()

    print("## 4. RIR\n")
    rir_tab = defaultdict(Counter)
    for r in rows:
        rir_tab[(r["track"], r["n"])][r["rirs"]] += 1
    table(["track", "sets", "RIR per set (count)"],
          [(t, n, "; ".join(f"{list(k)} x{v}" for k, v in c.items())) for (t, n), c in sorted(rir_tab.items())])
    print("RIR identical across all cycles of every exercise:",
          all(len(set(r["rirByCycle"])) == 1 for r in rows))
    track_by_pattern = Counter((r["track"], "pull" if r["isPull"] else "non-pull") for r in rows)
    print("Track vs movement pattern class:", dict(track_by_pattern))
    rest = Counter(s["restSeconds"] for p in programs for d in p["output"]["days"] for e in d.get("exercises", [])
                   for c in e["setsPerCycle"] for s in c)
    types = Counter(s["type"] for p in programs for d in p["output"]["days"] for e in d.get("exercises", [])
                    for c in e["setsPerCycle"] for s in c)
    print(f"restSeconds values: {dict(rest)}; set types: {dict(types)}\n")

    print("Same structure across experience, deload, and repeat runs (P1 P8 P16 P17 P18):")
    shape = {k: [(r["day"], r["pos"], r["track"], r["n"], r["rirs"], r["seq"],
                  r["e"]["movementPattern"][0] if r["track"] != "C" else None) for r in byp[k]] for k in
             ["P1", "P8", "P16", "P17", "P18"]}
    print({k: shape[k] == shape["P1"] for k in shape}, "\n")

    print("## 5. Exercise selection\n")
    gym = load_gym()
    eq_names = {str(v["name"]).lower() for v in U.values() if v["type"] == "equipment"}
    print(f"Gym list: {sum(gym.values())} in, {sum(not v for v in gym.values())} out; "
          f"{len(eq_names - set(gym))} catalog equipment names absent from the list")
    picks_av = Counter(availability(EX[r["e"]["id"]], U, gym) for r in rows)
    print(f"Picked exercises available under the gym list: {dict(picks_av)}")
    for r in rows:
        if availability(EX[r["e"]["id"]], U, gym) is False:
            print(f"    unavailable pick: {r['pid']} {r['e']['name']}")
    print()

    lv = defaultdict(Counter)
    for r in rows:
        slot = r["slot"]
        slots = ["primary", "secondary"] if slot == "pull?" else [slot]
        lvls = [EX[r["e"]["id"]][level_field(r["inp"]["goal"], s)] for s in slots]
        lvls = [x for x in lvls if x is not None]
        lv[slot][min(lvls) if lvls else None] += 1
    table(["slot", "level of the pick in its goal field (count)", "share at level 1"],
          [(s, ", ".join(f"{k}: {v}" for k, v in sorted(c.items(), key=lambda kv: (kv[0] is None, kv[0] or 0))),
            f"{c[1.0] / sum(c.values()):.0%}") for s, c in lv.items()])

    muscle_name = {i: str(U[i]["name"]) for e in EX.values() for i in e["primaryFeatureMuscle"]}
    by_muscle = defaultdict(list)
    for e in EX.values():
        for m in e["primaryFeatureMuscle"]:
            by_muscle[muscle_name[m]].append(e)

    skip_reason = Counter()
    skip_examples = defaultdict(list)
    tie_rank = Counter()
    top_expected = []
    picks_skipping = 0
    for k, prs in byp.items():
        prog_ids = {r["e"]["id"] for r in prs}
        prog_excl = Counter(g for i in prog_ids for g in EX[i]["exclusionGroupings"])
        for r in prs:
            if r["slot"] == "pull?":
                continue
            f = level_field(r["inp"]["goal"], r["slot"])
            ex = EX[r["e"]["id"]]
            mine = ex[f]
            if mine is None:
                continue
            best_skips = None
            for m in r["e"]["primary"]:
                better = [c for c in by_muscle[m] if c[f] is not None and c[f] < mine and c["id"] != ex["id"]]
                if best_skips is None or len(better) < len(best_skips):
                    best_skips = better
            if best_skips:
                picks_skipping += 1
            for c in best_skips or []:
                av = availability(c, U, gym)
                if av is False:
                    why = "equipment not in gym"
                elif c["id"] in prog_ids:
                    why = "already in program"
                elif any(prog_excl[g] for g in c["exclusionGroupings"]):
                    why = "exclusion grouping taken"
                elif c["preconditions"]:
                    why = "has precondition"
                elif av is None:
                    why = "equipment unknown"
                else:
                    why = "unexplained"
                skip_reason[why] += 1
                if len(skip_examples[why]) < 6:
                    skip_examples[why].append(f"{r['pid']} {r['slot']} {r['e']['name']} (L{mine:g}) over "
                                              f"{c['name']} (L{c[f]:g})")
            same = [c for m in r["e"]["primary"] for c in by_muscle[m]
                    if c[f] == mine and availability(c, U, gym) is not False and not c["preconditions"]]
            boosts = sorted({c.get("searchBoostValue") or 0 for c in same}, reverse=True)
            uniq = {c["id"]: c for c in same}.values()
            if boosts:
                top_expected.append(sum((c.get("searchBoostValue") or 0) == boosts[0] for c in uniq) / len(uniq))
            tie_rank[boosts.index(ex.get("searchBoostValue") or 0) + 1 if boosts else None] += 1
    determinable = sum(1 for r in rows if r["slot"] != "pull?")
    print(f"Picks with a strictly better-level candidate for the same primary muscle: {picks_skipping}/{determinable}")
    print(f"Skipped better candidates by likely cause: {dict(skip_reason)}")
    for why, ex in skip_examples.items():
        print(f"  {why}: " + " | ".join(ex))
    print(f"\nRank of the pick's searchBoost among equal-level, equipment-possible, precondition-free candidates "
          f"(1 = highest boost): {dict(sorted(tie_rank.items(), key=lambda kv: kv[0] or 99))}")
    print(f"Share of picks at the top boost: {tie_rank[1] / len(top_expected):.0%}; expected under a uniform draw "
          f"among those candidates: {sum(top_expected) / len(top_expected):.0%}\n")

    print("Pairwise exercise overlap (shared ids / union) among same-structure programs:\n")
    group = ["P1", "P8", "P9", "P10", "P16", "P17", "P18", "P7"]
    ids = {k: {r["e"]["id"] for r in byp[k]} for k in group}
    pos = {k: {(r["day"], r["pos"]): r["e"]["id"] for r in byp[k]} for k in group}
    table([""] + group, [(a, *[f"{len(ids[a] & ids[b]) / len(ids[a] | ids[b]):.2f}" for b in group]) for a in group])
    print("P1 vs P8 same exercise at the same day and position:",
          f"{sum(pos['P1'][x] == pos['P8'].get(x) for x in pos['P1'])}/{len(pos['P1'])}")
    print("P14 vs P19 (6x noPreference vs 6x PPLPPL) shared ids:",
          f"{len({r['e']['id'] for r in byp['P14']} & {r['e']['id'] for r in byp['P19']})}"
          f"/{len({r['e']['id'] for r in byp['P14']} | {r['e']['id'] for r in byp['P19']})}\n")

    viol_prog, viol_day, repeats = [], [], []
    for k, prs in byp.items():
        for a, b in itertools.combinations(prs, 2):
            if a["e"]["id"] == b["e"]["id"]:
                repeats.append(f"{k} {a['e']['name']} ({a['dayName']} and {b['dayName']})")
                continue
            shared = set(a["e"]["exclusionGroupings"]) & set(b["e"]["exclusionGroupings"])
            if shared:
                (viol_day if a["day"] == b["day"] else viol_prog).append(
                    f"{k} {a['dayName']}:{a['slot']} {a['e']['name']} / {b['dayName']}:{b['slot']} {b['e']['name']} "
                    f"share {sorted(shared)}")
    print(f"Exclusion grouping shared within a day: {len(viol_day)}; across days of one program: {len(viol_prog)}")
    for v in viol_day + viol_prog[:25]:
        print("   ", v)
    print(f"Same exercise on two days of one program: {len(repeats)}")
    for v in repeats:
        print("   ", v)
    grp_dup = Counter()
    for k, prs in byp.items():
        for a, b in itertools.combinations(prs, 2):
            if a["e"]["id"] != b["e"]["id"] and set(a["e"]["exerciseGroup"][:1]) & set(b["e"]["exerciseGroup"][:1]):
                grp_dup[k] += 1
    print(f"Pairs sharing their first exerciseGroup per program: {dict(grp_dup)}\n")

    pre = Counter((r["e"]["name"], tuple(r["e"]["preconditions"])) for r in rows if r["e"]["preconditions"])
    print(f"Picked exercises with a precondition: {sum(pre.values())} of {len(rows)} picks")
    for (n, pc), c in pre.most_common():
        print(f"    {n}: {pc[0]} x{c}")
    pre_total = sum(1 for e in EX.values() if e["preconditions"])
    print(f"Catalog exercises with a precondition: {pre_total}\n")

    print("Compound slots per movement pattern per week (P/S/? counts):")
    pats = ["HPush", "VPush", "HPull", "VPull", "Squat", "Hinge"]
    rows_pp = []
    for k, prs in byp.items():
        c = Counter((SHORT_PATTERN.get(r["e"]["movementPattern"][0]), r["slot"]) for r in prs if r["track"] != "C")
        rows_pp.append((k, *[f"{c[(x, 'primary')]}/{c[(x, 'secondary')]}/{c[(x, 'pull?')]}" for x in pats]))
    table(["prog"] + pats, rows_pp)
    print("Accessory primary muscles per day, in day order:")
    for k in ["P11", "P4", "P15", "P1", "P2", "P20", "P12"]:
        for di in sorted({r["day"] for r in byp[k]}):
            acc = [r for r in byp[k] if r["day"] == di and r["track"] == "C"]
            print(f"    {k} {acc[0]['dayName'] if acc else di}: " + ", ".join("+".join(r["e"]["primary"]) for r in acc))
    print()

    print("Compound movement patterns per day (all programs; accessories by pattern):")
    acc_pat = defaultdict(Counter)
    for r in rows:
        if r["track"] == "C":
            acc_pat[r["inp"]["split"]][r["e"]["movementPattern"][0]] += 1
    for s, c in acc_pat.items():
        print(f"    {s}: " + ", ".join(f"{k} {v}" for k, v in c.most_common()))
    print()

    print("## 6. Weekly sets per muscle (cycle 1; primary 1, secondary 0.5)\n")
    weekly = {}
    for k, prs in byp.items():
        m = Counter()
        for r in prs:
            for x in r["e"]["primary"]:
                m[x] += r["n"]
            for x in r["e"]["secondary"]:
                m[x] += r["n"] / 2
        weekly[k] = m
    muscles = sorted({m for w in weekly.values() for m in w}, key=lambda m: -sum(w[m] for w in weekly.values()))
    order = ["P1", "P8", "P16", "P17", "P18", "P9", "P10", "P7", "P11", "P12", "P2", "P15", "P20", "P4", "P5", "P3",
             "P6", "P13", "P14", "P19"]
    table(["muscle"] + order, [(m, *[f"{weekly[k][m]:g}" for k in order]) for m in muscles] +
          [("total", *[f"{sum(weekly[k].values()):g}" for k in order])])
    direct = {k: Counter(x for r in prs if r["track"] == "C" for x in r["e"]["primary"]) for k, prs in byp.items()}
    print("Accessory exercises per primary muscle, P4 (focus) vs P5 (same split, no focus):")
    for k in ["P4", "P5"]:
        print(f"    {k}: {dict(direct[k].most_common())}")
    for k in ["P4", "P5", "P1"]:
        tot = sum(weekly[k].values())
        print(f"    {k} share of weighted weekly sets: " + ", ".join(
            f"{m} {weekly[k][m] / tot:.1%}" for m in ["Biceps", "Side Delts", "Chest", "Triceps", "Lats"]))
    print()

    print("## 7. Deload\n")
    a, b = P["P1"]["output"], P["P18"]["output"]
    print("Top-level output keys that differ P1 vs P18:", [k for k in a if k not in ("days", "name") and a[k] != b[k]])
    print("P1 last cycle vs cycle 6 identical for every exercise:",
          all(r["e"]["setsPerCycle"][6] == r["e"]["setsPerCycle"][5] for r in byp["P1"]))
    print("P18 last cycle vs cycle 6 identical for every exercise:",
          all(r["e"]["setsPerCycle"][6] == r["e"]["setsPerCycle"][5] for r in byp["P18"]))


if __name__ == "__main__":
    main()
