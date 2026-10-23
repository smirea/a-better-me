import type { R2Bucket } from '@cloudflare/workers-types';
import { SYNCED_TABLES } from '../../../shared/db/schema';
import type { Db } from './postgres';

export const BACKUP_CRON = '0 9 * * *';
export const BACKUP_PREFIX = 'postgres/';
export const BACKUPS_KEPT = 30;

/**
 * Every table as one JSON document, read in one repeatable-read transaction so every table comes from the same
 * snapshot. Supabase's own backups cover only its `postgres` database, never `a_better_me`.
 */
export async function dumpJson(db: Db, at: Date): Promise<string> {
	return db.transaction(
		async tx => {
			const tables: Record<string, unknown[]> = {};
			for (const [name, table] of Object.entries(SYNCED_TABLES)) tables[name] = await tx.select().from(table);
			return JSON.stringify({ at: at.toISOString(), tables });
		},
		{ isolationLevel: 'repeatable read', accessMode: 'read only' },
	);
}

/** `postgres/2026-10-23.json`, so a lexicographic listing is oldest first and a rerun the same day overwrites. */
export const backupKey = (at: Date) => `${BACKUP_PREFIX}${at.toISOString().slice(0, 10)}.json`;

/**
 * Writes today's dump, then deletes all but the newest `BACKUPS_KEPT`. Pruning by count rather than age means a run
 * of failed days never deletes the last good backups.
 */
export async function backupDatabase(db: Db, bucket: R2Bucket, at: Date): Promise<string> {
	const key = backupKey(at);
	await bucket.put(key, await dumpJson(db, at), { httpMetadata: { contentType: 'application/json' } });
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
