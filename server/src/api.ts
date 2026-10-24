import { withBearer } from 'sync-engine/core';
import type { Config } from './config';

/**
 * `engine` is the sync engine behind `POST /api/sync` and `GET /api/live`, reached only after the owner check: the
 * Worker forwards to its Durable Object, the Bun server runs a space in-process. `Upgraded` is what a host answers
 * once it has taken over the socket (Bun returns nothing after `server.upgrade`); the Worker always has a Response.
 */
export type App<Upgraded = never> = { config: Config; engine(request: Request): Promise<Response | Upgraded> };

const error = (status: number, message: string) => Response.json({ ok: false, error: message }, { status });

/** Compares SHA-256 digests byte by byte without stopping early, so the time taken says nothing about the token. */
export async function isOwner(request: Request, token: string): Promise<boolean> {
	const given = /^Bearer (.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
	if (!given) return false;
	const encoder = new TextEncoder();
	const [a, b] = await Promise.all(
		[given, token].map(async value => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))),
	);
	let difference = 0;
	for (let index = 0; index < a!.length; index++) difference |= a![index]! ^ b![index]!;
	return difference === 0;
}

/**
 * Every route, as one fetch handler: `index.ts` serves it with Bun and `worker.ts` on Cloudflare, so it stays free of
 * Bun and Node APIs. Only `/status` is open. The engine sees the original request, which Bun needs for the upgrade;
 * `withBearer` only matters for a browser's `/live`, whose token rides in the subprotocol.
 */
export async function handle<Upgraded = never>(request: Request, app: App<Upgraded>): Promise<Response | Upgraded> {
	const url = new URL(request.url);
	const route = `${request.method} ${url.pathname}`;
	if (route === 'GET /status') return Response.json({ ok: true });
	if (route !== 'POST /api/sync' && route !== 'GET /api/live') return error(404, 'Not found');
	if (!(await isOwner(withBearer(request), app.config.ownerToken))) return error(401, 'Missing or wrong owner token');
	return app.engine(request);
}
