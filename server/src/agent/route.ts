import { z } from 'zod';
import type { Db } from './db';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Context<Query, Body> = { db: Db; params: Record<string, string>; query: Query; body: Body; now: string };

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
/** A list that pages: `total` counts every match, so an agent knows when it has them all. */
export const paged = (item: z.ZodType) => z.object({ total: z.int(), items: z.array(item) });

export function where(conditions: [string, ...(string | number)[]][]): [string | undefined, (string | number)[]] {
	if (!conditions.length) return [undefined, []];
	return [conditions.map(([sql]) => sql).join(' AND '), conditions.flatMap(([, ...params]) => params)];
}
