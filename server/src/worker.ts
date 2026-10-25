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

/** The Cloudflare entry `wrangler.jsonc` names. The Bun server in `index.ts` serves the same `handle`. */

type Env = Settings & { SPACE: DurableObjectNamespace; BACKUPS: R2Bucket };

/**
 * The owner's one space. `/dump` is reachable only through the stub, which the Worker calls from the cron alone. The
 * agent API runs here, beside the rows and the bot tokens, on the request's original `/api` path.
 */
class OwnerSpace extends SpaceObject<Env> {
	private readonly driver;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, schema);
		this.driver = durableDriver(ctx.storage);
	}

	override async fetch(request: Request): Promise<Response> {
		const { pathname } = new URL(request.url);
		if (pathname === '/dump') return Response.json(this.space.dump());
		if (pathname !== '/api' && !pathname.startsWith('/api/')) return super.fetch(request);
		const before = this.space.head();
		const response = await handleAgent(request, {
			space: this.space,
			driver: this.driver,
			ownerToken: configOf(this.env).ownerToken,
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
		integrations: [
			Sentry.cronTriggersIntegration({
				monitorSlug: cron => (cron === BACKUP_CRON ? 'a-better-me-backup' : undefined),
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
