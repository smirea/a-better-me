import { eq, getTableColumns, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { SETTINGS_ID, SYNCED_TABLES, type SyncedTable } from '../../shared/db/schema';
import type { Db } from './db/postgres';

/**
 * `POST /api/upload`: a device's queued PowerSync writes. This file is the boundary between PowerSync's wire shape
 * (snake_case columns, JSON as text, booleans as 0 or 1) and the schema's typed columns. Every write is one
 * single-row statement, so a batch needs no transaction, and every write converges when replayed: a put upserts the
 * whole row, a patch sets the columns it names, and a delete removes the row. PowerSync resending a batch is harmless.
 * One bad write is rejected alone and the rest still apply, and the batch never answers a 4xx, because PowerSync stops
 * uploading on one.
 */

export type Fields = Record<string, unknown>;
export type Write =
	| { op: 'put' | 'patch'; table: SyncedTable; id: string; values: Fields }
	| { op: 'delete'; table: SyncedTable; id: string };
export type Rejected = { table: string; id: string; reason: string };

type Kind = 'text' | 'integer' | 'number' | 'boolean' | 'json' | 'timestamp';
type Column = { key: string; name: string; kind: Kind; notNull: boolean; required: boolean };

const KINDS: Record<string, Kind> = {
	PgText: 'text',
	PgInteger: 'integer',
	PgDoublePrecision: 'number',
	PgBoolean: 'boolean',
	PgJsonb: 'json',
	PgTimestampString: 'timestamp',
};

/** Each synced table's columns by wire name, from the schema, so a new column needs no change here. */
const COLUMNS = Object.fromEntries(
	Object.entries(SYNCED_TABLES).map(([table, definition]) => [
		table,
		new Map(
			Object.entries(getTableColumns(definition) as Record<string, PgColumn>)
				.filter(([key]) => key !== 'id')
				.map(([key, column]): [string, Column] => {
					const kind = KINDS[column.columnType];
					if (!kind) throw new Error(`${table}.${column.name}: no upload parser for ${column.columnType}`);
					const required = column.notNull && !column.hasDefault;
					return [column.name, { key, name: column.name, kind, notNull: column.notNull, required }];
				}),
		),
	]),
) as Record<SyncedTable, Map<string, Column>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** Postgres `text` and `jsonb` refuse U+0000, so it is refused here instead of failing the statement. */
const hasNul = (value: unknown): boolean =>
	typeof value === 'string'
		? value.includes('\u0000')
		: typeof value === 'object' && value !== null && Object.values(value).some(hasNul);

/** The value as its column stores it, or the reason it can't be. Never called with null. */
function coerce(column: Column, value: unknown): { value: unknown } | { problem: string } {
	switch (column.kind) {
		case 'text':
			return typeof value === 'string' ? { value } : { problem: 'expected text' };
		case 'integer': {
			const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
			return Number.isSafeInteger(number) ? { value: number } : { problem: 'expected an integer' };
		}
		case 'number': {
			const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
			return typeof number === 'number' && Number.isFinite(number)
				? { value: number }
				: { problem: 'expected a number' };
		}
		case 'boolean':
			if (value === true || value === 1 || value === '1') return { value: true };
			if (value === false || value === 0 || value === '0') return { value: false };
			return { problem: 'expected 0 or 1' };
		case 'json':
			if (typeof value !== 'string') return { value };
			try {
				return { value: JSON.parse(value) };
			} catch {
				return { problem: 'expected JSON' };
			}
		case 'timestamp':
			return typeof value === 'string' && Number.isFinite(Date.parse(value))
				? { value }
				: { problem: 'expected an ISO 8601 timestamp' };
	}
}

/**
 * A put leaves out the columns PowerSync omits, which are its null ones, so the insert gives them their default or
 * null; a required column must be there. A patch carries only what changed, and a null clears a nullable column.
 */
function fieldsOf(table: SyncedTable, op: 'put' | 'patch', values: Record<string, unknown>): Fields | string {
	const columns = COLUMNS[table];
	const fields: Fields = {};
	for (const [name, raw] of Object.entries(values)) {
		const column = columns.get(name);
		if (!column || raw === undefined) continue;
		if (raw === null) {
			if (op === 'patch' && column.notNull) return `${name}: cannot be null`;
			if (op === 'patch') fields[column.key] = null;
			continue;
		}
		const coerced = coerce(column, raw);
		if ('problem' in coerced) return `${name}: ${coerced.problem}`;
		fields[column.key] = coerced.value;
	}
	if (op === 'put') {
		const missing = [...columns.values()].filter(column => column.required && !(column.key in fields));
		if (missing.length) return `${missing.map(column => column.name).join(', ')}: required`;
	}
	if (hasNul(fields)) return 'Text cannot contain U+0000';
	return fields;
}

export function parseWrite(raw: unknown): Write | Rejected {
	if (!isRecord(raw) || typeof raw.table !== 'string' || typeof raw.id !== 'string' || !raw.id) {
		const table = isRecord(raw) && typeof raw.table === 'string' ? raw.table : '';
		const id = isRecord(raw) && typeof raw.id === 'string' ? raw.id : '';
		return { table, id, reason: 'Malformed write' };
	}
	const { table, id, op } = raw;
	const reject = (reason: string): Rejected => ({ table, id, reason });
	if (!Object.hasOwn(SYNCED_TABLES, table)) return reject(`Unknown table ${table}`);
	const synced = table as SyncedTable;
	if (synced === 'settings' && id !== SETTINGS_ID) return reject(`The settings row is named ${SETTINGS_ID}`);
	if (op === 'delete') return synced === 'settings' ? reject('Settings cannot be deleted') : { op, table: synced, id };
	if (op !== 'put' && op !== 'patch') return reject(`Unknown op ${String(op)}`);
	if (!isRecord(raw.values)) return reject('A put or patch needs values');
	const fields = fieldsOf(synced, op, raw.values);
	return typeof fields === 'string' ? reject(fields) : { op, table: synced, id, values: fields };
}

/** `excluded.<column>` for every column but the id, so a put replaces the whole row. */
const replaceAll = (table: SyncedTable) =>
	Object.fromEntries([...COLUMNS[table].values()].map(column => [column.key, sql.raw(`excluded."${column.name}"`)]));

async function statement(db: Db, write: Write): Promise<void> {
	const table: PgTable = SYNCED_TABLES[write.table];
	const id = (getTableColumns(table) as Record<string, PgColumn>).id!;
	if (write.op === 'delete') {
		await db.delete(table).where(eq(id, write.id));
	} else if (write.op === 'put') {
		await db
			.insert(table)
			.values({ ...write.values, id: write.id })
			.onConflictDoUpdate({ target: id, set: replaceAll(write.table) });
	} else if (Object.keys(write.values).length) {
		// A patch of a row that is gone, such as one a delete beat here, updates nothing.
		await db.update(table).set(write.values).where(eq(id, write.id));
	}
}

/** SQLSTATE classes 22 (data exception) and 23 (integrity constraint violation) are the write's fault, not the server's. */
function refusal(error: unknown): string | null {
	for (let cause = error; isRecord(cause) || cause instanceof Error; cause = (cause as { cause?: unknown }).cause) {
		const { code, message } = cause as { code?: unknown; message?: unknown };
		if (typeof code === 'string' && /^2[23]/.test(code)) return `The database refused the write: ${String(message)}`;
	}
	return null;
}

/**
 * Applies the writes in order, one statement each, so a put and a later patch of the same row in one batch land in
 * that order. A refused write is reported and skipped; any other failure throws, and PowerSync retries the batch.
 */
export async function upload(db: Db, writes: readonly unknown[]): Promise<{ rejected: Rejected[] }> {
	const rejected: Rejected[] = [];
	for (const raw of writes) {
		const write = parseWrite(raw);
		if ('reason' in write) {
			rejected.push(write);
			continue;
		}
		try {
			await statement(db, write);
		} catch (error) {
			const reason = refusal(error);
			if (!reason) throw error;
			rejected.push({ table: write.table, id: write.id, reason });
		}
	}
	if (rejected.length) console.warn('upload: rejected writes', JSON.stringify(rejected));
	return { rejected };
}
