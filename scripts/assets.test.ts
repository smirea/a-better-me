import { expect, test } from 'bun:test';
import { ASSETS_DIR, buildAssets } from '../server/src/assets';
import { trackedVersion } from './assets';

test('the tracked ASSETS_VERSION matches app-ios/Assets', () => {
	const { version } = buildAssets(ASSETS_DIR).manifest;
	expect(trackedVersion(), 'app-ios/Config/Assets.xcconfig is stale. Run bun run assets version.').toBe(version);
});
