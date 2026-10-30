import { socketSession, type Session, type Sink } from './common';

const suffix = (text: string, prefix: string) => {
	if (!prefix) return text;
	if (text.toLowerCase().startsWith(prefix.toLowerCase())) return text.slice(prefix.length).trim();
	throw new Error('xAI revised a committed transcript; inspect trace');
};

export async function xai(key: string, hints: string[], sink: Sink): Promise<Session> {
	const url = new URL('wss://api.x.ai/v1/stt');
	url.search = new URLSearchParams({
		model: 'grok-voice-transcribe-2.0',
		sample_rate: '16000',
		encoding: 'pcm',
		language: 'en',
		interim_results: 'true',
		endpointing: '400',
		filler_words: 'true',
	}).toString();
	for (const hint of hints) url.searchParams.append('keyterm', hint.slice(0, 50));
	let utterance = '';
	let committed = '';

	return socketSession(
		url,
		{ Authorization: `Bearer ${key}` },
		'transcript.created',
		sink,
		(m, done) => {
			if (m.type === 'transcript.done') {
				if (m.text) {
					const tail = suffix(m.text.trim(), committed);
					if (tail) sink.event('final', tail, m.duration * 1000);
				}
				done();
				return;
			}
			if (m.type !== 'transcript.partial') return;
			let text = String(m.text ?? '').trim();
			if (m.speech_final) {
				// Utterance finals stitch together earlier chunk finals; only the remaining suffix is new.
				text = suffix(text, utterance);
				if (text) sink.event('final', text, (m.words?.at(-1)?.end ?? m.start + m.duration) * 1000);
				committed = [committed, text].filter(Boolean).join(' ');
				utterance = '';
			} else if (m.is_final) {
				sink.event('final', text, (m.words?.at(-1)?.end ?? m.start + m.duration) * 1000);
				utterance = [utterance, text].filter(Boolean).join(' ');
				committed = [committed, text].filter(Boolean).join(' ');
			} else sink.event('partial', text);
		},
		(socket, pcm) => socket.send(new Uint8Array(pcm).buffer),
		socket => socket.send(JSON.stringify({ type: 'audio.done' })),
	);
}

export async function elevenlabs(key: string, hints: string[], sink: Sink): Promise<Session> {
	const url = new URL('wss://api.elevenlabs.io/v1/speech-to-text/realtime');
	url.search = new URLSearchParams({
		model_id: 'scribe_v2_realtime',
		audio_format: 'pcm_16000',
		language_code: 'en',
		commit_strategy: 'vad',
		vad_silence_threshold_secs: '0.4',
		include_timestamps: 'true',
	}).toString();
	for (const hint of [...new Set(hints.map(x => x.slice(0, 20).trim()))].slice(0, 50))
		url.searchParams.append('keyterms', hint);
	return socketSession(
		url,
		{ 'xi-api-key': key },
		'session_started',
		sink,
		m => {
			if (m.message_type === 'partial_transcript') sink.event('partial', m.text ?? '');
			if (m.message_type === 'committed_transcript') sink.event('final', m.text ?? '');
			// Timestamp messages repeat an already committed segment, so they belong only in the trace.
		},
		(socket, pcm) =>
			socket.send(
				JSON.stringify({
					message_type: 'input_audio_chunk',
					audio_base_64: Buffer.from(pcm).toString('base64'),
					sample_rate: 16000,
				}),
			),
		socket =>
			socket.send(
				JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: '', commit: true, sample_rate: 16000 }),
			),
	);
}
