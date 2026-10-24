"""Print a markdown digest of generated-programs.json: per day, each exercise with its slot evidence and targets."""
import json
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
GOAL_KEY = {'hypertrophy': 'hypertrophy', 'strength': 'strength', 'both': None}


def reps(sets):
    rr = sorted({(s['repsMin'], s['repsMax']) for s in sets})
    return ','.join(f'{a}-{b}' if a != b else f'{a}' for a, b in rr)


def main():
    data = json.loads((HERE / 'generated-programs.json').read_text())
    for p in data['programs']:
        inp, out = p['inputs'], p['output']
        print(f"\n### {out['name']}\n")
        print('Inputs: ' + ', '.join(f'{k} {v}' for k, v in inp.items()) +
              f". Output: {out['cycles']} cycles, deload {out['deload']}, blocks {out['cycleBlocks']}.\n")
        muscle_sets = Counter()
        for d in out['days']:
            if d.get('rest'):
                continue
            print(f"**{d['name']}**\n")
            print('| # | Exercise | Class (H/S) | Levels | Sets | Reps by cycle | RIR c1 |')
            print('|---|---|---|---|---|---|---|')
            for i, e in enumerate(d['exercises'], 1):
                c1 = e['setsPerCycle'][0]
                for m in e['primary']:
                    muscle_sets[m] += len(c1)
                for m in e['secondary']:
                    muscle_sets[m] += len(c1) / 2
                cls = '/'.join(','.join(x.replace('Isolation/Accessory', 'Acc').replace(' Compound', '')
                                        for x in e['classification'][k]) or '-' for k in ('hypertrophy', 'strength'))
                abbr = {'hypertrophyPrimary': 'HP', 'hypertrophySecondary': 'HS', 'hypertrophyAccessory': 'HA',
                        'strengthPrimary': 'SP', 'strengthSecondary': 'SS', 'strengthAccessory': 'SA'}
                lv = ' '.join(f'{abbr[k]}{v:g}' for k, v in e['levels'].items())
                byc = ' > '.join(reps(c) for c in e['setsPerCycle'])
                rir = ','.join(str(s['rir']) for s in c1)
                print(f"| {i} | {e['name']} | {cls} | {lv} | {len(c1)} | {byc} | {rir} |")
            print()
        print('Weekly sets by muscle (cycle 1, primary 1, secondary 0.5): ' +
              ', '.join(f'{m} {v:g}' for m, v in muscle_sets.most_common()))


if __name__ == '__main__':
    main()
