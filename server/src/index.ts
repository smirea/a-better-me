import { mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { bunSqlite } from 'sync-engine/bun-sqlite';
import { createSpace, handleSync, LIVE_PROTOCOL } from 'sync-engine/core';
import { schema } from '../../shared/db/schema';
import { handle } from './api';
import { parseConfig } from './config';
import env from './env';

const config = parseConfig(env);

// One file per checkout, named after its directory: a worktree never shares the main checkout's data.
const root = join(import.meta.dir, '../..');
mkdirSync(join(root, '.data'), { recursive: true });
const file = join(root, '.data', `${basename(root)}.sqlite`);
const space = createSpace(bunSqlite(file), schema);
space.migrate();

const server = Bun.serve({
	development: config.environment === 'development',
	idleTimeout: 120,
	port: env.API_PORT,
	fetch: (request, server) =>
		handle<undefined>(request, {
			config,
			async engine(request) {
				if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
					// Echo the subprotocol only when offered: the Swift client offers none and fails the handshake on an echo.
					const offered = request.headers
						.get('sec-websocket-protocol')
						?.split(',')
						.some(p => p.trim() === LIVE_PROTOCOL);
					const headers = offered ? { 'Sec-WebSocket-Protocol': LIVE_PROTOCOL } : undefined;
					if (server.upgrade(request, { headers })) return undefined;
					return Response.json({ ok: false, error: 'Expected a WebSocket upgrade' }, { status: 400 });
				}
				const before = space.head();
				const response = await handleSync(space, request);
				const head = space.head();
				if (head > before) server.publish('live', JSON.stringify({ head }));
				return response;
			},
		}),
	websocket: {
		open: ws => void ws.subscribe('live'),
		message(ws, message) {
			if (message === 'ping') ws.send('pong');
		},
	},
	error: error => {
		console.error(error);
		return Response.json({ ok: false, error: 'Internal error' }, { status: 500 });
	},
});

console.log(`Server running at ${server.url.href} over ${file}`);
