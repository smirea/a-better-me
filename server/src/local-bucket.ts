import type { R2Bucket, R2HTTPMetadata } from '@cloudflare/workers-types';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type Meta = { etag: string; httpMetadata: R2HTTPMetadata; size: number };

/**
 * The pictures bucket outside Cloudflare, for the Bun server and the tests: a folder that answers the part of R2's
 * binding `images.ts` uses, a create-only put included. `dir` is where it keeps the objects, or null for a temporary
 * folder removed when the process exits. Wrangler's own emulation runs a `workerd` process that outlives the server
 * (procrastimate tried it), and the real binding still runs under `bun scripts/wrangler-dev.ts`.
 */
export function localBucket(dir: string | null): R2Bucket {
	const root = dir ?? mkdtempSync(join(tmpdir(), 'a-better-me-bucket-'));
	if (!dir) process.on('exit', () => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, 'bytes'), { recursive: true });
	mkdirSync(join(root, 'meta'), { recursive: true });
	const bytes = (key: string) => Bun.file(join(root, 'bytes', key));
	const meta = (key: string) => Bun.file(join(root, 'meta', `${key}.json`));

	const head = async (key: string) => {
		const stored = meta(key);
		if (!(await stored.exists())) return null;
		const { etag, httpMetadata, size } = (await stored.json()) as Meta;
		return { key, size, etag, httpEtag: `"${etag}"`, httpMetadata };
	};

	const bucket = {
		head,
		async get(key: string, options: { onlyIf?: Headers } = {}) {
			const object = await head(key);
			if (!object) return null;
			if (options.onlyIf?.get('if-none-match') === object.httpEtag) return object;
			return { ...object, body: bytes(key).stream(), json: () => bytes(key).json() };
		},
		async put(key: string, value: unknown, options: { onlyIf?: Headers; httpMetadata?: R2HTTPMetadata } = {}) {
			if (options.onlyIf?.get('if-none-match') === '*' && (await head(key))) return null;
			const data = new Uint8Array(await new Response(value as BodyInit).arrayBuffer());
			await Bun.write(bytes(key), data);
			const stored: Meta = {
				etag: createHash('md5').update(data).digest('hex'),
				httpMetadata: options.httpMetadata ?? {},
				size: data.byteLength,
			};
			await Bun.write(meta(key), JSON.stringify(stored));
			return head(key);
		},
		async list() {
			const keys = readdirSync(join(root, 'meta'))
				.filter(name => name.endsWith('.json'))
				.map(name => name.slice(0, -'.json'.length))
				.sort();
			return { objects: keys.map(key => ({ key })), truncated: false };
		},
		async delete(keys: string | string[]) {
			for (const key of [keys].flat()) {
				rmSync(join(root, 'bytes', key), { force: true });
				rmSync(join(root, 'meta', `${key}.json`), { force: true });
			}
		},
	};
	return bucket as unknown as R2Bucket;
}
