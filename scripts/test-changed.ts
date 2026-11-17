/**
 * Runs the unit tests related to the files lefthook passes in: every `*.test.ts(x)` whose imports reach a changed
 * file, followed through the import graph. Imports resolve the way Bun resolves them, so tsconfig paths and
 * workspace packages count; anything that lands in node_modules does not. The Swift tests need a simulator, which no
 * hook boots, so they run only in CI. `--dry-run` prints what would run.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { assertNotBare } from './check-not-bare';
import { dropGitEnv } from './git-env';

// Pre-commit runs every test through here, so this is where their GIT_* stops (see git-env.ts).
dropGitEnv();

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

if (selected.length > 0) {
	const command = ['bun', 'test', ...selected];
	if (dryRun) console.log(command.join(' '));
	else {
		const result = spawnSync(command[0]!, command.slice(1), { cwd: root, stdio: 'inherit' });
		assertNotBare(command.join(' '));
		if (result.status !== 0) process.exit(result.status ?? 1);
	}
}
