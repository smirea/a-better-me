import { basename, join } from 'node:path';

/** The local server's database: one file per checkout, named after its directory, so a worktree never shares data. */
export const DATA_FILE = (() => {
	const root = join(import.meta.dir, '../..');
	return join(root, '.data', `${basename(root)}.sqlite`);
})();
