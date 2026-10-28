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
 * was answered. Words still unanswered wait for their turn to complete, up to `FINISH_CAP_MS`.
 */
const QUIET_AFTER_END_MS = 800;
const FINISH_CAP_MS = 6_000;
const SETUP_TIMEOUT_MS = 8_000;
/** Above this RMS a 16-bit frame holds speech. */
const VOICED_RMS = 300;
/** Silence that ends a turn, so Gemini answers what it heard while the speaker goes on. */
const PAUSE_MS = 600;

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

function voiced(pcm: Uint8Array): boolean {
	const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
	if (!samples.length) return false;
	let sum = 0;
	for (const sample of samples) sum += sample * sample;
	return Math.sqrt(sum / samples.length) > VOICED_RMS;
}

type LiveMessage = {
	setupComplete?: unknown;
	serverContent?: { inputTranscription?: { text?: string }; turnComplete?: boolean };
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
): Promise<LiveRamble> {
	const input = LiveRambleRequest.parse(request);
	const names = aliases({ ...input, transcript: '' });
	const items = new LiveItems();
	let transcript = '';
	let ending = false;
	/**
	 * Turns are ours, not Gemini's: its own activity detection stopped listening for good after the first pause on some
	 * voices (the Eddy TTS voice lost everything after "I'm having one cup of"). A turn opens on a voiced frame and
	 * closes after `PAUSE_MS` of silence or at the stop; Gemini transcribes and answers each one when it closes.
	 */
	let speaking = false;
	let silentMs = 0;
	let open = 0;
	const unanswered = () => speaking || open > 0;
	let quiet: ReturnType<typeof setTimeout> | undefined;
	let cap: ReturnType<typeof setTimeout> | undefined;
	let done: ((result: LiveResult) => void) | undefined;
	let settled = false;
	const finished = () => {
		if (settled || !done) return;
		settled = true;
		clearTimeout(quiet);
		clearTimeout(cap);
		done({ transcript, outline: items.outline(input, names) });
	};
	/** Each message after the end of the audio restarts the wait, so the last tool calls are never cut off. */
	const settle = () => {
		clearTimeout(quiet);
		if (!unanswered()) quiet = setTimeout(finished, QUIET_AFTER_END_MS);
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
			// Each turn's transcription starts bare, so a sentence after a pause would run into the one before it.
			const gap = /[.!?,]$/.test(transcript) && !/^\s/.test(heard) ? ' ' : '';
			transcript += gap + heard;
			events.transcript(transcript);
		}
		if (message.serverContent?.turnComplete) open = Math.max(0, open - 1);
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
			if (message.serverContent?.turnComplete && !calls.length) finished();
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
	const live = socket;
	live.send(
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
		live.close();
	}, SETUP_TIMEOUT_MS);
	await ready.finally(() => clearTimeout(timeout));
	const endTurn = () => {
		speaking = false;
		open++;
		live.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
	};

	return {
		audio(pcm) {
			if (ending) return;
			if (voiced(pcm)) {
				silentMs = 0;
				if (!speaking) live.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
				speaking = true;
			} else if (speaking && (silentMs += (pcm.byteLength / 2 / LIVE_SAMPLE_RATE) * 1000) >= PAUSE_MS) endTurn();
			live.send(
				JSON.stringify({
					realtimeInput: {
						audio: { data: base64(pcm), mimeType: `audio/pcm;rate=${LIVE_SAMPLE_RATE}` },
					},
				}),
			);
		},
		finish() {
			return new Promise<LiveResult>(resolve => {
				done = resolve;
				if (ending) return;
				ending = true;
				if (speaking) endTurn();
				cap = setTimeout(finished, FINISH_CAP_MS);
				settle();
			});
		},
		close() {
			clearTimeout(quiet);
			clearTimeout(cap);
			live.close();
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
