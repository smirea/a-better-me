import type { SigningKey } from './config';

/**
 * PowerSync's two server halves. The token tells PowerSync a device belongs to the owner: an EdDSA JWT signed with
 * `POWERSYNC_JWT_PRIVATE_KEY`, whose public half every PowerSync config lists inline, so PowerSync never calls back
 * into the server. The proxy keeps a device on one origin.
 */

export const TOKEN_AUDIENCE = 'powersync';
export const TOKEN_SUBJECT = 'owner';
export const TOKEN_SECONDS = 60 * 60;
export const POWERSYNC_PATH = '/api/powersync';

const base64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
const encodeJson = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));

const imported = new WeakMap<SigningKey, Promise<CryptoKey>>();
function cryptoKey(key: SigningKey): Promise<CryptoKey> {
	let created = imported.get(key);
	if (!created) {
		const { kty, crv, x, d } = key;
		created = crypto.subtle.importKey('jwk', { kty, crv, x, d }, { name: 'Ed25519' }, false, ['sign']);
		imported.set(key, created);
	}
	return created;
}

/** `{ alg: 'EdDSA', kid }` over `{ sub: 'owner', aud: 'powersync', iat, exp }`, an hour long. */
export async function signSyncToken(key: SigningKey, now = Date.now()): Promise<string> {
	const iat = Math.floor(now / 1000);
	const header = encodeJson({ alg: 'EdDSA', typ: 'JWT', kid: key.kid });
	const claims = encodeJson({ sub: TOKEN_SUBJECT, aud: TOKEN_AUDIENCE, iat, exp: iat + TOKEN_SECONDS });
	const input = `${header}.${claims}`;
	const signature = await crypto.subtle.sign('Ed25519', await cryptoKey(key), new TextEncoder().encode(input));
	return `${input}.${base64url(new Uint8Array(signature))}`;
}

/**
 * Forwards `/api/powersync/<path>` to the PowerSync service, the streaming sync response included. PowerSync is asked
 * for an identity encoding and the response loses `content-encoding` and `content-length`: the runtime decompresses
 * the body but keeps the headers, and a client then closes every stream. The path is appended to the upstream's,
 * never resolved against it: `//evil.example/x` would otherwise name another host. The owner bearer never leaves the
 * server; PowerSync reads only its own `Token`.
 */
export async function powersyncProxy(request: Request, upstream: string): Promise<Response> {
	const url = new URL(request.url);
	const target = new URL(upstream);
	target.pathname = `${target.pathname.replace(/\/$/, '')}${url.pathname.slice(POWERSYNC_PATH.length)}`;
	target.search = url.search;
	const headers = new Headers(request.headers);
	headers.delete('host');
	headers.delete('cookie');
	headers.set('accept-encoding', 'identity');
	const response = await fetch(target, {
		method: request.method,
		headers,
		body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
		// @ts-expect-error Bun and workerd both stream a request body with duplex half.
		duplex: 'half',
	});
	const out = new Headers(response.headers);
	out.delete('content-encoding');
	out.delete('content-length');
	return new Response(response.body, { status: response.status, headers: out });
}
