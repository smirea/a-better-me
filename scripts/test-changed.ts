/**
 * Runs the unit tests related to the files lefthook passes in: every `*.test.ts(x)` whose imports reach a changed
 * file, followed through the import graph, plus the colocated test of a changed file.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = join(import.meta.dir, '..');
const SOURCE_DIRS = ['shared', 'server', 'app-web/src', 'scripts'];
const SOURCE = /\.(ts|tsx|mts)$/;
const TEST = /\.test\.tsx?$/;

const files = process.argv
	.slice(2)
	.flatMap(arg => arg.split(/\s+/))
	.map(file => file.trim().replaceAll('\\', '/').replace(/^\.\//, ''))
	.filter(Boolean);

function walk(dir: string, out: string[]) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === 'node_modules' || entry.name === 'generated' || entry.name.startsWith('.')) continue;
		const path = join(dir, entry.name);
		if (entry.isDirectory()) walk(path, out);
		else if (SOURCE.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(path);
	}
}

const sources: string[] = [];
for (const dir of SOURCE_DIRS) if (existsSync(join(root, dir))) walk(join(root, dir), sources);

function resolveImport(from: string, specifier: string): string | null {
	let base: string;
	if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
	else if (specifier.startsWith('shared/')) base = join(root, specifier);
	else return null;
	for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, join(base, 'index.ts')]) {
		if (existsSync(candidate) && SOURCE.test(candidate)) return candidate;
	}
	return null;
}

const transpiler = new Bun.Transpiler({ loader: 'tsx' });
const importers = new Map<string, Set<string>>();
for (const file of sources) {
	for (const { path } of transpiler.scanImports(readFileSync(file, 'utf8'))) {
		const target = resolveImport(file, path);
		if (!target) continue;
		importers.set(target, (importers.get(target) ?? new Set()).add(file));
	}
}

function dependents(changed: readonly string[]): Set<string> {
	const seen = new Set(changed);
	const queue = [...changed];
	for (let i = 0; i < queue.length; i++) {
		for (const importer of importers.get(queue[i]!) ?? []) {
			if (!seen.has(importer)) {
				seen.add(importer);
				queue.push(importer);
			}
		}
	}
	return seen;
}

const changed = files.filter(file => SOURCE.test(file)).map(file => join(root, file));
const selected = [...dependents(changed)].filter(file => TEST.test(file) && existsSync(file));

if (selected.length > 0) {
	const result = spawnSync('bun', ['test', ...selected.toSorted()], { cwd: root, stdio: 'inherit' });
	process.exit(result.status ?? 1);
}
