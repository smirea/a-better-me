/**
 * The local Postgres and PowerSync in `docker/compose.yaml`. One Postgres container on port 6159 serves every checkout,
 * each in its own database next to a `<database>_powersync` database for that checkout's PowerSync container, which
 * listens on the checkout's base port + 2. `setup-worktree.ts` and `teardown-worktree.ts` drive it for worktrees; the
 * main checkout runs it by hand:
 *
 *   bun scripts/local-stack.ts [up] [--reset-db]   start the stack, migrate, and point .env.override at it
 *   bun scripts/local-stack.ts down                stop this checkout's PowerSync; the databases stay
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
// Loaded where it connects: `setup-worktree.ts` imports this file before its `bun install` has run in a new worktree.
import type postgres from 'postgres';
import { parseDotenv, readOverride, run as runCommand } from './lib';

export const POSTGRES_PORT = 6159;
const ADMIN_URL = `postgres://postgres:postgres@127.0.0.1:${POSTGRES_PORT}/postgres`;
const PROJECT = 'a-better-me';
const CONTAINER_PREFIX = `${PROJECT}-powersync-`;
const root = join(import.meta.dir, '..');
const compose = join(root, 'docker/compose.yaml');

const run = (cmd: string[], env?: Record<string, string>) => runCommand(cmd, { env });
const connectTo = async (url: string) => (await import('postgres')).default(url, { max: 1, onnotice: () => {} });

export const databaseUrl = (database: string) => `postgres://postgres:postgres@127.0.0.1:${POSTGRES_PORT}/${database}`;

function isMainCheckout(checkout: string): boolean {
	const git = (...args: string[]) => runCommand(['git', '-C', checkout, 'rev-parse', ...args]);
	return git('--git-dir') === git('--git-common-dir');
}

/** The container suffix and database name: the worktree directory, which outlives a branch rename, or `main`. */
export function checkoutKey(checkout: string): string {
	return isMainCheckout(checkout) ? 'main' : basename(checkout).replaceAll(/[^A-Za-z0-9_.-]/g, '-');
}

/** Postgres identifiers are 63 bytes, and the `_powersync` suffix needs room. */
export function databaseName(checkout: string): string {
	const key = checkoutKey(checkout);
	return key === 'main'
		? 'main'
		: `wt_${key
				.toLowerCase()
				.replaceAll(/[^a-z0-9]+/g, '_')
				.slice(0, 45)}`;
}

const containerName = (checkout: string) => `${CONTAINER_PREFIX}${checkoutKey(checkout)}`;

export function dockerRunning(): boolean {
	return spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
}

export function requireDocker(): void {
	if (!dockerRunning()) {
		throw new Error('Docker is not running. Start Docker Desktop (or `colima start`), then rerun this script.');
	}
}

async function withAdmin<T>(use: (sql: postgres.Sql) => Promise<T>): Promise<T> {
	const sql = await connectTo(ADMIN_URL);
	try {
		return await use(sql);
	} finally {
		await sql.end();
	}
}

const databasesOf = (database: string) => [database, `${database}_powersync`];

/** A replication slot outlives its PowerSync container and blocks `DROP DATABASE`, so it goes first. */
async function dropDatabase(sql: postgres.Sql, name: string): Promise<void> {
	await sql`SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots WHERE database = ${name}`;
	await sql.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
}

async function ensureDatabases(database: string, reset: boolean): Promise<void> {
	await withAdmin(async sql => {
		for (const name of databasesOf(database)) {
			const exists = (await sql`SELECT 1 FROM pg_database WHERE datname = ${name}`).length > 0;
			if (exists && reset) await dropDatabase(sql, name);
			if (!exists || reset) await sql.unsafe(`CREATE DATABASE "${name}"`);
		}
	});
}

export async function dropDatabases(database: string): Promise<void> {
	await withAdmin(async sql => {
		for (const name of databasesOf(database)) await dropDatabase(sql, name);
	});
}

/**
 * PowerSync answers `No sync config available` until it has replicated the publication, which the migrations create,
 * so the stack migrates before PowerSync starts and waits for its first replication before anything uses it.
 */
async function migrateApp(database: string): Promise<void> {
	const { connect } = await import('../server/src/db/postgres');
	const { migrate } = await import('../server/src/db/migrate');
	const connection = connect(databaseUrl(database));
	try {
		await migrate(connection.db);
	} finally {
		await connection.end();
	}
}

/** PowerSync marks its sync config `ACTIVE` in its storage database once the first replication finished. */
async function waitForReplication(name: string, storage: string): Promise<void> {
	const sql = await connectTo(databaseUrl(storage));
	try {
		for (const deadline = Date.now() + 60_000; Date.now() < deadline; await Bun.sleep(500)) {
			const active = await sql`SELECT 1 FROM powersync.sync_rules WHERE state = 'ACTIVE'`.catch(() => []);
			if (active.length) return;
		}
	} finally {
		await sql.end();
	}
	throw new Error(`PowerSync did not start replicating within 60 s. See \`docker logs ${name}\`.`);
}

function writeServiceConfig(checkout: string, database: string): string {
	const template = readFileSync(join(root, 'powersync/local/service.template.yaml'), 'utf8');
	const dir = join(checkout, '.powersync');
	mkdirSync(dir, { recursive: true });
	const file = join(dir, 'service.yaml');
	writeFileSync(file, template.replaceAll('{{DATABASE}}', database));
	return file;
}

export type Stack = { DATABASE_URL: string; POWERSYNC_URL: string };

/**
 * Starts the shared Postgres, this checkout's databases, and its PowerSync on `base + 2`, migrated and replicating.
 * Postgres starts with `--no-recreate` because every checkout shares it: a compose change would otherwise recreate it
 * under every other checkout's running servers.
 */
export async function stackUp(checkout: string, base: number, reset = false): Promise<Stack> {
	requireDocker();
	run(['docker', 'compose', '-f', compose, '-p', PROJECT, 'up', '-d', '--wait', '--no-recreate', 'postgres']);
	const database = databaseName(checkout);
	// PowerSync holds its slot open, and a reset drops the databases it replicates.
	if (reset) stopPowerSync(checkout);
	await ensureDatabases(database, reset);
	await migrateApp(database);
	const name = containerName(checkout);
	const port = base + 2;
	run(
		[
			'docker',
			'compose',
			'-f',
			compose,
			'-p',
			`${PROJECT}-${checkoutKey(checkout)}`,
			'up',
			'-d',
			'--wait',
			'powersync',
		],
		{
			CHECKOUT: checkoutKey(checkout),
			CHECKOUT_PATH: checkout,
			POWERSYNC_PORT: String(port),
			POWERSYNC_SERVICE_CONFIG: writeServiceConfig(checkout, database),
		},
	);
	for (const deadline = Date.now() + 60_000; ; await Bun.sleep(500)) {
		const alive = await fetch(`http://127.0.0.1:${port}/probes/liveness`).catch(() => null);
		if (alive?.ok) break;
		if (Date.now() > deadline) {
			throw new Error(`PowerSync did not answer on port ${port} within 60 s. See \`docker logs ${name}\`.`);
		}
	}
	await waitForReplication(name, `${database}_powersync`);
	return { DATABASE_URL: databaseUrl(database), POWERSYNC_URL: `http://127.0.0.1:${port}` };
}

export function stopPowerSync(checkout: string): void {
	spawnSync('docker', ['rm', '-f', containerName(checkout)], { stdio: 'ignore' });
}

if (import.meta.main) {
	const args = process.argv.slice(2);
	const command = args.find(arg => !arg.startsWith('--')) ?? 'up';
	const checkout = runCommand(['git', 'rev-parse', '--show-toplevel']);
	if (command === 'down') {
		stopPowerSync(checkout);
		console.log(`Stopped ${containerName(checkout)}. The databases stay; \`up --reset-db\` recreates them.`);
	} else if (command === 'up') {
		const values = (file: string) => (existsSync(file) ? parseDotenv(readFileSync(file, 'utf8')) : {});
		const override = readOverride(checkout) ?? {};
		const base = Number(
			override.CLIENT_PORT ??
				values(join(checkout, '.env.local')).CLIENT_PORT ??
				values(join(checkout, '.env')).CLIENT_PORT,
		);
		if (!Number.isInteger(base)) throw new Error('No numeric CLIENT_PORT in .env.override, .env.local, or .env.');
		const stack = await stackUp(checkout, base, args.includes('--reset-db'));
		const merged = { ...override, ...stack };
		writeFileSync(
			join(checkout, '.env.override'),
			`${Object.entries(merged)
				.map(([key, value]) => `${key}=${value}`)
				.join('\n')}\n`,
		);
		run(['bunx', 'env-manager', 'gen', '--local']);
		console.log(`Local stack ready.\n  database   ${stack.DATABASE_URL}\n  powersync  ${stack.POWERSYNC_URL}`);
	} else {
		throw new Error('Usage: bun scripts/local-stack.ts [up|down] [--reset-db]');
	}
}
