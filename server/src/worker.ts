import type {
	DurableObjectNamespace,
	DurableObjectState,
	ExecutionContext,
	R2Bucket,
	ScheduledController,
} from '@cloudflare/workers-types';
import * as Sentry from '@sentry/cloudflare';
import { durableDriver, SpaceObject } from 'sync-engine/cloudflare';
import { handleAgent } from './agent';
import { schema } from '../../shared/db/schema';
import { handle } from './api';
import { BACKUP_CRON, backup } from './backup';
import { parseConfig, type Config, type Settings } from './config';
import { serveLiveRamble } from './food/ramble-live';

declare const WebSocketPair: typeof import('@cloudflare/workers-types').WebSocketPair;

/** The Cloudflare entry `wrangler.jsonc` names. The Bun server in `index.ts` serves the same `handle`. */

type Env = Settings & { SPACE: DurableObjectNamespace; BACKUPS: R2Bucket };

/**
 * The owner's one space. `/dump` is reachable only through the stub, which the Worker calls from the cron alone. The
 * agent API runs here, beside the rows and the bot tokens, on the request's original `/api` path.
 */
class OwnerSpace extends SpaceObject<Env> {
	private readonly driver;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, schema, configOf(env).space);
		this.driver = durableDriver(ctx.storage);
	}

	override async fetch(request: Request): Promise<Response> {
		const { pathname } = new URL(request.url);
		if (pathname === '/dump') return Response.json(this.space.dump());
		if (pathname === '/ramble-live') return this.rambleLive();
		if (pathname !== '/api' && !pathname.startsWith('/api/')) return super.fetch(request);
		const before = this.space.head();
		const response = await handleAgent(request, {
			space: this.space,
			driver: this.driver,
			ownerToken: configOf(this.env).ownerToken,
			geminiApiKey: configOf(this.env).geminiApiKey,
		});
		const head = this.space.head();
		if (head > before) {
			for (const socket of this.ctx.getWebSockets()) {
				try {
					socket.send(JSON.stringify({ head }));
				} catch {
					// A socket mid-close throws on send, and it has no one left to nudge.
				}
			}
		}
		return response;
	}

	/**
	 * Here rather than in the stateless Worker: a Durable Object's CPU budget resets with every message, while a
	 * Worker's covers the socket's whole life. The socket is accepted directly, not hibernated, so it stays out of
	 * `getWebSockets()`, which the sync nudge reads.
	 */
	private rambleLive(): Response {
		const { 0: client, 1: server } = new WebSocketPair();
		server.accept();
		const ramble = serveLiveRamble(
			{ send: text => server.send(text), close: (code, reason) => server.close(code, reason) },
			configOf(this.env).geminiApiKey!,
		);
		// Binary frames arrive as Blobs here; reading one is async, so a chain keeps the frames and the stop in order.
		let order = Promise.resolve();
		server.addEventListener('message', event => {
			const data = event.data as string | ArrayBuffer | Blob;
			order = order.then(async () => ramble.message(data instanceof Blob ? await data.arrayBuffer() : data));
		});
		server.addEventListener('close', () => ramble.close());
		return new Response(null, { status: 101, webSocket: client } as ResponseInit);
	}
}

const configs = new WeakMap<Env, Config>();
/** Parsed once per bindings object, which the runtime keeps for the isolate's life. */
function configOf(env: Env): Config {
	let config = configs.get(env);
	if (!config) {
		config = parseConfig(env);
		configs.set(env, config);
	}
	return config;
}

/**
 * Reporting to `a-better-me-worker`, with a cron monitor so a backup that never runs alerts, not only one that throws.
 * A config that does not parse turns Sentry off here, so that `fetch` answers the 500 that names the missing setting.
 */
function sentryOptions(env: Env): Sentry.CloudflareOptions {
	let sentry: Config['sentry'];
	try {
		sentry = configOf(env).sentry;
	} catch {
		return { enabled: false };
	}
	if (!sentry) return { enabled: false };
	return {
		...sentry,
		// A message without a stack trace keeps its own text as the issue title, not the calling function's name.
		attachStacktrace: false,
		integrations: defaults => [
			// Dedupe drops an event equal to the one before it, which is every refusal after the first in a run.
			...defaults.filter(integration => integration.name !== 'Dedupe'),
			Sentry.cronTriggersIntegration({
				// A local `wrangler dev` run would open a development monitor that then misses every day.
				monitorSlug: cron =>
					cron === BACKUP_CRON && sentry.environment === 'production' ? 'a-better-me-backup' : undefined,
			}),
		],
	};
}

/** The stub speaks the Workers Request and Response types, which this tsconfig's Bun globals do not know. */
const owner = (env: Env) =>
	env.SPACE.get(env.SPACE.idFromName('owner')) as unknown as { fetch(input: Request | string): Promise<Response> };

async function fetch(request: Request, env: Env): Promise<Response> {
	try {
		// Before routing, so a misconfigured deploy fails every request and logs the missing setting.
		const config = configOf(env);
		return await handle(request, {
			config,
			report: Sentry,
			engine(request) {
				const url = new URL(request.url);
				url.pathname = url.pathname.slice('/api'.length);
				return owner(env).fetch(new Request(url, request));
			},
			agent: request => owner(env).fetch(request),
			ramble(request) {
				const url = new URL(request.url);
				url.pathname = '/ramble-live';
				return owner(env).fetch(new Request(url, request));
			},
		});
	} catch (error) {
		console.error(error);
		Sentry.captureException(error);
		return Response.json({ ok: false, error: 'Internal error' }, { status: 500 });
	}
}

/** The daily dump to R2. A throw marks the cron run failed in the Cloudflare dashboard. */
async function scheduled(controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
	if (controller.cron !== BACKUP_CRON) throw new Error(`No job for cron ${controller.cron}`);
	const tables = (await (await owner(env).fetch('https://space/dump')).json()) as Record<string, unknown[]>;
	console.log(`Backed up the space to ${await backup(tables, env.BACKUPS, new Date(controller.scheduledTime))}`);
}

export const Space = Sentry.instrumentDurableObjectWithSentry(sentryOptions, OwnerSpace);

export default Sentry.withSentry(sentryOptions, { fetch, scheduled } as never);
