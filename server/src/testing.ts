import { bunSqlite } from 'sync-engine/bun-sqlite';
import { createSpace, handleSync } from 'sync-engine/core';
import { schema } from '../../shared/db/schema';
import { agentApi } from './agent';
import { handle, type App, type Report } from './api';
import { parseConfig } from './config';

const silent: Report = { captureMessage: () => undefined, captureException: () => undefined };

/** The whole API over an in-memory space, as `index.ts` serves it, for tests. */
export function testServer(options: { geminiApiKey?: string | null; report?: Report; clock?: () => Date } = {}) {
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
		agent: agent(options.geminiApiKey ?? null),
	};
	return { space, driver, config, app, agent, handle: (request: Request) => handle(request, app) };
}
