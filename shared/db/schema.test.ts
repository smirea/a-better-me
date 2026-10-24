import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { generate } from 'sync-engine/schema';
import { SWIFT_SCHEMA } from '../../scripts/generate';
import { schema } from './schema';

test('the committed Swift schema is what `bun run generate` writes', () => {
	const committed = readFileSync(join(import.meta.dir, '../..', SWIFT_SCHEMA), 'utf8');
	expect(committed).toBe(generate({ schema }).swift);
});
