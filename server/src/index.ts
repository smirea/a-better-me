import * as Sentry from '@sentry/bun';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { bunSqlite } from 'sync-engine/bun-sqlite';
import { createSpace, handleSync, LIVE_PROTOCOL } from 'sync-engine/core';
import { schema } from '../../shared/db/schema';
import { agentApi } from './agent';
import { handle } from './api';
import { ASSETS_DIR, assetRoutes } from './assets';
import { parseConfig } from './config';
import { DATA_FILE } from './data-file';
import { serveLiveRamble, type LiveRambleSetup } from './food/ramble-live';
import { SENTRY_DEFAULTS, withoutDedupe } from './sentry';
import env from './env';

const config = parseConfig(env);
// Before `Bun.serve`, which the SDK wraps to report a thrown error. Without a DSN the SDK stays silent.
if (config.sentry) Sentry.init({ ...config.sentry, ...SENTRY_DEFAULTS, integrations: withoutDedupe });

mkdirSync(dirname(DATA_FILE), { recursive: true });
const driver = bunSqlite(DATA_FILE);
const space = createSpace(driver, schema);
space.migrate();

const publish = (head: number) => server.publish('live', JSON.stringify({ head }));
const agent = agentApi({ space, driver, ownerToken: config.ownerToken, geminiApiKey: config.geminiApiKey, publish });

// No auth: the files are already in git, and the Worker never serves them.
const assets = assetRoutes(ASSETS_DIR);

/** A live sync socket has no data; a live Ramble socket carries its setup until it opens. */
type Socket = { setup: LiveRambleSetup; ramble?: ReturnType<typeof serveLiveRamble> } | undefined;

const server = Bun.serve<Socket>({
	development: config.environment === 'development',
	idleTimeout: 120,
	port: env.API_PORT,
	fetch: (request, server) =>
		assets(request) ??
		handle<undefined>(request, {
			config,
			report: Sentry,
			async ramble(request, setup) {
				if (server.upgrade(request, { data: { setup } })) return undefined;
				return Response.json({ ok: false, error: 'Expected a WebSocket upgrade' }, { status: 400 });
			},
			async engine(request) {
				if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
					// Echo the subprotocol only when offered: the Swift client offers none and fails the handshake on an echo.
					const offered = request.headers
						.get('sec-websocket-protocol')
						?.split(',')
						.some(p => p.trim() === LIVE_PROTOCOL);
					const headers = offered ? { 'Sec-WebSocket-Protocol': LIVE_PROTOCOL } : undefined;
					if (server.upgrade(request, { headers, data: undefined })) return undefined;
					return Response.json({ ok: false, error: 'Expected a WebSocket upgrade' }, { status: 400 });
				}
				const before = space.head();
				const response = await handleSync(space, request);
				if (space.head() > before) publish(space.head());
				return response;
			},
			agent,
		}),
	websocket: {
		open(ws) {
			if (!ws.data) return void ws.subscribe('live');
			ws.data.ramble = serveLiveRamble(
				{ send: text => ws.send(text), close: (code, reason) => ws.close(code, reason) },
				ws.data.setup,
			);
		},
		message(ws, message) {
			if (ws.data?.ramble) return ws.data.ramble.message(message);
			if (message === 'ping') ws.send('pong');
		},
		close: ws => ws.data?.ramble?.close(),
	},
	error: error => {
		console.error(error);
		return Response.json({ ok: false, error: 'Internal error' }, { status: 500 });
	},
});

console.log(`Server running at ${server.url.href} over ${DATA_FILE}`);
console.log(`Sentry: ${config.sentry ? config.sentry.environment : 'off'}`);
