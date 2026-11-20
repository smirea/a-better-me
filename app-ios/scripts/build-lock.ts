import { mkdirSync, readFileSync, rmSync, statfsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Twice a pair of parallel simulator builds took the Mac from a few GB free to zero, and then every agent's shell and
// file write failed with ENOSPC, so nothing could clean up. A build that refuses to start leaves room to recover.
const minimumFreeGB = 10;

function assertDiskRoom(path: string) {
	const { bavail, bsize } = statfsSync(path);
	const freeGB = (bavail * bsize) / 2 ** 30;
	if (freeGB < minimumFreeGB)
		throw new Error(
			`Only ${freeGB.toFixed(1)} GB free; a build needs ${minimumFreeGB} GB. Free space (empty the Trash, delete unused simulators, or settle merged worktrees) and rerun.`,
		);
}

function alive(pid: number) {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/** Runs `build` while holding `<derivedData>/.build-lock`. `scripts/run` and `scripts/watch-drive` build into the same
 * folder, and two xcodebuilds there fail on Xcode's database lock, so the second waits instead. A lock whose process
 * died is taken over. The build refuses to start with less than 10 GB free. */
export async function withBuildLock<T>(derivedData: string, build: () => Promise<T>): Promise<T> {
	const lock = join(derivedData, '.build-lock');
	mkdirSync(derivedData, { recursive: true });
	let waiting = false;
	while (true) {
		try {
			mkdirSync(lock);
			break;
		} catch {
			let holder = 0;
			try {
				holder = Number(readFileSync(join(lock, 'pid'), 'utf8'));
			} catch {}
			if (holder && !alive(holder)) {
				rmSync(lock, { recursive: true, force: true });
				continue;
			}
			if (!waiting) console.log('Waiting for another build in this DerivedData folder…');
			waiting = true;
			await Bun.sleep(250);
		}
	}
	writeFileSync(join(lock, 'pid'), String(process.pid));
	try {
		assertDiskRoom(derivedData);
		return await build();
	} finally {
		rmSync(lock, { recursive: true, force: true });
	}
}
