import { getTableColumns } from 'drizzle-orm';
import type { Space, SqlDriver, SqlValue, Values, Write } from 'sync-engine/core';
import { SYNCED_TABLES, type SyncedTable } from '../../../shared/db/schema';

export type RowOf<T extends SyncedTable> = (typeof SYNCED_TABLES)[T]['$inferSelect'];

type Change = { table: SyncedTable; id: string } & ({ op: 'put' | 'patch'; values: Values } | { op: 'delete' });

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

/** Sorted keys, the encoding iOS writes (`RowJSON`), so a value an agent writes reads back byte for byte the same. */
export function stableJson(value: unknown): string {
	return JSON.stringify(value, (_key, inner) =>
		inner && typeof inner === 'object' && !Array.isArray(inner)
			? Object.fromEntries(
					Object.keys(inner)
						.toSorted()
						.map(key => [key, inner[key]]),
				)
			: inner,
	);
}

/** The writer's client id in the space's log. Every agent write is one more seq of this client. */
const CLIENT = 'agent-api';

/**
 * Reads go straight to the space's tables. Writes go through `space.sync` as one more client, so they take the same
 * validators, change log, and tombstones as a phone's, and every device pulls them on its next sync.
 */
export function openDb(space: Space, driver: SqlDriver) {
	const columnsOf = (table: SyncedTable) => Object.entries(getTableColumns(SYNCED_TABLES[table]));

	function decode<T extends SyncedTable>(table: T, row: Record<string, SqlValue>): RowOf<T> {
		const columns = columnsOf(table).map(([key, column]) => {
			const value = row[column.name];
			return [key, value === null || value === undefined ? null : column.mapFromDriverValue(value)];
		});
		return Object.fromEntries(columns) as RowOf<T>;
	}

	function encode(table: SyncedTable, values: Record<string, unknown>): Values {
		const encoded: Values = {};
		for (const [key, column] of columnsOf(table)) {
			const value = values[key];
			if (value === undefined || key === 'id') continue;
			encoded[column.name] =
				value === null
					? null
					: column.columnType === 'SQLiteTextJson'
						? stableJson(value)
						: column.mapToDriverValue(value);
		}
		return encoded;
	}

	function all<T extends SyncedTable>(table: T, where?: string, params: SqlValue[] = []): RowOf<T>[] {
		return driver
			.exec(`SELECT * FROM ${table}${where ? ` WHERE ${where}` : ''}`, params)
			.map(row => decode(table, row));
	}

	return {
		all,
		get: <T extends SyncedTable>(table: T, id: string): RowOf<T> | undefined => all(table, 'id = ?', [id])[0],
		find<T extends SyncedTable>(table: T, id: string, label: string): RowOf<T> {
			const row = all(table, 'id = ?', [id])[0];
			if (!row) throw new ApiError(404, `No ${label} with id ${id}`);
			return row;
		},
		put: <T extends SyncedTable>(table: T, row: RowOf<T>): Change => ({
			table,
			id: row.id,
			op: 'put',
			values: encode(table, row),
		}),
		patch: <T extends SyncedTable>(table: T, id: string, values: Partial<RowOf<T>>): Change => ({
			table,
			id,
			op: 'patch',
			values: encode(table, values),
		}),
		delete: (table: SyncedTable, id: string): Change => ({ table, id, op: 'delete' }),
		/**
		 * Applies the changes in order. The engine checks each write alone, so a refused one does not undo the ones before
		 * it; the request schemas already enforce everything the engine checks, which keeps that from happening.
		 */
		commit(...changes: Change[]) {
			if (!changes.length) return;
			const { acked } = space.sync({ protocol: 1, client: CLIENT, cursor: space.head(), writes: [] });
			const writes = changes.map((change, index) => ({ ...change, seq: acked + 1 + index }) as Write);
			const { rejected } = space.sync({ protocol: 1, client: CLIENT, cursor: space.head(), writes });
			if (rejected.length) {
				throw new ApiError(422, rejected.map(r => `${r.table} ${r.id}: ${r.reason}`).join('; '));
			}
		},
	};
}

export type Db = ReturnType<typeof openDb>;
