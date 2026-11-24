#!/usr/bin/env bun
import { join } from 'node:path';
import { analyze } from '../src/biomech';
import { groupsOf } from '../src/catalog';
import { generate, kinematics } from '../src/exercise';
import { EXERCISES } from '../src/exercises';
import { FAULTS } from '../src/faults';
import { MUSCLES, type Muscle } from '../src/muscles';
import { runChecks, validateLoad, validateMotion } from '../src/validate';

const root = join(import.meta.dir, '..');
const repo = join(root, '..');
const dist = join(root, 'dist');
const catalog: {
	id: string;
	name: string;
	primaryMuscles: Muscle[];
	secondaryMuscles: Muscle[];
	images: string[];
	selection?: { stretchedMuscles: string[] };
}[] = await Bun.file(join(repo, 'app-ios/Sources/CoreResources/Catalog/exercises.json')).json();

const exercises = [];
const report: string[] = ['# Exercise motion evaluation', ''];
for (const spec of EXERCISES) {
	const started = performance.now();
	const { body, built, sequence } = generate(spec);
	const seconds = (performance.now() - started) / 1000;
	const kin = kinematics(body, sequence);
	const analysis = analyze(body, sequence, kin);
	const issues = validateMotion(body, sequence, kin);
	const loadIssues = validateLoad(sequence, analysis);
	const checks = runChecks(body, built, sequence, kin);
	const entry = catalog.find(exercise => exercise.id === spec.catalogId);
	if (!entry) throw new Error(`${spec.name}: catalog id ${spec.catalogId} is not in exercises.json`);
	const stretched = groupsOf(entry.selection?.stretchedMuscles ?? []);

	const ranked = [...MUSCLES].toSorted((a, b) => analysis.peak[b].activation - analysis.peak[a].activation);
	const listed = [...entry.primaryMuscles, ...entry.secondaryMuscles];
	const top = ranked.slice(0, listed.length);
	const mean = (muscles: Muscle[]) =>
		muscles.length ? muscles.reduce((sum, muscle) => sum + analysis.peak[muscle].activation, 0) / muscles.length : 0;
	const others = MUSCLES.filter(muscle => !listed.includes(muscle));
	const agreement = {
		listedInTop: listed.filter(muscle => top.includes(muscle)).length,
		listed: listed.length,
		primaryMean: mean(entry.primaryMuscles),
		secondaryMean: mean(entry.secondaryMuscles),
		otherMean: mean(others),
		unexpected: top.filter(muscle => !listed.includes(muscle)),
		stretchedFound: stretched.filter(muscle => analysis.peak[muscle].stretch >= 0.4).length,
		stretched: stretched.length,
	};

	const faults = FAULTS.filter(fault => fault.exercise === spec.id).map(fault => {
		const broken = structuredClone(sequence);
		fault.apply?.(broken, body, built);
		if (fault.loadKg) broken.loadKg = fault.loadKg;
		const brokenKin = kinematics(body, broken);
		const brokenIssues = [
			...validateMotion(body, broken, brokenKin),
			...validateLoad(broken, analyze(body, broken, brokenKin)),
		];
		const brokenChecks = runChecks(body, built, broken, brokenKin);
		const raised = [
			...new Set([
				...brokenIssues.map(issue => issue.code),
				...brokenChecks.filter(check => !check.pass).map(check => check.id),
			]),
		];
		const caught = fault.expect.filter(code => raised.includes(code));
		return {
			id: fault.id,
			label: fault.label,
			what: fault.what,
			expect: fault.expect,
			caught,
			raised,
			sequence: broken,
			issues: validateMotion(body, broken, brokenKin),
			checks: brokenChecks,
		};
	});

	const images = await Promise.all(
		entry.images.map(
			async name =>
				`data:image/webp;base64,${Buffer.from(await Bun.file(join(repo, `app-ios/Assets/ExerciseImages/${name}.webp`)).arrayBuffer()).toString('base64')}`,
		),
	);
	exercises.push({
		sequence,
		issues,
		checks,
		catalog: { primary: entry.primaryMuscles, secondary: entry.secondaryMuscles, stretched },
		agreement,
		faults,
		images,
	});

	const pct = (value: number) => `${(value * 100).toFixed(0)}%`;
	report.push(`## ${spec.name}`, '');
	report.push(`- Generated ${sequence.poses.length} frames in ${seconds.toFixed(2)} s.`);
	report.push(`- Motion issues flagged: ${issues.length}. Load issues at ${sequence.loadKg} kg: ${loadIssues.length}.`);
	report.push(`- Instruction checks: ${checks.filter(check => check.pass).length} of ${checks.length} pass.`);
	for (const check of checks.filter(item => !item.pass)) report.push(`  - FAIL ${check.label}: ${check.measured}`);
	report.push(
		`- Muscles the app lists (${listed.join(', ')}): ${agreement.listedInTop} of ${agreement.listed} are among the model's ${listed.length} most engaged.`,
	);
	report.push(
		`  - Mean peak engagement: primary ${pct(agreement.primaryMean)}, secondary ${pct(agreement.secondaryMean)}, unlisted ${pct(agreement.otherMean)}.`,
	);
	report.push(
		`  - Model's ranking: ${ranked
			.slice(0, 8)
			.map(muscle => `${muscle} ${pct(analysis.peak[muscle].activation)}`)
			.join(', ')}.`,
	);
	if (agreement.unexpected.length)
		report.push(
			`  - In the model's top ${listed.length} but not listed by the app: ${agreement.unexpected.join(', ')}.`,
		);
	report.push(
		`- Muscles the app marks as stretched (${stretched.join(', ') || 'none'}): ${agreement.stretchedFound} of ${agreement.stretched} reach 40% of their range in the model.`,
	);
	report.push(`  - ${stretched.map(muscle => `${muscle} ${pct(analysis.peak[muscle].stretch)}`).join(', ')}.`);
	report.push(`- Injected faults caught: ${faults.filter(fault => fault.caught.length).length} of ${faults.length}.`);
	for (const fault of faults)
		report.push(
			`  - ${fault.caught.length ? 'caught' : 'MISSED'} ${fault.label}: raised ${fault.raised.join(', ') || 'nothing'}`,
		);
	report.push('');
}

const data = { muscles: MUSCLES, exercises };
const bundle = await Bun.build({ entrypoints: [join(root, 'viewer/main.ts')], minify: true, target: 'browser' });
if (!bundle.success) throw new AggregateError(bundle.logs, 'Viewer bundle failed');
const script = (await bundle.outputs[0].text()).replaceAll('</script', '<\\/script');
const css = (name: string) => Bun.file(join(root, `viewer/${name}.css`)).text();
const template = await Bun.file(join(root, 'viewer/index.html')).text();
const fill = (page: string, slot: string, value: string) => {
	if (!page.includes(slot)) throw new Error(`viewer/index.html has no ${slot} slot`);
	return page.replace(slot, () => value);
};
const json = JSON.stringify(data).replaceAll('</', '<\\/');
const page = async (layout: string) =>
	fill(
		fill(fill(template, '/*STYLE*/', (await css('style')) + (await css(layout))), '__DATA__', json),
		'/*SCRIPT*/',
		script,
	);
const html = await page('page');
await Bun.write(join(dist, 'exercise-motion-embed.html'), await page('embed'));
await Bun.write(join(dist, 'exercise-motion.html'), html);
await Bun.write(join(dist, 'evaluation.md'), report.join('\n'));
for (const item of exercises) await Bun.write(join(dist, `${item.sequence.id}.json`), JSON.stringify(item.sequence));
console.log(report.join('\n'));
const missed = exercises.flatMap(item =>
	item.faults.filter(fault => !fault.caught.length).map(fault => `${item.sequence.name}: ${fault.label}`),
);
if (missed.length) throw new Error(`Fault tests went uncaught, so a detector is broken: ${missed.join('; ')}`);
console.log(`\nWrote ${join(dist, 'exercise-motion.html')} (${(html.length / 1e6).toFixed(2)} MB)`);
