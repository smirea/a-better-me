/**
 * Runs the unit tests related to the files lefthook passes in: every `*.test.ts(x)` whose imports reach a changed
 * file, followed through the import graph. Imports resolve the way Bun resolves them, so tsconfig paths and
 * workspace packages count; anything that lands in node_modules does not. Changed Swift files run, through
 * `app-ios/scripts/test`, every AppTests suite in a changed test file or naming a type a changed source declares.
 * `--dry-run` prints what would run.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { assertNotBare } from './check-not-bare';

const root = realpathSync(join(import.meta.dir, '..'));
const SOURCE = /\.(ts|tsx|mts)$/;
const TEST = /\.test\.tsx?$/;
const SKIP = new Set(['node_modules', 'dist', 'build', 'generated']);

const dryRun = process.argv.includes('--dry-run');
const files = process.argv
	.slice(2)
	.filter(arg => arg !== '--dry-run')
	.flatMap(arg => arg.split(/\s+/))
	.filter(Boolean)
	.map(file => join(root, file));

function walk(dir: string, out: string[]) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue;
		const path = join(dir, entry.name);
		if (entry.isDirectory()) walk(path, out);
		else if (SOURCE.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(path);
	}
	return out;
}

function resolveImport(from: string, specifier: string): string | null {
	try {
		const path = realpathSync(Bun.resolveSync(specifier, dirname(from)));
		return path.includes('/node_modules/') ? null : path;
	} catch {
		return null;
	}
}

const transpiler = new Bun.Transpiler({ loader: 'tsx' });
const importers = new Map<string, Set<string>>();
for (const file of walk(root, [])) {
	// scanImports rejects a shebang line, which executable scripts start with.
	const source = readFileSync(file, 'utf8').replace(/^#!.*/, '');
	for (const { path } of transpiler.scanImports(source)) {
		const target = resolveImport(file, path);
		if (target) importers.set(target, (importers.get(target) ?? new Set()).add(file));
	}
}

const seen = new Set(files.filter(file => SOURCE.test(file)));
const queue = [...seen];
for (let i = 0; i < queue.length; i++) {
	for (const importer of importers.get(queue[i]!) ?? []) {
		if (!seen.has(importer)) {
			seen.add(importer);
			queue.push(importer);
		}
	}
}

const selected = [...seen].filter(file => TEST.test(file) && existsSync(file)).toSorted();

const app = join(root, 'app-ios');
const swiftFiles = (dir: string) =>
	readdirSync(join(app, dir), { recursive: true })
		.map(String)
		.filter(file => file.endsWith('.swift'))
		.map(file => join(app, dir, file));
const suitesIn = (source: string) =>
	[...source.matchAll(/\b(?:struct|class|enum|actor) (\w+Tests)\b/g)].map(m => m[1]!);
const changedSwift = files.filter(file => file.endsWith('.swift') && existsSync(file));
const suites = new Set<string>();
if (changedSwift.length > 0) {
	// Extensions count only for the app's own types: `extension View` would name every suite.
	const appTypes = new Set(
		swiftFiles('Sources').flatMap(file =>
			[...readFileSync(file, 'utf8').matchAll(/\b(?:struct|class|enum|actor|protocol) (\w+)/g)].map(m => m[1]!),
		),
	);
	const changedTypes = new Set<string>();
	for (const file of changedSwift) {
		const source = readFileSync(file, 'utf8');
		if (file.startsWith(join(app, 'Tests'))) for (const suite of suitesIn(source)) suites.add(suite);
		for (const [, type] of source.matchAll(/\b(?:struct|class|enum|actor|protocol|extension) (\w+)/g))
			if (appTypes.has(type!)) changedTypes.add(type!);
	}
	if (changedTypes.size > 0) {
		const named = new RegExp(`\\b(?:${[...changedTypes].join('|')})\\b`);
		for (const file of swiftFiles('Tests')) {
			const source = readFileSync(file, 'utf8');
			if (named.test(source)) for (const suite of suitesIn(source)) suites.add(suite);
		}
	}
}

const runs: [string[], string][] = [];
if (selected.length > 0) runs.push([['bun', 'test', ...selected], root]);
if (suites.size > 0) runs.push([['./scripts/test', ...[...suites].toSorted()], app]);
for (const [command, cwd] of runs) {
	if (dryRun) {
		console.log(command.join(' '));
		continue;
	}
	const result = spawnSync(command[0]!, command.slice(1), { cwd, stdio: 'inherit' });
	if (result.status === 3) console.error('The Mac was too busy to boot a simulator for the Swift suites: rerun.');
	assertNotBare(command.join(' '));
	if (result.status !== 0) process.exit(result.status ?? 1);
}
