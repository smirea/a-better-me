/**
 * The iOS simulators agent worktrees own. `app-ios/scripts/run` claims the simulator it targets from a linked worktree
 * by writing the worktree's path into the simulator's data directory, and rewrites it on every run, so the file's mtime
 * is the simulator's last use. teardown-worktree.ts and worktree-gc.ts read the claim back. The main checkout never
 * claims, so the owner's own simulators are never shut down or deleted.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { run } from './lib';

export type Device = { name: string; udid: string; state: string; dataPath: string };

export function devices(): Device[] {
	const { devices } = JSON.parse(run(['xcrun', 'simctl', 'list', 'devices', '--json'])) as {
		devices: Record<string, Device[]>;
	};
	return Object.values(devices).flat();
}

const claimFile = (device: Pick<Device, 'dataPath'>) => join(device.dataPath, 'a-better-me-worktree');

/** Claims the simulator for the worktree `cwd` is in; a no-op in the main checkout. */
export function claim(device: Pick<Device, 'dataPath'>, cwd: string) {
	const gitDir = resolve(cwd, run(['git', '-C', cwd, 'rev-parse', '--git-dir']));
	const commonDir = resolve(cwd, run(['git', '-C', cwd, 'rev-parse', '--git-common-dir']));
	if (gitDir === commonDir) return;
	mkdirSync(device.dataPath, { recursive: true });
	writeFileSync(claimFile(device), run(['git', '-C', cwd, 'rev-parse', '--show-toplevel']));
}

export function owner(device: Device): { worktree: string; lastUsed: number } | undefined {
	const file = claimFile(device);
	if (!existsSync(file)) return undefined;
	return { worktree: readFileSync(file, 'utf8').trim(), lastUsed: statSync(file).mtimeMs };
}

export function shutdown(device: Device) {
	if (device.state !== 'Shutdown') spawnSync('xcrun', ['simctl', 'shutdown', device.udid]);
}

/** Deletes the simulator and every watch paired with it, through the launcher's `--delete`. */
export function remove(device: Device, repoRoot: string) {
	run(['bun', join(repoRoot, 'app-ios/scripts/run'), '-t', device.udid, '--delete'], {
		cwd: join(repoRoot, 'app-ios'),
	});
}

const CPU_LIMIT = 70;
// Under the 600-second tool limit with room left for the build that follows.
const CPU_WAIT_MS = 4 * 60_000;

/** Total CPU use across all cores, in percent, from the second of two `top` samples (the first covers all uptime). */
export function cpuUsage(): number {
	const samples = [...run(['top', '-l', '2', '-n', '0', '-s', '1']).matchAll(/CPU usage:.*?([\d.]+)% idle/g)];
	const idle = samples.at(-1)?.[1];
	if (!idle) throw new Error('`top` printed no CPU usage line.');
	return Math.round(100 - Number(idle));
}

/**
 * Every booted simulator slows every other agent's build, so an agent boots one only while the Mac has room: total CPU at
 * or under 70%. It says it is waiting, and after four minutes exits 3, the code `pr-ship` uses for "rerun", so the
 * agent's tool call never hits the 600-second limit.
 */
export async function waitForCpu(what: string) {
	let usage = cpuUsage();
	if (usage <= CPU_LIMIT) return;
	const deadline = Date.now() + CPU_WAIT_MS;
	console.log(`CPU is at ${usage}% (limit ${CPU_LIMIT}%), so ${what} waits for the Mac to cool down…`);
	while (usage > CPU_LIMIT) {
		if (Date.now() > deadline) {
			console.log(`CPU is still at ${usage}% after 4 minutes. Rerun the same command to keep waiting.`);
			process.exit(3);
		}
		await Bun.sleep(20_000);
		usage = cpuUsage();
		console.log(`CPU at ${usage}%.`);
	}
}
