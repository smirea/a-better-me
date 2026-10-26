"""Write the series the engine calibration needs from a MacroFactor Granular Export to a JSON file outside git.

Usage: python3 -I calibrate-export.py <export.xlsx> <out.json>
Values stay in the owner's private folder; only error figures are ever reported.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'mf-workouts' / 'tools'))
from xlsx import read_sheets  # noqa: E402

SHEETS = {
    'Scale Weight': 'scaleLb',
    'Weight Trend': 'trendLb',
    'Expenditure': 'expenditure',
    'Calories & Macros': 'intakeKcal',
}

sheets = read_sheets(sys.argv[1])
out = {}
for sheet, key in SHEETS.items():
    out[key] = [{'day': int(float(r[0])), 'value': float(r[1])} for r in sheets[sheet][1:] if r and r[0] != '' and r[1] != '']
for sheet, key in (('Partial Logging', 'incomplete'), ('Fasting', 'fasting')):
    out[key] = [r[0] for r in sheets[sheet][1:] if r and r[1] == 'Yes']
Path(sys.argv[2]).write_text(json.dumps(out))
print(f"wrote {sys.argv[2]}: " + ', '.join(f'{k} {len(v)}' for k, v in out.items()))
