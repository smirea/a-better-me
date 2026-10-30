/**
 * Fails on Swift source patterns the design system replaces, naming the replacement. Runs in CI's Swift checks and
 * in pre-commit. Usage: `bun app-ios/scripts/lint-swift.ts`.
 */
import { Glob } from 'bun';
import { join, relative } from 'node:path';

const sources = join(import.meta.dir, '../Sources');

// The iPhone app's tint is white; the watch app and widgets set their own, so the rules cover `App/` only.
const rules = [
	{
		pattern: /\.buttonStyle\(\.glassProminent\)/,
		allowedIn: ['App/DesignSystem/Buttons.swift'],
		fix: 'use .prominentButton() (or .prominentButton(tint:)) or .primaryPill(); the native style draws white text on the white tint',
	},
];

const problems: string[] = [];
for await (const path of new Glob('App/**/*.swift').scan(sources)) {
	const lines = (await Bun.file(join(sources, path)).text()).split('\n');
	for (const rule of rules) {
		if (rule.allowedIn.includes(path)) continue;
		lines.forEach((line, index) => {
			if (rule.pattern.test(line))
				problems.push(`${relative(process.cwd(), join(sources, path))}:${index + 1}: ${rule.fix}`);
		});
	}
}

if (problems.length) {
	console.error(problems.join('\n'));
	process.exit(1);
}
