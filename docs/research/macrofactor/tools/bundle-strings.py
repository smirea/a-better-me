"""Generate app-strings.md from the MacroFactor bundle.

Pulls UI copy from the Dart AOT snapshot and the native strings tables, drops
German copies and code noise, then buckets the rest by feature with ordered
keyword rules. Strings the MF Workouts snapshot also holds (Flutter, shared SBS
packages, and the workouts feature, which MacroFactor 5.8.9 also ships) survive
only when a feature rule claims them and they do not mention workouts. The
output is deterministic for a given pair of bundles.

Usage: python3 -I tools/bundle-strings.py [MacroFactor.app] [MF Workouts Runner.app] > app-strings.md
"""
import json
import re
import subprocess
import sys
from pathlib import Path

MF = Path(sys.argv[1] if len(sys.argv) > 1 else "/Applications/MacroFactor.app")
WK = Path(sys.argv[2] if len(sys.argv) > 2 else "/Applications/Runner.app")
RUNNER = MF / "Wrapper/Runner.app"
SNAPSHOT = "Wrapper/Runner.app/Frameworks/App.framework/App"
WORDS = Path("/usr/share/dict/words")

for required in (MF / SNAPSHOT, WK / SNAPSHOT, WORDS):
    if not required.exists():
        sys.exit(f"missing {required}")


def snapshot_strings(path):
    """Dart keeps Latin-1 strings one byte per char and any string with a char
    above U+00FF as UTF-16LE, so typographic copy only shows up in the second pass."""
    data = path.read_bytes()
    out = set()
    for m in re.finditer(rb"[\x20-\x7e\xa0-\xff]{4,}", data):
        out.add(m.group().decode("latin-1"))
    for m in re.finditer(rb"(?:[\x20-\x7e\xa0-\xff]\x00|[\x00-\xff]\x20)+", data):
        s = m.group().decode("utf-16-le")
        if any(ord(c) > 0xFF for c in s):
            out.add(s)
    return {clean(s) for s in out}


def clean(s):
    # The pool often glues one to three snapshot bytes such as `²â` onto a string.
    return re.sub(r"(?<=[\x20-\x7e’”])[\x80-\xff]{1,3}$", "", s).strip()


ENGLISH = set(w.lower() for w in WORDS.read_text().split())
GERMAN = re.compile(
    r"[äöüßÄÖÜ]|\b(und|Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer|der|die|das|den|dem|mit|nicht|für|ein|eine|einen|werden|wird"
    r"|auf|zu|von|bei|ist|oder|Sich|sich|Wir|wir|Kein|Keine|Zum|zum|Zur|zur|Bitte|Diese|Dieser|Dieses|auch|noch|nach)\b"
)
CODE = re.compile(r"[_{}<>=;\\@|#^~`\[\]]|^/|^\d+:|^[a-z]{2}:|package:|dart:|https?:|^[a-z]+[A-Z]|^[,.:(]|\(\)|%\(|\.dart\b")
ALLOWED = re.compile(r"^[\x20-\x7e’‘“”–—…•°×éè]+$")
NOISE = re.compile(
    r"^(Unexpected|Expected|Invalid|Cannot|Could not|Failed|Error|Unsupported|Unknown|Missing|Null|Bad state)\b"
    r"|\b(exception|null|parse|token|argument|stack|instance|isolate|widget|render|assert|tag|entity|doctype|eof"
    r"|end of file|selector|css|child|attribute|charset|literal|codec|utf|mime|http|json|xml|html|listeners?|notifier"
    r"|notifying|dispatching|async|asynchronous|synchronously|c\+\+|palette|source color|shadowing|typesense)\b",
    re.I,
)


def is_ui(s):
    if len(s) < 3 or not ALLOWED.match(s) or GERMAN.search(s) or CODE.search(s) or NOISE.search(s):
        return False
    words = re.findall(r"[A-Za-z’']+", s)
    if not words or not re.search(r"[A-Za-z]{3}", s):
        return False
    if s.upper() == s or re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)+", s) or (" " not in s and re.search(r"[/.:]", s)):
        return False
    if len(words) == 1:
        return bool(re.fullmatch(r"[A-Z][a-z]{3,}", s)) and s.lower() in ENGLISH
    known = sum(w.lower().strip("’'s") in ENGLISH or w.lower() in ENGLISH for w in words)
    return known / len(words) >= 0.6


# Ordered: the first matching area wins, so narrow areas come before broad ones.
AREAS = [
    ("Subscriptions, referrals, reviews, and social", True,
     r"subscri|free trial|\btrial\b|paywall|purchase|referr|affiliate|promo|coupon|discount|billing|\bprice|per month"
     r"|per year|annual|testimonial|newsletter|rate macrofactor|review on the|leave a review|app store|google play"
     r"|invite|refer a friend|gift|share macrofactor|revenuecat|premium|unlock|member since|cancel anytime|instagram"
     r"|youtube|reddit|podcast|facebook|twitter|tiktok|community"),
    ("Accounts and sign-in", True,
     r"sign in|sign up|sign out|log in\b|login|log out|password|e-?mail|account|apple id|google sign|credential|verify your"),
    ("Onboarding", True, r"onboarding|welcome to|get started|let’s start|let's start|tell us|about you|intro"),
    ("AI logging: describe, photo, voice", False,
     r"\bai\b|describ|llm|chatgpt|claude|copilot|gemini|photo log|snap|recogni|estimate the|estimated by|voice|speak"
     r"|\bmeal photo|analy[sz]ing|prompt"),
    ("Nutrition label scan", False, r"label|nutrition facts|front of (the )?package|product (front|image)|ingredients list"),
    ("Barcode", False, r"barcode|\bscan|upc|ean\b|gtin"),
    ("Recipes", False, r"recipe|ingredient|yield|\bservings? per|cook|import (a|from) (url|web|link)|website"),
    ("Custom foods", False, r"custom food|create (a )?food|food name|brand name|serving name|my foods|user food"),
    ("Food search and database", False,
     r"search|database|verified|common food|branded|open food facts|\boff\b|result|no match|did you mean|usda"
     r"|restaurant|generic"),
    ("Fasting", False, r"fast(ing|ed|s)?\b|eating window|feeding window"),
    ("Habits", False, r"habit|streak"),
    ("Check-ins and plan updates", False, r"check-?in|weekly update|program update|plan update|weigh-?in|logging break|partial log"),
    ("Expenditure", False, r"expenditure|tdee|\bbmr\b|metabolic|maintenance|energy balance|burn|\bactiv|athlete"),
    ("Micronutrients", False,
     r"vitamin|mineral|micronutrient|nutrient|omega|fiber|sodium|potassium|calcium|iron\b|magnesium|zinc|selenium"
     r"|copper|manganese|phosphorus|choline|folate|niacin|thiamin|riboflavin|cobalamin|pyridoxine|pantothenic"
     r"|cholesterol|caffeine|sugar|starch|saturated|trans fat|amino|leucine|alcohol|water|\brda\b|\bdri\b|upper limit"),
    ("Strategy, goals, and programs", False,
     r"program|goal|\brate\b|deficit|surplus|target|macro|protein|carb|\bfats?\b|calorie floor|distribution|coached"
     r"|collaborative|manual|diet|floor|ceiling|budget|cut\b|bulk|lose|gain|maintain|keto|calorie|kcal|kilojoule|energy"),
    ("Body metrics and weight", False,
     r"weight|scale|trend|body ?fat|waist|hip|chest|neck|measurement|body metric|lean mass|\bbmi\b|height"),
    ("Progress photos", False, r"photo|picture|camera|gallery"),
    ("Health integrations", False, r"apple health|health ?kit|health connect|fitbit|garmin|\bsteps?\b|integration|sync"),
    ("Data export and import", False, r"export|import|csv|spreadsheet|xlsx|download|backup"),
    ("Widgets, Siri, and shortcuts", False, r"widget|siri|shortcut|quick action|control center|lock screen|home screen"),
    ("Notifications", False, r"notif|remind|alert"),
    ("Dashboard, charts, and insights", False,
     r"dashboard|insight|chart|average|week|month|year|day|trend|progress|history|analytics|summary|over time"),
    ("Food logging", False,
     r"\blog|meal|food|serving|entry|entries|copy|paste|quick add|timeline|hour|favorite|recent|plate|portion|gram"
     r"|ounce|\bcup|tbsp|tsp|breakfast|lunch|dinner|snack|eat"),
    ("Settings and appearance", False,
     r"setting|\bunits?\b|metric|imperial|theme|appearance|dark|light|language|preference|app icon|haptic|sound|color"
     r"|display|privacy|crash"),
]
AREAS = [(name, cut, re.compile(rx, re.I)) for name, cut, rx in AREAS]
WORKOUTS = re.compile(
    r"workout|exercise|\bsets?\b|\breps?\b|lift|muscle|gym|equipment|barbell|dumbbell|\brir\b|\brpe\b|superset"
    r"|warm-?up|training|cardio|split|machine|cable|rest timer|deload|mesocycle|volume|strength|hypertrophy",
    re.I,
)


def area_of(s):
    for name, _, rx in AREAS:
        if rx.search(s):
            return name
    return "Unsorted"


def strings_table(path):
    # Some tables are old-style text plists, which plistlib cannot read.
    out = subprocess.run(["plutil", "-convert", "json", "-o", "-", str(path)], capture_output=True, check=True)
    return json.loads(out.stdout)


def native_sections():
    sections = []
    info = strings_table(RUNNER / "Info.plist")
    usage = {k: v for k, v in info.items() if k.startswith("NS") and k.endswith("UsageDescription")}
    sections.append(("Info.plist permission prompts", [f"`{k}`: {v}" for k, v in sorted(usage.items())]))
    for title, path in [
        ("Siri and App Shortcuts phrases (`en.lproj/AppShortcuts.strings`)", RUNNER / "en.lproj/AppShortcuts.strings"),
        ("App Intents nutrition vocabulary (`en.lproj/AppIntentsNutrition.strings`)", RUNNER / "en.lproj/AppIntentsNutrition.strings"),
        ("Native app strings: intents, Siri dialogs, widgets (`en.lproj/Localizable.strings`)", RUNNER / "en.lproj/Localizable.strings"),
        ("Widget extension strings (`mfwidgetsExtension.appex/en.lproj/Localizable.strings`)",
         RUNNER / "PlugIns/mfwidgetsExtension.appex/en.lproj/Localizable.strings"),
        ("Settings.bundle (`Settings.bundle/en.lproj/Root.strings`)", RUNNER / "Settings.bundle/en.lproj/Root.strings"),
    ]:
        values = sorted({v.strip() for v in strings_table(path).values() if re.search(r"[A-Za-z]{3}", v)})
        sections.append((title, values))
    intents = strings_table(RUNNER / "en.lproj/Intents.strings")
    names = sorted({v for k, v in intents.items() if "-" not in k and "${" not in v and "%" not in v})
    sections.append(("Intent parameter values (`en.lproj/Intents.strings`, keys without a prompt prefix)", names))
    return sections


mf = {s for s in snapshot_strings(MF / SNAPSHOT) if is_ui(s)}
shared = snapshot_strings(WK / SNAPSHOT)
own = sorted(
    (s for s in mf if s not in shared or (area_of(s) != "Unsorted" and not WORKOUTS.search(s))),
    key=lambda s: (s.lower(), s),
)

grouped = {name: [] for name, _, _ in AREAS}
grouped["Unsorted"] = []
for s in own:
    grouped[area_of(s)].append(s)

version = strings_table(RUNNER / "Info.plist")["CFBundleShortVersionString"]
wk_version = strings_table(WK / "Wrapper/Runner.app/Info.plist")["CFBundleShortVersionString"]
cut_areas = {name for name, cut, _ in AREAS if cut}

print(f"""# MacroFactor app strings

Generated by `python3 -I tools/bundle-strings.py > app-strings.md` from MacroFactor {version} and MF Workouts {wk_version}. Do not edit by hand; change the tool and rerun it.

Sources: the Dart AOT snapshot (`Runner.app/Frameworks/App.framework/App`) and the native strings tables listed at the end.
The snapshot's string pool is hash-ordered, not ordered by screen, so every grouping below is inference from keyword rules in the tool; the strings themselves are verbatim.
A string lands in the first area whose rule matches, so a string about protein targets on a check-in lands under check-ins.

What the tool drops, and why:

- Strings the MF Workouts {wk_version} snapshot also holds, unless a feature rule claims them and they do not mention workouts. That removes Flutter, Firebase, and most shared SBS package copy, and the workouts feature that MacroFactor {version} also ships (see [`../mf-workouts/app-strings.md`](../mf-workouts/app-strings.md)), while keeping shared settings, export, steps, and subscription copy. Generic shared labels such as "Delete" go.
- German copies, code identifiers, parser and error messages, and fragments that are not mostly dictionary words. The pool also holds Japanese copy that this extractor does not decode.

Strings that end mid-sentence are the first half of an interpolation, and the app appends a value.
Areas marked (commercial only) are features the clone cuts (preferences: subscriptions, social, referrals, coaching upsells, onboarding, accounts); they are listed so a reader can recognize and skip them.
""")

for name, items in grouped.items():
    if not items:
        continue
    flag = " (commercial only)" if name in cut_areas else ""
    print(f"## {name}{flag}\n")
    print(f"{len(items)} strings.\n")
    for s in items:
        print(f"- {s}")
    print()

print("# Native strings\n")
print("These come from plist and `.strings` tables, so they are exact and complete.\n")
for title, values in native_sections():
    print(f"## {title}\n")
    for v in values:
        print(f"- {v}")
    print()
