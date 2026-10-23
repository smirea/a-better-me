import { sql } from 'drizzle-orm';
import { migrations } from './migrations.generated';
import type { Db } from './postgres';

/**
 * Applies the bundled `server/drizzle` migrations. The bookkeeping table is drizzle-kit's own, so `drizzle-kit migrate`
 * agrees with it. A transaction-level advisory lock comes first, so Worker isolates and dev servers starting together
 * apply each migration once. A database whose history is not a prefix of these migrations fails before a statement
 * runs: a local database recovers with `bun scripts/local-stack.ts --reset-db`; production never should.
 */

const TABLE = sql`${sql.identifier('drizzle')}.${sql.identifier('__drizzle_migrations')}`;
/** Any constant; it only has to be the same in every process that migrates this database. */
const LOCK_KEY = 6_150_001;

export async function migrate(db: Db): Promise<string[]> {
	return db.transaction(async tx => {
		await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_KEY})`);
		await tx.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier('drizzle')}`);
		await tx.execute(
			sql`CREATE TABLE IF NOT EXISTS ${TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
		);
		const applied = rows<{ created_at: string | number }>(
			await tx.execute(sql`SELECT created_at FROM ${TABLE} ORDER BY created_at`),
		).map(row => Number(row.created_at));
		const history = migrations.map(migration => migration.when);
		if (applied.length > history.length || applied.some((at, index) => at !== history[index])) {
			throw new Error(
				`The database's migration history [${applied.join(', ')}] is not a prefix of server/drizzle [${history.join(', ')}], so nothing was migrated.`,
			);
		}
		const todo = migrations.slice(applied.length);
		for (const migration of todo) {
			for (const statement of migration.statements) await tx.execute(sql.raw(statement));
			await tx.execute(sql`INSERT INTO ${TABLE} (hash, created_at) VALUES ('', ${migration.when})`);
		}
		return todo.map(migration => migration.tag);
	});
}

/** postgres.js answers `execute` with the row array itself; PGlite wraps it in `{ rows }`. */
function rows<T>(result: unknown): T[] {
	return Array.isArray(result) ? (result as T[]) : (result as { rows: T[] }).rows;
}
