import { z } from 'zod';
import {
	aliases,
	MEALS,
	ModelItem,
	ModelOutline,
	rambleInstructions,
	RambleRequest,
	resolveAliases,
	type Aliases,
	type RambleOutline,
} from './ramble';

/**
 * Ramble on Gemini Live, the way Todoist's Ramble works: the speaker's audio streams to one Live session, which
 * transcribes it and calls `add_food`, `add_copy`, `edit_item`, and `remove_item` as each item becomes clear. The
 * tool calls build the same model items the text read returns, so `resolveAliases` maps them to the phone's ids.
 * Ported from procrastimate's `server/src/ramble-gemini.ts`.
 */

export const RAMBLE_LIVE_MODEL = 'gemini-3.1-flash-live-preview';
export const LIVE_SAMPLE_RATE = 16_000;
const LIVE_URL =
	'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
/**
 * After the audio ends, how long Gemini may stay silent before the items are taken as they are, once every word heard
 * was answered. A turn still unanswered waits `UNANSWERED_QUIET_MS` from Gemini's last message, since Gemini
 * sometimes never answers a turn, and at most `FINISH_CAP_MS` in all.
 */
const QUIET_AFTER_END_MS = 800;
const UNANSWERED_QUIET_MS = 2_000;
const FINISH_CAP_MS = 6_000;
const SETUP_TIMEOUT_MS = 8_000;
const ACTIVITY_START = JSON.stringify({ realtimeInput: { activityStart: {} } });
const ACTIVITY_END = JSON.stringify({ realtimeInput: { activityEnd: {} } });
/**
 * Whether a 16-bit frame holds speech is judged against the speaker's own levels, not a fixed RMS: the phone records
 * in measurement mode, with no gain control, and a voice there sat near the 300 the TTS rambles were tuned on, so turns
 * opened late and broke mid-word, and Gemini made foods up from the pieces. A frame is voiced above `FLOOR_RATIO` times
 * the noise floor and `PEAK_RATIO` times the loudest recent speech, and never at or below `MIN_VOICED_RMS`.
 */
const MIN_VOICED_RMS = 60;
const FLOOR_RATIO = 4;
const PEAK_RATIO = 0.05;
/** Per 100 ms: the floor rises this share of the way toward a louder frame, so steady speech never becomes it. */
const FLOOR_RISE = 0.002;
/** Per 100 ms: the peak decays by this factor, halving in about 35 s. */
const PEAK_DECAY = 0.998;
/** Quiet speech is raised toward this peak RMS before Gemini hears it, at most `MAX_GAIN` times. */
const TARGET_PEAK = 5_000;
const MAX_GAIN = 16;

export type TurnTiming = {
	/** Silence that ends a turn, so Gemini answers what it heard while the speaker goes on. */
	pauseMs: number;
	/** Past this a turn ends at the next dip between words, so rows appear while someone talks without pausing. */
	dipAfterMs: number;
	/** Past this a turn ends on the next frame, dip or not. */
	maxMs: number;
};
export const TURN_TIMING: TurnTiming = { pauseMs: 350, dipAfterMs: 3_000, maxMs: 5_000 };
/** A frame this far below the turn's mean loudness is a gap between words. */
const DIP = 0.5;
/** Less speech than this in a turn, such as the tail of a word after a split, Gemini transcribes as invented Spanish. */
const MIN_VOICED_MS = 300;

export const LiveRambleRequest = RambleRequest.omit({ transcript: true, audio: true });
export type LiveRambleRequest = z.input<typeof LiveRambleRequest>;

type Args = Record<string, unknown>;
type Item = z.input<typeof ModelItem> & { id: string };

function tools(names: Aliases) {
	const entries = [...names.entries.keys()];
	const meals = [...names.meals.keys()];
	const when = {
		meal: { type: 'STRING', enum: [...MEALS] },
		time: { type: 'STRING', description: 'A said clock time as 24-hour HH:MM.' },
		day: { type: 'INTEGER', description: 'Days from today when the speaker named the day: 0 today, -1 yesterday.' },
	};
	const food = {
		name: { type: 'STRING' },
		amount: { type: 'NUMBER' },
		unit: { type: 'STRING' },
		...(entries.length ? { ref: { type: 'STRING', enum: entries } } : {}),
		...when,
		options: { type: 'BOOLEAN' },
	};
	const id = { type: 'STRING', description: 'A short id you choose (1, 2, 3, ...), unique in this ramble.' };
	const except = entries.length ? { except: { type: 'ARRAY', items: { type: 'STRING', enum: entries } } } : {};
	return [
		{
			functionDeclarations: [
				{
					name: 'add_food',
					description: 'Add a food or drink the speaker just said.',
					parameters: { type: 'OBJECT', properties: { id, ...food }, required: ['id', 'name'] },
				},
				...(meals.length
					? [
							{
								name: 'add_copy',
								description: 'Add a whole logged meal again.',
								parameters: {
									type: 'OBJECT',
									properties: { id, copy: { type: 'STRING', enum: meals }, ...except, ...when },
									required: ['id', 'copy'],
								},
							},
						]
					: []),
				{
					name: 'edit_item',
					description: 'Change an item added earlier, for a correction or a back-reference. Pass only what changes.',
					parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' }, ...food, ...except }, required: ['id'] },
				},
				{
					name: 'remove_item',
					description: 'Remove an item added earlier ("scratch that", "I didn\'t have the toast").',
					parameters: { type: 'OBJECT', properties: { id: { type: 'STRING' } }, required: ['id'] },
				},
			],
		},
	];
}

const FIELDS = ['name', 'amount', 'unit', 'ref', 'copy', 'except', 'meal', 'time', 'day', 'options'] as const;

/** The items the tool calls built, in the order first said. A repeated `add_food` updates the food it repeats. */
export class LiveItems {
	readonly #items = new Map<string, Item>();
	#next = 1;

	apply(name: string, args: Args): Args {
		if (name === 'add_food' || name === 'add_copy') {
			const kind = name === 'add_food' ? 'food' : 'copy';
			const key = (item: Item) => (item.kind === 'food' ? item.name?.trim().toLowerCase() : item.copy);
			const fresh = { kind, id: '' } as Item;
			this.#update(fresh, args);
			const same = [...this.#items.values()].find(item => item.kind === kind && key(item) === key(fresh));
			if (same) {
				this.#update(same, args);
				return { id: same.id, note: 'Already in the list. Do not add it again; use edit_item to change it.' };
			}
			const id = typeof args.id === 'string' && args.id && !this.#items.has(args.id) ? args.id : `auto${this.#next++}`;
			this.#items.set(id, { ...fresh, id });
			return { id, note: 'Added. Use edit_item to change it.' };
		}
		const item = this.#items.get(String(args.id));
		if (!item) return { error: 'No item has that id.' };
		if (name === 'edit_item') this.#update(item, args);
		if (name === 'remove_item') this.#items.delete(item.id);
		return { ok: true };
	}

	outline(input: z.output<typeof LiveRambleRequest>, names: Aliases): RambleOutline {
		const items = [...this.#items.values()].flatMap(({ id: _, ...item }) => {
			const parsed = ModelItem.safeParse(item);
			return parsed.success ? [parsed.data] : [];
		});
		return resolveAliases(ModelOutline.parse({ items }), { ...input, transcript: '' }, names);
	}

	#update(item: Item, args: Args) {
		for (const field of FIELDS)
			if (args[field] !== undefined && args[field] !== null) Object.assign(item, { [field]: args[field] });
	}
}

export type LiveEvents = {
	transcript(text: string): void;
	outline(outline: RambleOutline): void;
	/** The upstream session ended before `finish` resolved. */
	error(error: Error): void;
};
export type LiveResult = { transcript: string; outline: RambleOutline };
export type LiveRamble = {
	/** 16 kHz mono 16-bit little-endian PCM. */
	audio(pcm: Uint8Array): void;
	/** Ends the audio and resolves once Gemini has answered every word it heard. */
	finish(): Promise<LiveResult>;
	close(): void;
};

/** No `Buffer`: the Worker runs without Node compatibility. */
function base64(bytes: Uint8Array) {
	let text = '';
	for (const byte of bytes) text += String.fromCharCode(byte);
	return btoa(text);
}

function amplify(pcm: Uint8Array, gain: number): Uint8Array {
	if (gain === 1) return pcm;
	const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
	const out = new Int16Array(samples.length);
	for (let i = 0; i < samples.length; i++) out[i] = Math.max(-32_768, Math.min(32_767, Math.round(samples[i]! * gain)));
	return new Uint8Array(out.buffer);
}

function rms(pcm: Uint8Array): number {
	const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
	if (!samples.length) return 0;
	let sum = 0;
	for (const sample of samples) sum += sample * sample;
	return Math.sqrt(sum / samples.length);
}

/**
 * Where the turns of the speech fall. Turns are ours, not Gemini's: its own activity detection stopped listening for
 * good after the first pause on some voices (the Eddy TTS voice lost everything after "I'm having one cup of"). A turn
 * opens on a voiced frame and closes on a pause, on a dip between words once it runs long, or at the stop; Gemini
 * transcribes and answers each one when it closes.
 */
export class Turns {
	speaking = false;
	floor = MIN_VOICED_RMS / FLOOR_RATIO;
	peak = 0;
	private silentMs = 0;
	private turnMs = 0;
	private loudness = 0;
	voicedMs = 0;
	private frames = 0;

	constructor(private readonly timing: TurnTiming = TURN_TIMING) {}

	/**
	 * What the frame does to the turn, before the frame is sent. A long turn splits at the frame, which opens the next
	 * one, so no audio falls between turns.
	 */
	frame(pcm: Uint8Array): 'start' | 'end' | 'split' | null {
		const ms = (pcm.byteLength / 2 / LIVE_SAMPLE_RATE) * 1000;
		const level = rms(pcm);
		this.floor = level < this.floor ? level : this.floor + (level - this.floor) * FLOOR_RISE;
		this.peak *= PEAK_DECAY;
		const voiced = this.voiced(level);
		if (voiced) this.peak = Math.max(this.peak, level);
		if (!this.speaking) {
			if (!voiced) return null;
			this.open(level, ms);
			return 'start';
		}
		this.silentMs = voiced ? 0 : this.silentMs + ms;
		if (this.silentMs >= this.timing.pauseMs) {
			this.speaking = false;
			return 'end';
		}
		const dip = this.turnMs >= this.timing.dipAfterMs && level < DIP * (this.loudness / this.frames);
		if (dip || this.turnMs >= this.timing.maxMs) {
			this.open(level, ms);
			return 'split';
		}
		this.count(level, ms);
		return null;
	}

	/** How much to raise the audio Gemini hears, from the loudest recent speech. */
	get gain(): number {
		return this.peak ? Math.min(MAX_GAIN, Math.max(1, TARGET_PEAK / this.peak)) : 1;
	}

	private voiced(level: number) {
		return level > Math.max(MIN_VOICED_RMS, this.floor * FLOOR_RATIO, this.peak * PEAK_RATIO);
	}

	private open(level: number, ms: number) {
		this.speaking = true;
		this.silentMs = this.turnMs = this.loudness = this.frames = this.voicedMs = 0;
		this.count(level, ms);
	}

	private count(level: number, ms: number) {
		this.turnMs += ms;
		if (!this.voiced(level)) return;
		this.loudness += level;
		this.frames++;
		this.voicedMs += ms;
	}
}

type LiveMessage = {
	setupComplete?: unknown;
	serverContent?: { inputTranscription?: { text?: string }; generationComplete?: boolean; turnComplete?: boolean };
	toolCall?: { functionCalls?: Array<{ id: string; name: string; args?: Args }> };
	goAway?: unknown;
};

function connect(url: string, onMessage: (message: LiveMessage) => void, onClose: (reason: string) => void) {
	return new Promise<WebSocket>((resolve, reject) => {
		const socket = new WebSocket(url);
		socket.binaryType = 'arraybuffer';
		let open = false;
		socket.onopen = () => {
			open = true;
			resolve(socket);
		};
		socket.onmessage = event => {
			const raw = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer);
			try {
				onMessage(JSON.parse(raw));
			} catch {}
		};
		socket.onclose = event => {
			if (open) onClose(`${event.code} ${event.reason}`);
			else reject(new Error(`Gemini Live refused the session: ${event.code} ${event.reason}`));
		};
	});
}

export async function openLiveRamble(
	request: LiveRambleRequest,
	apiKey: string,
	events: LiveEvents,
	model = RAMBLE_LIVE_MODEL,
	timing = TURN_TIMING,
): Promise<LiveRamble> {
	const input = LiveRambleRequest.parse(request);
	const names = aliases({ ...input, transcript: '' });
	const items = new LiveItems();
	let transcript = '';
	let ending = false;
	const turns = new Turns(timing);
	/**
	 * Gemini drops a turn spoken while it answers the one before ("200 g of steak … at 3:00 p.m." came back as "200by
	 * 3:00 p.m."), so each turn closed waits for its answer, and what follows is held here and sent once it lands.
	 */
	let answering = false;
	/** Gemini sometimes never answers a turn; past this with no message from it, the held turns go on without one. */
	let answerTimer: ReturnType<typeof setTimeout> | undefined;
	const held: string[] = [];
	let afterGeneration = false;
	/** No words of the current turn are in the transcript yet. */
	let fresh = true;
	const unanswered = () => turns.speaking || answering || held.length > 0;
	const waitForAnswer = () => {
		clearTimeout(answerTimer);
		answerTimer = setTimeout(answered, UNANSWERED_QUIET_MS);
	};
	const write = (message: string) => {
		socket!.send(message);
		if (message === ACTIVITY_START) fresh = true;
		if (message !== ACTIVITY_END) return;
		answering = true;
		afterGeneration = false;
		waitForAnswer();
	};
	const send = (message: string) => {
		if (answering || held.length) held.push(message);
		else write(message);
	};
	function answered() {
		clearTimeout(answerTimer);
		answering = false;
		while (held.length && !answering) write(held.shift()!);
	}
	/**
	 * A turn opened after silence holds its audio until it has `MIN_VOICED_MS` of speech and is dropped if it closes
	 * first. A turn split from a long one is speech already, so it opens at once.
	 */
	let opening: string[] | null = null;
	const close = () => {
		if (opening) opening = null;
		else send(ACTIVITY_END);
	};
	/** The phone's frames arrive in whatever size its mic tap delivers; turns are judged on 100 ms. */
	const FRAME_BYTES = (LIVE_SAMPLE_RATE / 10) * 2;
	let partial = new Uint8Array(0);
	const frame = (pcm: Uint8Array) => {
		const turn = turns.frame(pcm);
		if (turn === 'end' || turn === 'split') close();
		if (turn === 'start') opening = [];
		if (turn === 'split') send(ACTIVITY_START);
		// Audio outside a turn is silence Gemini would ignore.
		if (!turns.speaking) return;
		const audio = JSON.stringify({
			realtimeInput: {
				audio: { data: base64(amplify(pcm, turns.gain)), mimeType: `audio/pcm;rate=${LIVE_SAMPLE_RATE}` },
			},
		});
		if (!opening) return send(audio);
		opening.push(audio);
		if (turns.voicedMs < MIN_VOICED_MS) return;
		send(ACTIVITY_START);
		for (const message of opening) send(message);
		opening = null;
	};
	let quiet: ReturnType<typeof setTimeout> | undefined;
	let cap: ReturnType<typeof setTimeout> | undefined;
	let done: ((result: LiveResult) => void) | undefined;
	let settled = false;
	const finished = () => {
		if (settled || !done) return;
		settled = true;
		// The phone's mic levels decide the turns; the Worker logs keep them for tuning against real voices.
		console.log(
			`ramble live: peak ${Math.round(turns.peak)} floor ${Math.round(turns.floor)} gain ${turns.gain.toFixed(1)}, ${transcript.split(/\s+/).filter(Boolean).length} words, ${items.outline(input, names).items.length} items`,
		);
		clearTimeout(quiet);
		clearTimeout(cap);
		done({ transcript, outline: items.outline(input, names) });
	};
	/** Each message after the end of the audio restarts the wait, so the last tool calls are never cut off. */
	const settle = () => {
		clearTimeout(quiet);
		quiet = setTimeout(finished, unanswered() ? UNANSWERED_QUIET_MS : QUIET_AFTER_END_MS);
	};

	let setUp = () => {};
	let refused = (_: Error) => {};
	const ready = new Promise<void>((resolve, reject) => {
		setUp = resolve;
		refused = reject;
	});
	let socket: WebSocket | undefined;
	const onMessage = (message: LiveMessage) => {
		if (message.setupComplete) return setUp();
		const heard = message.serverContent?.inputTranscription?.text;
		if (heard) {
			// Each turn's transcription starts bare, and a turn may split mid-sentence, so the next would run into it.
			const gap = fresh && transcript && !/^\s/.test(heard) ? ' ' : '';
			transcript += gap + heard;
			fresh = false;
			events.transcript(transcript);
		}
		// An answer ends in generationComplete, then turnComplete, and sometimes the first alone; the turnComplete after
		// a generationComplete belongs to the same answer, not the turn sent since.
		const generated = message.serverContent?.generationComplete;
		if (answering) waitForAnswer();
		if (generated || (message.serverContent?.turnComplete && !afterGeneration)) answered();
		if (generated) afterGeneration = true;
		else if (message.serverContent?.turnComplete) afterGeneration = false;
		const calls = message.toolCall?.functionCalls ?? [];
		if (calls.length) {
			const functionResponses = calls.map(call => ({
				id: call.id,
				name: call.name,
				response: items.apply(call.name, call.args ?? {}),
			}));
			socket?.send(JSON.stringify({ toolResponse: { functionResponses } }));
			events.outline(items.outline(input, names));
		}
		if (ending) {
			if (message.serverContent?.turnComplete && !unanswered()) finished();
			else settle();
		}
	};
	const onClose = (reason: string) => {
		refused(new Error(`Gemini Live refused the setup: ${reason}`));
		if (ending) return finished();
		events.error(new Error(`Gemini Live closed the session: ${reason}`));
	};

	// The preview model sometimes refuses a new session with 409 ABORTED, so one failed open is retried.
	for (let attempt = 0; !socket; attempt++) {
		try {
			socket = await connect(`${LIVE_URL}?key=${encodeURIComponent(apiKey)}`, onMessage, onClose);
		} catch (error) {
			if (attempt >= 1) throw error;
		}
	}
	socket.send(
		JSON.stringify({
			setup: {
				model: `models/${model}`,
				// Live models answer only in audio. The instructions forbid speaking, and none comes back.
				generationConfig: { responseModalities: ['AUDIO'], temperature: 0.2 },
				systemInstruction: { parts: [{ text: rambleInstructions({ ...input, transcript: '' }, true) }] },
				tools: tools(names),
				inputAudioTranscription: {},
				realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
			},
		}),
	);
	const timeout = setTimeout(() => {
		refused(new Error('Gemini Live did not set up in time'));
		socket.close();
	}, SETUP_TIMEOUT_MS);
	await ready.finally(() => clearTimeout(timeout));

	return {
		audio(pcm) {
			if (ending) return;
			const joined = new Uint8Array(partial.length + pcm.length);
			joined.set(partial);
			joined.set(pcm, partial.length);
			let at = 0;
			for (; at + FRAME_BYTES <= joined.length; at += FRAME_BYTES) frame(joined.subarray(at, at + FRAME_BYTES));
			partial = joined.slice(at);
		},
		finish() {
			return new Promise<LiveResult>(resolve => {
				done = resolve;
				if (ending) return;
				ending = true;
				if (partial.length >= 2) frame(partial);
				if (turns.speaking) {
					turns.speaking = false;
					close();
				}
				cap = setTimeout(finished, FINISH_CAP_MS);
				settle();
			});
		},
		close() {
			clearTimeout(quiet);
			clearTimeout(cap);
			clearTimeout(answerTimer);
			socket.close();
		},
	};
}

/**
 * The phone's side of `GET /api/food-database/ramble/live`, the same on Bun and in the Worker's Durable Object. The
 * phone sends the ramble's context as its first text message, then 16 kHz PCM as binary frames, then `{"type":"stop"}`.
 * The server answers `ready` once Gemini is listening, `transcript` and `outline` as they change, and `done` with both
 * after the stop; an `error` closes the socket. Audio sent before `ready` is held, so the first words are not lost.
 */
export type LiveSocket = { send(text: string): void; close(code?: number, reason?: string): void };

export function serveLiveRamble(socket: LiveSocket, apiKey: string) {
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
				if (JSON.parse(data)?.type !== 'stop') return;
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
			openLiveRamble(parsed.data, apiKey, {
				transcript: text => send({ type: 'transcript', text }),
				outline: outline => send({ type: 'outline', outline }),
				error: fail,
			}).then(live => {
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
