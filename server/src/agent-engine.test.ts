import { describe, expect, test } from 'bun:test';
import { addDays, dayIn, eachDay, expenditure, expenditureDays, initialEstimate, weightTrend } from './agent/engine';

/** The literals are the iOS engine tests' (`app-ios/Tests/Nutrition/Engine/`), so the port answers what the phone does. */
const round = (values: number[], places: number) => values.map(value => Number(value.toFixed(places)));

describe('trend weight', () => {
	test('interpolates the scale across a gap and holds the last weigh-in after it', () => {
		const weighIns = [
			{ day: '2026-10-01', value: 100 },
			{ day: '2026-10-02', value: 99 },
			{ day: '2026-10-04', value: 98 },
		];
		const trend = weightTrend(weighIns, '2026-10-05');
		expect(trend.map(day => day.scaleKg)).toEqual([100, 99, 98.5, 98, 98]);
		expect(trend.map(day => day.weighedIn)).toEqual([true, true, false, true, false]);
		expect(
			round(
				trend.map(day => day.trendKg),
				3,
			),
		).toEqual([99.73, 99.657, 99.541, 99.387, 99.248]);
	});

	test('averages a day of weigh-ins and keeps easing toward the last one', () => {
		const weighIns = [
			{ day: '2026-10-01', value: 80 },
			{ day: '2026-10-02', value: 81 },
			{ day: '2026-10-02', value: 83 },
		];
		expect(
			round(
				weightTrend(weighIns, '2026-10-04').map(day => day.trendKg),
				3,
			),
		).toEqual([80.54, 80.686, 80.817, 80.936]);
	});

	test('a single weigh-in is its own trend, none gives none, and it runs through the last weigh-in', () => {
		expect(weightTrend([{ day: '2026-10-03', value: 90 }], '2026-10-03')).toEqual([
			{ day: '2026-10-03', scaleKg: 90, trendKg: 90, weighedIn: true },
		]);
		expect(weightTrend([], '2026-10-03')).toEqual([]);
		const two = [
			{ day: '2026-10-01', value: 90 },
			{ day: '2026-10-03', value: 92 },
		];
		expect(weightTrend(two, '2026-10-01').length).toBe(3);
	});

	test('a weigh-in lands on its day in the owner time zone, and days step by date across daylight saving', () => {
		expect(dayIn('2026-03-08T07:30:00.000Z', 'America/Los_Angeles')).toBe('2026-03-07');
		expect(dayIn('2026-03-08T07:30:00.000Z', 'UTC')).toBe('2026-03-08');
		expect(eachDay('2026-03-07', '2026-03-10')).toEqual(['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10']);
		const trend = weightTrend(
			[
				{ day: '2026-03-07', value: 100 },
				{ day: '2026-03-10', value: 97 },
			],
			'2026-03-10',
		);
		expect(
			round(
				trend.map(day => day.trendKg),
				3,
			),
		).toEqual([100, 99.9, 99.71, 99.439]);
	});
});

describe('expenditure', () => {
	const days = Array.from({ length: 45 }, (_, index) => addDays('2026-01-01', index));
	const weighIns = days.map(day => ({ day, value: 80 }));
	const intake = new Map(days.map(day => [day, 2000]));
	const trendOf = (points: { day: string; value: number }[]) =>
		new Map(weightTrend(points, days[44]!).map(day => [day.day, day.trendKg]));

	test('closes a share of the gap to the energy-balance estimate each day', () => {
		const result = expenditureDays(intake, trendOf(weighIns), new Set(days), 2500, days[30]!, days[32]!);
		expect(
			round(
				result.map(day => day.kcal),
				4,
			),
		).toEqual([2492.5, 2485.1125, 2477.8358]);
		expect(result.map(day => day.holding)).toEqual([false, false, false]);
	});

	test('a falling trend raises the estimate', () => {
		const falling = new Map(days.map((day, index) => [day, 90 - 0.1 * index]));
		const result = expenditureDays(intake, falling, new Set(days), 2500, days[30]!, days[30]!);
		expect(
			round(
				result.map(day => day.kcal),
				4,
			),
		).toEqual([2502.4208]);
	});

	test('a new user updates over the trend there is, at the startup gain', () => {
		const result = expenditureDays(intake, trendOf(weighIns), new Set(days), 2500, days[0]!, days[5]!);
		expect(result.map(day => [round([day.kcal], 2)[0], day.holding])).toEqual([
			[2500, true],
			[2500, true],
			[2500, true],
			[2500, true],
			[2400, false],
			[2320, false],
		]);
	});

	test('holds without three counted days or a weigh-in in the week before', () => {
		const sparse = new Map([...intake].filter(([day]) => Number(day.slice(8)) % 4 === 0));
		const held = expenditureDays(sparse, trendOf(weighIns), new Set(days), 2500, days[30]!, days[32]!);
		expect(held.map(day => [day.kcal, day.holding])).toEqual([
			[2500, true],
			[2500, true],
			[2500, true],
		]);
		expect(expenditureDays(intake, trendOf(weighIns), new Set(), 2500, days[30]!, days[30]!)).toEqual([
			{ day: days[30]!, kcal: 2500, holding: true },
		]);
	});

	test('starts at the first data with the BMR estimate, or runs the static number', () => {
		const profile = { sex: 'male', heightCm: 180, birthDate: '1996-01-01' };
		expect(initialEstimate(profile, {}, 100, '2026-01-01')).toBe(2990);
		expect(
			initialEstimate(
				{ ...profile, sex: 'female' },
				{ activity: 'mostlySedentary', exercise: 'zero' },
				100,
				'2026-01-01',
			),
		).toBe(2058);
		expect(initialEstimate({ sex: 'male' }, {}, 100, '2026-01-01')).toBeNull();

		const trend = weightTrend(weighIns, days[32]!);
		const run = expenditure({ intake, weighIns, trend, settings: {}, profile, today: days[32]! });
		expect(run).toMatchObject({ strategy: 'updating', start: '2026-01-01', initialKcal: 2698 });
		expect(run.days.length).toBe(33);

		const fixed = expenditure({
			intake,
			weighIns,
			trend,
			settings: { staticKcal: 2400 },
			profile: {},
			today: days[2]!,
		});
		expect(fixed).toEqual({
			strategy: 'fixed',
			start: '2026-01-01',
			initialKcal: null,
			days: days.slice(0, 3).map(day => ({ day, kcal: 2400, holding: false })),
		});
		expect(expenditure({ intake, weighIns, trend, settings: {}, profile: {}, today: days[2]! }).strategy).toBeNull();
	});
});
