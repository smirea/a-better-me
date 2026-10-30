import { mkdir, rename, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { parseArgs, parseEnv } from 'node:util';
import type { Clip, LabCase, TtsEngine } from './types';

const root = resolve(import.meta.dir, '../..');
const cache = `${root}/.cache/ramble-lab`;
const audio = `${cache}/audio`;
const { values } = parseArgs({
	args: Bun.argv.slice(2),
	strict: true,
	options: {
		engine: { type: 'string' },
		voices: { type: 'string' },
		speeds: { type: 'string', default: '1' },
		conditions: { type: 'string', default: 'clean' },
		only: { type: 'string' },
		set: { type: 'string', default: 'lab' },
		concurrency: { type: 'string', default: '4' },
		'list-voices': { type: 'boolean' },
		help: { type: 'boolean' },
	},
});
const engines = new Set<TtsEngine>(['xai', 'elevenlabs', 'gemini', 'say']);
const engine = values.engine as TtsEngine;
const geminiModel = 'gemini-3.1-flash-tts-preview';
const elevenModel = 'eleven_flash_v2_5';
let keys: Record<string, string | undefined> = {};
const list = (s: string) => [
	...new Set(
		s
			.split(',')
			.map(v => v.trim())
			.filter(Boolean),
	),
];
const safe = (s: string) => encodeURIComponent(s).replaceAll('.', '%2E');
const message = (e: unknown) => {
	let text = e instanceof Error ? e.message : String(e);
	for (const key of Object.values(keys)) if (key) text = text.replaceAll(key, '[redacted]');
	return text;
};

async function command(args: string[]): Promise<Buffer> {
	const proc = Bun.spawn(args, { stdout: 'pipe', stderr: 'pipe' });
	const [out, err, code] = await Promise.all([
		new Response(proc.stdout).arrayBuffer(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	if (code) throw new Error(`${args[0]} exited ${code}: ${err.slice(-2000)}`);
	return Buffer.from(out);
}

async function request(url: string, headers: Record<string, string>, body?: unknown): Promise<Response> {
	for (let attempt = 0; ; attempt++) {
		let response: Response;
		try {
			response = await fetch(url, {
				method: body === undefined ? 'GET' : 'POST',
				headers: { ...headers, 'Content-Type': 'application/json' },
				body: body === undefined ? undefined : JSON.stringify(body),
				signal: AbortSignal.timeout(120_000),
			});
		} catch (error) {
			if (attempt >= 4) throw error;
			console.warn(`Network retry ${attempt + 1}: ${message(error)}`);
			await Bun.sleep(1000 * 2 ** attempt + Math.random() * 500);
			continue;
		}
		if (response.ok) return response;
		const detail = (await response.text()).slice(0, 1000);
		if (attempt >= 4 || (response.status !== 429 && response.status < 500)) {
			throw new Error(`HTTP ${response.status}: ${detail}`);
		}
		const retry = response.headers.get('retry-after');
		const delay = retry ? (Number.isFinite(Number(retry)) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : 0;
		const wait = Math.min(120_000, Math.max(delay || 0, 1000 * 2 ** attempt + Math.random() * 500));
		console.warn(`HTTP ${response.status}; retry ${attempt + 1} in ${(wait / 1000).toFixed(1)}s`);
		await Bun.sleep(wait);
	}
}

function apiKey(name: string): string {
	if (!keys[name]) throw new Error(`Missing ${name} in .cache/ramble-lab/keys.env`);
	return keys[name];
}

async function voices() {
	if (engine === 'say') return console.log((await command(['say', '-v', '?'])).toString());
	if (engine === 'gemini') {
		console.log(
			'Prebuilt: Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, Callirrhoe, Autonoe, Enceladus, Iapetus, Umbriel, Algieba, Despina, Erinome, Algenib, Rasalgethi, Laomedeia, Achernar, Alnilam, Schedar, Gacrux, Pulcherrima, Achird, Zubenelgenubi, Vindemiatrix, Sadachbia, Sadaltager, Sulafat',
		);
		return;
	}
	let token: string | undefined;
	do {
		const url =
			engine === 'xai'
				? 'https://api.x.ai/v1/tts/voices'
				: `https://api.elevenlabs.io/v2/voices?page_size=100${token ? `&next_page_token=${encodeURIComponent(token)}` : ''}`;
		const headers: Record<string, string> =
			engine === 'xai'
				? { Authorization: `Bearer ${apiKey('XAI_API_KEY')}` }
				: { 'xi-api-key': apiKey('ELEVENLABS_API_KEY') };
		const data = (await (await request(url, headers)).json()) as {
			voices: { voice_id: string; name: string; gender?: string; labels?: Record<string, string> }[];
			has_more?: boolean;
			next_page_token?: string;
		};
		for (const v of data.voices)
			console.log(`${v.voice_id}\t${v.name}\t${v.gender ?? v.labels?.gender ?? ''}\t${v.labels?.accent ?? ''}`);
		token = data.has_more ? data.next_page_token : undefined;
	} while (token);
}

function xaiText(c: LabCase) {
	const delivery = c.delivery ?? '';
	const tags = [
		[/whisper/i, 'whisper'],
		[/soft|quiet|bored|tired|thinking/i, 'soft'],
		[/hurried|fast|quick/i, 'fast'],
		[/slow|hesitant/i, 'slow'],
		[/loud|excited/i, 'loud'],
	] as const;
	return tags
		.filter(([pattern]) => pattern.test(delivery))
		.reduce((text, [, tag]) => `<${tag}>${text}</${tag}>`, c.text);
}

async function synthesize(c: LabCase, voice: string, dir: string): Promise<{ file: string; input: string[] }> {
	const file = `${dir}/source`;
	if (engine === 'say') {
		await command(['say', '-v', voice, '-o', `${file}.aiff`, '--', c.text]);
		return { file: `${file}.aiff`, input: [] };
	}
	let bytes: Buffer;
	let rate = 16000;
	if (engine === 'gemini') {
		const response = await request(
			`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
			{ 'x-goog-api-key': apiKey('GEMINI_API_KEY') },
			{
				contents: [
					{
						parts: [
							{
								text: `Synthesize speech. Say ${c.delivery ?? 'naturally, conversationally'}. Read only the following transcript verbatim:\n${c.text}`,
							},
						],
					},
				],
				generationConfig: {
					responseModalities: ['AUDIO'],
					speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
				},
			},
		);
		const data = (await response.json()) as {
			candidates?: {
				content?: { parts?: { inlineData?: { data: string; mimeType: string } }[] };
				finishReason?: string;
			}[];
		};
		const parts = data.candidates?.[0]?.content?.parts?.flatMap(p => (p.inlineData ? [p.inlineData] : [])) ?? [];
		if (!parts.length)
			throw new Error(`Gemini returned no audio (${data.candidates?.[0]?.finishReason ?? 'no candidate'})`);
		if (parts.some(p => !/audio\/L16/i.test(p.mimeType))) throw new Error('Unexpected Gemini audio format');
		rate = Number(parts[0]!.mimeType.match(/rate=(\d+)/)?.[1] ?? 24000);
		bytes = Buffer.concat(parts.map(p => Buffer.from(p.data, 'base64')));
	} else {
		const response =
			engine === 'xai'
				? await request(
						'https://api.x.ai/v1/tts',
						{ Authorization: `Bearer ${apiKey('XAI_API_KEY')}` },
						{
							text: xaiText(c),
							voice_id: voice,
							language: 'en',
							output_format: { codec: 'pcm', sample_rate: 16000 },
						},
					)
				: await request(
						`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=pcm_16000`,
						{ 'xi-api-key': apiKey('ELEVENLABS_API_KEY') },
						{ text: c.text, model_id: elevenModel, language_code: 'en' },
					);
		bytes = Buffer.from(await response.arrayBuffer());
	}
	if (!bytes.length || bytes.length % 2) throw new Error('Empty or incomplete PCM response');
	await Bun.write(file, bytes);
	return { file, input: ['-f', 's16le', '-ar', String(rate), '-ac', '1'] };
}

const wavOptions = [
	'-map_metadata',
	'-1',
	'-fflags',
	'+bitexact',
	'-flags',
	'+bitexact',
	'-c:a',
	'pcm_s16le',
	'-ar',
	'16000',
	'-ac',
	'1',
	'-f',
	'wav',
];
async function verify(file: string) {
	const b = Buffer.from(await Bun.file(file).arrayBuffer());
	if (
		b.length <= 44 ||
		b.toString('ascii', 0, 4) !== 'RIFF' ||
		b.toString('ascii', 8, 16) !== 'WAVEfmt ' ||
		b.readUInt32LE(16) !== 16 ||
		b.readUInt16LE(20) !== 1 ||
		b.readUInt16LE(22) !== 1 ||
		b.readUInt32LE(24) !== 16000 ||
		b.readUInt32LE(28) !== 32000 ||
		b.readUInt16LE(32) !== 2 ||
		b.readUInt16LE(34) !== 16 ||
		b.toString('ascii', 36, 40) !== 'data' ||
		b.readUInt32LE(40) !== b.length - 44 ||
		b.readUInt32LE(4) !== b.length - 8 ||
		(b.length - 44) % 2
	) {
		throw new Error(`Invalid plain 44-byte PCM WAV: ${file}`);
	}
	return (b.length - 44) / 32;
}

function tempo(speed: number) {
	const filters: string[] = [];
	while (speed > 2) {
		filters.push('atempo=2');
		speed /= 2;
	}
	while (speed < 0.5) {
		filters.push('atempo=0.5');
		speed *= 2;
	}
	return [...filters, `atempo=${speed}`].join(',');
}

async function render(source: string, speed: number, condition: Clip['condition'], output: string, dir: string) {
	if (condition !== 'noisy') {
		await command([
			'ffmpeg',
			'-v',
			'error',
			'-y',
			'-i',
			source,
			'-af',
			`${tempo(speed)}${condition === 'quiet' ? ',volume=0.05' : ''}`,
			...wavOptions,
			output,
		]);
		return;
	}
	const speech = await command([
		'ffmpeg',
		'-v',
		'error',
		'-i',
		source,
		'-af',
		tempo(speed),
		'-f',
		'f32le',
		'-ar',
		'16000',
		'-ac',
		'1',
		'pipe:1',
	]);
	const samples = new Float32Array(speech.buffer, speech.byteOffset, speech.length / 4);
	const duration = samples.length / 16000;
	const noise = await command([
		'ffmpeg',
		'-v',
		'error',
		'-f',
		'lavfi',
		'-i',
		`anoisesrc=color=brown:r=16000:d=${duration}:seed=42[b];anoisesrc=color=pink:r=16000:d=${duration}:seed=43[p];[b][p]amix=inputs=2:normalize=0,highpass=f=100,lowpass=f=2500,tremolo=f=0.7:d=0.35`,
		'-f',
		'f32le',
		'-ac',
		'1',
		'pipe:1',
	]);
	const bed = new Float32Array(noise.buffer, noise.byteOffset, noise.length / 4);
	if (bed.length < samples.length) throw new Error('Noise bed shorter than speech');
	const rms = (s: Float32Array) => Math.sqrt(s.reduce((sum, v) => sum + v * v, 0) / s.length);
	const speechRms = rms(samples);
	// Reversed speech adds unintelligible cafe babble without another paid generation.
	const babbleGain = speechRms ? (rms(bed) * 0.35) / speechRms : 0;
	for (let i = 0; i < samples.length; i++) bed[i]! += samples[samples.length - 1 - i]! * babbleGain;
	const gain = speechRms / (10 ** (15 / 20) * rms(bed));
	let peak = 0;
	for (let i = 0; i < samples.length; i++) {
		samples[i]! += bed[i]! * gain;
		peak = Math.max(peak, Math.abs(samples[i]!));
	}
	if (peak > 0.99) for (let i = 0; i < samples.length; i++) samples[i]! *= 0.99 / peak;
	const mixed = `${dir}/mix-${speed}.f32`;
	await Bun.write(mixed, speech);
	await command([
		'ffmpeg',
		'-v',
		'error',
		'-y',
		'-f',
		'f32le',
		'-ar',
		'16000',
		'-ac',
		'1',
		'-i',
		mixed,
		...wavOptions,
		output,
	]);
}

async function saveClip(clip: Clip) {
	const lock = `${audio}/manifest.lock`;
	const started = Date.now();
	while (true) {
		try {
			await mkdir(lock);
			break;
		} catch (e) {
			if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
			if (Date.now() - started > 30_000)
				throw new Error('Manifest lock busy; check for an interrupted writer', { cause: e });
			await Bun.sleep(50 + Math.random() * 100);
		}
	}
	try {
		const file = Bun.file(`${audio}/manifest.json`);
		const entries: Clip[] = (await file.exists()) ? await file.json() : [];
		const merged = new Map(entries.map(entry => [entry.file, entry]));
		merged.set(clip.file, clip);
		const temp = `${audio}/manifest-${crypto.randomUUID()}.tmp`;
		await Bun.write(
			temp,
			JSON.stringify(
				[...merged.values()].sort((a, b) => a.file.localeCompare(b.file)),
				null,
				2,
			) + '\n',
		);
		await rename(temp, `${audio}/manifest.json`);
	} finally {
		await rm(lock, { recursive: true });
	}
}

async function main() {
	if (values.help) {
		console.log(
			'bun scripts/ramble-lab/speak.ts --engine xai|elevenlabs|gemini|say --voices a,b [--speeds 1,1.25] [--conditions clean,quiet,noisy] [--only id1,id2] [--set lab|dev] [--concurrency 4]\nAdd --list-voices with --engine to list voices; ElevenLabs takes voice IDs.',
		);
		return;
	}
	if (!engines.has(engine)) throw new Error('--engine must be xai, elevenlabs, gemini, or say');
	if (await Bun.file(`${cache}/keys.env`).exists()) keys = parseEnv(await Bun.file(`${cache}/keys.env`).text());
	if (values['list-voices']) return voices();
	const selectedVoices = list(values.voices ?? '');
	const speeds = list(values.speeds!).map(Number);
	const conditions = list(values.conditions!) as Clip['condition'][];
	const concurrency = Number(values.concurrency);
	if (
		!selectedVoices.length ||
		!speeds.length ||
		speeds.some(s => !Number.isFinite(s) || s < 0.1 || s > 10) ||
		!conditions.length ||
		conditions.some(c => !['clean', 'quiet', 'noisy'].includes(c)) ||
		!Number.isInteger(concurrency) ||
		concurrency < 1 ||
		concurrency > 64 ||
		!['lab', 'dev'].includes(values.set!)
	) {
		throw new Error(
			'Invalid options: voices required, speeds 0.1–10, conditions clean/quiet/noisy, concurrency 1–64, set lab/dev',
		);
	}
	const corpus = `${import.meta.dir}/corpus.ts`;
	let cases: LabCase[];
	if (values.set === 'lab' && (await Bun.file(corpus).exists())) cases = (await import(corpus)).LAB;
	else {
		if (values.set === 'lab') console.warn('corpus.ts absent; using DEV');
		cases = (await import('../food-ramble/cases')).DEV.map(c => ({
			...c,
			persona: 'precise',
			scenario: 'DEV baseline',
		}));
	}
	const only = values.only ? list(values.only) : undefined;
	if (only) {
		const missing = only.filter(id => !cases.some(c => c.id === id));
		if (missing.length) throw new Error(`Unknown case IDs: ${missing.join(', ')}`);
		cases = cases.filter(c => only.includes(c.id));
	}
	await mkdir(audio, { recursive: true });
	const jobs = cases.flatMap(c => selectedVoices.map(voice => ({ c, voice })));
	let failures = 0;
	let index = 0;
	await Promise.all(
		Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
			while (index < jobs.length) {
				const { c, voice } = jobs[index++]!;
				const dir = `${cache}/tmp/${crypto.randomUUID()}`;
				try {
					const variants = speeds.flatMap(speed =>
						conditions.map(condition => ({
							speed,
							condition,
							file: `.cache/ramble-lab/audio/${engine}-${safe(voice)}-${speed}x-${condition}/${safe(c.id)}.wav`,
						})),
					);
					const pending = [];
					for (const v of variants) {
						if (await Bun.file(`${root}/${v.file}`).exists()) {
							await saveClip({ caseId: c.id, engine, voice, ...v, durationMs: await verify(`${root}/${v.file}`) });
							console.log(`cache ${v.file}`);
						} else pending.push(v);
					}
					if (!pending.length) continue;
					await mkdir(dir, { recursive: true });
					const hash = new Bun.CryptoHasher('sha256')
						.update(
							JSON.stringify({
								engine,
								voice,
								text: c.text,
								delivery: c.delivery,
								model: engine === 'gemini' ? geminiModel : engine === 'elevenlabs' ? elevenModel : engine,
							}),
						)
						.digest('hex');
					const source = `${cache}/sources/${hash}.wav`;
					if (!(await Bun.file(source).exists())) {
						const started = performance.now();
						const raw = await synthesize(c, voice, dir);
						console.log(`synth ${engine}/${voice}/${c.id} ${(performance.now() - started).toFixed(0)}ms`);
						await command([
							'ffmpeg',
							'-v',
							'error',
							'-y',
							...raw.input,
							'-i',
							raw.file,
							...wavOptions,
							`${dir}/base.wav`,
						]);
						await verify(`${dir}/base.wav`);
						await mkdir(dirname(source), { recursive: true });
						await rename(`${dir}/base.wav`, source);
					}
					for (const v of pending) {
						try {
							const output = `${dir}/output.wav`;
							await render(source, v.speed, v.condition, output, dir);
							const durationMs = await verify(output);
							await mkdir(dirname(`${root}/${v.file}`), { recursive: true });
							await rename(output, `${root}/${v.file}`);
							await saveClip({ caseId: c.id, engine, voice, ...v, durationMs });
							console.log(`wrote ${v.file} ${(durationMs / 1000).toFixed(2)}s`);
						} catch (error) {
							failures++;
							console.error(`FAIL ${c.id}/${voice}/${v.speed}/${v.condition}: ${message(error)}`);
						}
					}
				} catch (error) {
					failures++;
					console.error(`FAIL ${c.id}/${voice}: ${message(error)}`);
				} finally {
					await rm(dir, { recursive: true, force: true });
				}
			}
		}),
	);
	console.log(`Done: ${jobs.length} case/voice jobs, ${failures} failures`);
	if (failures) process.exitCode = 1;
}

await main().catch(error => {
	console.error(message(error));
	process.exitCode = 1;
});
