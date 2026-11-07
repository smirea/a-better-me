import type { SyncedTable } from '../../../shared/db/schema';
import { z } from 'zod';
import { ApiError } from '../http';
import type { Db, RowOf } from './db';
import { day, newId } from './models';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Context<Query, Body> = {
	db: Db;
	/** UUID-shaped path parameters arrive lowercase, like every row id. */
	params: Record<string, string>;
	query: Query;
	body: Body;
	now: string;
};

/** One operation: the router dispatches on it and the OpenAPI document is generated from it, so the two never drift. */
export type Route = {
	method: Method;
	path: string;
	tag: string;
	summary: string;
	description?: string;
	query?: z.ZodObject;
	body?: z.ZodType;
	response: z.ZodType;
	run(context: Context<any, any>): unknown;
};

export function route<Query extends z.ZodObject = z.ZodObject<{}>, Body extends z.ZodType = z.ZodUndefined>(
	definition: Omit<Route, 'run' | 'query' | 'body'> & {
		query?: Query;
		body?: Body;
		run(context: Context<z.output<Query>, z.output<Body>>): unknown;
	},
): Route {
	return definition as Route;
}

export const flag = z.stringbool();
export const limit = (fallback: number, max: number) => z.coerce.number().int().min(1).max(max).default(fallback);
export const offset = z.coerce.number().int().min(0).default(0);
export const page = { limit: limit(500, 5000), offset };
/** A list that pages: `total` counts every match, so an agent knows when it has them all. */
export const paged = (item: z.ZodType) => z.object({ total: z.int(), items: z.array(item) });
export const days = z.object({
	from: day.optional().meta({ description: 'The first day, inclusive.' }),
	to: day.optional().meta({ description: 'The last day, inclusive.' }),
});

export type Condition = [string, ...(string | number)[]];

export function where(conditions: Condition[]): [string | undefined, (string | number)[]] {
	if (!conditions.length) return [undefined, []];
	return [conditions.map(([sql]) => sql).join(' AND '), conditions.flatMap(([, ...params]) => params)];
}

export function dayRange(column: string, query: { from?: string; to?: string }) {
	const conditions: Condition[] = [];
	if (query.from) conditions.push([`${column} >= ?`, query.from]);
	if (query.to) conditions.push([`${column} <= ?`, query.to]);
	return conditions;
}

export function list<T extends SyncedTable>(db: Db, table: T, conditions: Condition[], order: string) {
	const [sql, params] = where(conditions);
	return db.all(table, `${sql ?? '1'} ORDER BY ${order}`, params);
}

export function pagedList<T extends SyncedTable, Item = RowOf<T>>(
	db: Db,
	table: T,
	conditions: Condition[],
	order: string,
	query: { limit: number; offset: number },
	map: (row: RowOf<T>) => Item = row => row as Item,
) {
	const [sql, params] = where(conditions);
	const rows = db.all(table, `${sql ?? '1'} ORDER BY ${order} LIMIT ? OFFSET ?`, [
		...params,
		query.limit,
		query.offset,
	]);
	return { total: db.count(table, sql, params), items: rows.map(map) };
}

export function fresh(db: Db, table: SyncedTable, id: string | undefined): string {
	if (!id) return newId();
	if (db.get(table, id)) throw new ApiError(409, `${table} ${id} already exists. PATCH it instead.`);
	return id;
}

/** A `{day}` path parameter, refused unless it is a `YYYY-MM-DD` day. */
export const dayParam = (params: Record<string, string>) => day.parse(params.day);
