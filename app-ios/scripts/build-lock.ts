import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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
 * died is taken over. */
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
		return await build();
	} finally {
		rmSync(lock, { recursive: true, force: true });
	}
}
