/**
 * Preloaded by `bun test`. In procrastimate, a shell with a cloud environment loaded once filled a shared database
 * with test users. Refuse to start unless the database is local.
 */
export function remoteDatabaseReason(env: Record<string, string | undefined>): string | null {
	const url = env.DATABASE_URL ?? '';
	if (!url) return null;
	let host: string;
	try {
		host = new URL(url).hostname;
	} catch {
		return `Refusing to run tests: DATABASE_URL is not a URL (${url}).`;
	}
	if (host === '127.0.0.1' || host === 'localhost' || host === '[::1]') return null;
	return `Refusing to run tests against a remote database (${host}). Unset DATABASE_URL or point it at the local Docker Postgres.`;
}

const reason = remoteDatabaseReason(process.env);
if (reason) {
	console.error(reason);
	process.exit(1);
}
