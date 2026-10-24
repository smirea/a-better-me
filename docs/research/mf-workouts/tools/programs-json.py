"""Convert MF program .xlsx exports into generated-programs.json.

Usage: python3 -I tools/programs-json.py
Reads exports/program-inputs.json (wizard inputs per export stem) and exports/<stem>.xlsx,
resolves exercise names to MF ids through app_file.json, and writes generated-programs.json.
"""
import json
import re
import sys
sys.dont_write_bytecode = True
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from xlsx import read_sheets  # noqa: E402

APP_FILE = Path('/Applications/Runner.app/Wrapper/Runner.app/Frameworks/App.framework/flutter_assets'
                '/packages/macrofactor/assets/import/app_file.json')
LEVEL_FIELDS = {
    'hypertrophyPrimary': 'hypertrophyPrimaryCompoundRecommendationLevel',
    'hypertrophySecondary': 'hypertrophySecondaryCompoundRecommendationLevel',
    'hypertrophyAccessory': 'hypertrophyAccessoryRecommendationLevel',
    'strengthPrimary': 'strengthPrimaryCompoundRecommendationLevel',
    'strengthSecondary': 'strengthSecondaryCompoundRecommendationLevel',
    'strengthAccessory': 'strengthAccessoryRecommendationLevel',
}
SET_TYPES = {'Standard Set': 'standard', 'Warm-Up Set': 'warmUp', 'Drop Set': 'drop', 'Myo Set': 'myo',
             'Failure Set': 'failure'}


def load_catalog():
    data = json.loads(APP_FILE.read_text())
    idx = data['uuidIndex']
    names = lambda ids: [idx[i]['name'] for i in ids or []]  # noqa: E731
    by_name = {}
    for e in data['exercises']:
        by_name.setdefault(e['name'].lower(), e)
    def info(e):
        return {
            'id': e['id'],
            'type': idx[e['exerciseType']]['name'] if e.get('exerciseType') else None,
            'primary': names(e['primaryFeatureMuscle']),
            'secondary': names(e['secondaryFeatureMuscle']),
            'movementPattern': names(e['movementPattern']),
            'classification': {'hypertrophy': names(e['exerciseClassificationHypertrophy']),
                               'strength': names(e['exerciseClassificationStrength'])},
            'levels': {k: e[v] for k, v in LEVEL_FIELDS.items() if e.get(v) is not None},
            'exclusionGroupings': names(e['exclusionGroupings']),
            'exerciseGroup': names(e['exerciseGroup']),
            'preconditions': names(e['preconditions']),
            'searchBoost': e.get('searchBoostValue'),
        }
    return lambda name: info(by_name[name.lower()]) if name.lower() in by_name else None


def parse_rest(v):
    if not v:
        return None
    m = re.fullmatch(r'(\d+):(\d{2})', v)
    return int(m[1]) * 60 + int(m[2]) if m else v


def parse_set(cells):
    kind, reps, rir, rest = (cells + [''] * 4)[:4]
    if not kind:
        return None
    m = re.fullmatch(r'(\d+)(?: - (\d+))?', reps.strip()) if reps else None
    return {
        'type': SET_TYPES.get(kind, kind),
        'repsMin': int(m[1]) if m else None,
        'repsMax': int(m[2] or m[1]) if m else None,
        'rir': None if rir == '' else round(float(rir)),
        'restSeconds': parse_rest(rest),
    }


def parse_program(path, lookup):
    rows = read_sheets(path)['Training Programs']
    header = dict(part.split(': ', 1) for part in rows[0] if ': ' in part)
    cycles, block, day, unknown = [], None, None, set()
    for r in rows[1:]:
        first = r[0] if r else ''
        if re.fullmatch(r'Block \d+', first):
            block = int(first.split()[1])
        elif re.fullmatch(r'Cycle \d+', first):
            cycles.append({'cycle': int(first.split()[1]), 'block': block, 'days': []})
        elif first == 'Rest':
            cycles[-1]['days'].append({'rest': True})
        elif first or (len(r) > 1 and r[1]):
            if first:
                name, _, gym = first.partition(' @ ')
                day = {'name': name, 'gym': gym or None, 'exercises': []}
                cycles[-1]['days'].append(day)
            ex_name = r[1]
            ex = lookup(ex_name)
            if ex is None:
                unknown.add(ex_name)
            sets = [s for s in (parse_set(r[i:i + 4]) for i in range(4, len(r), 4)) if s]
            day['exercises'].append({'name': ex_name, 'id': ex['id'] if ex else None,
                                     'skipped': r[2] == 'Yes', 'note': r[3] or None, 'sets': sets})
    return {
        'name': header.get('Program'),
        'cycles': int(header['Cycles']),
        'deload': header.get('Deload'),
        'color': header.get('Color'),
        'icon': header.get('Icon'),
        'schedule': cycles,
    }, unknown


def compact(program, lookup):
    """Fold per-cycle copies into one day list whose exercises carry per-cycle set targets."""
    first = program['schedule'][0]['days']
    days = []
    for di, d in enumerate(first):
        if d.get('rest'):
            days.append({'rest': True})
            continue
        exercises = []
        for ei, e in enumerate(d['exercises']):
            per_cycle = []
            for c in program['schedule']:
                ce = c['days'][di]['exercises'][ei]
                assert ce['name'] == e['name'], (program['name'], c['cycle'], ce['name'], e['name'])
                per_cycle.append([{k: s[k] for k in ('type', 'repsMin', 'repsMax', 'rir', 'restSeconds')}
                                  for s in ce['sets']])
            info = lookup(e['name']) or {}
            exercises.append({'id': e['id'], 'name': e['name'], **{k: v for k, v in info.items() if k != 'id'},
                              'setsPerCycle': per_cycle})
        days.append({'name': d['name'], 'gym': d['gym'], 'exercises': exercises})
    return {k: program[k] for k in ('name', 'cycles', 'deload', 'color', 'icon')} | {
        'blocks': sorted({c['block'] for c in program['schedule']}),
        'cycleBlocks': [c['block'] for c in program['schedule']],
        'days': days,
    }


def main():
    lookup = load_catalog()
    inputs = json.loads((HERE / 'exports' / 'program-inputs.json').read_text())
    out, missing = [], {}
    for stem, inp in inputs.items():
        program, unknown = parse_program(HERE / 'exports' / f'{stem}.xlsx', lookup)
        if unknown:
            missing[stem] = sorted(unknown)
        out.append({'export': f'exports/{stem}.xlsx', 'inputs': inp, 'output': compact(program, lookup)})
    (HERE / 'generated-programs.json').write_text(json.dumps(
        {'source': 'MF Workouts 1.4.1 Smart Generation, gym "Aquasol 6770" (owner default), 2026-10-23',
         'programs': out}, indent=1, ensure_ascii=False) + '\n')
    if missing:
        print('unresolved exercise names:', json.dumps(missing, indent=1), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
