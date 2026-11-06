import { $ } from 'bun';
import { env } from 'node:process';

const directory = env.SWIFT_DIRECTORY ?? '';
if (!directory) throw new Error('Missing SWIFT_DIRECTORY');

const xcodeArgs = [
	'-project',
	'App.xcodeproj',
	'-scheme',
	'App',
	'-derivedDataPath',
	'DerivedData/ci',
	'-clonedSourcePackagesDirPath',
	'.build/SourcePackages',
	'CODE_SIGNING_ALLOWED=NO',
];

async function testSimulator() {
	const testables =
		await $`xmllint --xpath ${'boolean(//TestableReference | //TestPlanReference)'} App.xcodeproj/xcshareddata/xcschemes/App.xcscheme`
			.cwd(directory)
			.text();
	if (testables.trim() !== 'true') return undefined;
	const simulators: { devices: Record<string, { udid: string; name: string }[]> } =
		await $`xcrun simctl list devices available --json`.cwd(directory).json();
	const simulator = Object.entries(simulators.devices)
		.sort(([a], [b]) => b.localeCompare(a))
		.filter(([runtime]) => runtime.includes('iOS'))
		.flatMap(([, devices]) => devices)
		.find(device => device.name.includes('iPhone'));
	if (!simulator) throw new Error('No available iPhone simulator');
	return simulator.udid;
}

const task = Bun.argv[2];
if (task !== 'tests' && task !== 'build') throw new Error(`Unknown Swift task: ${task}`);

// Booting the simulator alongside the build made the tests job slower (13 minutes before, 14.6 and 17.8 after): on
// one runner the build started 9 minutes late, and on the other it took 8.8 minutes instead of 2.3. xcodebuild boots
// it after the build.
const simulator = task === 'tests' ? await testSimulator() : undefined;

if (task === 'tests') await $`bun app-ios/scripts/lint-swift.ts`;
await $`bun scripts/own-packages.ts .build/SourcePackages`.cwd(directory);

if (task === 'build') {
	await $`xcodebuild build ${xcodeArgs} -configuration Release -destination ${'generic/platform=iOS Simulator'}`.cwd(
		directory,
	);
} else if (!simulator) {
	console.log('No Xcode tests configured.');
} else {
	await $`xcodebuild test ${xcodeArgs} -destination ${`platform=iOS Simulator,id=${simulator}`}`.cwd(directory);
}
