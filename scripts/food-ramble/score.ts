import type { RambleItem, RambleOutline } from '../../server/src/food/ramble';
import type { Case, Expected } from './cases';

/** The labelled-ramble scorer of the ramble lab (`scripts/ramble-lab/`). */

const UNITS: Record<string, string> = {
	gram: 'g',
	grams: 'g',
	gr: 'g',
	kilogram: 'kg',
	ounce: 'oz',
	ounces: 'oz',
	pound: 'lb',
	lbs: 'lb',
	milliliter: 'ml',
	milliliters: 'ml',
	ml: 'ml',
	liter: 'l',
	cups: 'cup',
	tablespoon: 'tbsp',
	tablespoons: 'tbsp',
	teaspoon: 'tsp',
	teaspoons: 'tsp',
};
/** "berries" and "berry", "potatoes" and "potato", "eggs" and "egg" compare equal. */
const singular = (word: string) => {
	if (word.length <= 3 || !word.endsWith('s') || word.endsWith('ss')) return word;
	if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
	if (word.endsWith('oes')) return word.slice(0, -2);
	return word.slice(0, -1);
};
const BASE: Record<string, [string, number]> = {
	g: ['g', 1],
	kg: ['g', 1000],
	oz: ['g', 28.3495],
	lb: ['g', 453.592],
	ml: ['ml', 1],
	l: ['ml', 1000],
};
const unit = (u: string) => {
	const lower = u.trim().toLowerCase();
	return UNITS[lower] ?? singular(lower);
};
const words = (s: string) =>
	s
		.toLowerCase()
		.replace(/(\d)"/g, '$1 inch')
		.split(/[^\p{L}\p{N}%.]+/u)
		.map(w => w.replace(/^\.+|\.+$/g, ''))
		.filter(w => w && !['a', 'an', 'the', 'of', 'with', 'and'].includes(w))
		.map(singular);

export function nameMatches(accepted: string[], actual: string): boolean {
	const got = new Set(words(actual));
	// "corn flakes" and "cornflakes" are one food: a name also matches as a run of the output's words joined up.
	const joined = words(actual);
	return accepted.some(name => {
		const want = words(name);
		if (want.every(w => got.has(w)) && got.size <= new Set(want).size + 2) return true;
		const glued = want.join('');
		return joined.some((_, i) =>
			joined.slice(i).some((__, k) => joined.slice(i, i + k + 1).join('') === glued && joined.length - (k + 1) <= 2),
		);
	});
}

function anyOf<T>(want: T | T[], got: T, same: (a: T, b: T) => boolean = (a, b) => a === b) {
	return (Array.isArray(want) ? want : [want]).some(w => same(w, got));
}

/** The fields of `actual` that differ from `expected`, empty when it matches. */
export function diff(expected: Expected, actual: RambleItem, text: string): string[] {
	const misses: string[] = [];
	const kind = expected.kind ?? 'food';
	if (actual.kind !== kind) return [`kind ${actual.kind}`];
	if (expected.name && !nameMatches(expected.name, actual.name)) misses.push(`name "${actual.name}"`);
	// Amount 0 logs one usual serving, so with no unit it is the same entry as amount 1 ("a banana"). Not with a ref:
	// there 0 keeps the logged serving ("my usual pancake" is the usual 2) and 1 is one of the default measure.
	const amount = (a: number, u: string) => (a === 0 && !u && !actual.ref ? 1 : a);
	const [base, scale] = BASE[unit(actual.unit)] ?? [unit(actual.unit), 1];
	const wantUnits = expected.unit === undefined ? [] : Array.isArray(expected.unit) ? expected.unit : [expected.unit];
	const sameQuantity = wantUnits.some(u => {
		const [wantBase, wantScale] = BASE[unit(u)] ?? [unit(u), 1];
		const wants = Array.isArray(expected.amount) ? expected.amount : [expected.amount ?? actual.amount];
		return (
			wantBase === base &&
			wants.some(w => Math.abs(amount(w, u) * wantScale - amount(actual.amount, actual.unit) * scale) < 0.01)
		);
	});
	if (!sameQuantity) {
		if (
			expected.amount !== undefined &&
			!anyOf(expected.amount, actual.amount, (a, b) => amount(a, actual.unit) === amount(b, actual.unit))
		)
			misses.push(`amount ${actual.amount}`);
		if (expected.unit !== undefined && !anyOf(expected.unit, actual.unit, (a, b) => unit(a) === unit(b)))
			misses.push(`unit "${actual.unit}"`);
	}
	if (!anyOf(expected.ref ?? null, actual.ref)) misses.push(`ref ${actual.ref}`);
	if ((expected.copy ?? null) !== actual.copy) misses.push(`copy ${actual.copy}`);
	if ((expected.except ?? []).toSorted().join() !== actual.except.toSorted().join())
		misses.push(`except [${actual.except}]`);
	if (expected.meal !== undefined && !anyOf(expected.meal, actual.meal)) misses.push(`meal "${actual.meal}"`);
	if ((expected.time ?? '') !== actual.time) misses.push(`time "${actual.time}"`);
	// A labelled day was said and must come back. Otherwise the phone's open day applies, unless "today" was said.
	const today = actual.day === 0 && /\btoday\b/i.test(text);
	if (expected.day === undefined ? actual.day !== null && !today : expected.day !== actual.day)
		misses.push(`day ${actual.day}`);
	if ((expected.options ?? false) !== actual.options) misses.push(`options ${actual.options}`);
	return misses;
}

export function check(c: Case, outline: RambleOutline): string[] {
	const misses: string[] = [];
	if (outline.items.length !== c.items.length) misses.push(`${outline.items.length} items, want ${c.items.length}`);
	// Order does not change what is logged: each expected item takes the first unclaimed match, else is compared with
	// the item at its own position.
	const claimed = new Set<number>();
	c.items.forEach((expected, i) => {
		const match = outline.items.findIndex((item, j) => !claimed.has(j) && diff(expected, item, c.text).length === 0);
		if (match >= 0) return claimed.add(match);
		const actual = outline.items[i];
		if (actual) for (const miss of diff(expected, actual, c.text)) misses.push(`#${i + 1} ${miss}`);
		else misses.push(`#${i + 1} missing`);
	});
	return misses;
}
