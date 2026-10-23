import type { Config } from './config';
import type { Db } from './db/postgres';
import { POWERSYNC_PATH, powersyncProxy, signSyncToken } from './sync';
import { upload } from './upload';

export type App = { config: Config; db: Db };

const error = (status: number, message: string) => Response.json({ ok: false, error: message }, { status });

/** Compares SHA-256 digests byte by byte without stopping early, so the time taken says nothing about the token. */
async function isOwner(request: Request, token: string): Promise<boolean> {
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
 * Bun and Node APIs. Only `/status` and the PowerSync proxy are open; the proxy's caller carries PowerSync's own token.
 */
export async function handle(request: Request, app: App): Promise<Response> {
	const url = new URL(request.url);
	const route = `${request.method} ${url.pathname}`;
	if (route === 'GET /status') return Response.json({ ok: true });
	if (url.pathname.startsWith(`${POWERSYNC_PATH}/`)) {
		if (!app.config.powersync.url) return error(503, 'Sync is off');
		return powersyncProxy(request, app.config.powersync.url);
	}
	if (route !== 'GET /api/sync/token' && route !== 'POST /api/upload') return error(404, 'Not found');
	if (!(await isOwner(request, app.config.ownerToken))) return error(401, 'Missing or wrong owner token');

	if (route === 'GET /api/sync/token') {
		if (!app.config.powersync.url) return error(503, 'Sync is off');
		return Response.json({
			token: await signSyncToken(app.config.powersync.key),
			endpoint: `${url.origin}${POWERSYNC_PATH}`,
		});
	}

	const body: unknown = await request.json().catch(() => null);
	const writes = (body as { writes?: unknown } | null)?.writes;
	if (!Array.isArray(writes)) return error(400, 'Expected { writes: [...] }');
	return Response.json(await upload(app.db, writes));
}
