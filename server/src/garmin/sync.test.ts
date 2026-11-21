import { describe, expect, it } from 'bun:test';
import { createSpace } from 'sync-engine/core';
import { bunSqlite } from 'sync-engine/bun-sqlite';
import { schema } from '../../../shared/db/schema';
import { computeWhoopStressSeries, detectMotionSpans, estimateStrain } from '../../../shared/garmin/metrics';
import { FOREGROUND_THROTTLE_MS, GarminSyncer } from './sync';

function makeJwt(expSeconds: number): string {
	const header = btoa(JSON.stringify({ alg: 'none' }));
	const payload = btoa(JSON.stringify({ exp: expSeconds }));
	return `${header}.${payload}.sig`;
}

function createTestSyncer(options: {
	fetchFn: typeof fetch;
	now: () => number;
	personalApiKey?: string | null;
	connectTokensJson?: string | null;
}) {
	const driver = bunSqlite(':memory:');
	const space = createSpace(driver, schema, {});
	space.migrate();
	const published: number[] = [];
	const syncer = new GarminSyncer(
		space,
		driver,
		{
			personalApiKey: options.personalApiKey ?? 'test-key',
			connectTokensJson: options.connectTokensJson ?? null,
		},
		head => published.push(head),
		options.fetchFn,
		options.now,
	);
	return { syncer, space, driver, published };
}

describe('Garmin metrics', () => {
	it('computes WHOOP-style stress monitor curve and fills motion gaps from HR', () => {
		const baseSec = 1_795_100_000;
		const heartRate: [number, number][] = [];
		const rawStress: [number, number][] = [];
		const motionMinutes = new Set<number>();

		for (let i = 0; i < 40; i++) {
			const sec = baseSec + i * 60;
			const isWalk = i >= 15 && i <= 25;
			heartRate.push([sec, isWalk ? 110 : 72]);
			if (isWalk) motionMinutes.add(Math.floor(sec / 60));
			else rawStress.push([sec, 25]);
		}

		const series = computeWhoopStressSeries({
			heartRate,
			rawStress,
			respiration: [],
			motionMinutes,
			restingHeartRate: 60,
			sleepStartSec: null,
			sleepEndSec: null,
			stepMinutes: 3,
		});

		expect(series.length).toBeGreaterThan(8);
		const restPoint = series[1]![1];
		const walkPoint = series.find(([sec]) => sec >= baseSec + 18 * 60 && sec <= baseSec + 22 * 60)![1];
		expect(walkPoint).toBeGreaterThan(restPoint);
		expect(walkPoint).toBeLessThanOrEqual(3);
		expect(restPoint).toBeGreaterThanOrEqual(0);

		const spans = detectMotionSpans(motionMinutes, 9);
		expect(spans).toHaveLength(1);
	});

	it('swaps 1-second activity HR in place of all-day HR when computing strain', () => {
		const start = 1_795_100_000;
		const allDay: [number, number][] = Array.from({ length: 60 }, (_, i) => [start + i * 60, 75]);
		const activity: [number, number][] = Array.from({ length: 1800 }, (_, i) => [start + 600 + i, 155]);

		const baseStrain = estimateStrain(allDay, [], start, start + 3600, 1);
		const withActivity = estimateStrain(allDay, [activity], start, start + 3600, 1);
		expect(baseStrain).not.toBeNull();
		expect(withActivity).not.toBeNull();
		expect(withActivity!).toBeGreaterThan(baseStrain! + 4);
	});
});

describe('GarminSyncer throttling, SSO caching, and backoff', () => {
	it('caches Personal API bearer token across syncs and enforces 15-minute throttle', async () => {
		let now = Date.parse('2026-11-20T18:00:00Z');
		let tokenExchanges = 0;

		const fetchFn = (async (input: string | URL) => {
			const url = String(input);
			if (url.includes('/personal-api-key/token')) {
				tokenExchanges++;
				return new Response(makeJwt(Math.floor((now + 3600_000) / 1000)), { status: 200 });
			}
			if (url.includes('/v2/dailysummaries')) return Response.json({ data: [] });
			if (url.includes('/dailySleepSummariesByDate')) return Response.json([]);
			if (url.includes('/hrv/daily/')) return Response.json({ hrvSummaries: [] });
			if (url.includes('/search/activities')) return Response.json([]);
			if (url.includes('/usersummary/daily')) return Response.json({ bodyBatteryAtWakeTime: 72 });
			if (url.includes('/dailyHeartRate')) return Response.json({ heartRateValues: [[now - 120_000, 74]] });
			return new Response(null, { status: 404 });
		}) as unknown as typeof fetch;

		const { syncer } = createTestSyncer({ fetchFn, now: () => now });

		const first = await syncer.sync({ days: 1 });
		expect(first.status).toBe('synced');
		expect(tokenExchanges).toBe(1);

		// 5 minutes later: throttled without touching Garmin.
		now += 5 * 60_000;
		const throttled = await syncer.sync({ days: 1 });
		expect(throttled.status).toBe('throttled');
		expect(tokenExchanges).toBe(1);

		// 16 minutes after first sync: runs again, but reuses cached bearer token (still valid > 15m).
		now += FOREGROUND_THROTTLE_MS;
		const second = await syncer.sync({ days: 1 });
		expect(second.status).toBe('synced');
		expect(tokenExchanges).toBe(1);
	});

	it('trips exponential backoff on 429 and blocks further calls until backoff expires', async () => {
		let now = Date.parse('2026-11-20T18:00:00Z');
		let calls = 0;

		const fetchFn = (async () => {
			calls++;
			return new Response('Too Many Requests', { status: 429 });
		}) as unknown as typeof fetch;

		const { syncer } = createTestSyncer({ fetchFn, now: () => now });

		const first = await syncer.sync({ days: 1 });
		expect(first.status).toBe('backoff');
		expect(calls).toBe(1);

		// 30 minutes later: still in 2h backoff, makes zero requests.
		now += 30 * 60_000;
		const blocked = await syncer.sync({ days: 1 });
		expect(blocked.status).toBe('backoff');
		expect(calls).toBe(1);

		// After 2h backoff expires, next 429 doubles backoff to 4h.
		now += 2 * 60 * 60_000;
		const second = await syncer.sync({ days: 1 });
		expect(second.status).toBe('backoff');
		expect(calls).toBe(2);
		expect(syncer.status().consecutiveRateLimits).toBe(2);
	});
});
