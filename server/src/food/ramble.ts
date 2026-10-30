import { z } from 'zod';
import { ApiError } from '../agent/db';

export type RambleModel = {
	provider: 'gemini' | 'xai';
	model: string;
	thinking?: 'minimal' | 'low' | 'medium' | 'high';
};
export type RambleKeys = { gemini: string | null; xai: string | null };

/**
 * Picked by `scripts/ramble-lab/replay.ts` (docs/decisions/nutrition.md, Ramble logging): the fastest model that kept
 * the labelled rambles near 100% when read live, with no final read. Each read tries them in order, so Grok answers
 * when Gemini cannot (an outage, the project's spend cap); it reads as fast but kept fewer rambles right.
 */
export const RAMBLE_MODELS: readonly RambleModel[] = [
	{ provider: 'gemini', model: 'gemini-3.5-flash', thinking: 'minimal' },
	{ provider: 'xai', model: 'grok-4.20-0309-non-reasoning' },
];
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const XAI_URL = 'https://api.x.ai/v1/chat/completions';
const TIMEOUT_MS = 15_000;
/** A model that failed sits out this long, so a live ramble during an outage reads with the next one at once. */
const REST_MS = 30_000;
const resting = new Map<string, number>();

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const day = z.iso.date();

export const RambleLogged = z
	.object({
		id: z.string().min(1).max(80),
		name: z.string().trim().min(1).max(200),
		serving: z.string().trim().max(80),
	})
	.meta({ id: 'RambleLogged' });

export const RambleMeal = z
	.object({
		id: z.string().min(1).max(80),
		day,
		meal: z.enum(MEALS),
		entries: z.array(RambleLogged).min(1).max(30),
	})
	.meta({ id: 'RambleMeal' });

/**
 * The phone sends what the speaker can point back at: recent meals to copy, the foods they log most ("my usual
 * pancake"), and the options it is showing for each item, so a pick ("the pepperoni") names one of them.
 */
export const RambleRequest = z.object({
	transcript: z.string().max(12_000),
	today: day,
	time: z.string().regex(/^\d{2}:\d{2}$/),
	meals: z.array(RambleMeal).max(40).default([]),
	usual: z.array(RambleLogged).max(60).default([]),
	shown: z
		.array(z.object({ item: z.int().min(0), options: z.array(z.string().max(200)).max(10) }))
		.max(40)
		.default([]),
});
export type RambleRequest = z.input<typeof RambleRequest>;

/**
 * One line of the ramble's list. `food` is searched on the phone by `name`; `ref` names a logged entry to reuse
 * instead. `copy` is a whole logged meal minus `except`. Amount 0 means none was said, so the phone logs one of the
 * food's usual serving; a unit always comes with an amount. `day` is an offset from today, or null when the speaker
 * named no day and the phone's open day applies; `time` is a 24-hour clock or empty. `said` quotes the transcript's
 * words the item came from, which the phone highlights and flies into the row; it may be empty or misquoted.
 */
export const RambleItem = z
	.object({
		kind: z.enum(['food', 'copy']),
		name: z.string(),
		amount: z.number().min(0),
		unit: z.string(),
		ref: z.string().nullable(),
		copy: z.string().nullable(),
		except: z.array(z.string()),
		day: z.int().min(-30).max(0).nullable(),
		meal: z.enum(['', ...MEALS]),
		time: z.string().regex(/^(\d{2}:\d{2})?$/),
		options: z.boolean(),
		said: z.string(),
	})
	.meta({ id: 'RambleItem' });
export type RambleItem = z.output<typeof RambleItem>;
export const RambleOutline = z.object({ items: z.array(RambleItem) }).meta({ id: 'RambleOutline' });
export type RambleOutline = z.output<typeof RambleOutline>;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekday = (iso: string) => WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]!;
const dayOffset = (iso: string, today: string) =>
	Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
const dayLabel = (iso: string, today: string) => {
	const offset = dayOffset(iso, today);
	const relative = offset === 0 ? 'today' : offset === -1 ? 'yesterday' : `${-offset} days ago`;
	return `${relative}, ${weekday(iso)} ${iso}`;
};

/**
 * The model sees short aliases (`m1`, `e1`, `u1`) instead of the phone's UUIDs: it copies them more reliably, and the
 * schema limits every reference to the aliases that exist, so it cannot invent one.
 */
export type Aliases = { meals: Map<string, string>; entries: Map<string, string> };

export function aliases(input: z.output<typeof RambleRequest>): Aliases {
	const meals = new Map<string, string>();
	const entries = new Map<string, string>();
	input.meals.forEach((meal, i) => {
		meals.set(`m${i + 1}`, meal.id);
		for (const entry of meal.entries) entries.set(`e${entries.size + 1}`, entry.id);
	});
	input.usual.forEach((entry, i) => entries.set(`u${i + 1}`, entry.id));
	return { meals, entries };
}

const logged = (entry: z.output<typeof RambleLogged>) =>
	entry.serving ? `${entry.name} (${entry.serving})` : entry.name;

const TRANSCRIPT = `The transcript is live speech-to-text: it has filler, false starts, missing punctuation, and misheard words, and it may stop mid-sentence. List what is clear so far: an item appears once its food is named, so a trailing "two slices of", "200 grams of", or "I drank" is not an item yet, and a copy appears once the meal it repeats is clear ("for lunch the steak" may still become "the steak dinner from last night"). The logged and usual foods below are the speaker's own, so a word that sounds like one of them is probably it.`;
const OMIT_EMPTY = `Leave out every field that is empty, 0, or false, except day 0 for a said "today": a food item with only a name is { "kind": "food", "name": "pizza" }. Leaving them out keeps the answer short, and the list updates live while the speaker talks.`;
const SAID = `Each item also has "said": the words of the transcript it came from, copied exactly as written there (same spelling, digits, and punctuation), shortest span that holds its food and amount, e.g. "2 tablespoons of chia seeds". For an item changed by a correction, quote the correcting words ("actually make that 250"). The app highlights these words, so never paraphrase.`;

export function rambleInstructions(input: z.output<typeof RambleRequest>): string {
	let e = 0;
	const meals = input.meals.map((meal, i) => {
		const entries = meal.entries.map(entry => `e${++e} ${logged(entry)}`).join('; ');
		return `- m${i + 1}: ${meal.meal}, ${dayLabel(meal.day, input.today)}: ${entries}`;
	});
	const usual = input.usual.map((entry, i) => `- u${i + 1} ${logged(entry)}`);
	const shown = input.shown.map(
		({ item, options }) => `- item ${item + 1}: ${options.map(option => JSON.stringify(option)).join(', ')}`,
	);
	return `You turn a spoken ramble into food log entries for a calorie tracker, the way Todoist Ramble turns speech into tasks.
Today is ${weekday(input.today)} ${input.today}, and the time is ${input.time}.

${TRANSCRIPT}

Corrections come first. When the speaker changes their mind, keep only the final version: "actually", "wait", "no", "I mean", "make that", "not X, Y", "sorry". They may point back at an item ("the oats", "that last one") to change it. "Scratch that", "remove the X", or "I didn't have the X" removes it. Saying an item again with new details updates it. Never output the same item twice. Keep the items in the order they were first said.

Each item is one of two kinds.
- "food": one food or drink.
  - name: the food to search a food database for, in the speaker's words without the amount, the meal, or filler: "oats", "blueberries", "chia seeds", "kefir", "pepperoni pizza", "2% milk". Keep words that tell foods apart (brand, flavor, cut, cooked or raw). Fix obvious speech-to-text mishearings of food names.
  - amount and unit: the amount, after corrections. Fractions are decimals: "half a cup" is 0.5 cup, "a cup and a half" is 1.5 cup. unit is g, kg, oz, lb, ml, l, fl oz, cup, tbsp, or tsp when the speaker used one of those, written that way ("grams" is g, "tablespoons" is tbsp). For counted foods unit is the counted thing in the singular ("slice", "egg", "scoop", "bar", "piece", "bowl", "glass", "can"), or "" when the count is of the food itself ("2 bananas" is amount 2, unit ""). Leave the amount out when none was said; a bare "a" or "an" ("a banana", "a beer") is no amount, but "a cup of", "a slice of" is 1 cup, 1 slice.
  - ref: the id of a logged entry when the speaker means a food they logged before: "my usual pancake", "the same coffee", "the oats from yesterday". Prefer a usual food (u…) for "my usual" or "my regular". Otherwise "". With a ref, name is still the food's name, and amount stays 0 unless they said a new amount.
- "copy": a whole logged meal again: "the same breakfast as yesterday", "yesterday's lunch", "the steak dinner from last night". copy is that meal's id (m…). Only when the speaker means the whole meal; one food from a meal ("the pancakes from Sunday") is a food item with that entry's ref. When they leave foods out, replace them, or change one's amount ("but with raspberries instead of blueberries", "without the syrup"), except lists the ids of those entries (e…), and each replacement is its own food item right after the copy. Otherwise copy and except are empty for a food item.

For every item:
- meal: breakfast, lunch, dinner, or snack when the speaker said it or it follows from what they said ("at 3pm" alone is not a meal); otherwise "". A meal said once applies to the items that follow it until another is said. For a copy, meal is the meal it is logged as now ("for lunch, the steak dinner from last night" is lunch), which defaults to the copied meal's.
- time: a 24-hour "HH:MM" only when the speaker said a clock time ("a bar at 3pm" is "15:00"); otherwise "".
- day: the day it was eaten, only when the speaker names it, as days from today: 0 for "today", -1 for "yesterday I had…". Leave it out otherwise; the app then logs on the day the speaker has open. A copied meal's day never sets it: "yesterday's breakfast" logged now has no day. A day said once applies to the items that follow it.
- options: true when the speaker says the match for that food is wrong or asks to see its options ("that pizza is not right", "show me options for the pizza"). When they pick one, by name, description, brand, or position ("let's go with the pepperoni", "the plain nonfat one, not the vanilla", "the second one"), set name to it, to the option's exact text when it is in the shown options, and options to false. A pick changes only the item it is for.

${OMIT_EMPTY}

${SAID}

Ignore chatter that is not about food, and "that's it" or "done" at the end.

Logged meals:
${meals.length ? meals.join('\n') : 'none'}

Usual foods:
${usual.length ? usual.join('\n') : 'none'}

Options shown on screen, by item number:
${shown.length ? shown.join('\n') : 'none'}`;
}

/**
 * A food and a copy are separate shapes, so a copy cannot leave out the meal it copies: with one shape and empty
 * fields omitted, the model sometimes answered `{ "kind": "copy", "name": "breakfast" }`.
 */
function responseSchema(names: Aliases) {
	const entries = [...names.entries.keys()];
	const when = {
		meal: { type: 'string', enum: ['', ...MEALS] },
		time: { type: 'string' },
		day: { type: 'integer' },
	};
	const food = {
		type: 'object',
		properties: {
			kind: { type: 'string', enum: ['food'] },
			name: { type: 'string' },
			amount: { type: 'number' },
			unit: { type: 'string' },
			ref: { type: 'string', enum: ['', ...entries] },
			...when,
			options: { type: 'boolean' },
			said: { type: 'string' },
		},
		required: ['kind', 'name', 'said'],
	};
	const copy = {
		type: 'object',
		properties: {
			kind: { type: 'string', enum: ['copy'] },
			copy: { type: 'string', enum: names.meals.size ? [...names.meals.keys()] : [''] },
			except: { type: 'array', items: { type: 'string', enum: entries.length ? entries : [''] } },
			...when,
			said: { type: 'string' },
		},
		required: ['kind', 'copy', 'said'],
	};
	return {
		type: 'object',
		properties: { items: { type: 'array', items: names.meals.size ? { anyOf: [food, copy] } : food } },
		required: ['items'],
	};
}

export const ModelItem = z.object({
	kind: z.enum(['food', 'copy']),
	name: z.string().default(''),
	amount: z.number().min(0).default(0),
	unit: z.string().default(''),
	ref: z.string().default(''),
	copy: z.string().default(''),
	except: z.array(z.string()).default([]),
	meal: z.enum(['', ...MEALS]).default(''),
	time: z.string().default(''),
	day: z.int().optional(),
	options: z.boolean().default(false),
	said: z.string().default(''),
});
export const ModelOutline = z.object({ items: z.array(ModelItem) });

const GeminiAnswer = z.object({
	candidates: z
		.array(
			z.object({
				content: z
					.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })) })
					.optional(),
			}),
		)
		.optional(),
});
const XaiAnswer = z.object({
	choices: z.array(z.object({ message: z.object({ content: z.string().nullish() }) })).optional(),
});

const clock = (time: string) => {
	const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
	if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return '';
	return `${match[1]!.padStart(2, '0')}:${match[2]}`;
};

const nameWords = (name: string) =>
	new Set(
		name
			.toLowerCase()
			.split(/[^\p{L}]+/u)
			.filter(word => word.length > 2)
			.map(word => word.replace(/s$/, '')),
	);
/** Grok marked foods for options unasked, which opened their lists over the transcript mid-ramble. */
const ASKS_FOR_OPTIONS = /\b(options?|choices?|alternatives?|wrong|not right|show me|other ones?)\b/i;

/** A ref names a food the speaker logged, so it shares a word with the item ("my usual pancake", "Protein pancake"). */
const sameFood = (name: string, logged: string) => {
	const said = nameWords(name);
	return [...nameWords(logged)].some(word => said.has(word));
};

/**
 * Maps aliases back to the phone's ids and drops what does not fit: a copy of no meal, an except outside its meal, a
 * ref to an entry that shares no word with the item's name (Grok once pointed "apple" at a logged banana), options
 * the speaker never asked for. A
 * food the speaker gave no meal or time joins the item before it ("lunch at 12:15 was ramen and a coke"), which the
 * model often leaves out once it omits empty fields.
 */
export function resolveAliases(
	outline: z.output<typeof ModelOutline>,
	input: z.output<typeof RambleRequest>,
	names: Aliases,
): RambleOutline {
	const items: RambleItem[] = [];
	const logged = new Map(
		[...input.meals.flatMap(meal => meal.entries), ...input.usual].map(entry => [entry.id, entry.name]),
	);
	for (const item of outline.items) {
		const meal = item.kind === 'copy' ? input.meals[[...names.meals.keys()].indexOf(item.copy)] : undefined;
		if (item.kind === 'copy' && !meal) continue;
		if (item.kind === 'food' && !item.name.trim()) continue;
		const inMeal = new Set(meal?.entries.map(entry => entry.id));
		const previous = items.at(-1);
		const said = item.day === undefined ? null : Math.min(0, Math.max(-30, item.day));
		const day = said ?? previous?.day ?? null;
		const follows = item.kind === 'food' && previous !== undefined && day === previous.day;
		const carried = follows && !item.meal && !item.time ? previous!.meal : '';
		const sameMeal = follows && (!item.meal || item.meal === previous!.meal);
		items.push({
			kind: item.kind,
			name: item.kind === 'food' ? item.name.trim() : '',
			amount: item.kind === 'food' ? item.amount || (item.unit.trim() ? 1 : 0) : 0,
			unit: item.kind === 'food' ? item.unit.trim().toLowerCase() : '',
			ref: (item.kind === 'food' && refTo(names.entries.get(item.ref), item.name)) || null,
			copy: meal?.id ?? null,
			except: item.except.map(alias => names.entries.get(alias)!).filter(id => id && inMeal.has(id)),
			day,
			meal: item.meal || (item.kind === 'copy' ? meal!.meal : carried),
			time: clock(item.time) || (sameMeal ? previous!.time : ''),
			options: item.kind === 'food' && item.options && ASKS_FOR_OPTIONS.test(input.transcript),
			said: item.said.trim(),
		});
	}
	return { items };

	function refTo(id: string | undefined, name: string) {
		return id && sameFood(name, logged.get(id) ?? '') ? id : null;
	}
}

/** The model's answer as text: the JSON the schema asked for. */
async function ask(spec: RambleModel, key: string, system: string, user: string, schema: object, signal: AbortSignal) {
	const label = spec.provider === 'gemini' ? 'Gemini' : 'Grok';
	let response: Response;
	try {
		response =
			spec.provider === 'gemini'
				? await fetch(`${GEMINI_URL}/${spec.model}:generateContent`, {
						method: 'POST',
						headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
						signal,
						body: JSON.stringify({
							systemInstruction: { parts: [{ text: system }] },
							contents: [{ role: 'user', parts: [{ text: user }] }],
							generationConfig: {
								temperature: 0,
								responseMimeType: 'application/json',
								responseJsonSchema: schema,
								...(spec.thinking ? { thinkingConfig: { thinkingLevel: spec.thinking } } : {}),
							},
						}),
					})
				: await fetch(XAI_URL, {
						method: 'POST',
						headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
						signal,
						body: JSON.stringify({
							model: spec.model,
							temperature: 0,
							messages: [
								{ role: 'system', content: system },
								{ role: 'user', content: user },
							],
							response_format: { type: 'json_schema', json_schema: { name: 'outline', schema } },
						}),
					});
	} catch (error) {
		throw new ApiError(502, `${label} is unreachable: ${String(error)}`);
	}
	if (!response.ok) throw new ApiError(502, `${label} answered ${response.status}: ${await response.text()}`);
	const json = await response.json().catch(() => null);
	const text =
		spec.provider === 'gemini'
			? GeminiAnswer.safeParse(json)
					.data?.candidates?.[0]?.content?.parts.filter(part => !part.thought)
					.map(part => part.text ?? '')
					.join('')
			: XaiAnswer.safeParse(json).data?.choices?.[0]?.message.content;
	if (!text) throw new ApiError(502, `${label} returned no answer`);
	return { label, text };
}

/**
 * The outline of the whole transcript so far. Each model in `models` with a key is tried in turn until one answers,
 * skipping one that failed in the last `REST_MS` unless every one did; the last failure is thrown.
 */
export async function outlineRamble(
	request: RambleRequest,
	keys: RambleKeys,
	{ models = RAMBLE_MODELS, signal }: { models?: readonly RambleModel[]; signal?: AbortSignal } = {},
): Promise<RambleOutline> {
	const input = RambleRequest.parse(request);
	if (!input.transcript.trim()) return { items: [] };
	const names = aliases(input);
	const keyed = models.filter(spec => keys[spec.provider]);
	if (!keyed.length) throw new ApiError(503, 'Ramble logging needs GEMINI_API_KEY or XAI_API_KEY on the server');
	const now = Date.now();
	const awake = keyed.filter(spec => (resting.get(spec.model) ?? 0) <= now);
	let failure: unknown;
	for (const spec of awake.length ? awake : keyed) {
		const timeout = AbortSignal.timeout(TIMEOUT_MS);
		try {
			const { label, text } = await ask(
				spec,
				keys[spec.provider]!,
				rambleInstructions(input),
				`Ramble: ${input.transcript}`,
				responseSchema(names),
				signal ? AbortSignal.any([signal, timeout]) : timeout,
			);
			let json: unknown;
			try {
				json = JSON.parse(text);
			} catch {
				throw new ApiError(502, `${label}'s answer is not JSON: ${text.slice(0, 200)}`);
			}
			const parsed = ModelOutline.safeParse(json);
			if (!parsed.success)
				throw new ApiError(502, `${label}'s answer does not fit the schema: ${parsed.error.message}`);
			resting.delete(spec.model);
			return resolveAliases(parsed.data, input, names);
		} catch (error) {
			if (signal?.aborted) throw error;
			console.error(`ramble read failed on ${spec.model}: ${String(error).slice(0, 300)}`);
			resting.set(spec.model, Date.now() + REST_MS);
			failure = error;
		}
	}
	throw failure;
}
