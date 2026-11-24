/**
 * Fails on Swift source patterns the design system replaces, naming the replacement, and on a framework import in
 * `Core` beyond the ones `swift test` builds on the Mac. Runs in CI's Swift checks and in pre-commit.
 * Usage: `bun app-ios/scripts/lint-swift.ts [file ...]`. Without arguments, scans all of `app-ios/Sources`.
 */
import { Glob } from 'bun';
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const sources = join(import.meta.dir, '../Sources');

// The iPhone app's tint is white; the watch app and widgets set their own, so the rules cover `App/` only.
const rules = [
	{
		pattern: /\bbuttonStyle\(\s*(\.glassProminent|GlassProminentButtonStyle)\b/,
		allowedIn: ['App/DesignSystem/Buttons.swift'],
		fix: 'use .prominentButton() (or .prominentButton(tint:)) or .primaryPill(); the native style draws white text on the white tint',
	},
	{
		pattern: /(?<![A-Za-z])Button\("(Close|Cancel|Done|Save)", systemImage: "(xmark|checkmark)"/,
		allowedIn: [],
		fix: 'a sheet closes with Button(role: .close) and confirms with Button("Save", role: .confirm), the native glyphs',
	},
	{
		pattern: /\.scrollContentBackground\(\.hidden\)/,
		allowedIn: ['App/DesignSystem/Components.swift', 'App/Workouts/Library/CustomExerciseWizard.swift'],
		fix: 'lists and forms call .themedList() to draw on Theme.background instead of the system grouped background (flat rows by default; use ThemedSection only for grouped cards)',
	},
	{
		pattern: /"(largecircle\.fill\.circle|record\.circle\.fill)"/,
		allowedIn: ['App/DesignSystem/WizardOption.swift'],
		fix: 'a choice row ends in SelectionMark(isOn:), one radio glyph and size everywhere',
	},
	{
		pattern: /AppFont\.(medium\(1[45]\)|caption\(12\)|title\((18|20)?\))/,
		allowedIn: [],
		fix: 'that size is a type role: AppFont.chip, rowTitle, rowDetail, listTitle, or sectionTitle',
	},
	{
		pattern: /\.(foregroundStyle|tint)\(\.(white|black|red|blue|green|gray)\)/,
		allowedIn: ['App/Workouts/Session/PlateCalculatorView.swift'],
		fix: 'use a Theme token: textPrimary, onPrimary, destructive, accent, or a named color',
	},
	{
		pattern: /\}\s*footer:\s*\{/,
		allowedIn: [],
		fix: 'zero extra copy: no explanatory Section footers; show state as a row or a ThemedSection subtitle, or drop it',
	},
	{
		pattern: /\.confirmationDialog\(/,
		allowedIn: [],
		fix: 'on iOS 26 and later a confirmationDialog shows as a popover, which drops its cancel button; use .alert with a Button(role: .cancel)',
	},
];

// Core is logic only: Package.swift compiles it for `swift test` on the Mac. SwiftUI, HealthKit and other UI or device
// frameworks would build there too, so a view or a device read would slip into the tests' module unnoticed.
const coreImports = new Set([
	'Foundation',
	'GRDB',
	'SyncEngine',
	'CryptoKit',
	'Synchronization',
	'os',
	'Observation',
	'Compression',
]);

async function collectFiles(args: string[]): Promise<{ app: string[]; core: string[] }> {
	if (args.length === 0) {
		const app: string[] = [];
		for await (const path of new Glob('App/**/*.swift').scan(sources)) app.push(path);
		const core: string[] = [];
		for (const glob of ['Core/**/*.swift', 'Shared/Core/**/*.swift']) {
			for await (const path of new Glob(glob).scan(sources)) core.push(path);
		}
		return { app, core };
	}

	const app: string[] = [];
	const core: string[] = [];
	for (const arg of args) {
		const absolute = resolve(process.cwd(), arg);
		if (!absolute.endsWith('.swift') || !existsSync(absolute)) continue;
		const rel = relative(sources, absolute).replaceAll('\\', '/');
		if (rel.startsWith('..')) continue;
		if (rel.startsWith('App/')) app.push(rel);
		else if (rel.startsWith('Core/') || rel.startsWith('Shared/Core/')) core.push(rel);
	}
	return { app, core };
}

const { app: appFiles, core: coreFiles } = await collectFiles(process.argv.slice(2));
const problems: string[] = [];

for (const path of appFiles) {
	const lines = (await Bun.file(join(sources, path)).text()).split('\n');
	for (const rule of rules) {
		if (rule.allowedIn.includes(path)) continue;
		lines.forEach((line, index) => {
			if (rule.pattern.test(line))
				problems.push(`${relative(process.cwd(), join(sources, path))}:${index + 1}: ${rule.fix}`);
		});
	}
}

for (const path of coreFiles) {
	const lines = (await Bun.file(join(sources, path)).text()).split('\n');
	lines.forEach((line, index) => {
		const name = /^\s*(?:@\w+\s+)*import\s+(?:(?:struct|class|enum|protocol|func|var|let|typealias)\s+)?(\w+)/.exec(
			line,
		)?.[1];
		if (name && !coreImports.has(name))
			problems.push(
				`${relative(process.cwd(), join(sources, path))}:${index + 1}: Core imports no ${name}; keep the framework code in the app target and pass Core plain values (allowed: ${[...coreImports].join(', ')})`,
			);
	});
}

if (problems.length) {
	console.error(problems.join('\n'));
	process.exit(1);
}
