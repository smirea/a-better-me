/**
 * `wrangler dev` against this checkout's local stack, so the Worker build runs the same sync smoke as the Bun server:
 * `bun scripts/wrangler-dev.ts [wrangler dev args]`, then `bun scripts/sync-smoke.ts --api http://127.0.0.1:<base + 3>`.
 * It runs as development, with the local owner token and signing key, on the checkout's base port + 3.
 * `--local-upstream` keeps the request's own origin: by default wrangler rewrites it to the custom domain.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDotenv, readOverride } from './lib';

const root = join(import.meta.dir, '..');
const override = readOverride(root);
if (!override?.DATABASE_URL || !override.POWERSYNC_URL) {
	throw new Error('.env.override lacks DATABASE_URL or POWERSYNC_URL. Run `bun scripts/local-stack.ts` first.');
}
const base = override.CLIENT_PORT ?? parseDotenv(readFileSync(join(root, '.env'), 'utf8')).CLIENT_PORT;
const port = String(Number(base) + 3);
const result = spawnSync(
	'bunx',
	[
		'wrangler',
		'dev',
		'--var',
		'APP_ENV:development',
		'--var',
		`POWERSYNC_URL:${override.POWERSYNC_URL}`,
		'--port',
		port,
		'--local-upstream',
		`127.0.0.1:${port}`,
		...process.argv.slice(2),
	],
	{
		stdio: 'inherit',
		env: { ...process.env, CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: override.DATABASE_URL },
	},
);
process.exit(result.status ?? 1);
