/**
 * What the repository scripts share: a process runner, the dotenv and env-manager readers, and the proxy to the shared
 * agent commands. No npm imports: the `setup-worktree` proxy runs before `bun install`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Values = Record<string, string>;

type RunOptions = {
	/** Answer the output, or an empty string, instead of throwing when the command fails. */
	allowFail?: boolean;
	/** `pipe` captures both streams; `inherit-stderr` shows progress while capturing stdout; `inherit` shows both. */
	stdio?: 'pipe' | 'inherit-stderr' | 'inherit';
	env?: Values;
	cwd?: string;
};

/** Runs a command to completion and answers its trimmed stdout. A failure names the command and shows its output. */
export function run(cmd: string[], { allowFail = false, stdio = 'pipe', env, cwd }: RunOptions = {}): string {
	const result = spawnSync(cmd[0]!, cmd.slice(1), {
		encoding: 'utf8',
		cwd,
		env: env ? { ...process.env, ...env } : process.env,
		stdio: stdio === 'pipe' ? 'pipe' : stdio === 'inherit' ? 'inherit' : ['ignore', 'pipe', 'inherit'],
	});
	if (result.status !== 0) {
		if (allowFail) return '';
		throw new Error(`\`${cmd.join(' ')}\` failed\n${result.stderr ?? ''}${result.stdout ?? ''}`);
	}
	return (result.stdout ?? '').trim();
}

/** Empty values count as unset and are left out. */
export function parseDotenv(text: string): Values {
	const values: Values = {};
	for (const raw of text.split('\n')) {
		const line = raw.trim();
		if (!line || line.startsWith('#')) continue;
		const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
		if (!match) continue;
		const [, key, rest] = match as unknown as [string, string, string];
		let value: string;
		const quote = rest[0];
		if ((quote === '"' || quote === "'") && rest.indexOf(quote, 1) > 0) {
			value = rest.slice(1, rest.indexOf(quote, 1));
		} else {
			value = rest.replace(/(^|\s+)#.*$/, '').trim();
		}
		if (value) values[key] = value;
	}
	return values;
}

/** One environment's values, from the `.env.local` section of `env-manager print`. */
export function readEnv(env: string): Values {
	// `bun run` puts the pinned `node_modules/.bin/env-manager` first, which cannot see the global one's AWS credentials.
	const path = (process.env.PATH ?? '')
		.split(':')
		.filter(dir => !dir.endsWith('node_modules/.bin'))
		.join(':');
	const result = spawnSync('env-manager', ['print', 'a-better-me', '-e', env], {
		encoding: 'utf8',
		env: { ...process.env, PATH: path },
	});
	const section = /^\.env\.local$([\s\S]*?)(?:^files$|(?![\s\S]))/m.exec(result.stdout ?? '')?.[1];
	if (result.status !== 0 || section === undefined) {
		throw new Error(`env-manager print a-better-me -e ${env} failed. It needs this Mac's AWS credentials.`);
	}
	return parseDotenv(section);
}

/** A worktree's `.env.override`, which `agent-t3-worktree setup` writes with its ports, or null without one. */
export function readOverride(worktree: string): Values | null {
	const file = join(worktree, '.env.override');
	return existsSync(file) ? parseDotenv(readFileSync(file, 'utf8')) : null;
}

/** `~/bin/<name>`, one of the agent worktree and simulator commands that `~/code/scripts` installs for every repo. */
export function agentCommand(name: 'agent-t3-worktree' | 'agent-simulator'): string {
	const path = join(process.env.HOME ?? '', 'bin', name);
	if (!existsSync(path)) throw new Error(`${path} is missing. Install it: bun ~/code/scripts/src/setup.ts`);
	return path;
}

/** Hands this script's arguments to a shared agent command and exits with its status. */
export function proxy(name: Parameters<typeof agentCommand>[0], args: string[]): never {
	const result = spawnSync(agentCommand(name), args, { stdio: 'inherit' });
	process.exit(result.status ?? 1);
}
