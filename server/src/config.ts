/**
 * Settings parsed once at the boundary. The Bun server reads them from the generated `env.ts`, the Worker from its
 * bindings, so this file imports neither. Secrets stay optional in the env schema so `env-manager gen --local` works
 * offline and in CI; production refuses to start without them instead of failing on the first request that reads one.
 */
export const REQUIRED_IN_PRODUCTION = ['OWNER_TOKEN', 'SENTRY_DSN'] as const;

/** The owner bearer of every local server and the tests. Never valid in production. */
export const DEV_OWNER_TOKEN = 'insecure-local-dev-owner-token';

export type Environment = 'development' | 'production';

export type Settings = Partial<Record<'APP_ENV' | (typeof REQUIRED_IN_PRODUCTION)[number], string>>;

/** Sentry project `a-better-me-worker`, reported under the server's own environment. Null turns reporting off. */
export type SentryTarget = { dsn: string; environment: Environment };

export type Config = { environment: Environment; ownerToken: string; sentry: SentryTarget | null };

const DSN = /^https:\/\/[0-9a-f]+@[^/@\s]+\/\d+$/;

export function parseConfig(settings: Settings): Config {
	const read = (key: keyof Settings) => settings[key]?.trim() || undefined;
	const environment = read('APP_ENV') ?? 'development';
	if (environment !== 'development' && environment !== 'production') {
		throw new Error(`APP_ENV must be development or production, not "${environment}"`);
	}
	if (environment === 'production') {
		const missing = REQUIRED_IN_PRODUCTION.filter(key => !read(key));
		if (missing.length) throw new Error(`Missing production settings: ${missing.join(', ')}`);
		if (read('OWNER_TOKEN') === DEV_OWNER_TOKEN) throw new Error('OWNER_TOKEN is the local development token');
	}
	const dsn = read('SENTRY_DSN');
	if (dsn && !DSN.test(dsn)) throw new Error('SENTRY_DSN is not a Sentry DSN (https://<key>@<host>/<project>)');
	return {
		environment,
		ownerToken: read('OWNER_TOKEN') ?? DEV_OWNER_TOKEN,
		sentry: dsn ? { dsn, environment } : null,
	};
}
