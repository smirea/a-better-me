import { describe, expect, test } from 'bun:test';
import { MEALS, USUAL } from '../food-ramble/history';
import { LAB } from './corpus';
import { PERSONAS } from './types';

describe('Ramble labelled corpus', () => {
	test('contains 120 uniquely identified cases with 12 per persona', () => {
		expect(LAB).toHaveLength(120);
		expect(new Set(LAB.map(c => c.id)).size).toBe(120);
		for (const persona of Object.keys(PERSONAS)) {
			const cases = LAB.filter(c => c.persona === persona);
			expect(cases).toHaveLength(12);
			for (const c of cases) expect(c.id).toMatch(new RegExp(`^${persona}-\\d+$`));
		}
	});

	test('references existing history entries and excludes entries from the copied meal', () => {
		const entries = new Set([...USUAL, ...MEALS.flatMap(m => m.entries)].map(e => e.id));
		const meals = new Map(MEALS.map(m => [m.id, m]));
		for (const c of LAB) {
			for (const item of c.items) {
				const refs = Array.isArray(item.ref) ? item.ref : [item.ref];
				for (const ref of refs) if (ref != null) expect(entries.has(ref), `${c.id}: ref ${ref}`).toBe(true);
				if (item.copy !== undefined) expect(meals.has(item.copy), `${c.id}: copy ${item.copy}`).toBe(true);
				for (const id of item.except ?? []) {
					expect(entries.has(id), `${c.id}: except ${id}`).toBe(true);
					expect(
						meals.get(item.copy ?? '')?.entries.some(e => e.id === id),
						`${c.id}: exclusion belongs to copy`,
					).toBe(true);
				}
			}
		}
	});

	test('shown options are nonempty and refer to an expected food', () => {
		for (const c of LAB) {
			for (const shown of c.shown ?? []) {
				expect(shown.options.length, c.id).toBeGreaterThan(0);
				for (const option of shown.options) expect(option.trim().length, c.id).toBeGreaterThan(0);
				expect(Number.isInteger(shown.item), c.id).toBe(true);
				expect(shown.item, c.id).toBeGreaterThanOrEqual(0);
				expect(shown.item, c.id).toBeLessThan(c.items.length);
				expect(c.items[shown.item]?.kind ?? 'food', c.id).toBe('food');
			}
		}
	});

	test('empty labels are reserved for explicitly nothing eaten scenarios', () => {
		for (const c of LAB) {
			if (c.items.length === 0) expect(c.scenario, c.id).toBe('nothing eaten');
			if (c.scenario === 'nothing eaten') expect(c.items, c.id).toHaveLength(0);
		}
	});
});
