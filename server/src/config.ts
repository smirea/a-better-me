import type { SpaceOptions } from 'sync-engine/core';

/**
 * Settings parsed once at the boundary. The Bun server reads them from the generated `env.ts`, the Worker from its
 * bindings, so this file imports neither. Secrets stay optional in the env schema so `env-manager gen --local` works
 * offline and in CI; production refuses to start without them instead of failing on the first request that reads one.
 */
export const REQUIRED_IN_PRODUCTION = ['OWNER_TOKEN', 'SENTRY_DSN', 'GEMINI_API_KEY', 'XAI_API_KEY'] as const;

/** The owner bearer of every local server and the tests. Never valid in production. */
export const DEV_OWNER_TOKEN = 'insecure-local-dev-owner-token';

/** Development-only knobs to see paging and compaction locally; production keeps the engine defaults. */
const SPACE_SETTINGS = {
	SYNC_PAGE_SIZE: 'pageSize',
	SYNC_RETENTION_MS: 'retention',
	SYNC_COMPACT_EVERY_MS: 'compactEvery',
} as const satisfies Record<string, keyof SpaceOptions>;

export type Environment = 'development' | 'production';

type SpaceSetting = keyof typeof SPACE_SETTINGS;
type TextSetting = 'APP_ENV' | (typeof REQUIRED_IN_PRODUCTION)[number];

/** The generated `env.ts` parses the space settings to numbers; Worker bindings arrive as strings. */
export type Settings = Partial<Record<TextSetting, string> & Record<SpaceSetting, string | number>>;

/** Sentry project `a-better-me-worker`, reported under the server's own environment. Null turns reporting off. */
export type SentryTarget = { dsn: string; environment: Environment };

export type Config = {
	environment: Environment;
	ownerToken: string;
	sentry: SentryTarget | null;
	space: SpaceOptions;
	/** Photo logging's and Ramble's Gemini key. Null in development without one, where the photo route answers 503. */
	geminiApiKey: string | null;
	/** Ramble's speech-to-text and fallback reads. Null in development without one, where live Ramble answers 503. */
	xaiApiKey: string | null;
};

const DSN = /^https:\/\/[0-9a-f]+@[^/@\s]+\/\d+$/;

export function parseConfig(settings: Settings): Config {
	const read = (key: TextSetting) => settings[key]?.trim() || undefined;
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
	if (environment === 'production' && dsn && !DSN.test(dsn))
		throw new Error('SENTRY_DSN is not a Sentry DSN (https://<key>@<host>/<project>)');
	const set = (Object.keys(SPACE_SETTINGS) as SpaceSetting[]).filter(name => String(settings[name] ?? '').trim());
	if (environment === 'production' && set.length) {
		throw new Error(`Space settings are development only: ${set.join(', ')}`);
	}
	const space: SpaceOptions = {};
	for (const name of set) {
		const value = Number(settings[name]);
		if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
		space[SPACE_SETTINGS[name]] = value;
	}
	return {
		environment,
		ownerToken: read('OWNER_TOKEN') ?? DEV_OWNER_TOKEN,
		sentry: environment === 'production' && dsn ? { dsn, environment } : null,
		space,
		geminiApiKey: read('GEMINI_API_KEY') ?? null,
		xaiApiKey: read('XAI_API_KEY') ?? null,
	};
}
