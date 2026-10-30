import { parseArgs } from 'node:util';
import { DEV_OWNER_TOKEN } from '../../server/src/config';
import { MEALS, TODAY, USUAL } from '../food-ramble/history';
import { check } from '../food-ramble/score';
import type { LabCase } from './types';

/**
 * Streams lab clips through a running server's live Ramble socket at real-time pace, as the phone would, and prints
 * what came back and when: the end-to-end check of `server/src/food/ramble-live.ts`.
 *
 *   bun scripts/ramble-lab/live.ts --dir .cache/ramble-lab/audio/xai-eve-1x-clean --only mind-changer-1,picker-3 \
 *     [--url http://127.0.0.1:24151] [--token …] [-v]
 */

const { values } = parseArgs({
	options: {
		dir: { type: 'string' },
		only: { type: 'string' },
		url: { type: 'string', default: `http://127.0.0.1:${process.env.API_PORT ?? 6151}` },
		token: { type: 'string', default: DEV_OWNER_TOKEN },
		concurrency: { type: 'string', default: '4' },
		v: { type: 'boolean', default: false },
	},
});
if (!values.dir) throw new Error('--dir <folder of 16 kHz WAV clips> is required');

const lab = (await import('./corpus')).LAB as LabCase[];
const only = values.only?.split(',');
const cases = lab.filter(c => (!only || only.includes(c.id)) && Bun.file(`${values.dir}/${c.id}.wav`).size > 0);

/** 16-bit PCM after the WAV header's data chunk. */
function pcm(wav: Uint8Array) {
	const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
	for (let at = 12; at + 8 <= wav.length; at += 8 + view.getUint32(at + 4, true))
		if (String.fromCharCode(...wav.subarray(at, at + 4)) === 'data') return wav.subarray(at + 8);
	throw new Error('no data chunk');
}

type Result = { c: LabCase; misses: string[]; settleMs: number; firstRowMs: number; outlines: number; error?: string };

async function run(c: LabCase): Promise<Result> {
	const audio = pcm(await Bun.file(`${values.dir}/${c.id}.wav`).bytes());
	const url = new URL('/api/food-database/ramble/live', values.url);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	const Socket = WebSocket as unknown as new (url: URL, options: { headers: Record<string, string> }) => WebSocket;
	const socket = new Socket(url, { headers: { authorization: `Bearer ${values.token}` } });
	const start = performance.now();
	const at = () => Math.round(performance.now() - start);
	let stoppedAt = 0;
	let firstRowMs = Infinity;
	let outlines = 0;
	return new Promise<Result>(resolve => {
		socket.onopen = async () => {
			socket.send(
				JSON.stringify({
					transcript: '',
					today: TODAY,
					time: c.time ?? '20:30',
					meals: MEALS,
					usual: USUAL,
					shown: c.shown ?? [],
				}),
			);
			for (let offset = 0; offset < audio.length; offset += 3200) {
				socket.send(audio.slice(offset, offset + 3200));
				await Bun.sleep(100);
			}
			stoppedAt = at();
			socket.send(JSON.stringify({ type: 'stop' }));
		};
		socket.onmessage = event => {
			const message = JSON.parse(String(event.data));
			if (values.v)
				console.log(
					`  ${c.id} ${String(at()).padStart(6)}ms ${message.type} ${JSON.stringify(message.type === 'outline' ? message.outline.items.map((i: { name: string; said: string }) => `${i.name} «${i.said}»`) : message.type === 'heard' ? `${message.committed} | ${message.partial}` : '')}`,
				);
			if (message.type === 'outline') {
				outlines++;
				if (message.outline.items.length) firstRowMs = Math.min(firstRowMs, at());
			}
			if (message.type === 'done')
				resolve({ c, misses: check(c, message.outline), settleMs: at() - stoppedAt, firstRowMs, outlines });
			if (message.type === 'error')
				resolve({ c, misses: ['error'], settleMs: NaN, firstRowMs, outlines, error: message.message });
		};
		socket.onclose = event =>
			resolve({ c, misses: ['closed'], settleMs: NaN, firstRowMs, outlines, error: `${event.code} ${event.reason}` });
	});
}

const results: Result[] = [];
let next = 0;
await Promise.all(
	Array.from({ length: Number(values.concurrency) }, async () => {
		while (next < cases.length) results.push(await run(cases[next++]!));
	}),
);
const q = (xs: number[], p: number) =>
	xs.filter(Number.isFinite).toSorted((a, b) => a - b)[Math.floor(xs.length * p)] ?? NaN;
for (const r of results)
	console.log(
		`${r.misses.length ? '✗' : '✓'} ${r.c.id.padEnd(18)} settle ${r.settleMs}ms  first row ${r.firstRowMs}ms  outlines ${r.outlines}  ${r.error ?? r.misses.join('; ')}`,
	);
const passed = results.filter(r => !r.misses.length).length;
console.log(
	`\npass ${passed}/${results.length}  settle p50 ${q(
		results.map(r => r.settleMs),
		0.5,
	)}ms p90 ${q(
		results.map(r => r.settleMs),
		0.9,
	)}ms`,
);
