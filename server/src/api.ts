import { withBearer, type SyncResponse } from 'sync-engine/core';
import type { Config } from './config';

/**
 * The two calls `handle` makes on a Sentry SDK. `index.ts` passes `@sentry/bun`, `worker.ts` `@sentry/cloudflare`,
 * and either does nothing until its SDK is initialized.
 */
export type Report = {
	captureMessage(
		message: string,
		context: { level: 'warning'; extra: Record<string, unknown>; fingerprint: string[] },
	): unknown;
	captureException(error: unknown, context: { extra: Record<string, unknown> }): unknown;
};

/**
 * `engine` is the sync engine behind `POST /api/sync` and `GET /api/live`, reached only after the owner check: the
 * Worker forwards to its Durable Object, the Bun server runs a space in-process. `Upgraded` is what a host answers
 * once it has taken over the socket (Bun returns nothing after `server.upgrade`); the Worker always has a Response.
 * `agent` is every other `/api` route, run where the space lives, which checks its own tokens (`agent/index.ts`).
 */
export type App<Upgraded = never> = {
	config: Config;
	report: Report;
	engine(request: Request): Promise<Response | Upgraded>;
	agent(request: Request): Promise<Response>;
	/** `GET /api/food-database/ramble/live`, the live Ramble socket (`food/ramble-live.ts`), after the owner check. */
	ramble?(request: Request): Promise<Response | Upgraded>;
};

export const RAMBLE_LIVE_ROUTE = 'GET /api/food-database/ramble/live';

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
 * Bun and Node APIs. Every route needs a token, the owner's for the engine and the owner's or a bot's for the agent
 * API, except `GET /api`, which only explains how to get one.
 * The engine sees the original request, which Bun needs for the upgrade;
 * `withBearer` only matters for a browser's `/live`, whose token rides in the subprotocol.
 */
export async function handle<Upgraded = never>(request: Request, app: App<Upgraded>): Promise<Response | Upgraded> {
	const url = new URL(request.url);
	const route = `${request.method} ${url.pathname}`;
	if (route === RAMBLE_LIVE_ROUTE) {
		if (!(await isOwner(request, app.config.ownerToken))) return error(401, 'Missing or wrong owner token');
		if (!app.config.geminiApiKey || !app.config.xaiApiKey)
			return error(503, 'Live Ramble needs GEMINI_API_KEY and XAI_API_KEY on the server');
		if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
			return error(426, 'Expected a WebSocket upgrade');
		return app.ramble ? app.ramble(request) : error(501, 'This host has no live ramble');
	}
	if (route !== 'POST /api/sync' && route !== 'GET /api/live') {
		if (url.pathname !== '/api' && !url.pathname.startsWith('/api/')) return error(404, 'Not found');
		return reportFailure(route, await app.agent(request), app.report);
	}
	if (!(await isOwner(withBearer(request), app.config.ownerToken))) return error(401, 'Missing or wrong owner token');
	const response = await app.engine(request);
	if (!(response instanceof Response)) return response;
	if (route === 'POST /api/sync' && response.status === 200) return reportRejected(response, app.report);
	return reportFailure(route, response, app.report);
}

/** A 5xx is a server bug. A thrown error never reaches here: Bun's SDK and the Worker's catch report it. */
function reportFailure(route: string, response: Response, report: Report): Response {
	if (response.status >= 500) {
		report.captureException(new Error(`${route} answered ${response.status}`), {
			extra: { route, status: response.status },
		});
	}
	return response;
}

/**
 * The engine answers 200 even when it refuses writes, and the refused rows are dropped on the device, so a warning is
 * their only lasting trace. The body is read once and handed back unchanged.
 */
async function reportRejected(response: Response, report: Report): Promise<Response> {
	const body = await response.text();
	const { rejected } = JSON.parse(body) as SyncResponse;
	if (rejected.length) {
		const tables = [...new Set(rejected.map(write => write.table))].sort().join(', ');
		// One issue per set of tables, whichever runtime and stack sent it.
		report.captureMessage(`Sync rejected writes to ${tables}`, {
			level: 'warning',
			extra: { rejected },
			fingerprint: ['sync-rejected', tables],
		});
	}
	return new Response(body, response);
}
