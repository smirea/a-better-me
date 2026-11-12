/**
 * Preloaded first by `bun test`. Tests of dates around a daylight-saving change only cross one when the process runs
 * in a zone that has it, and a shell's zone may be UTC, so every run pins the same zone.
 *
 * Git hooks (and `git rebase --exec`) export GIT_DIR and GIT_INDEX_FILE, and in a linked worktree GIT_DIR points into
 * the main checkout's `.git`. A test that ran `git init` in a scratch directory under them reinitialized the real
 * repository instead: it committed its fixtures onto the worktree's branch and set `core.bare = true` in the shared
 * config, which broke every git command in the main checkout and T3's worktree creation. Tests never mean the
 * repository they run in, so no test sees git's environment.
 */
process.env.TZ = 'America/New_York';
for (const key of Object.keys(process.env)) if (key.startsWith('GIT_')) delete process.env[key];
