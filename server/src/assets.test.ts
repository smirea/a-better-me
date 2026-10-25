import { afterAll, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assetRoutes } from './assets';

const dir = mkdtempSync(join(tmpdir(), 'assets-'));
mkdirSync(join(dir, 'Images'));
writeFileSync(join(dir, 'Images/a.webp'), 'image');
writeFileSync(join(dir, 'b.md'), '# B\n');
afterAll(() => rmSync(dir, { recursive: true }));

const IMAGE_SHA = '6105d6cc76af400325e94d588ce511be5bfdbb73b437dc51eca43917d7a43e3d';
const MARKDOWN_SHA = 'a81d3fbddd441e2d690b9c03c18251323a295c8eb8ebbfb81ca45b63bf8d5a06';
const VERSION = 'c4cc1dbdc1f554d0';

const serve = assetRoutes(dir);
const get = (path: string) => serve(new Request(`http://localhost${path}`))!;

test('serves the manifest of the current version', async () => {
	const response = get(`/assets/manifests/${VERSION}.json`);
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({
		version: VERSION,
		files: [
			{ path: 'Images/a.webp', sha256: IMAGE_SHA, size: 5 },
			{ path: 'b.md', sha256: MARKDOWN_SHA, size: 4 },
		],
	});
});

test('serves a blob by its sha256', async () => {
	const response = get(`/assets/blobs/${IMAGE_SHA}`);
	expect(response.status).toBe(200);
	expect(await response.text()).toBe('image');
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
	expect(serve(new Request(`http://localhost/assets/blobs/${IMAGE_SHA}`, { method: 'POST' }))).toBeNull();
});
