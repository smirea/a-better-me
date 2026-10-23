/**
 * Removes an agent's worktree once its PR is merged: `bun scripts/teardown-worktree.ts <worktree path | branch> [--force]`.
 * A worktree on a detached HEAD has no branch: pass its path or directory name with --force instead.
 * Run it from the main checkout. Stops its servers, deletes the worktree and its branches, and updates master.
 */
import { existsSync, realpathSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { readOverride, run, worktrees } from './lib';

const args = process.argv.slice(2);
const force = args.includes('--force');
const target = args.find(arg => !arg.startsWith('-'));
if (!target) throw new Error('Usage: bun scripts/teardown-worktree.ts <worktree path | branch> [--force]');

const root = run(['git', 'rev-parse', '--show-toplevel']);
if (run(['git', 'rev-parse', '--git-dir']) !== run(['git', 'rev-parse', '--git-common-dir'])) {
	throw new Error('Run this from the main checkout, not from a worktree.');
}

const known = worktrees(root);
// git lists real paths, and a path through a symlink such as macOS's /tmp would otherwise match nothing.
const path = existsSync(target) ? realpathSync(target) : resolve(target);
const entry =
	known.find(entry => entry.path === path) ??
	known.find(entry => entry.branch === target) ??
	known.find(entry => basename(entry.path) === target);
const worktree = entry?.path;
const branch = entry ? entry.branch : target;
const detached = Boolean(entry && !entry.branch);

const pr = branch
	? run(['gh', 'pr', 'view', branch, '--json', 'state,url', '-q', '.state + " " + .url'], { allowFail: true })
	: '';
if (!pr.startsWith('MERGED') && !force) {
	throw new Error(`The PR for ${branch ?? target} is ${pr || 'missing'}. Pass --force to tear it down anyway.`);
}

if (worktree) {
	const base = Number(readOverride(worktree)?.CLIENT_PORT) || undefined;
	if (base) {
		const ports = [base, base + 1, base + 10, base + 11].map(port => `-iTCP:${port}`);
		const pids = run(['lsof', '-t', '-sTCP:LISTEN', ...ports], { allowFail: true })
			.split('\n')
			.filter(Boolean);
		if (pids.length) run(['kill', ...new Set(pids)], { allowFail: true });
	}
	run(['git', 'worktree', 'remove', '--force', worktree]);
	console.log(`Removed worktree ${worktree}.`);
}

if (branch && !detached) {
	run(['git', 'branch', '-D', branch], { allowFail: true });
	run(['git', 'push', 'origin', '--delete', branch], { allowFail: true });
}
run(['git', 'worktree', 'prune']);

if (run(['git', 'branch', '--show-current']) === 'master') {
	run(['git', 'pull', '--ff-only', 'origin', 'master'], { allowFail: true });
} else {
	run(['git', 'fetch', 'origin', 'master:master'], { allowFail: true });
}
console.log(
	`Tore down ${worktree ?? branch}${pr ? ` (${pr})` : ''}. ${root} master is at ${run(['git', 'rev-parse', '--short', 'master'])}.`,
);
