import * as Sentry from '@sentry/bun';
import { mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { bunSqlite } from 'sync-engine/bun-sqlite';
import { createSpace, handleSync, LIVE_PROTOCOL } from 'sync-engine/core';
import { schema } from '../../shared/db/schema';
import { handleAgent } from './agent';
import { handle } from './api';
import { ASSETS_DIR, assetRoutes } from './assets';
import { parseConfig } from './config';
import { serveLiveRamble } from './food/ramble-live';
import env from './env';

const config = parseConfig(env);
// Before `Bun.serve`, which the SDK wraps to report a thrown error. Without a DSN the SDK stays silent. No stack
// traces and no Dedupe, for the reasons in `worker.ts`'s `sentryOptions`.
if (config.sentry) {
	Sentry.init({
		...config.sentry,
		attachStacktrace: false,
		integrations: defaults => defaults.filter(integration => integration.name !== 'Dedupe'),
	});
}

// One file per checkout, named after its directory: a worktree never shares the main checkout's data.
const root = join(import.meta.dir, '../..');
mkdirSync(join(root, '.data'), { recursive: true });
const file = join(root, '.data', `${basename(root)}.sqlite`);
const driver = bunSqlite(file);
const space = createSpace(driver, schema, config.space);
space.migrate();

/** Tells every device to pull when the request advanced the head, whether a phone or an agent wrote. */
async function nudging(run: () => Promise<Response>): Promise<Response> {
	const before = space.head();
	const response = await run();
	const head = space.head();
	if (head > before) server.publish('live', JSON.stringify({ head }));
	return response;
}

// No auth: the files are already in git, and the Worker never serves them.
const assets = assetRoutes(ASSETS_DIR);

type Socket = { ramble?: ReturnType<typeof serveLiveRamble> } | undefined;

const server = Bun.serve<Socket>({
	development: config.environment === 'development',
	idleTimeout: 120,
	port: env.API_PORT,
	fetch: (request, server) =>
		assets(request) ??
		handle<undefined>(request, {
			config,
			report: Sentry,
			async ramble(request) {
				if (server.upgrade(request, { data: {} })) return undefined;
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
				return nudging(() => handleSync(space, request));
			},
			agent: request =>
				nudging(() =>
					handleAgent(request, {
						space,
						driver,
						ownerToken: config.ownerToken,
						geminiApiKey: config.geminiApiKey,
						xaiApiKey: config.xaiApiKey,
					}),
				),
		}),
	websocket: {
		open(ws) {
			if (!ws.data) return void ws.subscribe('live');
			ws.data.ramble = serveLiveRamble(
				{ send: text => ws.send(text), close: (code, reason) => ws.close(code, reason) },
				{ gemini: config.geminiApiKey, xai: config.xaiApiKey! },
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

console.log(`Server running at ${server.url.href} over ${file}`);
console.log(`Sentry: ${config.sentry ? config.sentry.environment : 'off'}`);
