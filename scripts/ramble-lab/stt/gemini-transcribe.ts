import { deferred, within, type Session, type Sink } from './common';

const offsetMs = (value: unknown) => {
	if (typeof value === 'string' && /^\d+(\.\d+)?s$/.test(value)) return parseFloat(value) * 1000;
	return undefined;
};

export type TranscribeOptions = { silenceMs?: number; mode?: 'VERBATIM' | 'SMART'; hybrid?: boolean };

export async function geminiTranscribe(
	key: string,
	hints: string[],
	sink: Sink,
	options: TranscribeOptions = {},
): Promise<Session> {
	const ready = deferred();
	const done = deferred();
	let failure: Error | undefined;
	let closing = false;
	let ending = false;
	let initialized = false;
	let sentMs = 0;
	let lastSpeechMs = 0;
	let active = false;
	let drainTimer: ReturnType<typeof setTimeout> | undefined;
	const silenceMs = options.silenceMs ?? 400;
	const setup = {
		model: 'models/gemini-3.5-transcribe-live',
		generationConfig: { responseModalities: ['TEXT'] },
		inputAudioTranscription: {
			languageCodes: ['en-GB'],
			mode: options.mode ?? 'VERBATIM',
			...(hints.length ? { customVocabulary: hints.slice(0, 100) } : {}),
		},
		realtimeInputConfig: {
			automaticActivityDetection: { silenceDurationMs: silenceMs, prefixPaddingMs: 100 },
		},
	};
	const url = new URL(
		'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent',
	);
	url.searchParams.set('key', key);
	const socket = new WebSocket(url);
	const send = (message: object) => socket.send(JSON.stringify(message));
	const fail = (error: unknown) => {
		failure = error instanceof Error ? error : new Error(String(error));
		sink.fail(failure);
		ready.resolve();
		done.resolve();
	};
	socket.onopen = () => {
		sink.trace({ setup });
		send({ setup });
	};
	socket.onmessage = event => {
		try {
			const message = JSON.parse(String(event.data));
			sink.trace(message);
			if (message.error) throw new Error(JSON.stringify(message.error));
			if (message.setupComplete) {
				initialized = true;
				ready.resolve();
			}
			const content = message.serverContent;
			if (content?.interimInputTranscription?.text) sink.event('partial', content.interimInputTranscription.text);
			if (content?.inputTranscription?.text) {
				const transcript = content.inputTranscription;
				sink.event('final', transcript.text, offsetMs(transcript.endOffset));
			}
			// Transcription is independent of turnComplete; drain late final messages too.
			if (ending) {
				clearTimeout(drainTimer);
				drainTimer = setTimeout(done.resolve, 1500);
			}
		} catch (error) {
			fail(error);
		}
	};
	socket.onerror = () => fail(new Error('Gemini transcription WebSocket transport failed'));
	socket.onclose = event => {
		if (!closing) fail(new Error(`Gemini transcription closed ${event.code}: ${event.reason}`));
	};
	try {
		await within(ready.promise, 15000, 'Gemini transcription setup timed out');
		if (failure || !initialized) throw failure ?? new Error('Gemini transcription did not initialize');
	} catch (error) {
		closing = true;
		socket.close();
		throw error;
	}
	return {
		audio(pcm) {
			if (failure) throw failure;
			sentMs += pcm.length / 32;
			send({
				realtimeInput: { audio: { data: Buffer.from(pcm).toString('base64'), mimeType: 'audio/pcm;rate=16000' } },
			});
			if (options.hybrid ?? true) {
				const samples = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
				let energy = 0;
				for (let i = 0; i < pcm.length; i += 2) energy += samples.getInt16(i, true) ** 2;
				// The hybrid gate is calibrated to clean lab clips; auto VAD remains available for noisy input.
				if (Math.sqrt(energy / (pcm.length / 2)) > 100) {
					lastSpeechMs = sentMs;
					active = true;
				} else if (active && sentMs - lastSpeechMs >= silenceMs) {
					send({ realtimeInput: { audioStreamEnd: true } });
					active = false;
				}
			}
		},
		async finish() {
			if (failure) throw failure;
			ending = true;
			send({ realtimeInput: { audioStreamEnd: true } });
			// There is no documented stream-end acknowledgement. Keep a bounded quiet drain.
			drainTimer = setTimeout(done.resolve, 3000);
			await done.promise;
			if (failure) throw failure;
		},
		close() {
			closing = true;
			clearTimeout(drainTimer);
			socket.close();
		},
	};
}
