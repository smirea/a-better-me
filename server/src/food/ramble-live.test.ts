import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import type { RambleOutline } from './ramble';
import { Reader, serveLiveRamble, type Transcribe, type TranscriberEvents } from './ramble-live';

const context = { transcript: '', today: '2026-10-28', time: '08:15' };
const outline = (...names: string[]): RambleOutline => ({
	items: names.map(name => ({
		kind: 'food',
		name,
		amount: 0,
		unit: '',
		ref: null,
		copy: null,
		except: [],
		day: null,
		meal: '',
		time: '',
		options: false,
		said: name,
	})),
});
const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

/** A read per call that answers only when told to, with the foods its text names. */
function reads() {
	const calls: { text: string; answer(): void; fail(): void }[] = [];
	const read = (text: string) =>
		new Promise<RambleOutline>((resolve, reject) =>
			calls.push({
				text,
				answer: () => resolve(outline(...text.split(' and '))),
				fail: () => reject(new Error('both models failed')),
			}),
		);
	return { calls, read };
}

describe('Reader', () => {
	const timing = { debounceMs: 5, inflight: 2, settleCapMs: 500 };

	test('a burst of words is one read, and an older answer landing after a newer one is dropped', async () => {
		const { calls, read } = reads();
		const shown: string[][] = [];
		const reader = new Reader(read, { outline: o => shown.push(o.items.map(i => i.name)), error: () => {} }, timing);
		reader.heard('eggs');
		reader.heard('eggs and toast');
		await tick(20);
		reader.heard('eggs and toast and coffee');
		await tick(20);
		expect(calls.map(call => call.text)).toEqual(['eggs and toast', 'eggs and toast and coffee']);
		calls[1]!.answer();
		calls[0]!.answer();
		await tick();
		expect(shown).toEqual([['eggs', 'toast', 'coffee']]);
	});

	test('the stop reads the last words at once, past the in-flight limit, and settles on their answer', async () => {
		const { calls, read } = reads();
		const reader = new Reader(read, { outline: () => {}, error: () => {} }, { ...timing, inflight: 1 });
		reader.heard('eggs');
		await tick(20);
		const settled = reader.settle('eggs and toast');
		await tick();
		expect(calls.map(call => call.text)).toEqual(['eggs', 'eggs and toast']);
		calls[1]!.answer();
		expect((await settled).items.map(item => item.name)).toEqual(['eggs', 'toast']);
	});

	test('the last words already read settle at once, punctuation aside', async () => {
		const { calls, read } = reads();
		const reader = new Reader(read, { outline: () => {}, error: () => {} }, timing);
		reader.heard('two eggs');
		await tick(20);
		calls[0]!.answer();
		await tick();
		expect((await reader.settle('Two eggs.')).items.map(item => item.name)).toEqual(['two eggs']);
		expect(calls).toHaveLength(1);
	});

	test('a failed read is read again, and a second failure in a row ends the ramble', async () => {
		const { calls, read } = reads();
		const errors: Error[] = [];
		const reader = new Reader(read, { outline: () => {}, error: e => errors.push(e) }, timing);
		reader.heard('eggs');
		await tick(20);
		calls[0]!.fail();
		await tick();
		expect(calls.map(call => call.text)).toEqual(['eggs', 'eggs']);
		expect(errors).toEqual([]);
		calls[1]!.fail();
		await tick();
		expect(errors.map(e => e.message)).toEqual(['both models failed']);
	});
});

/** A transcriber the test speaks through. */
function fakeStt() {
	let events: TranscriberEvents | undefined;
	const audio: number[] = [];
	const transcribe: Transcribe = async given => {
		events = given;
		return {
			audio: pcm => audio.push(pcm.byteLength),
			end: () => setTimeout(() => events!.done(), 1),
			close: () => {},
		};
	};
	return { transcribe, audio, say: (committed: string, partial = '') => events!.heard({ committed, partial }) };
}

let sent: { url: string; transcript: string }[] = [];
afterEach(() => {
	(globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
	sent = [];
});
/** Gemini answers each read with one food per "and" of its transcript. */
function stubGemini() {
	spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL, init?: RequestInit) => {
		const body = JSON.parse(String(init?.body));
		const transcript = String(body.contents[0].parts[0].text).replace(/^Ramble: /, '');
		sent.push({ url: String(input), transcript });
		const items = transcript.split(' and ').map(name => ({ kind: 'food', name, said: name }));
		return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items }) }] } }] });
	}) as typeof fetch);
}

describe('serveLiveRamble', () => {
	test('audio before ready is held, words stream back, and the stop answers the outline of every word', async () => {
		stubGemini();
		const stt = fakeStt();
		const messages: Record<string, unknown>[] = [];
		const closes: number[] = [];
		const live = serveLiveRamble(
			{ send: text => messages.push(JSON.parse(text)), close: code => closes.push(code ?? 0) },
			{ gemini: 'gemini-key', xai: 'xai-key' },
			{ transcribe: stt.transcribe, timing: { debounceMs: 1, inflight: 2, settleCapMs: 500 } },
		);
		live.message(JSON.stringify({ ...context, transcript: 'oats' }));
		live.message(new Uint8Array(3200));
		await tick();
		expect(messages).toEqual([{ type: 'ready' }]);
		expect(stt.audio).toEqual([3200]);
		stt.say('and eggs', 'and toast');
		await tick(20);
		live.message(JSON.stringify({ type: 'shown', shown: [{ item: 1, options: ['Egg, whole, boiled'] }] }));
		live.message(JSON.stringify({ type: 'stop' }));
		await tick(20);
		expect(messages.filter(m => m.type === 'heard')).toEqual([
			{ type: 'heard', committed: 'oats and eggs', partial: 'and toast' },
		]);
		expect(sent.map(s => s.transcript)).toEqual(['oats and eggs and toast']);
		expect(messages.at(-1)).toEqual({
			type: 'done',
			transcript: 'oats and eggs and toast',
			outline: outline('oats', 'eggs', 'toast'),
		});
		expect(closes).toEqual([1000]);
	});

	test('a bad context is an error that closes the socket', () => {
		const messages: Record<string, unknown>[] = [];
		const closes: number[] = [];
		const live = serveLiveRamble(
			{ send: text => messages.push(JSON.parse(text)), close: code => closes.push(code ?? 0) },
			{ gemini: 'gemini-key', xai: 'xai-key' },
			{ transcribe: fakeStt().transcribe },
		);
		live.message(JSON.stringify({ today: 'soon' }));
		expect(messages[0]!.type).toBe('error');
		expect(closes).toEqual([1011]);
	});
});
