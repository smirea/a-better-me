import { bunSqlite } from 'sync-engine/bun-sqlite';
import { createSpace, handleSync, type SyncResponse } from 'sync-engine/core';
import { schema } from '../../shared/db/schema';
import { agentApi } from './agent';
import { handle, type App, type Report } from './api';
import { parseConfig } from './config';

const silent: Report = { captureMessage: () => undefined, captureException: () => undefined };

/** The whole API over an in-memory space, as `index.ts` serves it, for tests. */
export function testServer(options: { report?: Report; clock?: () => Date } = {}) {
	const driver = bunSqlite(':memory:');
	const space = createSpace(driver, schema);
	space.migrate();
	const config = parseConfig({});
	const agent = (geminiApiKey: string | null) =>
		agentApi({
			space,
			driver,
			ownerToken: config.ownerToken,
			geminiApiKey,
			publish: () => undefined,
			clock: options.clock,
		});
	const app: App = {
		config,
		report: options.report ?? silent,
		engine: request => handleSync(space, request),
		ramble: async () => new Response('A test server opens no sockets', { status: 501 }),
		agent: agent(null),
	};

	const call = (method: string, path: string, body?: unknown, token: string | null = config.ownerToken) =>
		handle(
			new Request(`http://api.test/api${path}`, {
				method,
				headers: { ...(token && { authorization: `Bearer ${token}` }), 'content-type': 'application/json' },
				body: body === undefined ? undefined : JSON.stringify(body),
			}),
			app,
		);
	/** The JSON of a call that must answer 200; anything else throws with the body. */
	async function ok<T = any>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
		const response = await call(method, path, body, token);
		if (response.status !== 200) throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
		return response.json() as Promise<T>;
	}
	const sync = (cursor: number, writes: unknown[]) =>
		handle(
			new Request('http://api.test/api/sync', {
				method: 'POST',
				headers: { authorization: `Bearer ${config.ownerToken}` },
				body: JSON.stringify({ protocol: 2, client: `phone-${crypto.randomUUID()}`, cursor, writes }),
			}),
			app,
		).then(response => response.json() as Promise<SyncResponse>);
	/** The live rows of `table` that a phone syncing from scratch receives. */
	const phone = async (table: string) =>
		(await sync(0, [])).rows.flatMap(row => (row.table === table && !row.deleted ? [row.values] : []));
	/** Pushes `writes` the way the phone does, from the current head. */
	const phoneWrites = (writes: unknown[]) => sync(space.head(), writes);

	return { space, config, app, agent, call, ok, phone, phoneWrites };
}
