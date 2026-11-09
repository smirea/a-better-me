import { describe, expect, test } from 'bun:test';
import { addDays } from './agent/engine';
import { maintenance, screenIntake } from './agent/maintenance';

/** The literals are the iOS engine tests' (`app-ios/Tests/Nutrition/Engine/MaintenanceTests.swift`), so the port answers what the phone does. */
const at = (index: number) => addDays('2026-01-01', index);
const day = (index: number, kcal: number, proteinG = 150, entries = 7, marked = false) => ({
	day: at(index),
	kcal,
	proteinG,
	entries,
	marked,
});
const round = (value: number) => Number(value.toFixed(1));

/** Sixty days: 2000 kcal logged four days in five, a daily weigh-in losing 50 g a day, and one weigh-in 3 kg off. */
const days = Array.from({ length: 60 }, (_, i) => i)
	.filter(i => i % 5 !== 4)
	.map(i => day(i, 2000));
const weighIns = Array.from({ length: 60 }, (_, i) => ({ day: at(i), value: 100 - 0.05 * i + (i === 30 ? 3 : 0) }));

describe('maintenance', () => {
	test('leaves out a day far below the typical one, or a light one with few entries or little protein, but never a marked one', () => {
		const typical = Array.from({ length: 20 }, (_, i) => day(i, 2000 + (i % 3) * 100));
		const { counted, incomplete } = screenIntake([
			...typical,
			day(20, 500, 40, 2),
			day(21, 1400, 120, 2),
			day(22, 1400, 60),
			day(23, 1400),
			day(24, 0, 0, 0, true),
			day(25, 300, 20, 0, true),
		]);
		expect(incomplete).toEqual([
			{ day: at(20), kcal: 500, typicalKcal: 2100, reason: 'farBelowTypical' },
			{ day: at(21), kcal: 1400, typicalKcal: 2100, reason: 'fewEntries' },
			{ day: at(22), kcal: 1400, typicalKcal: 2100, reason: 'lowProtein' },
		]);
		expect([...counted.keys()].slice(-3)).toEqual([at(23), at(24), at(25)]);
	});

	test('measures a dense stretch after it settles, without the outlier weigh-in, at today’s weight', () => {
		const estimate = maintenance({
			days,
			weighIns,
			weightKg: 97,
			steps: [],
			workouts: [],
			prior: null,
			today: at(60),
		})!;
		const [period] = estimate.periods;
		expect([period!.start, period!.end, period!.days, period!.loggedDays, period!.weighIns]).toEqual([
			at(14),
			at(58),
			45,
			36,
			44,
		]);
		expect([
			period!.intakeKcal,
			round(period!.weightChangeKg),
			round(period!.meanWeightKg),
			round(period!.measuredKcal),
		]).toEqual([2000, -2.3, 98.2, 2330.7]);
		expect(period!.adjustments.map(a => [a.kind, round(a.kcal)])).toEqual([['weight', -26.4]]);
		expect([round(estimate.kcal), round(estimate.sdKcal), period!.share]).toEqual([2304.3, 100, 1]);
	});

	test('moves an old stretch to today’s steps and workouts and pools it with the prior', () => {
		const steps = Array.from({ length: 100 }, (_, i) => ({ day: at(i), value: i < 60 ? 5000 : 9000 }));
		const workouts = Array.from({ length: 30 }, (_, i) => ({ day: at(i * 2), minutes: 60 }));
		const estimate = maintenance({
			days,
			weighIns,
			weightKg: 96,
			steps,
			workouts,
			prior: { kcal: 2600, source: 'bmr' },
			today: at(100),
		})!;
		const [period] = estimate.periods;
		expect(period!.adjustments.map(a => [a.kind, round(a.before), round(a.now), round(a.kcal)])).toEqual([
			['weight', 98.2, 96, -48.4],
			['steps', 5000, 9000, 160],
			['workouts', 214.7, 0, -122.7],
		]);
		expect([round(period!.kcal), round(period!.sdKcal), round(period!.share)]).toEqual([2319.6, 123.7, 0.9]);
		expect([round(estimate.kcal), round(estimate.prior!.share)]).toEqual([2344.1, 0.1]);
	});

	test('falls back to the prior without a dense stretch, and to nothing without one', () => {
		const thin = {
			days: days.slice(0, 10),
			weighIns: weighIns.slice(0, 10),
			steps: [],
			workouts: [],
			weightKg: 97,
			today: at(60),
		};
		const estimate = maintenance({ ...thin, prior: { kcal: 2600, source: 'bmr' } })!;
		expect([estimate.kcal, estimate.sdKcal, estimate.periods.length, estimate.prior!.share]).toEqual([2600, 400, 0, 1]);
		expect(maintenance({ ...thin, prior: null })).toBeNull();
	});
});
