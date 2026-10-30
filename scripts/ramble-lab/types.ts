import type { Case } from '../food-ramble/cases';

/** How someone talks. Each persona's rambles stress a different part of the pipeline. */
export const PERSONAS = {
	precise: 'Clear, complete sentences with exact amounts and units. Little filler.',
	terse: 'Aloof and clipped: fragments, no meal words, minimal grammar ("eggs. two. coffee black.").',
	rambling: 'Long-winded: chatter about the day between foods, tangents, foods buried mid-sentence.',
	fumbling: 'Ums, uhs, false starts, repeated words, self-interruptions ("I had, uh, the, the oat, oatmeal").',
	'mind-changer': 'Corrects themselves often: amounts, foods, removals, "actually", "no wait", "scratch that".',
	storyteller: 'Narrates a whole day in order with times and days ("yesterday at noon", "around 3pm").',
	'list-maker': 'Rattles off many items fast, comma-separated, with amounts.',
	casual: 'Natural speech with slang and vague amounts ("a bowl of", "some", "a handful of").',
	referrer: 'Points back at logged food: "my usual", "same breakfast as yesterday but…", "the bar from yesterday".',
	picker: 'Asks to see options and picks one by name or position ("that pizza is wrong", "the second one").',
} as const;
export type Persona = keyof typeof PERSONAS;

/** A labelled ramble. `items` uses the eval's `Expected` shape, scored by `scripts/food-ramble/score.ts`. */
export type LabCase = Case & {
	persona: Persona;
	/** One line on what this case tests ("removes the second of three items after a tangent"). */
	scenario: string;
	/**
	 * Optional TTS direction for engines that take it (xAI speech tags, Gemini style prompt): pauses and hesitations
	 * stay in `text` as words ("um", "uh"); this only hints delivery ("hurried", "bored", "thinking aloud").
	 */
	delivery?: string;
};

export type TtsEngine = 'xai' | 'elevenlabs' | 'gemini' | 'say';

/** One spoken rendition of a case: 16 kHz mono signed 16-bit little-endian WAV with a plain 44-byte header. */
export type Clip = {
	caseId: string;
	engine: TtsEngine;
	voice: string;
	/** Playback rate applied after synthesis (1 = as spoken). */
	speed: number;
	/** Post-processing: `quiet` scales to 0.05x, `noisy` mixes cafe-like noise at about 15 dB SNR. */
	condition: 'clean' | 'quiet' | 'noisy';
	file: string;
	durationMs: number;
};

export type SttEngine = 'xai' | 'elevenlabs' | 'gemini-transcribe' | 'apple';

/**
 * What a streaming transcriber said while a clip played at real-time pace, timed in ms from the first audio frame.
 * `partial` replaces the uncommitted tail; `final` commits a segment (it is appended to what was committed before).
 */
export type SttEvent = { at: number; kind: 'partial' | 'final'; text: string };

export type SttRun = {
	engine: SttEngine;
	clip: string;
	events: SttEvent[];
	/** When the last audio frame was sent, and when the transcriber's last final arrived after it. */
	audioEndAt: number;
	doneAt: number;
	error?: string;
};

/** The transcript as the phone would show it at a moment: every committed segment, then the live partial. */
export function transcriptAt(run: SttRun, at: number): { committed: string; partial: string } {
	let committed = '';
	let partial = '';
	for (const event of run.events) {
		if (event.at > at) break;
		if (event.kind === 'final') {
			committed = join(committed, event.text);
			partial = '';
		} else partial = event.text;
	}
	return { committed, partial };
}

export const join = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b).replace(/\s+/g, ' ').trim();
