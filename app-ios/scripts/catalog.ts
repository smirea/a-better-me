#!/usr/bin/env bun
/**
 * Regenerates the bundled exercise catalog from the installed MacroFactor Workouts app:
 * `bun app-ios/scripts/catalog.ts [path/to/Runner.app]`.
 * Reads the app's own catalog export (`packages/macrofactor/assets/import/app_file.json`), its instruction and
 * article Markdown, and its exercise and equipment images, and writes `Sources/App/Resources/Catalog/`.
 */
import { $ } from 'bun';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

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

// Exercise Markdown links to the authors' Notion workspace, which the app never opens. Keep the link text only.
const stripLinks = (markdown: string) => markdown.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').trim();

rmSync(out, { recursive: true, force: true });
for (const dir of ['Instructions', 'Articles', 'ExerciseImages', 'EquipmentImages'])
	mkdirSync(join(out, dir), { recursive: true });

const imageFiles = readdirSync(join(assets, 'assets/exercises'));
const markdownDir = join(assets, 'assets/markdown');
const equipmentDir = join(assets, 'assets/equipment');

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
			join(out, 'ExerciseImages', `${image}.webp`),
			Bun.file(join(assets, 'assets/exercises', `${image}.webp`)),
		);
	const instructions = Bun.file(join(markdownDir, `${id}.md`));
	const hasInstructions = await instructions.exists();
	if (hasInstructions) await Bun.write(join(out, 'Instructions', `${id}.md`), stripLinks(await instructions.text()));
	const articles = e.exerciseNote as string[];
	articles.forEach(a => {
		ref(a, 'exerciseNote');
		articleIDs.add(a);
	});
	const type = e.exerciseType ? ref(e.exerciseType as string, 'exerciseType').name : 'Other';
	exercises.push({
		id,
		name: e.name,
		alternativeNames: names(e.alternativeName, 'alternativeName'),
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
		laterality: names(e.laterality, 'laterality').map(camel)[0] ?? 'bilateral',
		metrics: names(e.exerciseMetrics, 'exerciseMetric').map(camel),
		resistanceEquipment: resistance.map(g => g.name),
		supportEquipment: support.map(g => g.name),
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
	await Bun.write(join(out, 'Articles', `${id}.md`), stripLinks(await file.text()));
	articles.push({ id, title: ref(id, 'exerciseNote').name });
}

const equipment = [];
for (const [id, entry] of Object.entries(source.uuidIndex)) {
	if (entry.type !== 'equipment') continue;
	const png = join(equipmentDir, `${id}.png`);
	const hasImage = existsSync(png);
	// The app ships 1000px PNGs (81 MB in total). Thumbnails are all the library and filters need.
	if (hasImage)
		await $`magick ${png} -resize 240x240 -quality 80 ${join(out, 'EquipmentImages', `${id}.webp`)}`.quiet();
	const kg = (value: unknown) => (typeof value === 'number' && value > 0 ? value : null);
	equipment.push({
		id,
		name: entry.name,
		category: entry.category ? ref(entry.category as string, 'appEquipmentCategory').name : 'Other',
		weightKg: kg(entry.weightKg),
		incrementKg: kg(entry.weightIncrementKg),
		hasImage,
	});
}

// Muscle tiles are drawn for a light theme with the target muscle in blue. Their grays are swapped for the dark theme's,
// and Xcode keeps them as vectors through an asset catalog. The owner's MF account uses the male figure.
const muscleDir = join(assets, 'assets/muscle_groups/male');
const muscleAssets = join(out, 'Muscles.xcassets');
const contents = (value: unknown) => `${JSON.stringify(value, null, '\t')}\n`;
await Bun.write(join(muscleAssets, 'Contents.json'), contents({ info: { author: 'xcode', version: 1 } }));
const muscles = readdirSync(muscleDir).filter(f => f.endsWith('.svg'));
for (const file of muscles) {
	const name = `muscle-${file.replace('.svg', '')}`;
	const svg = (await Bun.file(join(muscleDir, file)).text())
		.replaceAll('#EEEEEE', '#4A4A4A')
		.replaceAll('#DCDCDC', '#2E2E2E')
		.replaceAll('fill="white"', 'fill="#252525"');
	await Bun.write(join(muscleAssets, `${name}.imageset`, file), svg);
	await Bun.write(
		join(muscleAssets, `${name}.imageset`, 'Contents.json'),
		contents({
			images: [{ filename: file, idiom: 'universal' }],
			info: { author: 'xcode', version: 1 },
			properties: { 'preserves-vector-representation': true },
		}),
	);
}

// The Levels heat map and the summary fill each muscle of the whole-body figures separately. The SVG paths use only
// absolute M, L, H, V, C, and Z, so they are flattened here into a start point and line ([x, y]) or cubic
// ([x1, y1, x2, y2, x, y]) segments that Swift turns into a Path without parsing SVG.
const muscleNames = new Set(
	Object.values(source.uuidIndex)
		.filter(entry => entry.type === 'featureMuscleGroup')
		.map(entry => snake(entry.name)),
);
const bodyRegion = (id: string) => {
	if (id === 'body' || id === 'bone') return id;
	const muscle = id.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
	if (!muscleNames.has(muscle)) throw new Error(`Body figure path ${id} names no feature muscle group`);
	return muscle;
};
const round = (value: number) => Math.round(value * 100) / 100;
function bodyPath(id: string, d: string) {
	const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
	let start: number[] | undefined;
	const segments: number[][] = [];
	let point = [0, 0];
	let command = '';
	for (let i = 0; i < tokens.length;) {
		if (/[A-Za-z]/.test(tokens[i]!)) command = tokens[i++]!;
		const take = (count: number) => tokens.slice(i, (i += count)).map(Number);
		switch (command) {
			case 'M':
				if (start) throw new Error(`Body figure path ${id} has several subpaths`);
				point = take(2);
				start = point.map(round);
				command = 'L';
				break;
			case 'L':
				point = take(2);
				segments.push(point.map(round));
				break;
			case 'H':
				point = [take(1)[0]!, point[1]!];
				segments.push(point.map(round));
				break;
			case 'V':
				point = [point[0]!, take(1)[0]!];
				segments.push(point.map(round));
				break;
			case 'C': {
				const curve = take(6);
				point = curve.slice(4);
				segments.push(curve.map(round));
				break;
			}
			case 'Z':
				if (i !== tokens.length) throw new Error(`Body figure path ${id} continues after Z`);
				break;
			default:
				throw new Error(`Body figure path ${id} uses unsupported command ${command}`);
		}
	}
	if (!start) throw new Error(`Body figure path ${id} has no start point`);
	return { region: bodyRegion(id), start, segments };
}
async function bodyFigure(side: 'front' | 'back') {
	const svg = await Bun.file(join(assets, `assets/body/avatar_male_${side}.svg`)).text();
	const paths = [...svg.matchAll(/<path id="([^"]+)" d="([^"]+)"/g)];
	if (paths.length !== (svg.match(/<path/g) ?? []).length)
		throw new Error(`avatar_male_${side}.svg has paths without an id before d`);
	return paths.map(([, id, d]) => bodyPath(id!, d!));
}
const figureSize = (await Bun.file(join(assets, 'assets/body/avatar_male_front.svg')).text()).match(
	/viewBox="0 0 (\d+) (\d+)"/,
);
if (!figureSize) throw new Error('avatar_male_front.svg has no viewBox');

const write = (name: string, value: unknown) => Bun.write(join(out, name), `${JSON.stringify(value, null, '\t')}\n`);
await Bun.write(
	join(out, 'body.json'),
	`${JSON.stringify({
		width: Number(figureSize[1]),
		height: Number(figureSize[2]),
		front: await bodyFigure('front'),
		back: await bodyFigure('back'),
	})}\n`,
);
await write('exercises.json', exercises);
await write('equipment.json', equipment);
await write('articles.json', articles);
console.log(
	`${exercises.length} exercises (${exercises.filter(e => e.images.length).length} with images, ` +
		`${exercises.filter(e => e.hasInstructions).length} with instructions), ${equipment.length} equipment, ` +
		`${articles.length} articles, ${muscles.length} muscle tiles from the catalog generated ${source.generatedAt}`,
);
