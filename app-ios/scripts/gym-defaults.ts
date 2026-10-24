#!/usr/bin/env bun
/**
 * Regenerates the default equipment loads a gym profile shows: `bun app-ios/scripts/gym-defaults.ts`.
 * MF's per-item default weight lists are not in its bundle. They were captured from a gym profile into
 * docs/research/mf-workouts/equipment.md (in lb); this resolves each name against the bundled equipment catalog and
 * writes `Sources/App/Resources/Gyms/equipment-loads.json` in the JSON Swift's synthesized `Codable` gives
 * `[EquipmentID: EquipmentLoad]`. Items listed as `Default` have no load and get no entry.
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const markdownPath = resolve(root, '../docs/research/mf-workouts/equipment.md');
const outDir = join(root, 'Sources/App/Resources/Gyms');
const kgPerLb = 0.45359237;

type Equipment = { id: string; name: string; category: string; pluralOf: string | null };
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

const loads: Record<string, Load> = {};
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
}
if (seen.size === 0) throw new Error(`No equipment lines in ${markdownPath}`);

const sorted = Object.fromEntries(Object.entries(loads).sort(([a], [b]) => a.localeCompare(b)));
mkdirSync(outDir, { recursive: true });
await Bun.write(join(outDir, 'equipment-loads.json'), `${JSON.stringify(sorted, null, '\t')}\n`);
console.log(`${seen.size} items in equipment.md, ${Object.keys(sorted).length} with a default load.`);
