#!/usr/bin/env bun
/**
 * Regenerates the bundled exercise catalog from the installed MacroFactor Workouts app:
 * `bun app-ios/scripts/catalog.ts [path/to/Runner.app]`.
 * Reads the app's own catalog export (`packages/macrofactor/assets/import/app_file.json`), its instruction and
 * article Markdown, and its exercise and equipment images. It writes the JSON and the Markdown pack to
 * `Sources/App/Resources/Catalog/`, which the app bundles, and the images to `Assets/`, which the app downloads after
 * install, then refreshes the tracked asset version.
 * The default weight lists MF shows per equipment item (dumbbells 2.5 to 165 lb and so on) are not in the bundle;
 * they come from docs/research/mf-workouts/equipment.md.
 */
import { $ } from 'bun';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ASSETS_DIR } from '../../server/src/assets';
import { writeVersion } from '../../scripts/assets';
import { writeMarkdownPack } from './markdown-pack';

const app = resolve(process.argv[2] ?? '/Applications/Runner.app');
const assets = join(app, 'Wrapper/Runner.app/Frameworks/App.framework/flutter_assets');
const out = resolve(import.meta.dir, '../Sources/App/Resources/Catalog');
if (!existsSync(assets)) throw new Error(`No Flutter assets at ${assets}. Is MacroFactor Workouts installed?`);

type Ref = { type: string; name: string; [key: string]: unknown };
type Source = {
	exercises: Record<string, unknown>[];
	uuidIndex: Record<string, Ref>;
	generatedAt: string;
};
const source: Source = await Bun.file(join(assets, 'packages/macrofactor/assets/import/app_file.json')).json();

function ref(id: string, type: string): Ref {
	const entry = source.uuidIndex[id];
	if (!entry) throw new Error(`Unknown ${type} reference ${id}`);
	if (entry.type !== type) throw new Error(`${id} is a ${entry.type}, expected ${type}`);
	return entry;
}
const names = (ids: unknown, type: string) => ((ids ?? []) as string[]).map(id => ref(id, type).name);
/** An equipment option is one piece of equipment or a group used together, such as "Barbell and weight plates". */
function equipmentOption(id: string, groupType: string): { name: string; equipment: string[] } {
	const entry = source.uuidIndex[id];
	if (entry?.type === 'equipment') return { name: entry.name, equipment: [id] };
	const group = ref(id, groupType);
	return { name: group.name, equipment: group.equipment as string[] };
}
const camel = (name: string) =>
	name.toLowerCase().replace(/[^a-z]+([a-z])/g, (_, letter: string) => letter.toUpperCase());
const snake = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, '_');
// The export stores names in sentence case ("45° cable rear delt fly"); the app shows every word capitalized.
const titleCase = (name: string) =>
	name.replace(/(^|[\s\-(/])(\p{Ll})/gu, (_, gap: string, letter: string) => gap + letter.toUpperCase());

// The picker groups exercises by what loads them. Machines win over the plates that load them, and an exercise
// without resistance equipment, or with only the uncategorized "Bodyweight only", is bodyweight.
const pickerCategories: [string, string[]][] = [
	['machines', ['Cable Machines', 'Plate Loaded Machines', 'Pin Loaded Machines']],
	['cardio', ['Cardio']],
	['freeWeights', ['Free Weights', 'Loadable Bars', 'Fixed Weight Bars', 'Loadable Accessories']],
	['bodyweight', ['Body Weights', 'Bands & Ropes', 'Accessories & Functional', 'Benches & Racks', 'Bodyweight']],
	['other', ['Other']],
];
function pickerCategory(equipment: string[]): string {
	const categories = equipment.map(id => {
		const category = ref(id, 'equipment').category as string | undefined;
		return category ? ref(category, 'appEquipmentCategory').name : 'Bodyweight';
	});
	return pickerCategories.find(([, names]) => categories.some(c => names.includes(c)))?.[0] ?? 'other';
}
/** The first resistance option decides, unless it is uncategorized. Distance-tracked exercises such as running are cardio. */
function listCategory(resistance: { equipment: string[] }[], support: { equipment: string[] }[], metrics: string[]) {
	if (metrics.includes('Distance long') || support.some(o => pickerCategory(o.equipment) === 'cardio')) return 'cardio';
	return resistance.map(o => pickerCategory(o.equipment)).find(c => c !== 'other') ?? 'other';
}
const region = (id: unknown) => {
	if (!id) return null;
	const name = ref(id as string, 'regionTrained').name;
	return name === 'Full body' ? 'fullBody' : camel(name.replace(' body', ''));
};
const level = (id: unknown, type: string) => (id ? Number(ref(id as string, type).name) : null);

const classifications: Record<string, string> = {
	'Primary Compound': 'primaryCompound',
	'Secondary Compound': 'secondaryCompound',
	'Isolation/Accessory': 'accessory',
	Core: 'core',
};
const classification = (ids: unknown) =>
	names(ids, 'exerciseDescriptor').map(name => {
		const value = classifications[name];
		if (!value) throw new Error(`Unknown exercise classification ${name}`);
		return value;
	});
const recommendation = (value: unknown) => {
	if (value !== null && typeof value !== 'number') throw new Error(`Recommendation level ${value} is not a number`);
	return value;
};
const recommendationLevels = (e: Record<string, unknown>, goal: 'strength' | 'hypertrophy') => ({
	primaryCompound: recommendation(e[`${goal}PrimaryCompoundRecommendationLevel`]),
	secondaryCompound: recommendation(e[`${goal}SecondaryCompoundRecommendationLevel`]),
	accessory: recommendation(e[`${goal}AccessoryRecommendationLevel`]),
});
const selection = (e: Record<string, unknown>) => ({
	hypertrophy: recommendationLevels(e, 'hypertrophy'),
	strength: recommendationLevels(e, 'strength'),
	hypertrophyClassification: classification(e.exerciseClassificationHypertrophy),
	strengthClassification: classification(e.exerciseClassificationStrength),
	exerciseGroups: names(e.exerciseGroup, 'exerciseGroup'),
	exclusionGroupings: names(e.exclusionGroupings, 'exclusionGroupings'),
	preconditions: names(e.preconditions, 'preconditions'),
	stretchedMuscles: names(e.stretchedMuscle, 'muscle'),
	emphasizedAgonists: names(e.emphasizedAgonist, 'featureMuscleGroup').map(snake),
	deemphasizedAgonists: names(e.deemphasizedAgonist, 'featureMuscleGroup').map(snake),
});

const plateLaterality: Record<string, string> = { 'Per side': 'perSide', 'Single side': 'singleSide' };
const gymPresets = [
	['commercialGym', 'commercial'],
	['warehouseGym', 'warehouse'],
	['localGym', 'local'],
	['garageGym', 'garage'],
	['homeGym', 'home'],
] as const;

// Exercise Markdown links to the authors' Notion workspace, which the app never opens. Keep the link text only.
const stripLinks = (markdown: string) => markdown.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();

rmSync(out, { recursive: true, force: true });
rmSync(ASSETS_DIR, { recursive: true, force: true });
for (const dir of ['ExerciseImages', 'EquipmentImages']) mkdirSync(join(ASSETS_DIR, dir), { recursive: true });

const imageFiles = readdirSync(join(assets, 'assets/exercises'));
const markdownDir = join(assets, 'assets/markdown');
const equipmentDir = join(assets, 'assets/equipment');

const markdown = new Map<string, string>();
const articleIDs = new Set<string>();
const exercises = [];
for (const e of source.exercises) {
	const id = e.id as string;
	const resistance = (e.resistanceEquipmentGroupIds as string[]).map(g =>
		equipmentOption(g, 'resistanceEquipmentGroup'),
	);
	const support = (e.supportEquipmentGroupIds as string[]).map(g => equipmentOption(g, 'supportEquipmentGroup'));
	const equipment = [...new Set([...resistance, ...support].flatMap(g => g.equipment))];
	equipment.forEach(eq => ref(eq, 'equipment'));
	const images = imageFiles
		.filter(f => f.startsWith(`${id}_`))
		.sort()
		.map(f => f.replace('.webp', ''));
	for (const image of images)
		await Bun.write(
			join(ASSETS_DIR, 'ExerciseImages', `${image}.webp`),
			Bun.file(join(assets, 'assets/exercises', `${image}.webp`)),
		);
	const instructions = Bun.file(join(markdownDir, `${id}.md`));
	const hasInstructions = await instructions.exists();
	if (hasInstructions) markdown.set(`Instructions/${id}`, stripLinks(await instructions.text()));
	const articles = e.exerciseNote as string[];
	articles.forEach(a => {
		ref(a, 'exerciseNote');
		articleIDs.add(a);
	});
	const type = e.exerciseType ? ref(e.exerciseType as string, 'exerciseType').name : 'Other';
	exercises.push({
		id,
		name: titleCase(e.name as string),
		alternativeNames: names(e.alternativeName, 'alternativeName').map(titleCase),
		type: type.startsWith('Multi')
			? 'compound'
			: type.startsWith('Single')
				? 'isolation'
				: type === 'Core'
					? 'core'
					: 'other',
		primaryMuscles: names(e.primaryFeatureMuscle, 'featureMuscleGroup').map(snake),
		secondaryMuscles: names(e.secondaryFeatureMuscle, 'featureMuscleGroup').map(snake),
		primaryMuscleDetails: names(e.primaryMuscle, 'muscle'),
		secondaryMuscleDetails: names(e.secondaryMuscle, 'muscle'),
		movementPatterns: names(e.movementPattern, 'movementPattern'),
		region: region(e.regionTrained),
		laterality: names(e.laterality, 'laterality').map(camel)[0] ?? 'bilateral',
		metrics: names(e.exerciseMetrics, 'exerciseMetric').map(camel),
		resistanceEquipment: resistance.map(g => g.name),
		supportEquipment: support.map(g => g.name),
		resistanceEquipmentIDs: resistance.map(g => g.equipment),
		supportEquipmentIDs: support.map(g => g.equipment),
		category: listCategory(resistance, support, names(e.exerciseMetrics, 'exerciseMetric')),
		rangeOfMotion: level(e.rom, 'rom'),
		stability: level(e.stability, 'stability'),
		primaryJointActions: names(e.primaryJointAction, 'jointAction'),
		secondaryJointActions: names(e.secondaryJointAction, 'jointAction'),
		selection: selection(e),
		equipmentIDs: equipment,
		bodyweightFraction: (e.bodyweight as number | null) ?? 0,
		searchBoost: (e.searchBoostValue as number | undefined) ?? 0,
		hasInstructions,
		articleIDs: articles,
		images,
	});
}

const articles = [];
for (const id of articleIDs) {
	const file = Bun.file(join(markdownDir, `${id}.md`));
	if (!(await file.exists())) continue;
	markdown.set(`Articles/${id}`, stripLinks(await file.text()));
	articles.push({ id, title: ref(id, 'exerciseNote').name });
}

const equipment = [];
for (const [id, entry] of Object.entries(source.uuidIndex)) {
	if (entry.type !== 'equipment') continue;
	const png = join(equipmentDir, `${id}.png`);
	const hasImage = existsSync(png);
	// The app ships 1000px PNGs (81 MB in total). Thumbnails are all the library and filters need.
	if (hasImage)
		await $`magick ${png} -resize 240x240 -quality 80 ${join(ASSETS_DIR, 'EquipmentImages', `${id}.webp`)}`.quiet();
	const kg = (value: unknown) => (typeof value === 'number' && value > 0 ? value : null);
	const weightOptionsKg = ((entry.weightSelectKg as string | null) ?? '').split(',').flatMap(option => {
		if (!option.trim()) return [];
		const value = Number(option);
		if (!Number.isFinite(value)) throw new Error(`${entry.name} has a non-numeric weight option "${option}"`);
		return [value];
	});
	let laterality: string | null = null;
	if (entry.plateCalculatorLaterality) {
		const name = ref(entry.plateCalculatorLaterality as string, 'plateCalculatorLaterality').name;
		laterality = plateLaterality[name] ?? null;
		if (!laterality) throw new Error(`Unknown plate calculator laterality ${name}`);
	}
	equipment.push({
		id,
		name: titleCase(entry.name),
		pluralOf: (entry.pluralOf as string | null) ?? null,
		category: entry.category ? ref(entry.category as string, 'appEquipmentCategory').name : 'Bodyweight',
		weightKg: kg(entry.weightKg),
		incrementKg: kg(entry.weightIncrementKg),
		weightOptionsKg,
		plateLaterality: laterality,
		gymPresets: gymPresets.filter(([flag]) => entry[flag] === 1).map(([, preset]) => preset),
		hasImage,
	});
}

// `scripts/body.svg` is the reference app's front and back avatars (`assets/body/avatar_male_{front,back}.svg`) as one
// figure, the back shifted right, with a path per side and region and a `<view>` per crop: each side for the Levels
// heat map and each muscle's tile, the square the reference app's `assets/muscle_groups/male/<muscle>.svg` shows.
// Its paths use only absolute M, L, H, V, C, and Z, so they are flattened here into subpaths of a start point and
// line ([x, y]) or cubic ([x1, y1, x2, y2, x, y]) segments that Swift turns into a Path without parsing SVG.
const muscleNames = new Set(
	Object.values(source.uuidIndex)
		.filter(entry => entry.type === 'featureMuscleGroup')
		.map(entry => snake(entry.name)),
);
const bodyRegion = (region: string) => {
	if (region !== 'body' && region !== 'bone' && !muscleNames.has(region))
		throw new Error(`body.svg path region ${region} names no feature muscle group`);
	return region;
};
function bodyPath(id: string, d: string) {
	const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
	const subpaths: number[][][] = [];
	let point = [0, 0];
	let command = '';
	for (let i = 0; i < tokens.length;) {
		if (/[A-Za-z]/.test(tokens[i]!)) command = tokens[i++]!;
		const take = (count: number) => tokens.slice(i, (i += count)).map(Number);
		const segments = subpaths.at(-1);
		if (command !== 'M' && !segments) throw new Error(`body.svg path ${id} draws before its first M`);
		switch (command) {
			case 'M':
				point = take(2);
				subpaths.push([point]);
				command = 'L';
				break;
			case 'L':
				point = take(2);
				segments!.push(point);
				break;
			case 'H':
				point = [take(1)[0]!, point[1]!];
				segments!.push(point);
				break;
			case 'V':
				point = [point[0]!, take(1)[0]!];
				segments!.push(point);
				break;
			case 'C': {
				const curve = take(6);
				point = curve.slice(4);
				segments!.push(curve);
				break;
			}
			case 'Z':
				break;
			default:
				throw new Error(`body.svg path ${id} uses unsupported command ${command}`);
		}
	}
	if (!subpaths.length) throw new Error(`body.svg path ${id} is empty`);
	return { region: bodyRegion(id.replace(/^(front|back)-/, '')), subpaths };
}
const bodySvg = await Bun.file(join(import.meta.dir, 'body.svg')).text();
const views = Object.fromEntries(
	[...bodySvg.matchAll(/<view id="([^"]+)" viewBox="([^"]+)"\/>/g)].map(([, id, box]) => [
		id!,
		box!.split(' ').map(Number),
	]),
);
const view = (id: string) => {
	if (!views[id]) throw new Error(`body.svg has no view ${id}`);
	return views[id];
};
const tiles = Object.fromEntries(
	Object.keys(views)
		.filter(id => id.startsWith('tile-'))
		.map(id => [bodyRegion(id.slice('tile-'.length)), view(id)]),
);
const bodyPaths = [...bodySvg.matchAll(/<path id="((?:front|back)-[a-z_]+)" d="([^"]+)"\/>/g)];
if (bodyPaths.length !== (bodySvg.match(/<path/g) ?? []).length)
	throw new Error('body.svg has paths whose id is not <front|back>-<region> before d');

const write = (name: string, value: unknown) => Bun.write(join(out, name), `${JSON.stringify(value, null, '\t')}\n`);
await Bun.write(
	join(out, 'body.json'),
	`${JSON.stringify({
		front: view('front'),
		back: view('back'),
		tiles,
		parts: bodyPaths.map(([, id, d]) => bodyPath(id!, d!)),
	})}\n`,
);
// One exercise per line: about 20% smaller in the bundle than indented, and a diff still names the exercises it touches.
await Bun.write(
	join(out, 'exercises.json'),
	`[\n${exercises.map(exercise => JSON.stringify(exercise)).join(',\n')}\n]\n`,
);
await write('equipment.json', equipment);
await write('articles.json', articles);
await writeMarkdownPack(out, markdown);
console.log(
	`${exercises.length} exercises (${exercises.filter(e => e.images.length).length} with images, ` +
		`${exercises.filter(e => e.hasInstructions).length} with instructions), ${equipment.length} equipment, ` +
		`${articles.length} articles, ${Object.keys(tiles).length} muscle tiles from the catalog generated ${source.generatedAt}. ` +
		`Picker groups: ${JSON.stringify(
			Object.groupBy(exercises, e => e.category),
			(k, v) => (Array.isArray(v) ? v.length : v),
		)}`,
);
writeVersion();
