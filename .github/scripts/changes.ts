import { $ } from 'bun';
import { appendFileSync } from 'node:fs';
import { extname } from 'node:path';
import { env } from 'node:process';

const { SCAFFOLD_TYPE: kind, BASE_SHA: base, HEAD_SHA: head, EVENT_NAME: event, GITHUB_OUTPUT: output } = env;
if (!kind || !head || !event || !output) throw new Error('Missing change detection environment');

const full = event === 'workflow_dispatch' || !base || /^0+$/.test(base);
const comparison = event === 'pull_request' ? `${base}...${head}` : `${base}..${head}`;
// Downloaded assets include Markdown, and a Bun test checks the tracked asset version against them.
const assets = ['app-ios/Assets/', 'app-ios/Config/Assets.xcconfig'];
const paths = (full ? [] : (await $`git diff --name-only -z ${comparison}`.text()).split('\0')).filter(
	name =>
		name &&
		(assets.some(prefix => name.startsWith(prefix)) ||
			(!['.md', '.rst'].includes(extname(name).toLowerCase()) && !name.startsWith('docs/'))),
);
const common = full || paths.some(name => name.startsWith('.github/'));
// The committed Swift schema is checked by a Bun test against the generator, so a hand edit to it runs the Bun jobs.
const generated = 'app-ios/Sources/App/Sync/Generated/';
const bun =
	!['swift', 'empty'].includes(kind) &&
	(common ||
		paths.some(name => !name.startsWith('app-ios/') || [generated, ...assets].some(prefix => name.startsWith(prefix))));
const swift =
	['swift', 'monorepo-swift'].includes(kind) &&
	(common ||
		paths.some(
			name =>
				kind === 'swift' ||
				['app-ios/', '.env', '.bun-version'].some(prefix => name.startsWith(prefix)) ||
				['package.json', 'bun.lock', 'bun.lockb'].includes(name),
		));

appendFileSync(output, `bun=${bun}\nswift=${swift}\n`);
