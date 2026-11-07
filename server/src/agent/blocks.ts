import type { z } from 'zod';
import { ApiError } from '../http';
import type * as M from './models';

function forEachSet(blocks: M.Blocks, visit: (set: { log?: z.output<typeof M.SetLog> }) => void) {
	for (const block of blocks) {
		for (const exercise of block.exercises) {
			for (const set of [...exercise.sets, ...(exercise.cycleTargets ?? []).flatMap(cycle => cycle.sets)]) {
				visit(set);
				set.subSets.forEach(visit);
			}
		}
	}
}

/** Swift's `SetLog.completedAt` is required, so a log without one gets the moment the workout ended. */
export function stampLogs(blocks: M.Blocks, at: string): M.Blocks {
	forEachSet(blocks, set => {
		if (set.log && !set.log.completedAt) set.log.completedAt = at;
	});
	return blocks;
}

/** Templates hold plans. The app decodes `SetLog.completedAt` strictly, so a log there would hide the template. */
export function assertNoLogs(blocks: M.Blocks | undefined) {
	let logged = false;
	forEachSet(blocks ?? [], set => {
		logged ||= !!set.log;
	});
	if (logged) throw new ApiError(400, 'Template sets take `target`, not `log`. Log done sets on a session.');
}
