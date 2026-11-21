import type { Space, SqlDriver } from 'sync-engine/core';
import {
	computeWhoopStressSeries,
	detectMotionSpans,
	estimateStrain,
	type SeriesPoint,
} from '../../../shared/garmin/metrics';
import { openDb, type RowOf } from '../agent/db';
import { parseWellnessZip, type ParsedWellnessFit } from './fit';

export const GARMIN_CRON = '0 * * * *';
export const GARMIN_SYNC_ROUTE = 'POST /api/garmin/sync';
export const GARMIN_STATUS_ROUTE = 'GET /api/garmin/status';

const PERSONAL_BASE = 'https://personal.connectapi.garmin.com';
const PERSONAL_TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token';
const CONNECT_BASE = 'https://connectapi.garmin.com';
const DI_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';

export const FOREGROUND_THROTTLE_MS = 15 * 60_000;
const TOKEN_REFRESH_MARGIN_MS = 15 * 60_000;
const PERSONAL_TOKEN_TTL_MS = 50 * 60_000;
const FULL_SYNC_INTERVAL_MS = 24 * 60 * 60_000;
const BASE_RATE_LIMIT_BACKOFF_MS = 2 * 60 * 60_000;
const MAX_RATE_LIMIT_BACKOFF_MS = 24 * 60 * 60_000;
const CONNECT_AUTH_BACKOFF_MS = 60 * 60_000;
const MAX_ACTIVITY_HR_POINTS = 7200;

export type GarminCredentials = {
	personalApiKey: string | null;
	connectTokensJson: string | null;
};

type CachedPersonalToken = { token: string; expiresAt: number };
type ConnectTokens = { di_token: string; di_refresh_token: string; di_client_id: string };
export type GarminSyncMeta = {
	lastSyncAt: number | null;
	lastFullSyncAt: number | null;
	backoffUntil: number | null;
	connectBackoffUntil: number | null;
	consecutiveRateLimits: number;
	lastError: string | null;
	lastSyncedDays: string[];
};

export type SyncOutcome =
	| { status: 'synced'; days: string[]; activities: number; usedConnect: boolean; syncedAt: string }
	| { status: 'throttled'; lastSyncAt: string; nextAllowedAt: string }
	| { status: 'backoff'; backoffUntil: string; reason: string }
	| { status: 'unconfigured' };

class HttpError extends Error {
	constructor(
		public readonly status: number,
		public readonly source: 'personal' | 'connect',
		message: string,
	) {
		super(message);
	}
}

function defaultMeta(): GarminSyncMeta {
	return {
		lastSyncAt: null,
		lastFullSyncAt: null,
		backoffUntil: null,
		connectBackoffUntil: null,
		consecutiveRateLimits: 0,
		lastError: null,
		lastSyncedDays: [],
	};
}

function jwtExpiresAt(token: string): number {
	try {
		const part = token.split('.')[1] ?? '';
		const base64 = part.replaceAll('-', '+').replaceAll('_', '/');
		const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
		const json = JSON.parse(atob(padded)) as { exp?: number };
		return (json.exp ?? 0) * 1000;
	} catch {
		return 0;
	}
}

function parseConnectTokens(raw: string | null): ConnectTokens | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<ConnectTokens>;
		if (parsed.di_token && parsed.di_refresh_token && parsed.di_client_id) {
			return {
				di_token: parsed.di_token,
				di_refresh_token: parsed.di_refresh_token,
				di_client_id: parsed.di_client_id,
			};
		}
	} catch {
		// Invalid JSON handled as unconfigured.
	}
	return null;
}

/** `YYYY-MM-DD` in UTC offset (defaults to America/Chicago -6h when no tzOffsetMinutes is supplied). */
function localDayString(nowMs: number, tzOffsetMinutes: number): string {
	return new Date(nowMs + tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

function addDaysUtc(dayStr: string, delta: number): string {
	const d = new Date(`${dayStr}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + delta);
	return d.toISOString().slice(0, 10);
}

function dayRangeList(endDay: string, count: number): string[] {
	const days: string[] = [];
	for (let i = count - 1; i >= 0; i--) days.push(addDaysUtc(endDay, -i));
	return days;
}

function buildUrl(base: string, pathname: string, params: Record<string, string | number | undefined> = {}): string {
	const url = new URL(pathname, base);
	for (const [k, v] of Object.entries(params)) {
		if (v !== undefined) url.searchParams.set(k, String(v));
	}
	return url.toString();
}

function downsampleSeries(points: SeriesPoint[], maxPoints: number): SeriesPoint[] {
	if (points.length <= maxPoints) return points;
	const step = Math.ceil(points.length / maxPoints);
	const out: SeriesPoint[] = [];
	for (let i = 0; i < points.length; i += step) out.push(points[i]!);
	return out;
}

function toIso(epochMs: number | null | undefined): string | null {
	if (typeof epochMs !== 'number' || !Number.isFinite(epochMs) || epochMs <= 0) return null;
	return new Date(epochMs).toISOString();
}

function parseGarminLocalToIso(localStr: string | null | undefined, tzOffsetMinutes: number): string | null {
	if (!localStr) return null;
	const normalized = localStr.replace(' ', 'T');
	const utcMs = Date.parse(`${normalized}Z`);
	if (Number.isNaN(utcMs)) return null;
	return new Date(utcMs - tzOffsetMinutes * 60_000).toISOString();
}

export class GarminSyncer {
	private inFlight: Promise<SyncOutcome> | null = null;
	private stateReady = false;

	constructor(
		private readonly space: Space,
		private readonly driver: SqlDriver,
		private readonly credentials: GarminCredentials,
		private readonly publish: (head: number) => void,
		private readonly fetchFn: typeof fetch = fetch,
		private readonly clock: () => number = () => Date.now(),
	) {}

	private ensureStateTable() {
		if (this.stateReady) return;
		this.driver.exec('CREATE TABLE IF NOT EXISTS _garmin_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
		this.stateReady = true;
	}

	private readState<T>(key: string): T | null {
		this.ensureStateTable();
		const row = this.driver.exec('SELECT value FROM _garmin_state WHERE key = ?', [key])[0];
		if (!row || typeof row.value !== 'string') return null;
		try {
			return JSON.parse(row.value) as T;
		} catch {
			return null;
		}
	}

	private writeState(key: string, value: unknown) {
		this.ensureStateTable();
		this.driver.exec('INSERT OR REPLACE INTO _garmin_state (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
	}

	status(): GarminSyncMeta & { configured: { personal: boolean; connect: boolean } } {
		const meta = { ...defaultMeta(), ...this.readState<Partial<GarminSyncMeta>>('meta') };
		return {
			...meta,
			configured: {
				personal: Boolean(this.credentials.personalApiKey),
				connect: Boolean(
					this.readState<ConnectTokens>('connect_tokens') ?? parseConnectTokens(this.credentials.connectTokensJson),
				),
			},
		};
	}

	/**
	 * Runs a Garmin sync with persistent SSO token caching, foreground throttling (default 15 min),
	 * in-flight coalescing, and exponential 429 backoff.
	 */
	async sync(
		options: {
			force?: boolean;
			throttleMs?: number;
			days?: number;
			tzOffsetMinutes?: number;
		} = {},
	): Promise<SyncOutcome> {
		if (!this.credentials.personalApiKey && !parseConnectTokens(this.credentials.connectTokensJson)) {
			return { status: 'unconfigured' };
		}
		if (this.inFlight) return this.inFlight;

		const now = this.clock();
		const meta = { ...defaultMeta(), ...this.readState<Partial<GarminSyncMeta>>('meta') };
		const throttleMs = options.throttleMs ?? FOREGROUND_THROTTLE_MS;

		if (!options.force) {
			if (meta.backoffUntil != null && now < meta.backoffUntil) {
				return {
					status: 'backoff',
					backoffUntil: new Date(meta.backoffUntil).toISOString(),
					reason: meta.lastError ?? 'Rate limited by Garmin',
				};
			}
			if (meta.lastSyncAt != null && now - meta.lastSyncAt < throttleMs) {
				return {
					status: 'throttled',
					lastSyncAt: new Date(meta.lastSyncAt).toISOString(),
					nextAllowedAt: new Date(meta.lastSyncAt + throttleMs).toISOString(),
				};
			}
		}

		const run = this.executeSync(meta, options).finally(() => {
			this.inFlight = null;
		});
		this.inFlight = run;
		return run;
	}

	private async getPersonalToken(): Promise<string | null> {
		const apiKey = this.credentials.personalApiKey;
		if (!apiKey) return null;
		const now = this.clock();
		const cached = this.readState<CachedPersonalToken>('personal_token');
		if (cached && cached.expiresAt - now > TOKEN_REFRESH_MARGIN_MS) return cached.token;

		const res = await this.fetchFn(PERSONAL_BASE + PERSONAL_TOKEN_PATH, {
			method: 'POST',
			headers: { Accept: '*/*', Authorization: `ApiKey ${apiKey}` },
		});
		const body = await res.text();
		if (!res.ok)
			throw new HttpError(
				res.status,
				'personal',
				`Personal token exchange failed (${res.status}): ${body.slice(0, 200)}`,
			);
		const token = body.trim();
		const exp = jwtExpiresAt(token);
		this.writeState('personal_token', {
			token,
			expiresAt: exp > now ? exp : now + PERSONAL_TOKEN_TTL_MS,
		} satisfies CachedPersonalToken);
		return token;
	}

	private async getConnectToken(meta: GarminSyncMeta): Promise<string | null> {
		const now = this.clock();
		if (meta.connectBackoffUntil != null && now < meta.connectBackoffUntil) return null;

		const envSeed = parseConnectTokens(this.credentials.connectTokensJson);
		let tokens = this.readState<ConnectTokens>('connect_tokens');
		const envSeedHash = this.readState<string>('connect_seed_client');
		if (!tokens && envSeed) {
			tokens = envSeed;
			this.writeState('connect_tokens', tokens);
			this.writeState('connect_seed_client', envSeed.di_refresh_token.slice(0, 16));
		} else if (
			envSeed &&
			envSeedHash !== envSeed.di_refresh_token.slice(0, 16) &&
			(!tokens || jwtExpiresAt(tokens.di_token) < now)
		) {
			// A freshly rotated secret was pushed via env-manager; adopt it if stored token is expired.
			tokens = envSeed;
			this.writeState('connect_tokens', tokens);
			this.writeState('connect_seed_client', envSeed.di_refresh_token.slice(0, 16));
		}
		if (!tokens) return null;

		if (jwtExpiresAt(tokens.di_token) - now > TOKEN_REFRESH_MARGIN_MS) return tokens.di_token;

		const res = await this.fetchFn(DI_TOKEN_URL, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${btoa(`${tokens.di_client_id}:`)}`,
				Accept: 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				client_id: tokens.di_client_id,
				refresh_token: tokens.di_refresh_token,
			}),
		});
		if (!res.ok) {
			const body = await res.text();
			throw new HttpError(res.status, 'connect', `Connect token refresh failed (${res.status}): ${body.slice(0, 200)}`);
		}
		const data = (await res.json()) as { access_token: string; refresh_token?: string };
		const refreshed: ConnectTokens = {
			...tokens,
			di_token: data.access_token,
			di_refresh_token: data.refresh_token ?? tokens.di_refresh_token,
		};
		this.writeState('connect_tokens', refreshed);
		return refreshed.di_token;
	}

	private async fetchJson<T>(
		source: 'personal' | 'connect',
		token: string,
		pathname: string,
		params: Record<string, string | number | undefined> = {},
	): Promise<T | null> {
		const url = buildUrl(source === 'personal' ? PERSONAL_BASE : CONNECT_BASE, pathname, params);
		const res = await this.fetchFn(url, {
			headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
		});
		if (res.status === 204 || res.status === 404) return null;
		const text = await res.text();
		if (!res.ok)
			throw new HttpError(
				res.status,
				source,
				`${source} GET ${pathname} failed (${res.status}): ${text.slice(0, 200)}`,
			);
		return text ? (JSON.parse(text) as T) : null;
	}

	private async fetchBytes(
		source: 'personal' | 'connect',
		token: string,
		pathname: string,
	): Promise<Uint8Array | null> {
		const url = buildUrl(source === 'personal' ? PERSONAL_BASE : CONNECT_BASE, pathname);
		const res = await this.fetchFn(url, { headers: { Authorization: `Bearer ${token}` } });
		if (res.status === 204 || res.status === 404) return null;
		if (!res.ok) {
			const text = await res.text();
			throw new HttpError(
				res.status,
				source,
				`${source} GET ${pathname} failed (${res.status}): ${text.slice(0, 200)}`,
			);
		}
		return new Uint8Array(await res.arrayBuffer());
	}

	private async executeSync(
		meta: GarminSyncMeta,
		options: { days?: number; tzOffsetMinutes?: number },
	): Promise<SyncOutcome> {
		const now = this.clock();
		const tzOffset = options.tzOffsetMinutes ?? -360;
		const today = localDayString(now, tzOffset);
		const db = openDb(this.space, this.driver);

		const existingDaysCount = db.count('garmin_days');
		const needsFull =
			existingDaysCount === 0 || meta.lastFullSyncAt == null || now - meta.lastFullSyncAt >= FULL_SYNC_INTERVAL_MS;
		const dayCount = Math.min(28, Math.max(1, options.days ?? (needsFull ? 7 : 2)));
		const days = dayRangeList(today, dayCount);
		const fromDay = days[0]!;
		const toDay = days.at(-1)!;

		try {
			const personalToken = await this.getPersonalToken();
			let connectToken: string | null = null;
			try {
				connectToken = await this.getConnectToken(meta);
			} catch (err) {
				if (err instanceof HttpError && err.status === 429) throw err;
				meta.connectBackoffUntil = now + CONNECT_AUTH_BACKOFF_MS;
				meta.lastError = err instanceof Error ? err.message : String(err);
			}

			if (!personalToken && !connectToken) {
				this.writeState('meta', meta);
				return {
					status: 'backoff',
					backoffUntil: new Date(meta.connectBackoffUntil ?? now + CONNECT_AUTH_BACKOFF_MS).toISOString(),
					reason: meta.lastError ?? 'No Garmin tokens available',
				};
			}

			// 1. Personal API range fetches
			type DailySummary = {
				calendarDate: string;
				movement?: { steps?: { value?: number | null } | null } | null;
				calories?: { burnedActive?: number | null; burnedTotal?: number | null } | null;
				heartRate?: { restingValue?: number | null } | null;
				stress?: { avgLevel?: number | null; maxLevel?: number | null } | null;
				bodyBattery?: {
					minValue?: number | null;
					maxValue?: number | null;
					chargedValue?: number | null;
					drainedValue?: number | null;
				} | null;
				respiration?: { avgValue?: number | null } | null;
				pulseOx?: { avgValue?: number | null } | null;
			};
			type DailySleep = {
				calendarDate: string;
				sleepTimeSeconds?: number | null;
				sleepStartTimestampGMT?: number | null;
				sleepEndTimestampGMT?: number | null;
				deepSleepSeconds?: number | null;
				lightSleepSeconds?: number | null;
				remSleepSeconds?: number | null;
				awakeSleepSeconds?: number | null;
				sleepScores?: { overall?: { value?: number | null } | null } | null;
			};
			type HrvSummary = {
				calendarDate: string;
				weeklyAvg?: number | null;
				lastNightAvg?: number | null;
				status?: string | null;
			};
			type GarminActivityApi = {
				activityId?: number | null;
				activityName?: string | null;
				startTimeGMT?: string | null;
				startTimeLocal?: string | null;
				duration?: number | null;
				calories?: number | null;
				distance?: number | null;
				averageHR?: number | null;
				maxHR?: number | null;
				activityType?: { typeKey?: string | null } | null;
			};

			const [summariesRes, sleepsRes, hrvRes, activitiesRes] = personalToken
				? await Promise.all([
						this.fetchJson<{ data?: DailySummary[] }>(
							'personal',
							personalToken,
							'/usersummary-service/v2/dailysummaries',
							{
								startDate: fromDay,
								endDate: toDay,
							},
						),
						this.fetchJson<DailySleep[]>('personal', personalToken, '/sleep-service/sleep/dailySleepSummariesByDate', {
							startDate: fromDay,
							endDate: toDay,
						}),
						this.fetchJson<{ hrvSummaries?: HrvSummary[] }>(
							'personal',
							personalToken,
							`/hrv-service/hrv/daily/${fromDay}/${toDay}`,
						),
						this.fetchJson<GarminActivityApi[]>(
							'personal',
							personalToken,
							'/activitylist-service/activities/search/activities',
							{
								start: 0,
								limit: 100,
								startDate: fromDay,
								endDate: toDay,
							},
						),
					])
				: [null, null, null, null];

			const summaryByDay = new Map((summariesRes?.data ?? []).map(s => [s.calendarDate, s]));
			const sleepByDay = new Map((sleepsRes ?? []).map(s => [s.calendarDate, s]));
			const hrvByDay = new Map((hrvRes?.hrvSummaries ?? []).map(h => [h.calendarDate, h]));

			// 2. Connect API range fetches (Readiness, VO2 max)
			type ReadinessEntry = {
				calendarDate: string;
				timestamp?: string;
				score?: number | null;
				level?: string | null;
				inputContext?: string | null;
			};
			type MaxMetEntry = {
				generic?: {
					calendarDate?: string | null;
					vo2MaxPreciseValue?: number | null;
					vo2MaxValue?: number | null;
				} | null;
			};

			let readinessByDay = new Map<string, ReadinessEntry>();
			let vo2ByDay = new Map<string, number>();
			let usedConnect = false;

			if (connectToken) {
				try {
					const [readinessArr, maxMetArr] = await Promise.all([
						this.fetchJson<ReadinessEntry[]>(
							'connect',
							connectToken,
							`/metrics-service/metrics/trainingreadiness/${fromDay}/${toDay}`,
						),
						this.fetchJson<MaxMetEntry[]>(
							'connect',
							connectToken,
							`/metrics-service/metrics/maxmet/daily/${fromDay}/${toDay}`,
						),
					]);
					for (const entry of (readinessArr ?? []).toSorted((a, b) =>
						(a.timestamp ?? '').localeCompare(b.timestamp ?? ''),
					)) {
						const cur = readinessByDay.get(entry.calendarDate);
						if (!cur || entry.inputContext === 'AFTER_WAKEUP_RESET' || cur.inputContext !== 'AFTER_WAKEUP_RESET') {
							readinessByDay.set(entry.calendarDate, entry);
						}
					}
					for (const m of maxMetArr ?? []) {
						const d = m.generic?.calendarDate;
						const v = m.generic?.vo2MaxPreciseValue ?? m.generic?.vo2MaxValue;
						if (d && typeof v === 'number') vo2ByDay.set(d, v);
					}
					usedConnect = true;
				} catch (err) {
					if (err instanceof HttpError && err.status === 429) throw err;
					if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
						meta.connectBackoffUntil = now + CONNECT_AUTH_BACKOFF_MS;
						meta.lastError = err.message;
						connectToken = null;
					}
				}
			}

			// 3. Activities + 1-second HR streams (only fetch details for activities we don't already have HR for)
			const activityRows: RowOf<'garmin_activities'>[] = [];
			const activityStreams: SeriesPoint[][] = [];
			for (const act of activitiesRes ?? []) {
				if (act.activityId == null || (act.duration ?? 0) < 60) continue;
				const id = String(act.activityId);
				const existing = db.get('garmin_activities', id);
				let hrSeries: SeriesPoint[] = Array.isArray(existing?.heartRateSeries)
					? (existing.heartRateSeries as SeriesPoint[])
					: [];

				if (hrSeries.length === 0 && personalToken) {
					const details = await this.fetchJson<{
						metricDescriptors?: { key: string; metricsIndex: number }[] | null;
						activityDetailMetrics?: { metrics: (number | null)[] }[] | null;
					}>('personal', personalToken, `/activity-service/activity/${act.activityId}/details`, {
						maxChartSize: 100_000,
					});
					const idx = (k: string) => details?.metricDescriptors?.find(d => d.key === k)?.metricsIndex;
					const tIdx = idx('directTimestamp');
					const hrIdx = idx('directHeartRate');
					if (tIdx != null && hrIdx != null) {
						const pts: SeriesPoint[] = [];
						for (const row of details?.activityDetailMetrics ?? []) {
							const t = row.metrics[tIdx];
							const bpm = row.metrics[hrIdx];
							if (typeof t === 'number' && typeof bpm === 'number' && bpm > 0) {
								pts.push([Math.floor(t / 1000), Math.round(bpm)]);
							}
						}
						hrSeries = downsampleSeries(pts, MAX_ACTIVITY_HR_POINTS);
					}
				}

				const startIso = act.startTimeGMT
					? new Date(`${act.startTimeGMT.replace(' ', 'T')}Z`).toISOString()
					: (parseGarminLocalToIso(act.startTimeLocal, tzOffset) ?? new Date(now).toISOString());
				const durationSec = act.duration ?? 0;
				const startSec = Math.floor(Date.parse(startIso) / 1000);
				const endSec = startSec + Math.round(durationSec);
				const actStrain = hrSeries.length > 0 ? estimateStrain([], [hrSeries], startSec, endSec) : null;
				if (hrSeries.length > 0) activityStreams.push(hrSeries);

				activityRows.push({
					id,
					name: act.activityName || act.activityType?.typeKey || 'Activity',
					activityType: act.activityType?.typeKey || 'other',
					startedAt: startIso,
					endedAt: new Date(endSec * 1000).toISOString(),
					durationSeconds: Math.round(durationSec),
					calories: act.calories ?? null,
					distanceMeters: act.distance ?? null,
					averageHeartRate: act.averageHR ?? null,
					maxHeartRate: act.maxHR ?? null,
					strain: actStrain,
					heartRateSeries: hrSeries,
				});
			}

			// 4. Per-day wellness FIT (1-min HR/stress/BB/respiration) + fallback Personal API 2-min HR
			const dayRows: RowOf<'garmin_days'>[] = [];
			const syncedAt = new Date(now).toISOString();

			for (const dayStr of days) {
				let parsedFit: ParsedWellnessFit | null = null;
				const motionMinutes = new Set<number>();

				if (connectToken) {
					try {
						const [zip, dailyStress] = await Promise.all([
							this.fetchBytes('connect', connectToken, `/download-service/files/wellness/${dayStr}`),
							this.fetchJson<{ stressValuesArray?: number[][] | null }>(
								'connect',
								connectToken,
								`/wellness-service/wellness/dailyStress/${dayStr}`,
							),
						]);
						if (zip) parsedFit = await parseWellnessZip(zip);
						for (const [tMs, val] of dailyStress?.stressValuesArray ?? []) {
							if (val === -2 && typeof tMs === 'number') {
								const m = Math.floor(tMs / 60_000);
								motionMinutes.add(m);
								motionMinutes.add(m + 1);
								motionMinutes.add(m + 2);
							}
						}
						usedConnect = true;
					} catch (err) {
						if (err instanceof HttpError && err.status === 429) throw err;
						if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
							meta.connectBackoffUntil = now + CONNECT_AUTH_BACKOFF_MS;
							meta.lastError = err.message;
							connectToken = null;
						}
					}
				}

				let heartRateSeries: SeriesPoint[] = parsedFit?.heartRate ?? [];
				let hrStepMinutes = 1;
				let bodyBatteryWake: number | null = null;

				if (personalToken) {
					const userSummary = await this.fetchJson<{ bodyBatteryAtWakeTime?: number | null }>(
						'personal',
						personalToken,
						'/usersummary-service/usersummary/daily',
						{ calendarDate: dayStr },
					);
					bodyBatteryWake = userSummary?.bodyBatteryAtWakeTime ?? null;

					if (heartRateSeries.length === 0) {
						const dailyHr = await this.fetchJson<{ heartRateValues?: (number | null)[][] | null }>(
							'personal',
							personalToken,
							'/wellness-service/wellness/dailyHeartRate',
							{ date: dayStr },
						);
						heartRateSeries = (dailyHr?.heartRateValues ?? []).flatMap(([tMs, bpm]) =>
							typeof tMs === 'number' && typeof bpm === 'number' && bpm > 0
								? [[Math.floor(tMs / 1000), Math.round(bpm)] as SeriesPoint]
								: [],
						);
						hrStepMinutes = 2;
					}
				}

				const summary = summaryByDay.get(dayStr);
				const sleep = sleepByDay.get(dayStr);
				const hrv = hrvByDay.get(dayStr);
				const readiness = readinessByDay.get(dayStr);

				const sleepStartIso = toIso(sleep?.sleepStartTimestampGMT);
				const sleepEndIso = toIso(sleep?.sleepEndTimestampGMT);
				const sleepStartSec = sleepStartIso ? Math.floor(Date.parse(sleepStartIso) / 1000) : null;
				const sleepEndSec = sleepEndIso ? Math.floor(Date.parse(sleepEndIso) / 1000) : null;

				const restingHr = summary?.heartRate?.restingValue ?? parsedFit?.restingHeartRate ?? null;
				const rawStressSeries = parsedFit?.rawStress ?? [];
				const bodyBatterySeries = parsedFit?.bodyBattery ?? [];
				const respirationSeries = parsedFit?.respiration ?? [];

				const stressSeries = computeWhoopStressSeries({
					heartRate: heartRateSeries,
					rawStress: rawStressSeries,
					respiration: respirationSeries,
					motionMinutes,
					restingHeartRate: restingHr ?? 62,
					sleepStartSec,
					sleepEndSec,
					stepMinutes: 3,
				});

				// Day strain over local calendar day window
				const dayStartSec = Math.floor((Date.parse(`${dayStr}T00:00:00Z`) - tzOffset * 60_000) / 1000);
				const dayEndSec = dayStartSec + 86_400;
				const strain = estimateStrain(heartRateSeries, activityStreams, dayStartSec, dayEndSec, hrStepMinutes);

				const prev = db.get('garmin_days', dayStr);
				dayRows.push({
					id: dayStr,
					restingHeartRate: restingHr ?? prev?.restingHeartRate ?? null,
					hrvLastNight: hrv?.lastNightAvg ?? parsedFit?.hrvLastNight ?? prev?.hrvLastNight ?? null,
					hrvWeeklyAvg: hrv?.weeklyAvg ?? parsedFit?.hrvWeeklyAvg ?? prev?.hrvWeeklyAvg ?? null,
					hrvStatus: hrv?.status?.toLowerCase() ?? parsedFit?.hrvStatus ?? prev?.hrvStatus ?? null,
					bodyBatteryWake: bodyBatteryWake ?? prev?.bodyBatteryWake ?? null,
					bodyBatteryHigh: summary?.bodyBattery?.maxValue ?? prev?.bodyBatteryHigh ?? null,
					bodyBatteryLow: summary?.bodyBattery?.minValue ?? prev?.bodyBatteryLow ?? null,
					bodyBatteryCharged: summary?.bodyBattery?.chargedValue ?? prev?.bodyBatteryCharged ?? null,
					bodyBatteryDrained: summary?.bodyBattery?.drainedValue ?? prev?.bodyBatteryDrained ?? null,
					stressAvg: summary?.stress?.avgLevel ?? prev?.stressAvg ?? null,
					stressMax: summary?.stress?.maxLevel ?? prev?.stressMax ?? null,
					sleepScore: sleep?.sleepScores?.overall?.value ?? parsedFit?.sleepScore ?? prev?.sleepScore ?? null,
					sleepStartAt: sleepStartIso ?? prev?.sleepStartAt ?? null,
					sleepEndAt: sleepEndIso ?? prev?.sleepEndAt ?? null,
					sleepSeconds: sleep?.sleepTimeSeconds ?? prev?.sleepSeconds ?? null,
					deepSeconds: sleep?.deepSleepSeconds ?? prev?.deepSeconds ?? null,
					lightSeconds: sleep?.lightSleepSeconds ?? prev?.lightSeconds ?? null,
					remSeconds: sleep?.remSleepSeconds ?? prev?.remSeconds ?? null,
					awakeSeconds: sleep?.awakeSleepSeconds ?? prev?.awakeSeconds ?? null,
					respirationAvg: summary?.respiration?.avgValue ?? prev?.respirationAvg ?? null,
					spo2Avg: summary?.pulseOx?.avgValue ?? prev?.spo2Avg ?? null,
					skinTempNightlyC: parsedFit?.skinTempNightlyC ?? prev?.skinTempNightlyC ?? null,
					skinTempDeviationC: parsedFit?.skinTempDeviationC ?? prev?.skinTempDeviationC ?? null,
					readinessScore: readiness?.score ?? prev?.readinessScore ?? null,
					readinessLevel:
						readiness?.level && readiness.level !== 'NONE'
							? readiness.level.toLowerCase()
							: (prev?.readinessLevel ?? null),
					acuteLoad: prev?.acuteLoad ?? null,
					vo2Max: vo2ByDay.get(dayStr) ?? prev?.vo2Max ?? null,
					steps: summary?.movement?.steps?.value ?? prev?.steps ?? null,
					activeKcal: summary?.calories?.burnedActive ?? prev?.activeKcal ?? null,
					totalKcal: summary?.calories?.burnedTotal ?? prev?.totalKcal ?? null,
					strain: strain ?? prev?.strain ?? null,
					syncedAt,
					stressSeries: stressSeries.length > 0 ? stressSeries : (prev?.stressSeries ?? []),
					heartRateSeries: heartRateSeries.length > 0 ? heartRateSeries : (prev?.heartRateSeries ?? []),
					rawStressSeries: rawStressSeries.length > 0 ? rawStressSeries : (prev?.rawStressSeries ?? []),
					bodyBatterySeries: bodyBatterySeries.length > 0 ? bodyBatterySeries : (prev?.bodyBatterySeries ?? []),
					motionSpans: motionMinutes.size > 0 ? detectMotionSpans(motionMinutes) : (prev?.motionSpans ?? []),
				});
			}

			const before = this.space.head();
			db.commit(
				...dayRows.map(row => db.put('garmin_days', row)),
				...activityRows.map(row => db.put('garmin_activities', row)),
			);
			const after = this.space.head();
			if (after > before) this.publish(after);

			const updatedMeta: GarminSyncMeta = {
				...meta,
				lastSyncAt: now,
				lastFullSyncAt: needsFull ? now : meta.lastFullSyncAt,
				backoffUntil: null,
				consecutiveRateLimits: 0,
				lastError: usedConnect ? null : meta.lastError,
				lastSyncedDays: days,
			};
			this.writeState('meta', updatedMeta);

			return {
				status: 'synced',
				days,
				activities: activityRows.length,
				usedConnect,
				syncedAt,
			};
		} catch (error) {
			if (error instanceof HttpError && error.status === 429) {
				const count = meta.consecutiveRateLimits + 1;
				const backoffMs = Math.min(MAX_RATE_LIMIT_BACKOFF_MS, BASE_RATE_LIMIT_BACKOFF_MS * 2 ** (count - 1));
				const backoffUntil = now + backoffMs;
				this.writeState('meta', {
					...meta,
					backoffUntil,
					consecutiveRateLimits: count,
					lastError: error.message,
				} satisfies GarminSyncMeta);
				return {
					status: 'backoff',
					backoffUntil: new Date(backoffUntil).toISOString(),
					reason: error.message,
				};
			}
			this.writeState('meta', {
				...meta,
				lastError: error instanceof Error ? error.message : String(error),
			} satisfies GarminSyncMeta);
			throw error;
		}
	}
}
