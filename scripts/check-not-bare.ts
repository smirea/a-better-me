#!/usr/bin/env bun
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';

const git = (...args: string[]) => spawnSync('git', args, { encoding: 'utf8' }).stdout.trim();

/** Fails when the repository's shared config says `core.bare = true`; `after` names what just ran, when it may be the cause. */
export function assertNotBare(after?: string) {
	if (git('config', '--type=bool', '--get', 'core.bare') !== 'true') return;
	const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
	console.error(
		[
			`core.bare is true in ${common}/config${after ? `, set during ${after}` : ''}. Linked worktrees still work, but every`,
			'git command in the main checkout fails and T3 cannot create worktrees. Something ran `git init` or `git config`',
			"with a git hook's GIT_DIR (docs/decisions/workflow.md). Find and fix it, then restore the main checkout with:",
			`  git -C ${dirname(common)} config core.bare false`,
		].join('\n'),
	);
	process.exit(1);
}

if (import.meta.main) assertNotBare();
