import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { SYNCED_TABLES } from './schema';

test('the sync config streams exactly the synced tables', () => {
	const config = readFileSync(join(import.meta.dir, '../../powersync/sync-config.yaml'), 'utf8');
	const streamed = [...config.matchAll(/SELECT \* FROM (\w+)/g)].map(match => match[1]);
	expect(streamed.toSorted()).toEqual(Object.keys(SYNCED_TABLES).toSorted());
});
