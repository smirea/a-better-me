import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { BACKUP_CRON } from './backup';

test('the Worker schedules exactly the backup cron that scheduled() runs', async () => {
	const wrangler = await Bun.file(join(import.meta.dir, '../../wrangler.jsonc')).text();
	const crons = JSON.parse(/"crons":\s*(\[[^\]]*\])/.exec(wrangler)![1]!);
	expect(crons).toEqual([BACKUP_CRON]);
});
