/**
 * `wrangler dev` for this checkout, so the Worker build answers the same `/api/sync` round trip as the Bun server:
 * `bun scripts/wrangler-dev.ts [wrangler dev args]`. It runs as development, with the local owner token, on the
 * checkout's base port + 2, and keeps its Durable Object state under `.wrangler/`.
 * `--local-upstream` keeps the request's own origin: by default wrangler rewrites it to the custom domain.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDotenv, readOverride } from './lib';

const root = join(import.meta.dir, '..');
const base = readOverride(root)?.CLIENT_PORT ?? parseDotenv(readFileSync(join(root, '.env'), 'utf8')).CLIENT_PORT;
const port = String(Number(base) + 2);
const result = spawnSync(
	'bunx',
	[
		'wrangler',
		'dev',
		'--var',
		'APP_ENV:development',
		'--port',
		port,
		'--local-upstream',
		`127.0.0.1:${port}`,
		...process.argv.slice(2),
	],
	{ stdio: 'inherit' },
);
process.exit(result.status ?? 1);
