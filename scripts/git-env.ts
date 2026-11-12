/**
 * Git hooks export GIT_DIR (and GIT_INDEX_FILE at commit), and in a linked worktree GIT_DIR points into the main
 * checkout's `.git`. Any git call they reach, `git init` in a scratch directory included, then acts on the real
 * repository: a test once committed its fixtures onto the worktree's branch, wrote its user and tags into the shared
 * repo, and set core.bare = true, which broke every git command in the main checkout. xcodebuild's package checkouts
 * failed the same way. Call this before the process spawns anything. Bun.spawn without `env` keeps the environment the
 * process started with and ignores this, so it only reaches processes started from node:child_process or with
 * `env: process.env`, and through them all of their children.
 */
export function dropGitEnv() {
	for (const key of Object.keys(process.env)) if (key.startsWith('GIT_')) delete process.env[key];
}
