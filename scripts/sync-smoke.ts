/**
 * Proves the sync loop against a running server: `bun scripts/sync-smoke.ts [--api http://127.0.0.1:16151]
 * [--token <owner token>]`. Gets a token, opens the stream through the proxy, uploads a put, a patch, and a delete of a
 * template and sees each stream back, then sees a bad write rejected alone. Exits non-zero on the first failure. The
 * API defaults to this checkout's `.env.override`, the token to the local development one.
 */
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { DEV_OWNER_TOKEN } from '../server/src/config';
import { readOverride } from './lib';

const { values: flags } = parseArgs({ options: { api: { type: 'string' }, token: { type: 'string' } } });
const api = flags.api ?? readOverride(join(import.meta.dir, '..'))?.API_URL ?? 'http://127.0.0.1:6151';
const headers = { authorization: `Bearer ${flags.token ?? DEV_OWNER_TOKEN}`, 'content-type': 'application/json' };

function check(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(`FAIL ${message}`);
	console.log(`ok   ${message}`);
}

async function json<T>(response: Response, what: string): Promise<T> {
	check(response.ok, `${what} answered ${response.status}`);
	return (await response.json()) as T;
}

type Entry = { op: string; object_type: string; object_id: string; data: string | null };
type StreamLine = { checkpoint_complete?: unknown; data?: { data: Entry[] } };

/**
 * PowerSync's newline-delimited sync stream, read across several waits. Every line is kept, and a wait scans the
 * history before reading more, so a row that arrived while the script looked for something else still counts.
 */
function openStream(response: Response) {
	const reader = response.body!.getReader();
	const decoder = new TextDecoder();
	const history: StreamLine[] = [];
	let buffer = '';
	let pending: ReturnType<typeof reader.read> | null = null;
	return {
		async until(matches: (line: StreamLine) => boolean, timeoutMs = 15_000): Promise<StreamLine | null> {
			const deadline = Date.now() + timeoutMs;
			let scanned = 0;
			while (Date.now() < deadline) {
				for (; scanned < history.length; scanned++) if (matches(history[scanned]!)) return history[scanned]!;
				pending ??= reader.read();
				const next = await Promise.race([pending, Bun.sleep(deadline - Date.now()).then(() => null)]);
				if (!next || next.done) return null;
				pending = null;
				buffer += decoder.decode(next.value, { stream: true });
				const parts = buffer.split('\n');
				buffer = parts.pop() ?? '';
				for (const text of parts) if (text.trim()) history.push(JSON.parse(text) as StreamLine);
			}
			return null;
		},
		close: () => reader.cancel(),
	};
}

/** The row data of the first matching stream entry, or null when none arrives in time. */
async function row(
	stream: ReturnType<typeof openStream>,
	id: string,
	op: 'PUT' | 'REMOVE',
	predicate: (row: Record<string, unknown>) => boolean = () => true,
	table = 'workout_templates',
): Promise<Record<string, unknown> | null> {
	const find = (line: StreamLine) =>
		line.data?.data.find(
			entry =>
				entry.object_type === table &&
				entry.object_id === id &&
				entry.op === op &&
				predicate(JSON.parse(entry.data ?? '{}')),
		);
	const line = await stream.until(line => Boolean(find(line)));
	return line ? JSON.parse(find(line)!.data ?? '{}') : null;
}

const upload = async (writes: unknown[]) =>
	json<{ rejected: { table: string; id: string; reason: string }[] }>(
		await fetch(`${api}/api/upload`, { method: 'POST', headers, body: JSON.stringify({ writes }) }),
		`upload of ${writes.length} write(s)`,
	);

const started = performance.now();
const unauthorized = await fetch(`${api}/api/sync/token`);
check(unauthorized.status === 401, `GET /api/sync/token without the bearer answered ${unauthorized.status}`);

const { token, endpoint } = await json<{ token: string; endpoint: string }>(
	await fetch(`${api}/api/sync/token`, { headers }),
	'GET /api/sync/token',
);
check(endpoint === `${api}/api/powersync`, `endpoint is the proxy: ${endpoint}`);

const response = await fetch(`${endpoint}/sync/stream`, {
	method: 'POST',
	headers: { authorization: `Token ${token}`, 'content-type': 'application/json' },
	body: JSON.stringify({
		buckets: [],
		include_checksum: true,
		raw_data: true,
		client_id: `smoke-${crypto.randomUUID()}`,
		streams: { include_defaults: true, subscriptions: [] },
	}),
});
check(response.ok, `sync stream opened through the proxy (${response.status})`);
check(!response.headers.get('content-encoding'), 'proxy stripped content-encoding');
const stream = openStream(response);
check(await stream.until(line => 'checkpoint_complete' in line), 'first checkpoint completed');

const id = crypto.randomUUID().toUpperCase();
const now = new Date().toISOString();
let result = await upload([
	{
		op: 'put',
		table: 'workout_templates',
		id,
		values: { name: 'Smoke', blocks: JSON.stringify([{ id: 'b1', exercises: [] }]), created_at: now, updated_at: now },
	},
]);
check(result.rejected.length === 0, 'put accepted');
const put = await row(stream, id, 'PUT', row => row.name === 'Smoke');
check(put, 'put streamed back');
console.log(`     wire row: ${JSON.stringify(put)}`);

result = await upload([{ op: 'patch', table: 'workout_templates', id, values: { name: 'Smoke patched' } }]);
check(result.rejected.length === 0, 'patch accepted');
check(await row(stream, id, 'PUT', row => row.name === 'Smoke patched'), 'patch streamed back');

result = await upload([{ op: 'delete', table: 'workout_templates', id }]);
check(result.rejected.length === 0, 'delete accepted');
check(await row(stream, id, 'REMOVE'), 'delete streamed back as a REMOVE');

const good = crypto.randomUUID().toUpperCase();
result = await upload([
	{ op: 'put', table: 'workout_templates', id: crypto.randomUUID(), values: { name: 'No timestamps' } },
	{ op: 'put', table: 'workout_templates', id: good, values: { name: 'Smoke good', created_at: now, updated_at: now } },
]);
check(
	result.rejected.length === 1 && result.rejected[0]!.reason === 'created_at, updated_at: required',
	`bad write rejected alone: ${JSON.stringify(result.rejected)}`,
);
check(await row(stream, good, 'PUT', row => row.name === 'Smoke good'), 'the good write beside it streamed back');
await upload([{ op: 'delete', table: 'workout_templates', id: good }]);
check(await row(stream, good, 'REMOVE'), 'cleanup delete streamed back');

const exercise = `custom-${crypto.randomUUID()}`;
result = await upload([
	{ op: 'put', table: 'custom_exercises', id: exercise, values: { exercise: '{"name":"Sled push"}', is_archived: 1 } },
]);
check(result.rejected.length === 0, 'custom exercise put accepted');
const archived = await row(stream, exercise, 'PUT', row => row.is_archived === 1, 'custom_exercises');
check(archived, `a boolean streams back as 1: ${JSON.stringify(archived)}`);
await upload([{ op: 'delete', table: 'custom_exercises', id: exercise }]);
check(await row(stream, exercise, 'REMOVE', undefined, 'custom_exercises'), 'custom exercise delete streamed back');

await stream.close();
console.log(`\nSync smoke passed in ${Math.round(performance.now() - started)} ms against ${api}`);
