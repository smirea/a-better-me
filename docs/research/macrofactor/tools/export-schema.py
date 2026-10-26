"""Print each sheet's columns and inferred types from a MacroFactor .xlsx export, never its values.

Usage: python3 -I export-schema.py <export.xlsx>
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'mf-workouts' / 'tools'))
from xlsx import read_sheets  # noqa: E402

DATE = re.compile(r'^\d{4}-\d{2}-\d{2}')
TIME = re.compile(r'^\d{1,2}:\d{2}(:\d{2})?( ?[AP]M)?$')


def kind(values):
    vals = [v for v in values if v not in ('', None)]
    if not vals:
        return 'empty'
    def is_num(v):
        try:
            float(v)
            return True
        except ValueError:
            return False
    if all(is_num(v) for v in vals):
        nums = [float(v) for v in vals]
        if all(n.is_integer() for n in nums):
            # Excel stores dates as serial day numbers around 40000-50000.
            if all(35000 < n < 60000 for n in nums):
                return 'date (Excel serial)'
            return 'integer'
        return 'number'
    if all(DATE.match(v) for v in vals):
        return 'date'
    if all(TIME.match(v) for v in vals):
        return 'time'
    if len(set(vals)) <= 6 and len(vals) > 6:
        return f'enum ({len(set(vals))} values)'
    return 'text'


def main(path):
    for name, rows in read_sheets(path).items():
        if not rows:
            print(f'## {name}\n(empty sheet)\n')
            continue
        header, body = rows[0], rows[1:]
        print(f'## {name}  ({len(body)} rows)')
        for i, col in enumerate(header):
            print(f'- {col}: {kind([r[i] if i < len(r) else "" for r in body])}')
        print()


main(sys.argv[1])
