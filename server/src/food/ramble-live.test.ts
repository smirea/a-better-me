import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import type { RambleOutline } from './ramble';
import {
	Reader,
	serveLiveRamble,
	wordsAfter,
	xaiTranscriber,
	type Heard,
	type SttSocket,
	type Transcribe,
	type TranscriberEvents,
} from './ramble-live';

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

	test('words that stop mid-amount wait four debounces for the food, so "dinner, 200" is not read as dinner rolls', async () => {
		const { calls, read } = reads();
		const reader = new Reader(read, { outline: () => {}, error: () => {} }, { ...timing, debounceMs: 10 });
		reader.heard('dinner, 200');
		await tick(20);
		expect(calls).toEqual([]);
		reader.heard('dinner, 200 grams of tofu');
		await tick(20);
		expect(calls.map(call => call.text)).toEqual(['dinner, 200 grams of tofu']);
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
	test('words committed after the stop are read as the last words, and closing ends a settle at once', async () => {
		const { calls, read } = reads();
		const reader = new Reader(read, { outline: () => {}, error: () => {} }, timing);
		const settled = reader.settle('eggs');
		reader.heard('eggs and toast');
		await tick();
		expect(calls.map(call => call.text)).toEqual(['eggs', 'eggs and toast']);
		calls[0]!.answer();
		calls[1]!.answer();
		expect((await settled).items.map(item => item.name)).toEqual(['eggs', 'toast']);
		const closing = new Reader(read, { outline: () => {}, error: () => {} }, timing);
		const started = Date.now();
		const settling = closing.settle('coffee');
		closing.close();
		expect(await settling).toEqual(outline());
		expect(Date.now() - started).toBeLessThan(timing.settleCapMs);
	});
});

describe('xaiTranscriber', () => {
	/** A socket shaped like a Worker's: listeners only, no `onmessage`. */
	function workerSocket() {
		const listeners: Record<string, ((event: never) => void)[]> = {};
		const sent: unknown[] = [];
		const socket: SttSocket = {
			binaryType: 'blob',
			send: data => sent.push(data),
			close: () => listeners.close?.forEach(listener => listener({ code: 1000, reason: '' } as never)),
			addEventListener: (type: string, listener: (event: never) => void) => (listeners[type] ??= []).push(listener),
		};
		const say = (message: object) =>
			listeners.message?.forEach(listener => listener({ data: JSON.stringify(message) } as never));
		return { socket, sent, say };
	}

	test("a Worker's socket starts, partials replace the tail, and a pause's repeat of the utterance adds only its new words", async () => {
		const { socket, sent, say } = workerSocket();
		const heard: Heard[] = [];
		let done = false;
		const starting = xaiTranscriber(
			'key',
			async () => socket,
		)({
			heard: words => heard.push(words),
			done: () => (done = true),
			error: error => {
				throw error;
			},
		});
		await tick();
		say({ type: 'transcript.created' });
		const stt = await starting;
		stt.audio(new Uint8Array(4));
		say({ type: 'transcript.partial', text: 'two eggs', is_final: false });
		say({ type: 'transcript.partial', text: 'two eggs,', is_final: true });
		say({ type: 'transcript.partial', text: 'and toast', is_final: false });
		say({ type: 'transcript.partial', text: 'Two eggs and toast.', is_final: true, speech_final: true });
		stt.end();
		say({ type: 'transcript.done', text: 'Two eggs and toast. Coffee.' });
		expect(heard).toEqual([
			{ committed: '', partial: 'two eggs' },
			{ committed: 'two eggs,', partial: '' },
			{ committed: 'two eggs,', partial: 'and toast' },
			{ committed: 'two eggs, and toast.', partial: '' },
			{ committed: 'two eggs, and toast. Coffee.', partial: '' },
		]);
		expect(done).toBe(true);
		expect(sent).toEqual([new Uint8Array(4), '{"type":"audio.done"}']);
	});

	test('a prefix matches by words, case and punctuation aside', () => {
		expect(wordsAfter('Two eggs and toast.', 'two eggs,')).toBe('and toast.');
		expect(wordsAfter('Three eggs and toast.', 'two eggs,')).toBeNull();
		expect(wordsAfter('eggs', '')).toBe('eggs');
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
