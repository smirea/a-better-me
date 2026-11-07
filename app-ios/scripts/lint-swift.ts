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
		fix: 'lists and forms call .themedList(), so every one draws its section cards on Theme.background, in sheets too',
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
		pattern: /\.confirmationDialog\(/,
		allowedIn: [],
		fix: 'on iOS 26 and later a confirmationDialog shows as a popover, which drops its cancel button; use .alert with a Button(role: .cancel)',
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
