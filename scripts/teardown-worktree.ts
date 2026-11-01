/**
 * Removes a worktree once its PR merged: `bun scripts/teardown-worktree.ts <worktree path | branch | dir> [--force]`
 * runs `agent-t3-worktree teardown`, which works from any checkout.
 */
import { proxy } from './lib';

proxy('agent-t3-worktree', ['teardown', ...process.argv.slice(2)]);
