import type { R2Bucket } from '@cloudflare/workers-types';

export const BACKUP_CRON = '0 9 * * *';
export const BACKUP_PREFIX = 'sqlite/';
export const BACKUPS_KEPT = 30;

/** `sqlite/2026-10-23.json`, so a lexicographic listing is oldest first and a rerun the same day overwrites. */
export const backupKey = (at: Date) => `${BACKUP_PREFIX}${at.toISOString().slice(0, 10)}.json`;

/**
 * Writes the space's tables as one JSON document, then deletes all but the newest `BACKUPS_KEPT`. Pruning by count
 * rather than age means a run of failed days never deletes the last good backups.
 */
export async function backup(tables: Record<string, unknown[]>, bucket: R2Bucket, at: Date): Promise<string> {
	const key = backupKey(at);
	await bucket.put(key, JSON.stringify({ at: at.toISOString(), tables }), {
		httpMetadata: { contentType: 'application/json' },
	});
	const keys: string[] = [];
	let cursor: string | undefined;
	do {
		const page = await bucket.list({ prefix: BACKUP_PREFIX, cursor });
		keys.push(...page.objects.map(object => object.key));
		cursor = page.truncated ? page.cursor : undefined;
	} while (cursor);
	const stale = keys.sort().slice(0, -BACKUPS_KEPT);
	if (stale.length) await bucket.delete(stale);
	return key;
}
