import { handle } from './api';
import { parseConfig } from './config';
import { migrate } from './db/migrate';
import { connect } from './db/postgres';
import env from './env';

const config = parseConfig(env);
if (!env.DATABASE_URL) {
	throw new Error(
		'DATABASE_URL is not set. Run `bun scripts/setup-worktree.ts` in a worktree or `bun scripts/local-stack.ts` in the main checkout.',
	);
}
const { db } = connect(env.DATABASE_URL);
const applied = await migrate(db);
if (applied.length) console.log('Applied migrations:', applied.join(', '));

const server = Bun.serve({
	development: config.environment === 'development',
	idleTimeout: 120,
	port: env.API_PORT,
	fetch: request => handle(request, { config, db }),
	error: error => {
		console.error(error);
		return Response.json({ ok: false, error: 'Internal error' }, { status: 500 });
	},
});

console.log('Server running at:', server.url);
