/**
 * Prepares a linked git worktree for an agent: `bun scripts/setup-worktree.ts [branch]`.
 * `branch` renames the worktree's branch first, so the PR and teardown share the final name. Installs, gives the
 * worktree its own ports through a git-ignored `.env.override`, and writes offline env files. Safe to rerun.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { parseDotenv, readOverride, run as runCommand, worktrees } from './lib';

const run = (cmd: string[]) => runCommand(cmd, { stdio: 'inherit-stderr' });
const git = (...args: string[]) => runCommand(['git', ...args]);

const root = git('rev-parse', '--show-toplevel');
process.chdir(root);
if (git('rev-parse', '--git-dir') === git('rev-parse', '--git-common-dir')) {
	throw new Error('This is the main checkout. Run this inside a linked worktree.');
}

const args = process.argv.slice(2);
const wanted = args.find(arg => !arg.startsWith('--'));
if (wanted && process.env.T3CODE_WORKTREE_PATH)
	throw new Error('T3 owns the branch name; rerun setup without a branch argument.');
if (wanted && wanted !== git('branch', '--show-current')) {
	if (git('branch', '--show-current')) git('branch', '-m', wanted);
	else git('switch', '-c', wanted);
}

const installed = existsSync(join(root, 'node_modules'));
run(['bun', 'install', '--frozen-lockfile']);
// A process that started before node_modules existed can't import packages installed since, so the first setup of a
// new worktree hands the rest to a fresh process.
if (!installed)
	process.exit(Bun.spawnSync(['bun', ...process.argv.slice(1)], { stdio: ['inherit', 'inherit', 'inherit'] }).exitCode);

// Worktree n's ports are the main checkout's plus 10000 + (n - 1) * 1000, each keeping its offset. setup-new-app
// hands out main ports 10 apart, so apps never collide, and 49152 is where macOS's ephemeral ports begin.
const mainPort = Number(parseDotenv(readFileSync(join(root, '.env'), 'utf8')).CLIENT_PORT);
if (!Number.isInteger(mainPort)) throw new Error('The root .env has no numeric CLIENT_PORT default.');
const STEP = 1000;
const FIRST_BLOCK = mainPort + 10_000;
const LAST_BLOCK = FIRST_BLOCK + Math.floor((49_152 - 10 - FIRST_BLOCK) / STEP) * STEP;
// Web, API, and `scripts/wrangler-dev.ts`.
const OFFSETS = [0, 1, 2];

function readPort(worktree: string): number | undefined {
	const port = Number(readOverride(worktree)?.CLIENT_PORT);
	return port >= FIRST_BLOCK && port <= LAST_BLOCK && (port - FIRST_BLOCK) % STEP === 0 ? port : undefined;
}

function portFree(port: number): Promise<boolean> {
	return new Promise(resolve => {
		const server = createServer()
			.once('error', () => resolve(false))
			.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
	});
}

async function pickBlock(): Promise<number> {
	const previous = readPort(root);
	if (previous) return previous;
	const claimed = new Set(worktrees(root).map(entry => readPort(entry.path)));
	for (let base = FIRST_BLOCK; base <= LAST_BLOCK; base += STEP) {
		if (claimed.has(base)) continue;
		const free = await Promise.all(OFFSETS.map(offset => portFree(base + offset)));
		if (free.every(Boolean)) return base;
	}
	throw new Error(`No free worktree slot: ${FIRST_BLOCK} to ${LAST_BLOCK} in steps of ${STEP} are all taken.`);
}

// Parallel setups would otherwise pick the same unclaimed block; mkdir is atomic, so it serves as the lock.
const lock = join(git('rev-parse', '--git-common-dir'), 'setup-worktree.lock');
for (const started = Date.now(); ; await Bun.sleep(100)) {
	try {
		mkdirSync(lock);
		break;
	} catch {
		const age = Date.now() - (statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
		if (age > 60_000) rmSync(lock, { recursive: true, force: true });
		if (Date.now() - started > 120_000) throw new Error(`Timed out waiting for ${lock}.`);
	}
}
let base: number;
try {
	base = await pickBlock();
	writeFileSync(
		join(root, '.env.override'),
		[`CLIENT_PORT=${base}`, `API_PORT=${base + 1}`, `API_URL=http://127.0.0.1:${base + 1}`, ''].join('\n'),
	);
} finally {
	rmSync(lock, { recursive: true, force: true });
}

// Offline from the schema defaults: a worktree never pulls cloud values, so agents without AWS access work the same.
run(['bunx', 'env-manager', 'gen', '--local']);

console.log(`
Worktree ready on ${git('branch', '--show-current') || '(detached HEAD)'}.
  web  http://127.0.0.1:${base}  (bun run start)
  api  http://127.0.0.1:${base + 1}  (.data/${root.split('/').pop()}.sqlite)`);
