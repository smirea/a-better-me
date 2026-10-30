import { expect, test } from 'bun:test';
import { Glob } from 'bun';
import { join } from 'node:path';

const sources = join(import.meta.dir, '../Sources/App');

test('iPhone screens confirm with alerts, never confirmationDialog', async () => {
	const offenders: string[] = [];
	for await (const path of new Glob('**/*.swift').scan(sources)) {
		const text = await Bun.file(join(sources, path)).text();
		text.split('\n').forEach((line, index) => {
			if (line.includes('.confirmationDialog(')) offenders.push(`${path}:${index + 1}`);
		});
	}
	expect(
		offenders,
		'On iOS 26 and later a confirmationDialog shows as a popover, which drops its cancel button, so the owner has no way to back out. Use .alert with a Button(role: .cancel).',
	).toEqual([]);
});
