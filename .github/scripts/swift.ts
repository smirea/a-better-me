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

// A fresh runner's first boot took 4.5 minutes, all of it after the build had finished. Booting before the package
// fetch and the build overlaps the two. Bun.spawn starts at once, where a `$` command waits until it's awaited.
const simulator = task === 'tests' ? await testSimulator() : undefined;
const boot = simulator
	? Bun.spawn(['xcrun', 'simctl', 'bootstatus', simulator, '-b'], { stdout: 'ignore', stderr: 'inherit' })
	: undefined;

if (task === 'tests') await $`bun app-ios/scripts/lint-swift.ts`;
await $`bun scripts/own-packages.ts .build/SourcePackages`.cwd(directory);

if (task === 'build') {
	await $`xcodebuild build ${xcodeArgs} -configuration Release -destination ${'generic/platform=iOS Simulator'}`.cwd(
		directory,
	);
} else if (!simulator) {
	console.log('No Xcode tests configured.');
} else {
	const destination = `platform=iOS Simulator,id=${simulator}`;
	await $`xcodebuild build-for-testing ${xcodeArgs} -destination ${destination}`.cwd(directory);
	if (await boot!.exited) throw new Error(`Booting simulator ${simulator} failed`);
	await $`xcodebuild test-without-building ${xcodeArgs} -destination ${destination}`.cwd(directory);
}
