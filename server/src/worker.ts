import type {
	DurableObjectNamespace,
	DurableObjectState,
	ExecutionContext,
	R2Bucket,
	ScheduledController,
} from '@cloudflare/workers-types';
import { SpaceObject } from 'sync-engine/cloudflare';
import { schema } from '../../shared/db/schema';
import { handle } from './api';
import { BACKUP_CRON, backup } from './backup';
import { parseConfig, type Config, type Settings } from './config';

/** The Cloudflare entry `wrangler.jsonc` names. The Bun server in `index.ts` serves the same `handle`. */

type Env = Settings & { SPACE: DurableObjectNamespace; BACKUPS: R2Bucket };

/** The owner's one space. `/dump` is reachable only through the stub, which the Worker calls from the cron alone. */
export class Space extends SpaceObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env, schema);
	}

	override fetch(request: Request): Promise<Response> {
		if (new URL(request.url).pathname === '/dump') return Promise.resolve(Response.json(this.space.dump()));
		return super.fetch(request);
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

/** The stub speaks the Workers Request and Response types, which this tsconfig's Bun globals do not know. */
const owner = (env: Env) =>
	env.SPACE.get(env.SPACE.idFromName('owner')) as unknown as { fetch(input: Request | string): Promise<Response> };

async function fetch(request: Request, env: Env): Promise<Response> {
	try {
		// Before routing, so a misconfigured deploy fails every request and logs the missing setting.
		const config = configOf(env);
		return await handle(request, {
			config,
			engine(request) {
				const url = new URL(request.url);
				url.pathname = url.pathname.slice('/api'.length);
				return owner(env).fetch(new Request(url, request));
			},
		});
	} catch (error) {
		console.error(error);
		return Response.json({ ok: false, error: 'Internal error' }, { status: 500 });
	}
}

/** The daily dump to R2. A throw marks the cron run failed in the Cloudflare dashboard. */
async function scheduled(controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
	if (controller.cron !== BACKUP_CRON) throw new Error(`No job for cron ${controller.cron}`);
	const tables = (await (await owner(env).fetch('https://space/dump')).json()) as Record<string, unknown[]>;
	console.log(`Backed up the space to ${await backup(tables, env.BACKUPS, new Date(controller.scheduledTime))}`);
}

export default { fetch, scheduled };
