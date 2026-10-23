import { $ } from 'bun';
import { env } from 'node:process';

const directory = env.SWIFT_DIRECTORY;
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

switch (Bun.argv[2]) {
	case 'checks':
		await $`swift build`.cwd(directory);
		break;
	case 'tests': {
		const pkg: { targets: { type: string }[] } = await $`swift package describe --type json`.cwd(directory).json();
		if (pkg.targets.some(target => target.type === 'test')) {
			await $`swift test`.cwd(directory);
		} else {
			console.log('No Swift package tests configured.');
		}
		const testables =
			await $`xmllint --xpath ${'boolean(//TestableReference | //TestPlanReference)'} App.xcodeproj/xcshareddata/xcschemes/App.xcscheme`
				.cwd(directory)
				.text();
		if (testables.trim() === 'true') {
			const simulators: { devices: Record<string, { udid: string; name: string }[]> } =
				await $`xcrun simctl list devices available --json`.cwd(directory).json();
			const simulator = Object.entries(simulators.devices)
				.sort(([a], [b]) => b.localeCompare(a))
				.filter(([runtime]) => runtime.includes('iOS'))
				.flatMap(([, devices]) => devices)
				.find(device => device.name.includes('iPhone'));
			if (!simulator) throw new Error('No available iPhone simulator');
			await $`xcodebuild test ${xcodeArgs} -destination ${`platform=iOS Simulator,id=${simulator.udid}`}`.cwd(
				directory,
			);
		} else {
			console.log('No Xcode tests configured.');
		}
		break;
	}
	case 'build':
		await $`xcodebuild build ${xcodeArgs} -configuration Release -destination ${'generic/platform=iOS Simulator'}`.cwd(
			directory,
		);
		break;
	default:
		throw new Error(`Unknown Swift task: ${Bun.argv[2]}`);
}
