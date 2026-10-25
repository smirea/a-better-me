import { expect, test } from 'bun:test';
import { computeManifest, trackedVersion } from './assets';

test('the tracked ASSETS_VERSION matches app-ios/Assets', () => {
	const { version } = computeManifest();
	expect(trackedVersion(), 'app-ios/Config/Assets.xcconfig is stale. Run bun run assets version.').toBe(version);
});
