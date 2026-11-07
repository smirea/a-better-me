const encoder = new TextEncoder();
const digest = async (text: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));

/** Compares SHA-256 digests byte by byte without stopping early, so the time taken says nothing about the token. */
export async function isOwner(request: Request, token: string): Promise<boolean> {
	const given = /^Bearer (.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
	if (!given) return false;
	const [a, b] = await Promise.all([digest(given), digest(token)]);
	let difference = 0;
	for (let index = 0; index < a.length; index++) difference |= a[index]! ^ b[index]!;
	return difference === 0;
}

export async function sha256Hex(text: string): Promise<string> {
	return [...(await digest(text))].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
