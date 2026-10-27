import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** The catalog images the iOS app downloads instead of bundling. */
export const ASSETS_DIR = join(import.meta.dir, '../../app-ios/Assets');

/**
 * Downloading thousands of few-KB files one request each is latency-bound, so files ship concatenated in packs of about
 * this size. Small enough that the Settings progress bar moves steadily and an edit re-downloads little.
 */
const PACK_BYTES = 1_000_000;

export type PackEntry = { path: string; offset: number; size: number };
export type Pack = { sha256: string; size: number; files: PackEntry[] };
export type Manifest = { version: string; packs: Pack[] };
export type Assets = { manifest: Manifest; blobs: Map<string, Uint8Array<ArrayBuffer>> };

const sha256 = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');

function walk(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
		if (entry.name.startsWith('.')) return [];
		const path = join(dir, entry.name);
		return entry.isDirectory() ? walk(path) : [path];
	});
}

/** The files back to back, and where each one sits. */
export function concatenate(files: { path: string; bytes: Uint8Array }[]): {
	bytes: Uint8Array<ArrayBuffer>;
	files: PackEntry[];
} {
	const bytes = new Uint8Array(files.reduce((sum, file) => sum + file.bytes.length, 0));
	let offset = 0;
	const entries = files.map(file => {
		bytes.set(file.bytes, offset);
		const entry = { path: file.path, offset, size: file.bytes.length };
		offset += file.bytes.length;
		return entry;
	});
	return { bytes, files: entries };
}

/** Packs `dir`'s files in path order. The same files always give the same packs and version. */
export function buildAssets(dir: string): Assets {
	const files = walk(dir)
		.map(file => ({ path: relative(dir, file).split('\\').join('/'), bytes: readFileSync(file) as Uint8Array }))
		.toSorted((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
	const groups: (typeof files)[] = [];
	let size = PACK_BYTES;
	for (const file of files) {
		if (size >= PACK_BYTES) {
			groups.push([]);
			size = 0;
		}
		groups.at(-1)!.push(file);
		size += file.bytes.length;
	}
	const blobs = new Map<string, Uint8Array<ArrayBuffer>>();
	const packs = groups.map(group => {
		const packed = concatenate(group);
		const hash = sha256(packed.bytes);
		blobs.set(hash, packed.bytes);
		return { sha256: hash, size: packed.bytes.length, files: packed.files };
	});
	return { manifest: { version: sha256(JSON.stringify(packs)).slice(0, 16), packs }, blobs };
}

const MANIFEST_ROUTE = /^\/assets\/manifests\/([^/]+)\.json$/;
const BLOB_ROUTE = /^\/assets\/blobs\/([^/]*)$/;

const notFound = (error: string) => Response.json({ ok: false, error }, { status: 404 });

/**
 * Serves `dir` in the asset bucket's layout under `/assets/`, so Debug builds download from the local dev server and
 * never touch the bucket. Returns null for any other request. Each manifest request repacks `dir`, so edits show up
 * without a restart.
 */
export function assetRoutes(dir: string): (request: Request) => Response | null {
	let blobs: Map<string, Uint8Array<ArrayBuffer>> | undefined;

	return request => {
		if (request.method !== 'GET') return null;
		const { pathname } = new URL(request.url);

		const version = MANIFEST_ROUTE.exec(pathname)?.[1];
		if (version !== undefined) {
			const built = buildAssets(dir);
			blobs = built.blobs;
			if (built.manifest.version !== version) {
				return notFound(`Asset version ${version} requested, app-ios/Assets is ${built.manifest.version}`);
			}
			return Response.json(built.manifest);
		}

		const sha = BLOB_ROUTE.exec(pathname)?.[1];
		if (sha !== undefined) {
			blobs ??= buildAssets(dir).blobs;
			const bytes = blobs.get(sha);
			if (!bytes) return notFound(`No asset pack with sha256 ${sha}`);
			return new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } });
		}

		return null;
	};
}
