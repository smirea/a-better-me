/**
 * Prepares a linked git worktree for an agent: `bun scripts/setup-worktree.ts [branch]`.
 * `branch` renames the worktree's branch first, so the PR and teardown share the final name. Installs, gives the
 * worktree its own ports through a git-ignored `.env.override`, and writes offline env files. Safe to rerun.
 */
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { readOverride, run as runCommand, worktrees } from './lib';

const run = (cmd: string[]) => runCommand(cmd, { stdio: 'inherit-stderr' });
const git = (...args: string[]) => runCommand(['git', ...args]);

const root = git('rev-parse', '--show-toplevel');
process.chdir(root);
if (git('rev-parse', '--git-dir') === git('rev-parse', '--git-common-dir')) {
	throw new Error('This is the main checkout. Run this inside a linked worktree.');
}

const wanted = process.argv.slice(2).find(arg => !arg.startsWith('--'));
if (wanted && wanted !== git('branch', '--show-current')) {
	if (git('branch', '--show-current')) git('branch', '-m', wanted);
	else git('switch', '-c', wanted);
}

run(['bun', 'install', '--frozen-lockfile']);

// Away from the main checkout's 6150 and other apps' worktree ranges, such as procrastimate's 6200-6980.
const FIRST_BLOCK = 7200;
const LAST_BLOCK = 7980;
// Web and API at +0/+1; +10/+11 stay free for e2e servers.
const OFFSETS = [0, 1, 10, 11];

function readPort(worktree: string): number | undefined {
	const port = Number(readOverride(worktree)?.CLIENT_PORT);
	return port >= FIRST_BLOCK ? port : undefined;
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
	for (let base = FIRST_BLOCK; base <= LAST_BLOCK; base += 20) {
		if (claimed.has(base)) continue;
		const free = await Promise.all(OFFSETS.map(offset => portFree(base + offset)));
		if (free.every(Boolean)) return base;
	}
	throw new Error(`No free port block between ${FIRST_BLOCK} and ${LAST_BLOCK}.`);
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
  api  http://127.0.0.1:${base + 1}`);
