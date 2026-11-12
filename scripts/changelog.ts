#!/usr/bin/env bun
/**
 * The in-app changelog: one JSON file per entry under `changelog/`, named `<YYYY-MM-DD>-<slug>.json` after the day it
 * merged, so parallel PRs never edit the same file.
 *
 *   bun scripts/changelog.ts add "<one-line title>" --task <id or link> [--task …] [--desc "<one short sentence>"]
 *   bun scripts/changelog.ts check [--base <ref>]        fails when shipped code changed without a new entry
 *   bun scripts/changelog.ts bundle --build <n> --out <file>   the JSON the iPhone app bundles
 *
 * An entry's build is the first TestFlight build that contained the commit adding it: the testflight workflow tags each
 * uploaded build `testflight/<build number>` on the commit it archived. Entries no tagged build contains ship in the
 * build being made. No npm imports, so CI runs this without installing.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export const changelogDir = 'changelog';
export const tagPrefix = 'testflight/';

export type Entry = {
	id: string;
	date: string;
	title: string;
	description?: string;
	tasks: string[];
	/** Set only on entries backfilled from before builds were tagged. */
	build?: string;
};

export type BundledEntry = Omit<Entry, 'build'> & { build: string };
export type Bundle = { build: string; entries: BundledEntry[] };

const fileName = /^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const buildNumber = /^\d{4}\.\d{1,4}\.\d{1,6}$/;
export const titleLimit = 90;
export const descriptionLimit = 240;

/** Shipped code: a change here reaches the owner, so its PR needs an entry. Tests, docs, and tooling don't. */
const shippedPrefixes = [
	'app-ios/Sources/',
	'app-ios/Config/',
	'app-ios/Assets/',
	'server/src/',
	'app-web/src/',
	'shared/',
];

export function isShipped(path: string): boolean {
	return shippedPrefixes.some(prefix => path.startsWith(prefix)) && !/\.test\.tsx?$/.test(path);
}

export function parseEntry(name: string, text: string): Entry {
	const fail = (problem: string): never => {
		throw new Error(`${changelogDir}/${name}: ${problem}`);
	};
	const date = fileName.exec(name)?.[1] ?? fail('name it <YYYY-MM-DD>-<lowercase-slug>.json');
	if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) fail(`${date} is not a date`);
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return fail('is not valid JSON');
	}
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return fail('must hold a JSON object');
	const { title, description, tasks = [], build, ...rest } = raw as Record<string, unknown>;
	const unknownKeys = Object.keys(rest);
	if (unknownKeys.length) fail(`unknown keys ${unknownKeys.join(', ')}; allowed: title, description, tasks, build`);
	const line = (value: unknown, key: string, limit: number): string => {
		if (typeof value !== 'string' || !value.trim()) return fail(`${key} must be a non-empty string`);
		if (/[\n\r]/.test(value)) fail(`${key} must be one line`);
		if (value.length > limit) fail(`${key} is ${value.length} characters; keep it to ${limit}`);
		return value.trim();
	};
	if (!Array.isArray(tasks) || tasks.some(task => typeof task !== 'string' || !uuid.test(task)))
		fail('tasks must be a list of ProcrastiMate task ids (lowercase UUIDs)');
	if (build !== undefined && (typeof build !== 'string' || !buildNumber.test(build)))
		fail('build must be a TestFlight build number such as 2026.1112.183941');
	return {
		id: name.slice(0, -'.json'.length),
		date,
		title: line(title, 'title', titleLimit),
		...(description === undefined ? {} : { description: line(description, 'description', descriptionLimit) }),
		tasks: tasks as string[],
		...(build === undefined ? {} : { build: build as string }),
	};
}

export function readEntries(root: string): Entry[] {
	const dir = join(root, changelogDir);
	if (!existsSync(dir)) return [];
	const errors: string[] = [];
	const entries: Entry[] = [];
	for (const name of readdirSync(dir).sort()) {
		try {
			entries.push(parseEntry(name, readFileSync(join(dir, name), 'utf8')));
		} catch (error) {
			errors.push((error as Error).message);
		}
	}
	if (errors.length) throw new Error(`Invalid changelog entries:\n${errors.join('\n')}`);
	return entries;
}

function git(root: string, args: string[]): string {
	const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
	if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed\n${result.stderr}`);
	return result.stdout;
}

/**
 * Stamps each entry with the build it shipped in, newest first. Order follows HEAD's first-parent history: the commit
 * that added an entry's file (a PR's merge commit on master) and the commits the TestFlight tags point at. Within a day,
 * entries merged later come first.
 */
export function bundle(root: string, currentBuild: string): Bundle {
	const entries = readEntries(root);
	const position = new Map(
		git(root, ['rev-list', '--first-parent', 'HEAD'])
			.split('\n')
			.filter(Boolean)
			.map((sha, index) => [sha, index] as const),
	);
	const added = new Map<string, number>();
	let commit = -1;
	for (const line of git(root, [
		'log',
		'--first-parent',
		'--diff-merges=first-parent',
		'--diff-filter=A',
		'--name-only',
		'--format=%x00%H',
		'--',
		`${changelogDir}/`,
	]).split('\n')) {
		if (line.startsWith('\0')) commit = position.get(line.slice(1)) ?? -1;
		else if (line && commit >= 0) added.set(basename(line, '.json'), commit);
	}
	// Build numbers drop leading zeros (2026.1112.1442 is 00:14:42), so they compare numerically. The build being made
	// is the newest.
	const buildOrder = (build: string) => (build === currentBuild ? [Infinity] : build.split('.').map(Number));
	const olderFirst = (a: string, b: string) => {
		const [x, y] = [buildOrder(a), buildOrder(b)];
		const i = x.findIndex((part, n) => part !== y[n]);
		return i < 0 ? 0 : x[i]! - y[i]!;
	};
	// Oldest first, so the first tag at or after a commit is the earliest build holding it, even when a rerun archived
	// the same commit twice.
	const tags = git(root, [
		'for-each-ref',
		'--format=%(refname:lstrip=2)%09%(objectname)%09%(*objectname)',
		`refs/tags/${tagPrefix}`,
	])
		.split('\n')
		.filter(Boolean)
		.flatMap(line => {
			const [name, object, peeled] = line.split('\t');
			const index = position.get(peeled || object!);
			return index === undefined ? [] : [{ build: name!.slice(tagPrefix.length), index }];
		})
		.sort((a, b) => b.index - a.index || olderFirst(a.build, b.build));
	const shippedIn = (index: number | undefined) =>
		index === undefined ? undefined : tags.find(tag => tag.index <= index)?.build;

	return {
		build: currentBuild,
		entries: entries
			.map(entry => {
				const index = added.get(entry.id);
				return { entry: { ...entry, build: entry.build ?? shippedIn(index) ?? currentBuild }, index };
			})
			.sort(
				(a, b) =>
					b.entry.date.localeCompare(a.entry.date) ||
					(a.index ?? -1) - (b.index ?? -1) ||
					// Entries one commit added, such as a backfill, fall back to their builds' order.
					olderFirst(b.entry.build, a.entry.build) ||
					b.entry.id.localeCompare(a.entry.id),
			)
			.map(({ entry }) => entry),
	};
}

export type CheckResult = { ok: true; added: string[] } | { ok: true; exempt: true } | { ok: false; shipped: string[] };

export function check(root: string, base: string): CheckResult {
	const changes = git(root, ['diff', '--name-status', '--no-renames', base, 'HEAD'])
		.split('\n')
		.filter(Boolean)
		.map(line => line.split('\t') as [string, string]);
	const added = changes
		.filter(([status, path]) => status === 'A' && path.startsWith(`${changelogDir}/`) && path.endsWith('.json'))
		.map(([, path]) => path);
	readEntries(root);
	if (added.length) return { ok: true, added };
	const shipped = changes.map(([, path]) => path).filter(isShipped);
	return shipped.length ? { ok: false, shipped } : { ok: true, exempt: true };
}

export function missingEntryMessage(shipped: string[]): string {
	const listed = shipped.slice(0, 5).join(', ') + (shipped.length > 5 ? `, and ${shipped.length - 5} more` : '');
	return [
		`This change ships code (${listed}) but adds no changelog entry.`,
		'Add one, with the ProcrastiMate task from your brief, and commit the file it prints:',
		'',
		'  bun scripts/changelog.ts add "<one-line title of what changed for the user>" --task <task id or link> [--desc "<one short sentence>"]',
		'',
		`Leave out --task only when no task exists. Changes outside ${shippedPrefixes.join(', ')} (tests, docs, tooling) need none.`,
	].join('\n');
}

export function slugify(title: string): string {
	const words = title
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
	let slug = words.shift() ?? 'change';
	for (const word of words) {
		if (slug.length + word.length >= 40) break;
		slug += `-${word}`;
	}
	return slug.slice(0, 40);
}

export function localDate(date = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function add(
	root: string,
	{
		title,
		tasks,
		description,
		date = localDate(),
	}: { title: string; tasks: string[]; description?: string; date?: string },
): string {
	const ids = tasks.map(task => {
		const id = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(task)?.[0]?.toLowerCase();
		if (!id) throw new Error(`--task ${task} holds no ProcrastiMate task id`);
		return id;
	});
	const body = { title, ...(description ? { description } : {}), ...(ids.length ? { tasks: ids } : {}) };
	let name = `${date}-${slugify(title)}.json`;
	for (let n = 2; existsSync(join(root, changelogDir, name)); n++) name = `${date}-${slugify(title)}-${n}.json`;
	const text = `${JSON.stringify(body, null, '\t')}\n`;
	parseEntry(name, text);
	mkdirSync(join(root, changelogDir), { recursive: true });
	writeFileSync(join(root, changelogDir, name), text);
	return join(changelogDir, name);
}

function main(argv: string[]): number {
	const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
	const [command, ...rest] = argv;
	const flags = new Map<string, string[]>();
	const positional: string[] = [];
	for (let i = 0; i < rest.length; i++) {
		const arg = rest[i]!;
		if (!arg.startsWith('--')) {
			positional.push(arg);
			continue;
		}
		const value = rest[++i];
		if (value === undefined) throw new Error(`${arg} needs a value`);
		flags.set(arg.slice(2), [...(flags.get(arg.slice(2)) ?? []), value]);
	}
	const flag = (name: string) => flags.get(name)?.at(-1);

	switch (command) {
		case 'add': {
			const title = positional.join(' ').trim();
			if (!title) throw new Error('usage: bun scripts/changelog.ts add "<title>" [--task <id>] [--desc "<text>"]');
			console.log(add(root, { title, tasks: flags.get('task') ?? [], description: flag('desc') }));
			return 0;
		}
		case 'check': {
			const base = flag('base') ?? git(root, ['merge-base', 'HEAD', 'origin/master']).trim();
			const result = check(root, base);
			if (!result.ok) {
				console.error(missingEntryMessage(result.shipped));
				return 1;
			}
			console.log(
				'exempt' in result
					? 'No shipped code changed; no changelog entry needed.'
					: `Changelog: ${result.added.join(', ')}`,
			);
			return 0;
		}
		case 'bundle': {
			const build = flag('build');
			const out = flag('out');
			if (!build || !out) throw new Error('usage: bun scripts/changelog.ts bundle --build <number> --out <file>');
			const result = bundle(root, build);
			mkdirSync(dirname(out), { recursive: true });
			writeFileSync(out, JSON.stringify(result));
			console.log(`Bundled ${result.entries.length} changelog entries into ${out}`);
			return 0;
		}
		default:
			console.error('usage: bun scripts/changelog.ts add|check|bundle (see the header of scripts/changelog.ts)');
			return 64;
	}
}

if (import.meta.main) {
	try {
		process.exit(main(process.argv.slice(2)));
	} catch (error) {
		console.error((error as Error).message);
		process.exit(1);
	}
}
