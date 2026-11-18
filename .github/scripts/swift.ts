import { $ } from 'bun';
import { env } from 'node:process';

const directory = env.SWIFT_DIRECTORY ?? '';
if (!directory) throw new Error('Missing SWIFT_DIRECTORY');

switch (Bun.argv[2]) {
	// Core's tests on the Mac: no simulator and no app build (app-ios/Package.swift).
	case 'package':
		await $`bun app-ios/scripts/lint-swift.ts`;
		await $`swift test`.cwd(directory);
		break;
	case 'app':
		await $`bun scripts/own-packages.ts .build/SourcePackages`.cwd(directory);
		await $`xcodebuild build -project App.xcodeproj -scheme App -derivedDataPath DerivedData/ci -clonedSourcePackagesDirPath .build/SourcePackages CODE_SIGNING_ALLOWED=NO -configuration Release -destination ${'generic/platform=iOS Simulator'}`.cwd(
			directory,
		);
		break;
	default:
		throw new Error(`Unknown Swift task: ${Bun.argv[2]}`);
}
