import { expect, test } from 'bun:test';
import { ASSETS_DIR, computeManifest } from '../server/src/assets';
import { trackedVersion } from './assets';

test('the tracked ASSETS_VERSION matches app-ios/Assets', () => {
	const { version } = computeManifest(ASSETS_DIR);
	expect(trackedVersion(), 'app-ios/Config/Assets.xcconfig is stale. Run bun run assets version.').toBe(version);
});
