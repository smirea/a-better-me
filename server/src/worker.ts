import type { ExecutionContext, Hyperdrive, R2Bucket, ScheduledController } from '@cloudflare/workers-types';
import { handle } from './api';
import { parseConfig, type Config, type Settings } from './config';
import { BACKUP_CRON, backupDatabase } from './db/backup';
import { migrate } from './db/migrate';
import { connect, type Db } from './db/postgres';

/** The Cloudflare entry `wrangler.jsonc` names. The Bun server in `index.ts` serves the same `handle`. */

type Env = Settings & { HYPERDRIVE: Hyperdrive; BACKUPS: R2Bucket };

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

let migrated: Promise<unknown> | null = null;
/** Once per isolate, under the migrator's advisory lock, so a deploy's first requests race nobody. */
function migrateOnce(db: Db) {
	migrated ??= migrate(db).catch(error => {
		migrated = null;
		throw error;
	});
	return migrated;
}

async function fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	const { db, end } = connect(env.HYPERDRIVE.connectionString);
	try {
		// Before routing, so a misconfigured deploy fails every request and logs the missing setting.
		const config = configOf(env);
		await migrateOnce(db);
		return await handle(request, { config, db });
	} catch (error) {
		console.error(error);
		return Response.json({ ok: false, error: 'Internal error' }, { status: 500 });
	} finally {
		ctx.waitUntil(end());
	}
}

/** The daily dump to R2. A throw marks the cron run failed in the Cloudflare dashboard. */
async function scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
	if (controller.cron !== BACKUP_CRON) throw new Error(`No job for cron ${controller.cron}`);
	const { db, end } = connect(env.HYPERDRIVE.connectionString);
	try {
		await migrateOnce(db);
		console.log(`Backed up Postgres to ${await backupDatabase(db, env.BACKUPS, new Date(controller.scheduledTime))}`);
	} finally {
		ctx.waitUntil(end());
	}
}

export default { fetch, scheduled };
