import { afterAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetRoutes, buildAssets } from './assets';

const dir = mkdtempSync(join(tmpdir(), 'assets-'));
mkdirSync(join(dir, 'Images'));
writeFileSync(join(dir, 'Images/a.webp'), 'image');
writeFileSync(join(dir, 'b.md'), '# B\n');
afterAll(() => rmSync(dir, { recursive: true }));

const PACK_SHA = 'ae14fe62bfab047974f07a844dff802e965a33f10d63713e40e866bc6a3e5bde';
const VERSION = '78a7696b1b689b11';

const serve = assetRoutes(dir);
const get = (path: string) => serve(new Request(`http://localhost${path}`))!;

test('serves the manifest of the current version', async () => {
	const response = get(`/assets/manifests/${VERSION}.json`);
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({
		version: VERSION,
		packs: [
			{
				sha256: PACK_SHA,
				size: 9,
				files: [
					{ path: 'Images/a.webp', offset: 0, size: 5 },
					{ path: 'b.md', offset: 5, size: 4 },
				],
			},
		],
	});
});

test('serves a pack, its files back to back, by its sha256', async () => {
	const response = get(`/assets/blobs/${PACK_SHA}`);
	expect(response.status).toBe(200);
	expect(await response.text()).toBe('image# B\n');
});

test('starts a new pack once one reaches 1 MB', () => {
	const large = mkdtempSync(join(tmpdir(), 'assets-'));
	try {
		writeFileSync(join(large, 'a'), 'a'.repeat(600_000));
		writeFileSync(join(large, 'b'), 'b'.repeat(600_000));
		writeFileSync(join(large, 'c'), 'c');
		const { manifest } = buildAssets(large);
		expect(manifest.packs.map(pack => pack.files.map(file => `${file.path}@${file.offset}`))).toEqual([
			['a@0', 'b@600000'],
			['c@0'],
		]);
	} finally {
		rmSync(large, { recursive: true });
	}
});

test('answers 404 naming both versions for a stale version', async () => {
	const response = get('/assets/manifests/ffffffffffffffff.json');
	expect(response.status).toBe(404);
	expect(await response.json()).toEqual({
		ok: false,
		error: `Asset version ffffffffffffffff requested, app-ios/Assets is ${VERSION}`,
	});
});

test('answers 404 for an unknown or malformed sha256', async () => {
	expect(get(`/assets/blobs/${'0'.repeat(64)}`).status).toBe(404);
	expect(get('/assets/blobs/..%2fb.md').status).toBe(404);
	expect(get('/assets/blobs/ABC').status).toBe(404);
});

test('leaves other requests to the API', () => {
	expect(serve(new Request('http://localhost/status'))).toBeNull();
	expect(serve(new Request(`http://localhost/assets/blobs/${PACK_SHA}`, { method: 'POST' }))).toBeNull();
});
