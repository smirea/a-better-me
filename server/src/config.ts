import devJwtKey from '../../powersync/local/INSECURE-dev-jwt-key.json' with { type: 'json' };

/**
 * Settings parsed once at the boundary. The Bun server reads them from the generated `env.ts`, the Worker from its
 * bindings, so this file imports neither. Secrets stay optional in the env schema so `env-manager gen --local` works
 * offline and in CI; production refuses to start without them instead of failing on the first request that reads one.
 * Development falls back to fixed local stand-ins that the local PowerSync trusts.
 */
export const REQUIRED_IN_PRODUCTION = ['OWNER_TOKEN', 'POWERSYNC_JWT_PRIVATE_KEY'] as const;

/** The owner bearer of every local server, the sync smoke, and the tests. Never valid in production. */
export const DEV_OWNER_TOKEN = 'insecure-local-dev-owner-token';

/** An Ed25519 private key as PowerSync and WebCrypto both read it. `kid` names it in the token header. */
export type SigningKey = { kty: 'OKP'; crv: 'Ed25519'; kid: string; x: string; d: string };

export type Environment = 'development' | 'production';

export type Settings = Partial<
	Record<'APP_ENV' | 'OWNER_TOKEN' | 'POWERSYNC_URL' | (typeof REQUIRED_IN_PRODUCTION)[number], string>
>;

export type Config = {
	environment: Environment;
	ownerToken: string;
	/** `url` is null when sync is off: the token route answers 503 and the proxy refuses. */
	powersync: { url: string | null; key: SigningKey };
};

function parseSigningKey(json: string): SigningKey {
	let key: Partial<SigningKey> | null;
	try {
		key = JSON.parse(json);
	} catch {
		throw new Error('POWERSYNC_JWT_PRIVATE_KEY is not JSON');
	}
	if (key?.kty !== 'OKP' || key.crv !== 'Ed25519') throw new Error('POWERSYNC_JWT_PRIVATE_KEY must be an Ed25519 JWK');
	for (const field of ['kid', 'x', 'd'] as const) {
		if (typeof key[field] !== 'string' || !key[field]) throw new Error(`POWERSYNC_JWT_PRIVATE_KEY lacks ${field}`);
	}
	return { kty: 'OKP', crv: 'Ed25519', kid: key.kid!, x: key.x!, d: key.d! };
}

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
	const url = read('POWERSYNC_URL');
	if (url && !URL.canParse(url)) throw new Error('POWERSYNC_URL is not a URL');
	const keyJson = read('POWERSYNC_JWT_PRIVATE_KEY');
	return {
		environment,
		ownerToken: read('OWNER_TOKEN') ?? DEV_OWNER_TOKEN,
		powersync: {
			url: url?.replace(/\/$/, '') ?? null,
			key: keyJson ? parseSigningKey(keyJson) : (devJwtKey as SigningKey),
		},
	};
}
