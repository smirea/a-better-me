"""Cross-program statistics over generated-programs.json, for the milestone 2 calibration notes."""
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent.parent
LEVEL = {'hypertrophy': 'hypertrophy', 'strength': 'strength', 'both': 'hypertrophy'}


def rr(s):
    return f"{s['repsMin']}-{s['repsMax']}"


def main():
    data = json.loads((HERE / 'generated-programs.json').read_text())
    for p in data['programs']:
        inp, out = p['inputs'], p['output']
        days = [d for d in out['days'] if not d.get('rest')]
        pattern = ''.join('R' if d.get('rest') else 'W' for d in out['days'])
        n_ex = [len(d['exercises']) for d in days]
        sets = [sum(len(e['setsPerCycle'][0]) for e in d['exercises']) for d in days]
        print(f"\n## {out['name']}  [{inp['goal']} {inp['daysPerWeek']}x {inp['split']} {inp['sessionMinutes']} "
              f"{inp['repProgression']} exp={inp['experience']} deload={inp['deload']} focus={inp['muscleFocus']}]")
        print(f"  cycles={out['cycles']} deload={out['deload']} blocks={out['cycleBlocks']} days={pattern} "
              f"names={[d['name'] for d in days]}")
        print(f"  exercises/day={n_ex} sets/day={sets}")
        tiers = defaultdict(Counter)
        for d in days:
            for e in d['exercises']:
                c1 = e['setsPerCycle'][0]
                key = rr(c1[0])
                prog = ' > '.join(dict.fromkeys(rr(c[0]) for c in e['setsPerCycle']))
                rir = tuple(s['rir'] for s in c1)
                tiers[key][(prog, len(c1), rir)] += 1
        for k in sorted(tiers, key=lambda k: int(k.split('-')[0])):
            for (prog, n, rir), cnt in tiers[k].most_common():
                print(f"    c1 {k:>6}: x{cnt} sets={n} rir={rir} cycles: {prog}")
        types = {s['type'] for d in days for e in d['exercises'] for c in e['setsPerCycle'] for s in c}
        rests = {s['restSeconds'] for d in days for e in d['exercises'] for c in e['setsPerCycle'] for s in c}
        print(f"  set types={types} rests={rests}")
        mus = Counter()
        for d in days:
            for e in d['exercises']:
                n = len(e['setsPerCycle'][0])
                for m in e['primary']:
                    mus[m] += n
                for m in e['secondary']:
                    mus[m] += n / 2
        print('  weekly muscle sets: ' + ', '.join(f'{m} {v:g}' for m, v in mus.most_common()))


if __name__ == '__main__':
    main()
