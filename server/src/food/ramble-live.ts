import { z } from 'zod';
import { outlineRamble, RambleRequest, type RambleKeys, type RambleModel, type RambleOutline } from './ramble';

/**
 * Live Ramble: the phone's audio streams to xAI's speech-to-text, and the text model reads the whole transcript again
 * each time it changes (`outlineRamble`), so the list follows the speaker, corrections included, and the last read of
 * the last words is the list: nothing reads the recording after the stop (docs/decisions/nutrition.md, Ramble
 * logging). Both were picked on the labelled rambles of `scripts/ramble-lab/`.
 */

export const LIVE_SAMPLE_RATE = 16_000;
export const STT_MODEL = 'grok-voice-transcribe-2.0';
const STT_URL = 'wss://api.x.ai/v1/stt';
const STT_READY_TIMEOUT_MS = 8_000;
/** The speaker paused this long: the transcript's last words are final enough to read. */
const ENDPOINTING_MS = 400;

export type ReadTiming = {
	/** A read starts this long after the words last changed, so a burst of partials costs one read. */
	debounceMs: number;
	/** Reads in flight at once; the answer for the newest words wins and older answers landing after it are dropped. */
	inflight: number;
	/** After the stop, at most this long for the outline of the last words; then the latest outline stands. */
	settleCapMs: number;
};
export const READ_TIMING: ReadTiming = { debounceMs: 250, inflight: 2, settleCapMs: 6_000 };

export const LiveRambleRequest = RambleRequest;
export type LiveRambleRequest = z.input<typeof LiveRambleRequest>;
const Shown = RambleRequest.shape.shown;

/** What the speaker has said so far: `committed` will not change; `partial` is the words still being heard. */
export type Heard = { committed: string; partial: string };
const joined = (...parts: string[]) => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
export const heardText = (heard: Heard) => joined(heard.committed, heard.partial);
/** Two transcripts that differ only in case or punctuation ("two eggs" and "Two eggs.") read the same. */
const sameWords = (a: string, b: string) => {
	const key = (text: string) =>
		text
			.toLowerCase()
			.replace(/[^\p{L}\p{N}]+/gu, ' ')
			.trim();
	return key(a) === key(b);
};

declare const WebSocketPair: unknown;

/** Bun takes handshake headers in the WebSocket constructor; a Worker can only send them with a fetch upgrade. */
async function dial(url: URL, headers: Record<string, string>): Promise<WebSocket> {
	if (typeof WebSocketPair === 'undefined') {
		const Dialer = WebSocket as unknown as new (url: URL, options: { headers: Record<string, string> }) => WebSocket;
		return new Dialer(url, { headers });
	}
	const response = await fetch(url.href.replace(/^wss:/, 'https:'), { headers: { ...headers, Upgrade: 'websocket' } });
	const socket = (response as Response & { webSocket?: WebSocket & { accept(): void } }).webSocket;
	if (!socket) throw new Error(`xAI refused the speech-to-text socket: ${response.status} ${await response.text()}`);
	socket.accept();
	return socket;
}

type SttMessage = {
	type?: string;
	text?: string;
	is_final?: boolean;
	speech_final?: boolean;
	message?: string;
	error?: string;
};

export type Transcriber = {
	/** 16 kHz mono 16-bit little-endian PCM. */
	audio(pcm: Uint8Array): void;
	/** Ends the audio; `done` follows once the last words are committed. */
	end(): void;
	close(): void;
};
export type TranscriberEvents = { heard(heard: Heard): void; done(): void; error(error: Error): void };
export type Transcribe = (events: TranscriberEvents) => Promise<Transcriber>;

/**
 * xAI's streaming speech-to-text. A partial replaces the words after the last final; `is_final` commits a chunk, and
 * `speech_final` repeats the whole utterance at a pause, of which only what follows the chunks already committed is
 * new. `transcript.done` answers `audio.done` with the whole transcript.
 */
export function xaiTranscriber(key: string): Transcribe {
	return async events => {
		const url = new URL(STT_URL);
		url.search = new URLSearchParams({
			model: STT_MODEL,
			sample_rate: String(LIVE_SAMPLE_RATE),
			encoding: 'pcm',
			language: 'en',
			interim_results: 'true',
			endpointing: String(ENDPOINTING_MS),
			filler_words: 'true',
		}).toString();
		const socket = await dial(url, { Authorization: `Bearer ${key}` });
		socket.binaryType = 'arraybuffer';
		let committed = '';
		let utterance = '';
		let ending = false;
		let over = false;
		const after = (text: string, prefix: string) =>
			prefix && text.toLowerCase().startsWith(prefix.toLowerCase()) ? text.slice(prefix.length).trim() : text;
		const finish = (error?: Error) => {
			if (over) return;
			over = true;
			if (error) events.error(error);
			else events.done();
			socket.close();
		};
		const ready = new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(
				() => reject(new Error('xAI speech-to-text did not start in time')),
				STT_READY_TIMEOUT_MS,
			);
			socket.onmessage = event => {
				let message: SttMessage;
				try {
					message = JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data));
				} catch {
					return;
				}
				if (message.type === 'transcript.created') {
					clearTimeout(timeout);
					return resolve();
				}
				if (message.type === 'error' || /error/.test(message.type ?? '')) {
					const error = new Error(`xAI speech-to-text failed: ${message.message ?? message.error ?? message.type}`);
					clearTimeout(timeout);
					reject(error);
					return finish(error);
				}
				const text = (message.text ?? '').trim();
				if (message.type === 'transcript.done') {
					// The whole transcript; when it revised words already committed, it stands over them.
					if (text)
						committed = text.toLowerCase().startsWith(committed.toLowerCase())
							? joined(committed, after(text, committed))
							: text;
					events.heard({ committed, partial: '' });
					return finish();
				}
				if (message.type !== 'transcript.partial') return;
				if (message.speech_final) {
					committed = joined(committed, after(text, utterance));
					utterance = '';
					events.heard({ committed, partial: '' });
				} else if (message.is_final) {
					utterance = joined(utterance, text);
					committed = joined(committed, text);
					events.heard({ committed, partial: '' });
				} else events.heard({ committed, partial: text });
			};
			socket.onclose = event => {
				clearTimeout(timeout);
				reject(new Error(`xAI speech-to-text closed: ${event.code} ${event.reason}`));
				if (ending) finish();
				else finish(new Error(`xAI speech-to-text closed: ${event.code} ${event.reason}`));
			};
		});
		await ready;
		return {
			audio(pcm) {
				if (!ending && !over) socket.send(pcm as Uint8Array<ArrayBuffer>);
			},
			end() {
				if (ending || over) return;
				ending = true;
				socket.send(JSON.stringify({ type: 'audio.done' }));
			},
			close() {
				over = true;
				socket.close();
			},
		};
	};
}

/**
 * Keeps the outline current with the transcript: every change is read whole, `timing.debounceMs` after the words last
 * changed, with up to `timing.inflight` reads at once. Once the speaker stops, the last words are read at once, past
 * the in-flight limit, since the speaker is waiting on that read alone.
 */
export class Reader {
	#latest = '';
	#issued = '';
	#applied = '';
	#outline: RambleOutline = { items: [] };
	#inflight = 0;
	#sequence = 0;
	#newest = 0;
	#failures = 0;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#final: string | undefined;
	#settled: (() => void) | undefined;
	#closed = false;
	reads = 0;

	constructor(
		private readonly read: (text: string) => Promise<RambleOutline>,
		private readonly events: { outline(outline: RambleOutline): void; error(error: Error): void },
		private readonly timing: ReadTiming = READ_TIMING,
	) {}

	get outline() {
		return this.#outline;
	}

	heard(text: string) {
		if (this.#closed || text === this.#latest) return;
		this.#latest = text;
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => this.#issue(), this.timing.debounceMs);
	}

	/** The outline of exactly `text`, the transcript's last words, or the latest outline after `settleCapMs`. */
	settle(text: string): Promise<RambleOutline> {
		this.#final = text;
		this.#latest = text;
		clearTimeout(this.#timer);
		const settled = new Promise<void>(resolve => (this.#settled = resolve));
		if (!text.trim() || sameWords(this.#applied, text)) this.#settle();
		else if (!sameWords(this.#issued, text)) this.#issue(true);
		const cap = new Promise<void>(resolve => setTimeout(resolve, this.timing.settleCapMs));
		return Promise.race([settled, cap]).then(() => this.#outline);
	}

	close() {
		this.#closed = true;
		clearTimeout(this.#timer);
	}

	#settle() {
		this.#settled?.();
		this.#settled = undefined;
	}

	#issue(force = false) {
		const text = this.#latest;
		if (this.#closed || !text.trim() || sameWords(text, this.#issued)) return;
		if (!force && this.#inflight >= this.timing.inflight) return;
		const mine = ++this.#sequence;
		this.#issued = text;
		this.#inflight++;
		this.reads++;
		this.read(text).then(
			outline => {
				this.#inflight--;
				this.#failures = 0;
				if (this.#closed) return;
				if (mine > this.#newest) {
					this.#newest = mine;
					this.#applied = text;
					this.#outline = outline;
					this.events.outline(outline);
				}
				if (this.#final !== undefined && sameWords(this.#applied, this.#final)) return this.#settle();
				this.#issue(this.#final !== undefined);
			},
			error => {
				this.#inflight--;
				if (this.#closed) return;
				// Every model failed this read; the next change reads again, and a second failure in a row ends the ramble.
				if (++this.#failures >= 2) return this.events.error(error instanceof Error ? error : new Error(String(error)));
				if (sameWords(this.#issued, text)) this.#issued = '';
				this.#issue(this.#final !== undefined);
			},
		);
	}
}

export type LiveEvents = {
	heard(heard: Heard): void;
	outline(outline: RambleOutline): void;
	/** The ramble failed before `finish` resolved. */
	error(error: Error): void;
};
export type LiveResult = { transcript: string; outline: RambleOutline };
export type LiveRamble = {
	audio(pcm: Uint8Array): void;
	/** The options the phone shows now, for picks spoken from here on ("the second one"). */
	shown(shown: z.input<typeof Shown>): void;
	/** Ends the audio and resolves with the outline of every word heard. */
	finish(): Promise<LiveResult>;
	close(): void;
};

export type LiveOptions = { transcribe: Transcribe; models?: readonly RambleModel[]; timing?: ReadTiming };

/**
 * One listen. The request's `transcript` is what earlier listens of the same ramble heard, so every read covers the
 * whole ramble and a correction may reach back past a stop.
 */
export async function openLiveRamble(
	request: LiveRambleRequest,
	keys: RambleKeys,
	events: LiveEvents,
	{ transcribe, models, timing }: LiveOptions,
): Promise<LiveRamble> {
	const context = LiveRambleRequest.parse(request);
	const base = context.transcript;
	let heard: Heard = { committed: base, partial: '' };
	let stt: Transcriber | undefined;
	let failed = false;
	let sttDone: () => void = () => {};
	const transcribed = new Promise<void>(resolve => (sttDone = resolve));
	const fail = (error: Error) => {
		if (failed) return;
		failed = true;
		reader.close();
		stt?.close();
		events.error(error);
	};
	const reader = new Reader(
		text => outlineRamble({ ...context, transcript: text }, keys, { models }),
		{ outline: events.outline, error: fail },
		timing,
	);
	stt = await transcribe({
		heard(words) {
			const next = { committed: joined(base, words.committed), partial: words.partial };
			if (next.committed === heard.committed && next.partial === heard.partial) return;
			heard = next;
			events.heard(heard);
			reader.heard(heardText(heard));
		},
		done: () => sttDone(),
		error: fail,
	});
	const started = Date.now();
	return {
		audio: pcm => stt.audio(pcm),
		shown(shown) {
			context.shown = Shown.parse(shown);
		},
		async finish() {
			const stopped = Date.now();
			stt.end();
			await Promise.race([transcribed, new Promise(resolve => setTimeout(resolve, 2_000))]);
			const transcript = heardText(heard);
			const outline = await reader.settle(transcript);
			// The Worker logs keep how long the speaker waited after the stop, for tuning against real voices.
			console.log(
				`ramble live: ${transcript.split(/\s+/).filter(Boolean).length} words over ${Math.round((stopped - started) / 1000)}s, ${reader.reads} reads, ${outline.items.length} items, settled ${Date.now() - stopped}ms after the stop`,
			);
			return { transcript, outline };
		},
		close() {
			reader.close();
			stt.close();
		},
	};
}

/**
 * The phone's side of `GET /api/food-database/ramble/live`, the same on Bun and in the Worker's Durable Object. The
 * phone sends the ramble's context as its first text message, then 16 kHz PCM as binary frames, `{"type":"shown"}`
 * whenever the options it shows change, and `{"type":"stop"}`. The server answers `ready` once the transcriber
 * listens, `heard` with the transcript and `outline` as they change, and `done` with both after the stop; an `error`
 * closes the socket. Audio sent before `ready` is held, so the first words are not lost.
 */
export type LiveSocket = { send(text: string): void; close(code?: number, reason?: string): void };

export function serveLiveRamble(
	socket: LiveSocket,
	keys: RambleKeys & { xai: string },
	options?: Partial<LiveOptions>,
) {
	let session: LiveRamble | undefined;
	let opening = false;
	let held: Uint8Array[] = [];
	let stopped = false;
	let closed = false;
	const send = (message: Record<string, unknown>) => {
		if (!closed) socket.send(JSON.stringify(message));
	};
	const fail = (error: unknown) => {
		send({ type: 'error', message: error instanceof Error ? error.message : String(error) });
		closed = true;
		session?.close();
		socket.close(1011, 'ramble failed');
	};
	const stop = async (live: LiveRamble) => {
		try {
			send({ type: 'done', ...(await live.finish()) });
		} catch (error) {
			fail(error);
			return;
		}
		live.close();
		closed = true;
		socket.close(1000, 'done');
	};
	return {
		message(data: string | ArrayBuffer | Uint8Array) {
			if (closed) return;
			if (typeof data !== 'string') {
				const pcm = data instanceof Uint8Array ? data : new Uint8Array(data);
				if (session) session.audio(pcm);
				else held.push(pcm);
				return;
			}
			if (opening) {
				let message: { type?: string; shown?: unknown };
				try {
					message = JSON.parse(data);
				} catch {
					return;
				}
				if (message.type === 'shown') {
					const shown = Shown.safeParse(message.shown);
					if (shown.success) session?.shown(shown.data);
				}
				if (message.type !== 'stop') return;
				stopped = true;
				if (session) void stop(session);
				return;
			}
			opening = true;
			let context: unknown;
			try {
				context = JSON.parse(data);
			} catch {
				return fail(new Error('The first message is the ramble context as JSON'));
			}
			const parsed = LiveRambleRequest.safeParse(context);
			if (!parsed.success) return fail(new Error(`Bad ramble context: ${parsed.error.message}`));
			openLiveRamble(
				parsed.data,
				keys,
				{
					heard: heard => send({ type: 'heard', ...heard }),
					outline: outline => send({ type: 'outline', outline }),
					error: fail,
				},
				{
					transcribe: options?.transcribe ?? xaiTranscriber(keys.xai),
					models: options?.models,
					timing: options?.timing,
				},
			).then(live => {
				if (closed) return live.close();
				session = live;
				send({ type: 'ready' });
				for (const pcm of held) live.audio(pcm);
				held = [];
				if (stopped) void stop(live);
			}, fail);
		},
		close() {
			closed = true;
			session?.close();
		},
	};
}
