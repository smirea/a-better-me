/**
 * The one bridge from env-manager project `a-better-me` to the Worker and GitHub.
 * Never prints a value: it logs key names only and hands values to child processes on stdin.
 *
 *   bun scripts/secrets.ts push        the Worker secrets from env-manager prod, once the Worker exists
 *   bun scripts/secrets.ts github      the Cloudflare deploy credentials as repository secrets
 *   bun scripts/secrets.ts check       drift between env-manager prod, the Worker, and GitHub
 *   bun scripts/secrets.ts verify      CI, before deploying: the Worker has every required secret (no AWS)
 *   bun scripts/secrets.ts ios         Release's API_URL and OWNER_TOKEN from env-manager prod into app-ios/Config/Env.xcconfig
 *
 * Every command but `verify` reads env-manager with `env-manager print`, which needs this Mac's AWS access.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, writeFileSync } from 'node:fs';
import { REQUIRED_IN_PRODUCTION } from '../server/src/config';
import { parseDotenv, type Values } from './lib';

const PROJECT = 'a-better-me';
const REPO = 'smirea/a-better-me';
const WORKER_SECRETS = REQUIRED_IN_PRODUCTION;
const CLOUDFLARE_SECRETS = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'] as const;
const IOS_RELEASE_SETTINGS = ['API_URL', 'OWNER_TOKEN'] as const;
const IOS_CONFIG_PATH = new URL('../app-ios/Config/Env.xcconfig', import.meta.url).pathname;

/** One environment's values, from the `.env.local` section of `env-manager print`. */
function readEnv(env: string): Values {
	// `bun run` puts the pinned `node_modules/.bin/env-manager` first, which cannot see the global one's AWS credentials.
	const path = (process.env.PATH ?? '')
		.split(':')
		.filter(dir => !dir.endsWith('node_modules/.bin'))
		.join(':');
	const result = spawnSync('env-manager', ['print', PROJECT, '-e', env], {
		encoding: 'utf8',
		env: { ...process.env, PATH: path },
	});
	const section = /^\.env\.local$([\s\S]*?)(?:^files$|(?![\s\S]))/m.exec(result.stdout ?? '')?.[1];
	if (result.status !== 0 || section === undefined) {
		throw new Error(`env-manager print ${PROJECT} -e ${env} failed. It needs this Mac's AWS credentials.`);
	}
	return parseDotenv(section);
}

function require(values: Values, names: readonly string[], env: string): Values {
	const missing = names.filter(name => !values[name]);
	if (missing.length) throw new Error(`Not set in env-manager ${env}: ${missing.join(', ')}`);
	return Object.fromEntries(names.map(name => [name, values[name]!]));
}

function run(command: string[], options: { stdin?: string; env?: Values } = {}): string {
	const result = spawnSync(command[0]!, command.slice(1), {
		input: options.stdin,
		encoding: 'utf8',
		stdio: ['pipe', 'pipe', 'inherit'],
		env: { ...process.env, ...options.env },
	});
	if (result.status !== 0) throw new Error(`${command.slice(0, 3).join(' ')} failed`);
	return result.stdout;
}

/** Wrangler can print a banner before its JSON. */
function workerSecretNames(cloudflare: Values): Set<string> {
	const output = run(['bunx', 'wrangler', 'secret', 'list', '--format', 'json'], { env: cloudflare });
	return new Set((JSON.parse(output.slice(output.indexOf('['))) as { name: string }[]).map(secret => secret.name));
}

function push() {
	const values = readEnv('prod');
	const secrets = require(values, WORKER_SECRETS, 'prod');
	run(['bunx', 'wrangler', 'secret', 'bulk'], {
		stdin: JSON.stringify(secrets),
		env: require(values, CLOUDFLARE_SECRETS, 'prod'),
	});
	console.log(`Pushed to the Worker: ${Object.keys(secrets).join(', ')}`);
}

function github() {
	const secrets = require(readEnv('prod'), CLOUDFLARE_SECRETS, 'prod');
	for (const [name, value] of Object.entries(secrets)) {
		run(['gh', 'secret', 'set', name, '--repo', REPO], { stdin: value });
		console.log(`Set GitHub secret ${name}`);
	}
}

function check() {
	const values = readEnv('prod');
	const onWorker = workerSecretNames(require(values, CLOUDFLARE_SECRETS, 'prod'));
	const onGithub = new Set(
		(JSON.parse(run(['gh', 'secret', 'list', '--repo', REPO, '--json', 'name'])) as { name: string }[]).map(
			secret => secret.name,
		),
	);
	const rows = [
		...WORKER_SECRETS.map(name => ({ name, where: 'Worker', ok: Boolean(values[name]) && onWorker.has(name) })),
		...CLOUDFLARE_SECRETS.map(name => ({ name, where: 'GitHub', ok: Boolean(values[name]) && onGithub.has(name) })),
	];
	for (const row of rows) console.log(`${row.ok ? 'ok   ' : 'DRIFT'} ${row.where} ${row.name}`);
	if (rows.some(row => !row.ok)) process.exit(1);
}

/** Run by CI before `wrangler deploy`, with the Cloudflare credentials in its environment. */
function verify() {
	const missing = WORKER_SECRETS.filter(name => !workerSecretNames({}).has(name));
	if (missing.length) {
		console.error(
			`The Worker lacks ${missing.join(', ')}. Set them in env-manager prod, then run bun run secrets:push.`,
		);
		process.exit(1);
	}
	console.log(`The Worker has every required secret: ${WORKER_SECRETS.join(', ')}`);
}

/** The token ships inside the Release app: the owner's own phone is the only install, so it is as safe as the device. */
function ios() {
	const settings = require(readEnv('prod'), IOS_RELEASE_SETTINGS, 'prod');
	// `$()` keeps an xcconfig from reading `//` as the start of a comment.
	const lines = Object.entries(settings).map(
		([name, value]) => `${name}[config=Release] = ${value.replaceAll('//', '/$()/')}`,
	);
	writeFileSync(
		IOS_CONFIG_PATH,
		`// Generated by bun run env:ios from env-manager prod. Do not edit.\n${lines.join('\n')}\n`,
	);
	chmodSync(IOS_CONFIG_PATH, 0o600);
	console.log(`Wrote ${IOS_RELEASE_SETTINGS.join(', ')} for Release to app-ios/Config/Env.xcconfig`);
}

const commands: Record<string, () => void> = { push, github, check, verify, ios };
const command = commands[process.argv[2] ?? ''];
if (!command) {
	console.error(`Usage: bun scripts/secrets.ts <${Object.keys(commands).join('|')}>`);
	process.exit(1);
}
command();
