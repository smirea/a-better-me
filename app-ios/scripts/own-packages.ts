#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const app = resolve(import.meta.dir, '..');
const resolvedFile = join(app, 'App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved');
const ownRepositories = 'github.com/smirea/';

type Pin = { identity: string; location: string; state: { branch?: string; revision: string } };

/**
 * The owner's own packages track their branch, never a commit. Xcode builds a branch package at the
 * revision its local pin names, and dropping the pin is not enough because it then re-resolves the
 * branch from its stale cached mirror. So this moves each own pin to the branch's current head, and
 * xcodebuild fetches that commit. Nothing changes when GitHub can't be reached, so offline builds keep
 * working with what they have.
 *
 * `Package.resolved` isn't tracked, and a missing one doesn't help either: Xcode then resolves from the
 * state cached in `sourcePackages`, which CI restores. So a missing file is resolved first, with the
 * same packages directory the build uses, and its own pins are moved like any other.
 */
export async function refreshOwnPackages(sourcePackages: string) {
	if (!existsSync(resolvedFile)) {
		const resolution = Bun.spawnSync(
			[
				'xcodebuild',
				'-resolvePackageDependencies',
				'-project',
				'App.xcodeproj',
				'-scheme',
				'App',
				'-clonedSourcePackagesDirPath',
				sourcePackages,
			],
			{ cwd: app, stdout: 'ignore', stderr: 'inherit' },
		);
		if (resolution.exitCode) throw new Error('Resolving the Swift packages failed.');
	}
	const resolved: { pins: Pin[] } = JSON.parse(readFileSync(resolvedFile, 'utf8'));
	const heads = await Promise.all(
		resolved.pins.map(async pin => {
			if (!pin.location.includes(ownRepositories) || !pin.state.branch) return undefined;
			const remote = Bun.spawn(['git', 'ls-remote', pin.location, `refs/heads/${pin.state.branch}`], {
				stdout: 'pipe',
				stderr: 'pipe',
			});
			const timeout = setTimeout(() => remote.kill(), 10_000);
			const [code, output, error] = await Promise.all([
				remote.exited,
				new Response(remote.stdout).text(),
				new Response(remote.stderr).text(),
			]);
			clearTimeout(timeout);
			if (code !== 0) {
				console.warn(
					`Kept ${pin.identity} at ${pin.state.revision.slice(0, 7)}: git ls-remote exited ${code}. ${error.trim()}`,
				);
			}
			const head = output.split('\t')[0];
			return code === 0 && /^[0-9a-f]{40}$/.test(head) && head !== pin.state.revision ? head : undefined;
		}),
	);
	const moved = resolved.pins.filter((_, index) => heads[index]);
	if (!moved.length) return;
	resolved.pins.forEach((pin, index) => {
		if (heads[index]) pin.state.revision = heads[index];
	});
	writeFileSync(resolvedFile, `${JSON.stringify(resolved, null, 2)}\n`);
	console.log(`Updated ${moved.map(pin => `${pin.identity} to ${pin.state.revision.slice(0, 7)}`).join(', ')}.`);
}

if (import.meta.main) {
	if (!process.argv[2]) throw new Error('Usage: own-packages.ts <cloned source packages directory>');
	await refreshOwnPackages(resolve(process.argv[2]));
}
