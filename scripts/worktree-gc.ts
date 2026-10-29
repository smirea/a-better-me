/**
 * Reports what agent worktrees leave running: `bun scripts/worktree-gc.ts`. Safe to run any time, from any checkout;
 * the task orchestrator runs it on every wake.
 *   - prints load, booted simulators, and worktree count
 *   - names booted simulators that no live worktree's branch owns (each worktree's simulator is named after its branch)
 *   - lists worktrees whose PR merged, for teardown-worktree.ts
 * It never shuts a simulator down: a child may be driving one through T3's device tools, which hold no lock it can see.
 */
import { run, worktrees } from './lib';

const tryRun = (cmd: string[]) => run(cmd, { allowFail: true });

const known = worktrees(import.meta.dir);
const branches = new Set(known.flatMap(entry => (entry.branch ? [entry.branch] : [])));

type Device = { name: string; udid: string; state: string };
const listed = JSON.parse(tryRun(['xcrun', 'simctl', 'list', 'devices', '--json']) || '{"devices":{}}') as {
	devices: Record<string, Device[]>;
};
const booted = Object.values(listed.devices)
	.flat()
	.filter(device => device.state === 'Booted');

console.log(
	`Load ${tryRun(['sysctl', '-n', 'vm.loadavg']).replaceAll(/[{}]/g, '').trim()} on ${navigator.hardwareConcurrency} cores; ${booted.length} booted simulators${booted.length ? ` (${booted.map(device => device.name).join(', ')})` : ''}; ${known.length - 1} worktrees.`,
);

for (const device of booted) {
	if (!branches.has(device.name))
		console.log(`Booted, no worktree of this repo owns it: ${device.name} ${device.udid}`);
}

for (const { path, branch } of known.slice(1)) {
	if (!branch) continue;
	const state = tryRun(['gh', 'pr', 'view', branch, '--json', 'state', '-q', '.state']);
	if (state === 'MERGED') console.log(`Merged, ready for teardown: bun scripts/teardown-worktree.ts ${path}`);
}
