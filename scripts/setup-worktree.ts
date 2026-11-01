/** Prepares a linked worktree: `bun scripts/setup-worktree.ts [--reset-data]` runs `agent-t3-worktree setup`. */
import { proxy } from './lib';

proxy('agent-t3-worktree', ['setup', ...process.argv.slice(2)]);
