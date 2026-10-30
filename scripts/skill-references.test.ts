import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Children follow the orchestrator's playbook to the letter, so a path it names that moved costs a whole job.
const root = join(import.meta.dir, '..');
const skill = join(root, '.claude/skills/task-orchestrator-start');
const files = [join(skill, 'SKILL.md'), join(skill, 'brief.md')];
const REPO_PATH = /(?<=^|[\s`(])((?:\.claude|app-ios|app-web|docs|scripts|server|shared)\/[\w./-]*[\w/])/gm;

/** Repo paths a playbook names, without placeholders (`<Feature>`) or ignored build output that CI never has. */
export function referencedPaths(text: string): string[] {
	return [...text.matchAll(REPO_PATH)].map(match => match[1]!).filter(path => !path.includes('DerivedData'));
}

test('finds paths in prose and code spans', () => {
	expect(
		referencedPaths('run `bun scripts/pr-ship.ts --merge` (see docs/decisions/sync.md) or app-ios/Tests/<Feature>/'),
	).toEqual(['scripts/pr-ship.ts', 'docs/decisions/sync.md', 'app-ios/Tests/']);
});

test('the orchestrator playbook names only paths that exist', () => {
	const missing = files.flatMap(file =>
		referencedPaths(readFileSync(file, 'utf8'))
			// `scripts/pm` sits next to the playbook; everything else is relative to the repo root.
			.filter(path => !existsSync(join(root, path)) && !existsSync(join(dirname(file), path)))
			.map(path => `${file.slice(root.length + 1)}: ${path}`),
	);
	expect(missing, 'Fix the playbook to name where these live now.').toEqual([]);
});
