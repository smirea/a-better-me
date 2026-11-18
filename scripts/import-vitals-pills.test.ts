import { expect, test } from 'bun:test';
import { amountOf, rowsOf, type Vitals } from './import-vitals-pills';

test("a vitals amount's number leads and the words after it join the unit", () => {
	expect(amountOf('1,000', 'mg')).toEqual({ amount: 1000, unit: 'mg' });
	expect(amountOf('100 million', 'AFU')).toEqual({ amount: 100, unit: 'million AFU' });
	expect(amountOf('0.05', 'mg')).toEqual({ amount: 0.05, unit: 'mg' });
	expect(amountOf('5', '')).toEqual({ amount: 5 });
	expect(amountOf(null, null)).toEqual({});
});

/** A made-up pill, none of the owner's. */
test('a vitals period becomes a regimen with the same dates, oldest first, on ISO weekdays', () => {
	const vitals: Vitals = {
		pills: [{ id: 32, name: 'Zinc', value: '1', unit: 'capsule', note: null, url: null }],
		components: [],
		periods: [
			{
				id: 27,
				pill_id: 32,
				start_date: '2026-01-12',
				end_date: null,
				count: 2,
				timing: 'morning',
				days_of_week_json: '["sunday","monday"]',
			},
			{
				id: 26,
				pill_id: 32,
				start_date: '2026-01-05',
				end_date: '2026-01-11',
				count: 1,
				timing: null,
				days_of_week_json: '[]',
			},
		],
		images: [],
		tags: [],
		pillTags: [],
		periodTags: [],
	};
	const [supplement] = rowsOf(vitals, '2026-11-17T00:00:00.000Z').supplements;
	expect(JSON.parse(supplement!.values.regimens as string)).toEqual([
		{ start: '2026-01-05', end: '2026-01-11', count: 1, weekdays: [] },
		{ start: '2026-01-12', count: 2, timing: 'morning', weekdays: [1, 7] },
	]);
});
