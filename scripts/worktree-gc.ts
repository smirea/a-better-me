/** Removes this repo's merged worktrees and idle simulators: `bun scripts/worktree-gc.ts [--dry-run]`. */
import { join } from 'node:path';
import { proxy } from './lib';

proxy('agent-t3-worktree', ['gc', '--repo', join(import.meta.dir, '..'), ...process.argv.slice(2)]);
