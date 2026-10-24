"""Measure MF Workouts' Smart Generation fields from the bundled exercise export.

Writes generation-candidates.json and the generated half of
smart-generation-fields.md (between the GENERATED markers; the prose above them
is hand-written and preserved).

Usage: python3 -I generation-fields.py [app_file.json]
"""
import json
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

DEFAULT = (
    "/Applications/Runner.app/Wrapper/Runner.app/Frameworks/App.framework/"
    "flutter_assets/packages/macrofactor/assets/import/app_file.json"
)
OUT = Path(__file__).resolve().parent.parent
MD = OUT / "smart-generation-fields.md"
JSON_OUT = OUT / "generation-candidates.json"
START, END = "<!-- GENERATED:START -->", "<!-- GENERATED:END -->"

LEVELS = [
    "strengthPrimaryCompoundRecommendationLevel",
    "strengthSecondaryCompoundRecommendationLevel",
    "strengthAccessoryRecommendationLevel",
    "hypertrophyPrimaryCompoundRecommendationLevel",
    "hypertrophySecondaryCompoundRecommendationLevel",
    "hypertrophyAccessoryRecommendationLevel",
]
SHORT = {f: f.replace("RecommendationLevel", "") for f in LEVELS}
LIST_REFS = [
    "exclusionGroupings",
    "exerciseGroup",
    "preconditions",
    "stretchedMuscle",
    "emphasizedAgonist",
    "deemphasizedAgonist",
    "movementPattern",
    "exerciseClassificationStrength",
    "exerciseClassificationHypertrophy",
]
SCALAR_REFS = ["rom", "stability", "regionTrained", "exerciseType"]
MAJOR = [
    "Chest", "Quads", "Hamstrings", "Glutes", "Lats", "Upper Back",
    "Side Delts", "Biceps", "Triceps", "Calves", "Abs",
]
ANCHORS = [
    "Barbell bench press", "Barbell back squat", "Barbell Romanian deadlift",
    "Overhand grip pull-up", "Chin-up", "Barbell overhead press", "Bent-over barbell row",
    "Seated dumbbell lateral raise", "Barbell biceps curl", "Leg extension",
    "Lying hamstring curl", "Barbell hip thrust", "Standing machine calf raise",
]

data = json.load(open(sys.argv[1] if len(sys.argv) > 1 else DEFAULT))
U = data["uuidIndex"]
EX = data["exercises"]
missing_refs = Counter()


def name(i):
    if i not in U:
        missing_refs[i] += 1
        return f"?{i}"
    return str(U[i]["name"])


def names(ids):
    return [name(i) for i in ids]


def lvl(v):
    return "" if v is None else (str(int(v)) if v == int(v) else str(v))


def boost(e):
    return e.get("searchBoostValue")


def table(header, rows):
    out = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    out += ["| " + " | ".join(str(c).replace("|", "/") for c in r) + " |" for r in rows]
    return out


def rank_key(e, f):
    return (e[f], -(boost(e) or 0), e["name"])


md = []
w = md.append

w(f"Source: `app_file.json`, generatedAt `{data['generatedAt']}`, {len(EX)} exercises, {len(U)} uuidIndex entries. All numbers in this section are measured.")
w("")

w("### uuidIndex entry shapes")
w("")
by_type = defaultdict(list)
for k, v in U.items():
    by_type[v["type"]].append(v)
rows = []
for t, vs in sorted(by_type.items(), key=lambda kv: -len(kv[1])):
    keys = sorted({k for v in vs for k in v} - {"type"})
    rows.append((t, len(vs), ", ".join(keys)))
md += table(["type", "count", "keys"], rows)
w("")

w("### Referenced uuidIndex types per field")
w("")
rows = []
for f in LIST_REFS + SCALAR_REFS:
    vals = [x for e in EX for x in (e.get(f) if isinstance(e.get(f), list) else [e.get(f)]) if x]
    lens = Counter(len(e[f]) for e in EX) if f in LIST_REFS else None
    rows.append((
        f,
        ", ".join(f"{t} {c}" for t, c in Counter(U[x]["type"] if x in U else "MISSING" for x in vals).items()),
        len(set(vals)),
        ", ".join(f"{k}:{c}" for k, c in sorted(lens.items())) if lens else f"null:{sum(1 for e in EX if not e.get(f))}",
    ))
md += table(["field", "referenced type and count", "distinct ids", "list length: exercises"], rows)
w("")

w("### Recommendation levels")
w("")
rows = []
for f in LEVELS:
    vals = [e[f] for e in EX if e.get(f) is not None]
    hist = Counter(vals)
    rows.append((
        SHORT[f], len(vals), min(vals), max(vals),
        sum(1 for v in vals if v != int(v)),
        ", ".join(f"{lvl(k)}:{c}" for k, c in sorted(hist.items())),
    ))
md += table(["field", "non-null", "min", "max", "non-integer", "level:count"], rows)
w("")

w("Mean searchBoostValue per level (lower level should mean more popular if level 1 is best):")
w("")
rows = []
for f in LEVELS:
    by = defaultdict(list)
    for e in EX:
        if e.get(f) is not None and boost(e) is not None:
            by[e[f]].append(boost(e))
    rows.append((SHORT[f], ", ".join(f"{lvl(k)}:{statistics.mean(v):.1f}" for k, v in sorted(by.items()))))
md += table(["field", "level:mean boost"], rows)
w("")

w("### Anchor exercises")
w("")
by_name = {e["name"].lower(): e for e in EX}
rows = []
for a in ANCHORS:
    e = by_name.get(a.lower())
    if not e:
        rows.append((a, "not in catalog", "", "", "", "", "", "", ""))
        continue
    rows.append((e["name"], *[lvl(e.get(f)) for f in LEVELS], boost(e), ", ".join(names(e["exerciseClassificationHypertrophy"]))))
md += table(["exercise", *[SHORT[f] for f in LEVELS], "boost", "classificationHypertrophy"], rows)
w("")

w("### Classification vs level presence")
w("")
w("Rows are the classification set; columns count exercises whose level field is non-null.")
w("")
for goal, cf in (("strength", "exerciseClassificationStrength"), ("hypertrophy", "exerciseClassificationHypertrophy")):
    fields = [f for f in LEVELS if f.startswith(goal)]
    groups = defaultdict(list)
    for e in EX:
        groups[" + ".join(sorted(names(e[cf]))) or "(empty)"].append(e)
    rows = []
    for k, es in sorted(groups.items(), key=lambda kv: -len(kv[1])):
        rows.append((k, len(es), *[sum(1 for e in es if e.get(f) is not None) for f in fields]))
    md += table([cf, "exercises", *[SHORT[f] for f in fields]], rows)
    w("")

agree = sum(1 for e in EX if sorted(e["exerciseClassificationStrength"]) == sorted(e["exerciseClassificationHypertrophy"]))
w(f"Strength and hypertrophy classification sets are identical for {agree} of {len(EX)} exercises.")
same_lvl = Counter()
for e in EX:
    for s, h in ((LEVELS[0], LEVELS[3]), (LEVELS[1], LEVELS[4]), (LEVELS[2], LEVELS[5])):
        same_lvl[(SHORT[s].replace("strength", ""), e.get(s) == e.get(h))] += 1
w("Strength vs hypertrophy level equality per slot (equal includes both null): " + ", ".join(f"{k[0]} {'equal' if k[1] else 'differ'}:{c}" for k, c in sorted(same_lvl.items())) + ".")
w("")
w("Classification vs exerciseType:")
w("")
ct = Counter((name(e["exerciseType"]) if e.get("exerciseType") else "null", " + ".join(sorted(names(e["exerciseClassificationHypertrophy"]))) or "(empty)") for e in EX)
md += table(["exerciseType", "classificationHypertrophy", "count"], [(*k, c) for k, c in ct.most_common()])
w("")

desc_used = {x for e in EX for x in e["exerciseClassificationStrength"] + e["exerciseClassificationHypertrophy"]}
unused = sorted(str(v["name"]) for k, v in U.items() if v["type"] == "exerciseDescriptor" and k not in desc_used)
w(f"exerciseDescriptor entries never referenced by an exercise classification: {', '.join(unused)}.")
w("")

w("### Scalar descriptors")
w("")
rows = []
for f in SCALAR_REFS:
    c = Counter(name(e[f]) if e.get(f) else "null" for e in EX)
    rows.append((f, ", ".join(f"{k}:{v}" for k, v in sorted(c.items(), key=lambda kv: str(kv[0])))))
c = Counter(boost(e) for e in EX)
rows.append(("searchBoostValue", ", ".join(f"{lvl(k) if k is not None else 'missing'}:{v}" for k, v in sorted(c.items(), key=lambda kv: (kv[0] is None, kv[0] or 0)))))
md += table(["field", "value:count"], rows)
w("")
w("Movement patterns (exercise count):")
w("")
c = Counter(x for e in EX for x in names(e["movementPattern"]))
w(", ".join(f"{k} {v}" for k, v in c.most_common()) + ".")
w("")

w("### exclusionGroupings")
w("")
members = defaultdict(list)
for e in EX:
    for g in e["exclusionGroupings"]:
        members[g].append(e)
sizes = Counter(len(v) for v in members.values())
w(f"{len(members)} groupings referenced. Group size:count {', '.join(f'{k}:{v}' for k, v in sorted(sizes.items()))}.")
leveled_ungrouped = sum(1 for e in EX if not e["exclusionGroupings"] and any(e.get(f) is not None for f in LEVELS))
w(f"Exercises with no exclusion grouping but some non-null level: {leveled_ungrouped}.")
pm_same = sum(1 for es in members.values() if len(es) > 1 and len({tuple(sorted(e['primaryFeatureMuscle'])) for e in es}) == 1)
w(f"Multi-member groupings whose members all share the same primaryFeatureMuscle set: {pm_same} of {sum(1 for es in members.values() if len(es) > 1)}.")
w("")
w("Largest 15 groupings with sample members:")
w("")
rows = []
for g, es in sorted(members.items(), key=lambda kv: -len(kv[1]))[:15]:
    rows.append((name(g), len(es), "; ".join(e["name"] for e in sorted(es, key=lambda e: -(boost(e) or 0))[:5])))
md += table(["grouping", "size", "top members by boost"], rows)
w("")
multi = [e for e in EX if len(e["exclusionGroupings"]) >= 3]
w("Exercises in 3 or more groupings (sample):")
w("")
md += table(["exercise", "groupings"], [(e["name"], "; ".join(names(e["exclusionGroupings"]))) for e in multi[:12]])
w("")

w("### exerciseGroup")
w("")
gmem = defaultdict(set)
for e in EX:
    for g in e["exerciseGroup"]:
        gmem[g].add(e["id"])
sizes = Counter(len(v) for v in gmem.values())
w(f"{len(gmem)} groups referenced. Group size:count {', '.join(f'{k}:{v}' for k, v in sorted(sizes.items()))}.")
nested = sum(1 for a, sa in gmem.items() if any(b != a and sa < sb for b, sb in gmem.items()))
w(f"Groups that are a strict subset of another group: {nested}.")
alt = sum(1 for g in gmem if U[g].get("alternativeName"))
w(f"Groups carrying alternativeName ids: {alt}.")
excl_eq = sum(1 for g, s in gmem.items() if any(s == {e['id'] for e in es} for es in members.values()))
w(f"Groups whose member set equals some exclusion grouping's member set: {excl_eq}.")
w("")
w("Largest 15 groups:")
w("")
id2ex = {e["id"]: e for e in EX}
rows = []
for g, s in sorted(gmem.items(), key=lambda kv: -len(kv[1]))[:15]:
    es = sorted((id2ex[i] for i in s), key=lambda e: -(boost(e) or 0))
    rows.append((name(g), len(s), "; ".join(e["name"] for e in es[:5])))
md += table(["exerciseGroup", "size", "top members by boost"], rows)
w("")
w("Example: groups and groupings of the barbell bench press family:")
w("")
fam = [e for e in EX if "bench press" in e["name"].lower() and "barbell" in e["name"].lower()][:10]
md += table(["exercise", "exerciseGroup", "exclusionGroupings", "preconditions"], [(e["name"], "; ".join(names(e["exerciseGroup"])), "; ".join(names(e["exclusionGroupings"])), "; ".join(names(e["preconditions"]))) for e in fam])
w("")

w("### preconditions")
w("")
pmem = defaultdict(list)
for e in EX:
    for p in e["preconditions"]:
        pmem[p].append(e)
w(f"{len(pmem)} of {len(by_type['preconditions'])} precondition entries are referenced; {sum(len(v) for v in pmem.values())} exercises carry one (never more than one).")
w("")
rows = []
for p, es in sorted(pmem.items(), key=lambda kv: name(kv[0])):
    rows.append((name(p), len(es), "; ".join(e["name"] for e in es[:6]) + (" ..." if len(es) > 6 else "")))
md += table(["precondition", "exercises", "members"], rows)
w("")

w("### stretchedMuscle, emphasizedAgonist, deemphasizedAgonist")
w("")
for f in ("stretchedMuscle", "emphasizedAgonist", "deemphasizedAgonist"):
    c = Counter(x for e in EX for x in names(e[f]))
    w(f"{f} top values: " + ", ".join(f"{k} {v}" for k, v in c.most_common(25)) + ".")
    w("")
pf_sub = sum(1 for e in EX if e["emphasizedAgonist"] and set(e["emphasizedAgonist"]) <= set(e["primaryFeatureMuscle"] + e["secondaryFeatureMuscle"]))
pf_any = sum(1 for e in EX if e["emphasizedAgonist"])
w(f"emphasizedAgonist is a subset of the exercise's primary plus secondary feature muscles for {pf_sub} of {pf_any} exercises that have one.")
de_sub = sum(1 for e in EX if e["deemphasizedAgonist"] and set(e["deemphasizedAgonist"]) <= set(e["primaryFeatureMuscle"] + e["secondaryFeatureMuscle"]))
de_any = sum(1 for e in EX if e["deemphasizedAgonist"])
w(f"deemphasizedAgonist is a subset of primary plus secondary feature muscles for {de_sub} of {de_any}.")
st_any = sum(1 for e in EX if e["stretchedMuscle"])
w(f"{st_any} exercises name at least one stretched anatomical muscle (uuidIndex type `muscle`, the same vocabulary as primaryMuscle).")
w("")
w("Examples:")
w("")
ex_rows = [e for e in EX if e["emphasizedAgonist"] or e["deemphasizedAgonist"]]
ex_rows = sorted(ex_rows, key=lambda e: -(boost(e) or 0))[:12]
md += table(["exercise", "primaryFeatureMuscle", "emphasized", "deemphasized", "stretched"], [(e["name"], ", ".join(names(e["primaryFeatureMuscle"])), ", ".join(names(e["emphasizedAgonist"])), ", ".join(names(e["deemphasizedAgonist"])), ", ".join(names(e["stretchedMuscle"])[:4]) + (" ..." if len(e["stretchedMuscle"]) > 4 else "")) for e in ex_rows])
w("")

muscles = sorted((k for k, v in U.items() if v["type"] == "featureMuscleGroup"), key=name)
candidates = {}
for m in muscles:
    per = {}
    for f in LEVELS:
        es = sorted((e for e in EX if m in e["primaryFeatureMuscle"] and e.get(f) is not None), key=lambda e: rank_key(e, f))
        per[SHORT[f]] = [
            {
                "id": e["id"],
                "name": e["name"],
                "level": e[f],
                "searchBoost": boost(e),
                "exerciseGroup": names(e["exerciseGroup"]),
                "exclusionGroupings": names(e["exclusionGroupings"]),
                "preconditions": names(e["preconditions"]),
                "resistanceEquipmentGroupIds": e["resistanceEquipmentGroupIds"],
            }
            for e in es
        ]
    candidates[name(m)] = per

w("### Candidate counts per primary feature muscle")
w("")
rows = [(m, *[len(candidates[m][SHORT[f]]) for f in LEVELS]) for m in candidates]
md += table(["muscle", *[SHORT[f] for f in LEVELS]], rows)
w("")

w("### Top 5 per slot for major muscles")
w("")
w("Sorted by level ascending, then searchBoostValue descending. Full lists for all feature muscles are in `generation-candidates.json`.")
w("")
for m in MAJOR:
    w(f"#### {m}")
    w("")
    rows = []
    for f in LEVELS:
        for c in candidates[m][SHORT[f]][:5]:
            rows.append((SHORT[f], lvl(c["level"]), c["searchBoost"], c["name"], "; ".join(c["exerciseGroup"][:2]), "; ".join(names(c["resistanceEquipmentGroupIds"][:3]))))
    md += table(["slot", "level", "boost", "exercise", "exerciseGroup", "equipment groups (first 3)"], rows)
    w("")

if missing_refs:
    w(f"Unresolved ids: {len(missing_refs)}.")
    w("")

def dump_candidates():
    lines = ["{", f' "source": "app_file.json",', f' "generatedAt": {json.dumps(data["generatedAt"])},',
             ' "sort": "level ascending, then searchBoostValue descending, then name",',
             f' "levelFields": {json.dumps([SHORT[f] for f in LEVELS])},', ' "muscles": {']
    for mi, (m, per) in enumerate(candidates.items()):
        lines.append(f"  {json.dumps(m)}: {{")
        for fi, (slot, cs) in enumerate(per.items()):
            body = ",\n".join("    " + json.dumps(c, ensure_ascii=False) for c in cs)
            close = "]" + ("," if fi < len(per) - 1 else "")
            lines.append(f"   {json.dumps(slot)}: [" + ("\n" + body + "\n   " if cs else "") + close)
        lines.append("  }" + ("," if mi < len(candidates) - 1 else ""))
    lines += [" }", "}"]
    text = "\n".join(lines) + "\n"
    json.loads(text)
    JSON_OUT.write_text(text)


dump_candidates()

body = "\n".join(md).rstrip() + "\n"
prev = MD.read_text() if MD.exists() else f"# Smart Generation fields\n\n{START}\n{END}\n"
head, _, rest = prev.partition(START)
_, _, tail = rest.partition(END)
MD.write_text(f"{head}{START}\n\n{body}\n{END}{tail}")
print(f"wrote {MD} and {JSON_OUT}; unresolved ids: {len(missing_refs)}")
