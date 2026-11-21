import type {
	DurableObjectNamespace,
	DurableObjectState,
	ExecutionContext,
	R2Bucket,
	ScheduledController,
} from '@cloudflare/workers-types';
import * as Sentry from '@sentry/cloudflare';
import { durableDriver, SpaceObject } from 'sync-engine/cloudflare';
import { schema } from '../../shared/db/schema';
import { agentApi } from './agent';
import { handle } from './api';
import { BACKUP_CRON, backup } from './backup';
import { parseConfig, type Config, type Settings } from './config';
import { liveRambleSetup, serveLiveRamble } from './food/ramble-live';
import { GARMIN_CRON, GarminSyncer } from './garmin/sync';
import { errorResponse } from './http';
import { imagesRoute, listedImages, moveSupplementImageRows, sweepImages } from './images';
import { SENTRY_DEFAULTS, withoutDedupe } from './sentry';

declare const WebSocketPair: typeof import('@cloudflare/workers-types').WebSocketPair;

type Env = Settings & { SPACE: DurableObjectNamespace; BACKUPS: R2Bucket; IMAGES: R2Bucket };

/**
 * The owner's one space. `/dump` is reachable only through the stub, which the Worker calls from the cron alone. The
 * agent API runs here, beside the rows and the bot tokens, on the request's original `/api` path.
 */
class OwnerSpace extends SpaceObject<Env> {
	private readonly agent;
	private readonly driver;
	private readonly garmin;
	/** The move of the old picture rows into the bucket, a batch beside each request until none are left. */
	private moving: Promise<boolean> = Promise.resolve(true);

	constructor(ctx: DurableObjectState, env: Env) {
		const config = configOf(env);
		super(ctx, env, schema, config.space);
		this.driver = durableDriver(ctx.storage);
		const publish = (head: number) => {
			for (const socket of this.ctx.getWebSockets()) {
				try {
					socket.send(JSON.stringify({ head }));
				} catch {
					// A socket mid-close throws on send, and it has no one left to nudge.
				}
			}
		};
		this.agent = agentApi({
			space: this.space,
			driver: this.driver,
			ownerToken: config.ownerToken,
			geminiApiKey: config.geminiApiKey,
			publish,
		});
		this.garmin = new GarminSyncer(
			this.space,
			this.driver,
			{ personalApiKey: config.garminPersonalApiKey, connectTokensJson: config.garminConnectTokens },
			publish,
		);
	}

	override async fetch(request: Request): Promise<Response> {
		// A move that fails is reported and tried again beside the next request; it never fails the request itself.
		this.moving = this.moving
			.then(async left => left && !!(await moveSupplementImageRows(this.driver, this.env.IMAGES)))
			.catch(error => {
				Sentry.captureException(error);
				return true;
			});
		await this.moving;
		const url = new URL(request.url);
		const { pathname } = url;
		if (pathname === '/dump') return Response.json(this.space.dump());
		if (pathname === '/ramble-live') return this.rambleLive();
		if (pathname === '/garmin/status') return Response.json(this.garmin.status());
		if (pathname === '/garmin/sync') return this.handleGarminSync(url);
		if (pathname !== '/api' && !pathname.startsWith('/api/')) return super.fetch(request);
		return this.agent(request);
	}

	private async handleGarminSync(url: URL): Promise<Response> {
		const force = url.searchParams.get('force') === '1' || url.searchParams.get('force') === 'true';
		const daysParam = url.searchParams.get('days');
		const tzParam = url.searchParams.get('tz') ?? undefined;
		const outcome = await this.garmin.sync({
			force,
			days: daysParam ? Number(daysParam) : undefined,
			timeZone: tzParam,
		});
		return Response.json(outcome);
	}

	/**
	 * Here rather than in the stateless Worker: a Durable Object's CPU budget resets with every message, while a
	 * Worker's covers the socket's whole life. The socket is accepted directly, not hibernated, so it stays out of
	 * `getWebSockets()`, which the sync nudge reads.
	 */
	private rambleLive(): Response {
		const setup = liveRambleSetup(configOf(this.env));
		if ('error' in setup) return errorResponse(503, setup.error);
		const { 0: client, 1: server } = new WebSocketPair();
		server.accept();
		const ramble = serveLiveRamble(
			{ send: text => server.send(text), close: (code, reason) => server.close(code, reason) },
			setup,
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
		...SENTRY_DEFAULTS,
		integrations: defaults => [
			...withoutDedupe(defaults),
			Sentry.cronTriggersIntegration({
				// A local `wrangler dev` run would open a development monitor that then misses every day.
				monitorSlug: cron => {
					if (sentry.environment !== 'production') return undefined;
					if (cron === BACKUP_CRON) return 'a-better-me-backup';
					if (cron === GARMIN_CRON) return 'a-better-me-garmin-sync';
					return undefined;
				},
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
			images: request => imagesRoute(request, env.IMAGES),
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
			garmin(request) {
				const url = new URL(request.url);
				url.pathname = url.pathname.slice('/api'.length);
				return owner(env).fetch(new Request(url, request));
			},
		});
	} catch (error) {
		console.error(error);
		Sentry.captureException(error);
		return errorResponse(500, 'Internal error');
	}
}

/** Daily R2 backup (`0 9 * * *`) and hourly Garmin sync (`0 * * * *`). */
async function scheduled(controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
	if (controller.cron === GARMIN_CRON) {
		const res = await owner(env).fetch('https://space/garmin/sync');
		const outcome = await res.json();
		console.log('Garmin hourly sync:', JSON.stringify(outcome));
		return;
	}
	if (controller.cron !== BACKUP_CRON) throw new Error(`No job for cron ${controller.cron}`);
	const tables = (await (await owner(env).fetch('https://space/dump')).json()) as Record<string, unknown[]>;
	const at = new Date(controller.scheduledTime);
	console.log(`Backed up the space to ${await backup(tables, env.BACKUPS, at)}`);
	const swept = await sweepImages(env.IMAGES, listedImages(tables), at);
	console.log(`Swept ${swept.length} pictures no row lists`);
}

export const Space = Sentry.instrumentDurableObjectWithSentry(sentryOptions, OwnerSpace);

export default Sentry.withSentry(sentryOptions, { fetch, scheduled } as never);
