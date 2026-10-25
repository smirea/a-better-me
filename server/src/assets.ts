import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** The large catalog files the iOS app downloads instead of bundling. */
export const ASSETS_DIR = join(import.meta.dir, '../../app-ios/Assets');

export type ManifestFile = { path: string; sha256: string; size: number };
export type Manifest = { version: string; files: ManifestFile[] };

const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');

function walk(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
		if (entry.name.startsWith('.')) return [];
		const path = join(dir, entry.name);
		return entry.isDirectory() ? walk(path) : [path];
	});
}

export function computeManifest(dir: string): Manifest {
	const files = walk(dir)
		.map(file => {
			const bytes = readFileSync(file);
			return { path: relative(dir, file).split('\\').join('/'), sha256: sha256(bytes), size: bytes.length };
		})
		.toSorted((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
	return { version: sha256(JSON.stringify(files)).slice(0, 16), files };
}

const MANIFEST_ROUTE = /^\/assets\/manifests\/([^/]+)\.json$/;
const BLOB_ROUTE = /^\/assets\/blobs\/([^/]*)$/;
const SHA256 = /^[0-9a-f]{64}$/;

const notFound = (error: string) => Response.json({ ok: false, error }, { status: 404 });

/**
 * Serves `dir` in the asset bucket's layout under `/assets/`, so Debug builds download from the local dev server and
 * never touch the bucket. Returns null for any other request. Each manifest request rehashes `dir`, so edits show up
 * without a restart.
 */
export function assetRoutes(dir: string): (request: Request) => Response | null {
	const index = (manifest: Manifest) => new Map(manifest.files.map(file => [file.sha256, file.path]));
	let blobPaths: Map<string, string> | undefined;

	return request => {
		if (request.method !== 'GET') return null;
		const { pathname } = new URL(request.url);

		const version = MANIFEST_ROUTE.exec(pathname)?.[1];
		if (version !== undefined) {
			const computed = computeManifest(dir);
			blobPaths = index(computed);
			if (computed.version !== version) {
				return notFound(`Asset version ${version} requested, app-ios/Assets is ${computed.version}`);
			}
			return new Response(JSON.stringify(computed), { headers: { 'content-type': 'application/json' } });
		}

		const sha = BLOB_ROUTE.exec(pathname)?.[1];
		if (sha !== undefined) {
			if (!SHA256.test(sha)) return notFound('Not a sha256');
			blobPaths ??= index(computeManifest(dir));
			const path = blobPaths.get(sha);
			if (!path) return notFound(`No asset with sha256 ${sha}`);
			return new Response(Bun.file(join(dir, path)), { headers: { 'content-type': 'application/octet-stream' } });
		}

		return null;
	};
}
