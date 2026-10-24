#!/usr/bin/env bun
/**
 * Regenerates the default equipment loads a gym profile shows: `bun app-ios/scripts/gym-defaults.ts`.
 * MF's per-item default weight lists are not in its bundle. They were captured from a gym profile into
 * docs/research/mf-workouts/equipment.md (in lb); this resolves each name against the bundled equipment catalog and
 * writes `Sources/App/Resources/Gyms/equipment-loads.json` in the JSON Swift's synthesized `Codable` gives
 * `[EquipmentID: EquipmentLoad]`. Items listed as `Default` have no load and get no entry.
 *
 * It also writes `equipment-loads-kg.json`, the loads a gym seeded while the unit is kg stores explicitly. MF's bundle
 * has kg values only for loadable bars (`weightOptionsKg`) and base weights (`weightKg`), and those are used as they
 * are. The plate, dumbbell, kettlebell, fixed-bar, body-weight, and pin-stack lists in `kgWeights` and `kgRanges` are
 * ours, not MF's: common metric gym equipment, so a kg gym doesn't start with 20.41 kg plates.
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const markdownPath = resolve(root, '../docs/research/mf-workouts/equipment.md');
const outDir = join(root, 'Sources/App/Resources/Gyms');
const kgPerLb = 0.45359237;

type Equipment = {
	id: string;
	name: string;
	category: string;
	pluralOf: string | null;
	weightKg: number | null;
	weightOptionsKg: number[] | null;
};
type Load =
	| { weights: { options: { kg: number }[] } }
	| { ranges: { options: { minKg: number; maxKg: number; incrementKg: number }[] } }
	| { base: { kg: number } }
	| { bands: { options: { color: string }[] } };

const catalog: Equipment[] = await Bun.file(join(root, 'Sources/App/Resources/Catalog/equipment.json')).json();
const markdown = await Bun.file(markdownPath).text();

const normalize = (name: string) =>
	name
		.replace(/[‘’]/g, "'")
		.trim()
		.toLowerCase();
const singulars = new Set(catalog.flatMap(item => (item.pluralOf ? [item.pluralOf] : [])));
const byName = new Map<string, Equipment[]>();
for (const item of catalog) {
	const key = normalize(item.name);
	byName.set(key, [...(byName.get(key) ?? []), item]);
}

function resolveItem(name: string): Equipment {
	const matches = byName.get(normalize(name)) ?? [];
	if (matches.length === 0) throw new Error(`equipment.md names "${name}", which is not in equipment.json`);
	// A gym lists the plural, so a name shared by a singular and a plural is not ambiguous.
	const listed = matches.filter(item => !singulars.has(item.id));
	if (listed.length !== 1) throw new Error(`equipment.md's "${name}" matches ${matches.length} catalog items`);
	return listed[0]!;
}

const kg = (lb: string) => {
	const value = Number(lb);
	if (!Number.isFinite(value)) throw new Error(`"${lb}" is not a weight in lb`);
	return value * kgPerLb;
};
// A single weight on these is the machine's or attachment's own weight, not a choice of weights.
const baseCategories = new Set(['Plate Loaded Machines', 'Loadable Accessories']);
const rangePattern = /^([\d.]+) - ([\d.]+) lb, ([\d.]+) lb increments$/;
const weightPattern = /^([\d.]+) lb$/;

function parseLoad(item: Equipment, value: string): Load {
	const parts = value.split(';').map(part => part.trim());
	if (parts.every(part => rangePattern.test(part))) {
		return {
			ranges: {
				options: parts.map(part => {
					const [, min, max, increment] = rangePattern.exec(part)!;
					return { minKg: kg(min!), maxKg: kg(max!), incrementKg: kg(increment!) };
				}),
			},
		};
	}
	const tokens = value.split(',').map(token => token.trim());
	if (tokens.every(token => weightPattern.test(token))) {
		const weights = tokens.map(token => kg(weightPattern.exec(token)![1]!));
		if (baseCategories.has(item.category)) {
			if (weights.length !== 1) throw new Error(`${item.name} is a ${item.category} item with several weights`);
			return { base: { kg: weights[0]! } };
		}
		return { weights: { options: weights.map(weight => ({ kg: weight })) } };
	}
	if (item.category === 'Bands & Ropes' && tokens.every(token => /^[A-Z][a-z]+$/.test(token))) {
		return { bands: { options: tokens.map(color => ({ color })) } };
	}
	throw new Error(`Cannot read the load "${value}" of ${item.name}`);
}

const steps = (from: number, to: number, by: number) =>
	Array.from({ length: Math.round((to - from) / by) + 1 }, (_, index) => Math.round((from + index * by) * 100) / 100);

const kgWeights: Record<string, number[]> = {
	'Weight Plates': [1.25, 2.5, 5, 10, 15, 20, 25],
	'Bumper Plates': [5, 10, 15, 20, 25],
	Dumbbells: [...steps(1, 10, 1), ...steps(12.5, 50, 2.5), ...steps(55, 75, 5)],
	Kettlebells: [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 44, 48],
	'Fixed-Weight EZ Bar': steps(10, 50, 5),
	'Fixed-Weight Straight Bar': steps(10, 50, 5),
	'Ankle Weights': steps(0.5, 10, 0.5),
	'Weighted Vest': [2.5, 5, 10, 15, 20, 30],
	'Medicine Ball': [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15],
};
const kgRanges: Record<string, { minKg: number; maxKg: number; incrementKg: number }> = {
	'0 - 500 lb, 10 lb increments': { minKg: 0, maxKg: 225, incrementKg: 5 },
	'0 - 500 lb, 1 lb increments': { minKg: 0, maxKg: 225, incrementKg: 0.5 },
};

function kgLoad(item: Equipment, load: Load, value: string): Load {
	if ('weights' in load) {
		const bundled = item.weightOptionsKg?.length ? [...item.weightOptionsKg].sort((a, b) => a - b) : undefined;
		const weights = bundled ?? kgWeights[item.name];
		if (!weights) throw new Error(`${item.name} has no kg weights in the bundle or in kgWeights`);
		return { weights: { options: weights.map(weight => ({ kg: weight })) } };
	}
	if ('ranges' in load) {
		return {
			ranges: {
				options: value.split(';').map(part => {
					const range = kgRanges[part.trim()];
					if (!range) throw new Error(`${item.name}'s "${part.trim()}" has no entry in kgRanges`);
					return range;
				}),
			},
		};
	}
	if ('base' in load) {
		if (item.weightKg != null) return { base: { kg: item.weightKg } };
		if (load.base.kg !== 0) throw new Error(`${item.name} weighs ${load.base.kg} kg in lb but has no weightKg`);
		return load;
	}
	return load;
}

const loads: Record<string, Load> = {};
const kgLoads: Record<string, Load> = {};
const seen = new Set<string>();
for (const line of markdown.split('\n')) {
	const match = /^- (.+?) — (.+?)( \(not in this gym\))?$/.exec(line);
	if (!match) continue;
	const [, name, value] = match;
	const item = resolveItem(name!);
	if (seen.has(item.id)) throw new Error(`equipment.md lists ${item.name} twice`);
	seen.add(item.id);
	if (value === 'Default') continue;
	loads[item.id] = parseLoad(item, value!);
	kgLoads[item.id] = kgLoad(item, loads[item.id]!, value!);
}
if (seen.size === 0) throw new Error(`No equipment lines in ${markdownPath}`);

const sorted = (record: Record<string, Load>) =>
	Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
mkdirSync(outDir, { recursive: true });
await Bun.write(join(outDir, 'equipment-loads.json'), `${JSON.stringify(sorted(loads), null, '\t')}\n`);
await Bun.write(join(outDir, 'equipment-loads-kg.json'), `${JSON.stringify(sorted(kgLoads), null, '\t')}\n`);
console.log(`${seen.size} items in equipment.md, ${Object.keys(loads).length} with a default load.`);
