import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { bunSqlite } from 'sync-engine/bun-sqlite';
import { createSpace, type Values } from 'sync-engine/core';
import { schema } from '../shared/db/schema';

/**
 * Loads a daily backup (`server/src/backup.ts`, `{ at, tables }`) into this checkout's local database, the file
 * `server/src/index.ts` serves, so a simulator syncs the owner's real data. Rows go through the space's own writer, so
 * each one is logged and a device pulls it like any other change. The database must not exist yet: merging a backup
 * into rows a device already synced would leave that device holding both.
 *
 *   bunx wrangler r2 object get a-better-me-backups/sqlite/<YYYY-MM-DD>.json --remote --file .data/prod-backup.json
 *   bun scripts/restore-backup.ts .data/prod-backup.json
 *
 * Keep the backup under the git-ignored `.data/`: it is the owner's private data, token hashes included.
 */

const [path] = process.argv.slice(2);
if (!path) throw new Error('Usage: bun scripts/restore-backup.ts <backup.json>');
const root = join(import.meta.dir, '..');
const file = join(root, '.data', `${basename(root)}.sqlite`);
if (existsSync(file)) throw new Error(`${file} exists; stop the server and trash it first`);

const backup = (await Bun.file(path).json()) as { at: string; tables: Record<string, ({ id: string } & Values)[]> };
const unknown = Object.keys(backup.tables).filter(name => !schema.tables.some(table => table.name === name));
if (unknown.length) throw new Error(`The backup has tables the schema lacks: ${unknown.join(', ')}`);

const space = createSpace(bunSqlite(file), schema);
space.migrate();
const counts = space.change(server =>
	Object.entries(backup.tables).map(([table, rows]) => {
		for (const { id, ...values } of rows) server.put(table, id, values);
		return `${table} ${rows.length}`;
	}),
);
console.log(`Restored the backup from ${backup.at} into ${file}, head ${space.head()}:\n${counts.join('\n')}`);
