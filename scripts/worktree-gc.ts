/**
 * Frees what agent worktrees leave behind: `bun scripts/worktree-gc.ts [--dry-run]`. Safe to run any time, from any
 * checkout; the task orchestrator runs it on every wake.
 *   - deletes simulators claimed by a worktree that no longer exists, with their paired watches
 *   - shuts down claimed simulators unused for 15 minutes that no running process names
 *   - deletes Xcode DerivedData of the App project at paths that no longer exist
 *   - prints CPU, load, booted simulators, and worktree count
 *   - lists worktrees whose PR merged, for teardown-worktree.ts
 */
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { run, worktrees } from './lib';
import { cpuUsage, devices, owner, remove, shutdown } from './simulators';

const dryRun = process.argv.includes('--dry-run');
const IDLE_MS = 15 * 60_000;

const tryRun = (cmd: string[]) => run(cmd, { allowFail: true });

async function act(message: string, action: () => unknown) {
	console.log(`${dryRun ? '[dry run] ' : ''}${message}`);
	if (!dryRun) await action();
}

const known = worktrees(import.meta.dir);
const repoRoot = known[0]!.path;
const live = new Set(known.map(entry => entry.path));
// A booted simulator's own processes carry its UDID in their paths, so only processes outside CoreSimulator count.
const processes = tryRun(['ps', '-axww', '-o', 'command='])
	.split('\n')
	.filter(line => !line.includes('/CoreSimulator/'));
const inUse = (udid: string) => processes.some(line => line.includes(udid));

for (const device of devices()) {
	const claim = owner(device);
	if (!claim) continue;
	if (!live.has(claim.worktree)) {
		await act(`Deleting simulator ${device.name}; its worktree ${claim.worktree} is gone.`, () =>
			remove(device, repoRoot),
		);
	} else if (device.state === 'Booted' && Date.now() - claim.lastUsed > IDLE_MS && !inUse(device.udid)) {
		const minutes = Math.round((Date.now() - claim.lastUsed) / 60_000);
		await act(`Shutting down ${device.name}, idle ${minutes} minutes.`, () => shutdown(device));
	}
}

const derivedData = join(homedir(), 'Library/Developer/Xcode/DerivedData');
for (const entry of existsSync(derivedData) ? readdirSync(derivedData) : []) {
	if (!entry.startsWith('App-')) continue;
	const workspace = tryRun(['plutil', '-extract', 'WorkspacePath', 'raw', join(derivedData, entry, 'info.plist')]);
	if (!workspace || existsSync(workspace)) continue;
	await act(`Deleting DerivedData ${entry} of the removed ${workspace}.`, () =>
		rmSync(join(derivedData, entry), { recursive: true, force: true }),
	);
}

const booted = devices()
	.filter(device => device.state === 'Booted')
	.map(device => device.name);
console.log(
	`CPU ${cpuUsage()}% (headless simulator boots wait above 70%); load ${tryRun(['sysctl', '-n', 'vm.loadavg']).replaceAll(/[{}]/g, '').trim()} on ${navigator.hardwareConcurrency} cores; ${booted.length} booted simulators${booted.length ? ` (${booted.join(', ')})` : ''}; ${known.length - 1} worktrees.`,
);

for (const { path, branch } of known.slice(1)) {
	if (!branch) continue;
	const state = tryRun(['gh', 'pr', 'view', branch, '--json', 'state', '-q', '.state']);
	if (state === 'MERGED') console.log(`Merged, ready for teardown: bun scripts/teardown-worktree.ts ${path}`);
}
