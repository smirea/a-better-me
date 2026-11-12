import { afterEach, beforeEach, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { add, bundle, check, parseEntry } from './changelog';

// Git hooks export GIT_DIR and GIT_INDEX_FILE, which would point every git call here, and the script's own, at the
// repository being committed instead of the scratch one: a pre-commit run once committed these fixtures onto the branch
// and wrote their user into the shared config.
for (const key of Object.keys(process.env)) if (key.startsWith('GIT_')) delete process.env[key];

let root: string;

function git(...args: string[]) {
	const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
	if (result.status !== 0) throw new Error(result.stderr);
	return result.stdout.trim();
}

function write(path: string, text: string) {
	mkdirSync(join(root, path, '..'), { recursive: true });
	writeFileSync(join(root, path), text);
}

function commit(message: string) {
	git('add', '-A');
	git('commit', '-q', '-m', message);
	return git('rev-parse', 'HEAD');
}

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), 'changelog-'));
	git('init', '-q', '-b', 'master');
	git('config', 'user.email', 'test@example.com');
	git('config', 'user.name', 'test');
	git('config', 'commit.gpgsign', 'false');
	write('README.md', 'repo\n');
	commit('init');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

test('each entry ships in the first tagged build holding it; untagged ones ship in the build being made', () => {
	write('changelog/2026-11-10-old.json', '{"title":"Old","build":"2026.1101.100000"}\n');
	write('changelog/2026-11-11-first.json', '{"title":"First","tasks":["2ca9f3dd-67c0-4ffc-8670-266407c5df7b"]}\n');
	commit('first');
	write('changelog/2026-11-11-second.json', '{"title":"Second","description":"More detail."}\n');
	git('tag', 'testflight/2026.1111.120000', commit('second'));
	write('changelog/2026-11-12-third.json', '{"title":"Third"}\n');
	git('tag', 'testflight/2026.1112.090000', commit('third'));
	write('changelog/2026-11-12-fourth.json', '{"title":"Fourth"}\n');
	commit('fourth');
	write('changelog/2026-11-12-uncommitted.json', '{"title":"Uncommitted"}\n');

	expect(bundle(root, 'dev')).toEqual({
		build: 'dev',
		entries: [
			{ id: '2026-11-12-uncommitted', date: '2026-11-12', title: 'Uncommitted', tasks: [], build: 'dev' },
			{ id: '2026-11-12-fourth', date: '2026-11-12', title: 'Fourth', tasks: [], build: 'dev' },
			{ id: '2026-11-12-third', date: '2026-11-12', title: 'Third', tasks: [], build: '2026.1112.090000' },
			{
				id: '2026-11-11-second',
				date: '2026-11-11',
				title: 'Second',
				description: 'More detail.',
				tasks: [],
				build: '2026.1111.120000',
			},
			{
				id: '2026-11-11-first',
				date: '2026-11-11',
				title: 'First',
				tasks: ['2ca9f3dd-67c0-4ffc-8670-266407c5df7b'],
				build: '2026.1111.120000',
			},
			{ id: '2026-11-10-old', date: '2026-11-10', title: 'Old', tasks: [], build: '2026.1101.100000' },
		],
	});
});

test('entries one commit adds on one day follow their builds, newest first', () => {
	write('changelog/2026-11-11-a.json', '{"title":"A","build":"2026.1111.426"}\n');
	write('changelog/2026-11-11-b.json', '{"title":"B","build":"2026.1111.170234"}\n');
	write('changelog/2026-11-11-c.json', '{"title":"C","build":"2026.1111.30604"}\n');
	write('changelog/2026-11-11-d.json', '{"title":"D"}\n');
	commit('backfill');
	expect(bundle(root, 'dev').entries.map(entry => `${entry.title} ${entry.build}`)).toEqual([
		'D dev',
		'B 2026.1111.170234',
		'C 2026.1111.30604',
		'A 2026.1111.426',
	]);
});

test('a change to shipped code fails the check until an entry is added', () => {
	const base = git('rev-parse', 'HEAD');
	write('app-ios/Sources/App/View.swift', 'struct V {}\n');
	write('docs/notes.md', 'notes\n');
	commit('feature');
	expect(check(root, base)).toEqual({ ok: false, shipped: ['app-ios/Sources/App/View.swift'] });

	const path = add(root, {
		title: 'A new view',
		tasks: ['https://procrastimate.stf.lol/inbox?task=2CA9F3DD-67C0-4FFC-8670-266407C5DF7B'],
		date: '2026-11-12',
	});
	expect(path).toBe('changelog/2026-11-12-a-new-view.json');
	expect(JSON.parse(readFileSync(join(root, path), 'utf8'))).toEqual({
		title: 'A new view',
		tasks: ['2ca9f3dd-67c0-4ffc-8670-266407c5df7b'],
	});
	commit('entry');
	expect(check(root, base)).toEqual({ ok: true, added: ['changelog/2026-11-12-a-new-view.json'] });
});

test('tests, docs, and tooling need no entry', () => {
	const base = git('rev-parse', 'HEAD');
	write('app-ios/Tests/Nutrition/RuleTests.swift', 'import Testing\n');
	write('server/src/sync.test.ts', 'test\n');
	write('scripts/tool.ts', 'tool\n');
	write('AGENTS.md', 'rules\n');
	commit('tooling');
	expect(check(root, base)).toEqual({ ok: true, exempt: true });
});

test('an entry with a multi-line title or a bad task id is rejected', () => {
	expect(() => parseEntry('2026-11-12-x.json', '{"title":"One\\nTwo"}')).toThrow('title must be one line');
	expect(() => parseEntry('2026-11-12-x.json', '{"title":"One","tasks":["123"]}')).toThrow('tasks must be');
	expect(() => parseEntry('notes.json', '{"title":"One"}')).toThrow('name it <YYYY-MM-DD>');
});

test('a commit archived twice keeps the first build that held it', () => {
	write('changelog/2026-11-12-a.json', '{"title":"A"}\n');
	const sha = commit('a');
	git('tag', 'testflight/2026.1112.100000', sha);
	git('tag', 'testflight/2026.1112.90000', sha);
	expect(bundle(root, 'dev').entries.map(entry => entry.build)).toEqual(['2026.1112.90000']);
});
