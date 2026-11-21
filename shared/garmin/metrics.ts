/**
 * WHOOP-style Strain (0–21) and Stress Monitor (0.0–3.0) computed from Garmin CIRQA telemetry.
 *
 * Strain constants were fit to 167 HR-only WHOOP workouts + 6 dual-worn CIRQA/WHOOP days.
 * Stress Monitor weights were fit with 5-day leave-one-day-out cross-validation (6,099 paired minutes, r = 0.816
 * overall, r = 0.86–0.88 on full active days): concave Garmin stress mapping + HR elevation to fill `-2` motion gaps.
 */

const STRAIN_RESTING_HR = 66;
const STRAIN_MAX_HR = 194;
const STRAIN_INTENSITY_EXP = 9.1804;
const STRAIN_LOAD_SCALE = 31925.877;
const STRAIN_CURVE_EXP = 0.3594;
const MAX_ACTIVITY_GAP_SEC = 10;

export type SeriesPoint = [epochSec: number, value: number];
export type MotionSpan = { start: number; end: number };

function sampleLoad(bpm: number, minutes: number): number {
	const reserve = Math.min(1, Math.max(0, (bpm - STRAIN_RESTING_HR) / (STRAIN_MAX_HR - STRAIN_RESTING_HR)));
	return minutes * reserve * Math.exp(STRAIN_INTENSITY_EXP * reserve);
}

function strainFromLoad(load: number): number {
	return Math.round(21 * (1 - Math.exp(-((load / STRAIN_LOAD_SCALE) ** STRAIN_CURVE_EXP))) * 10) / 10;
}

/**
 * WHOOP-style 0–21 strain over `[startSec, endSec)` from all-day HR (1-min or 2-min) with 1-second activity streams
 * swapped in wherever an activity covers the window.
 */
export function estimateStrain(
	allDay: SeriesPoint[],
	activityStreams: SeriesPoint[][],
	startSec: number,
	endSec: number,
	allDayStepMinutes = 1,
): number | null {
	const spans = activityStreams
		.filter(points => points.length > 1)
		.map(points => [points[0]![0], points.at(-1)![0]] as const);
	const covered = (sec: number) => spans.some(([from, to]) => sec >= from && sec <= to);

	let load = 0;
	let count = 0;
	for (const [sec, bpm] of allDay) {
		if (sec < startSec || sec >= endSec || bpm <= 0 || covered(sec)) continue;
		load += sampleLoad(bpm, allDayStepMinutes);
		count++;
	}
	for (const stream of activityStreams) {
		for (let i = 0; i < stream.length; i++) {
			const [sec, bpm] = stream[i]!;
			if (sec < startSec || sec >= endSec || bpm <= 0) continue;
			const next = stream[i + 1];
			const gapSec = next ? Math.min(Math.max(1, next[0] - sec), MAX_ACTIVITY_GAP_SEC) : 1;
			load += sampleLoad(bpm, gapSec / 60);
			count++;
		}
	}
	return count === 0 ? null : strainFromLoad(load);
}

/**
 * Calibrated Garmin → WHOOP Stress Monitor (0.0–3.0) series sampled every `stepMinutes` (default 3 min).
 * Combines 1-min Garmin stress, 1-min HR above RHR, respiration, `-2` motion flags, and sleep state with a ±5 min
 * rolling window.
 */
export function computeWhoopStressSeries(input: {
	heartRate: SeriesPoint[];
	rawStress: SeriesPoint[];
	respiration: SeriesPoint[];
	motionMinutes: Set<number>;
	restingHeartRate: number;
	sleepStartSec: number | null;
	sleepEndSec: number | null;
	stepMinutes?: number;
}): SeriesPoint[] {
	const step = input.stepMinutes ?? 3;
	const hrByMin = new Map<number, number>();
	for (const [sec, bpm] of input.heartRate) hrByMin.set(Math.floor(sec / 60), bpm);
	const stByMin = new Map<number, number>();
	for (const [sec, val] of input.rawStress) stByMin.set(Math.floor(sec / 60), val);
	const rrByMin = new Map<number, number>();
	for (const [sec, val] of input.respiration) rrByMin.set(Math.floor(sec / 60), val);

	const allMins = [...new Set([...hrByMin.keys(), ...stByMin.keys()])].sort((a, b) => a - b);
	if (allMins.length === 0) return [];
	const firstMin = allMins[0]!;
	const lastMin = allMins.at(-1)!;
	const rhr = input.restingHeartRate > 35 && input.restingHeartRate < 110 ? input.restingHeartRate : 62;

	const series: SeriesPoint[] = [];
	const radius = 5;

	for (let m = firstMin; m <= lastMin; m += step) {
		let hrSum = 0;
		let hrCount = 0;
		let stSum = 0;
		let stCount = 0;
		let rrSum = 0;
		let rrCount = 0;
		for (let d = -radius; d <= radius; d++) {
			const h = hrByMin.get(m + d);
			if (h != null) {
				hrSum += h;
				hrCount++;
			}
			const s = stByMin.get(m + d);
			if (s != null) {
				stSum += s;
				stCount++;
			}
			const r = rrByMin.get(m + d);
			if (r != null) {
				rrSum += r;
				rrCount++;
			}
		}
		if (hrCount === 0 && stCount === 0) continue;

		const hr = hrCount > 0 ? hrSum / hrCount : rhr;
		const hasSt = stCount > 0 ? 1 : 0;
		const stFrac = (stCount > 0 ? stSum / stCount : 50) / 100;
		const rr = rrCount > 0 ? rrSum / rrCount : 15;
		const mot = input.motionMinutes.has(m) ? 1 : 0;
		const sec = m * 60;
		const slp =
			input.sleepStartSec != null && input.sleepEndSec != null && sec >= input.sleepStartSec && sec <= input.sleepEndSec
				? 1
				: 0;
		const dhr = hr - rhr;

		const raw =
			-0.454 +
			3.975 * stFrac -
			2.495 * stFrac * stFrac +
			0.586 * (dhr / 40) -
			0.299 * (Math.max(0, dhr - 15) / 40) +
			0.112 * mot -
			0.091 * slp +
			0.243 * hasSt +
			0.174 * ((rr - 15) / 10);

		const clamped = Math.round(Math.min(3, Math.max(0, raw)) * 100) / 100;
		series.push([sec, clamped]);
	}

	return series;
}

/** Groups contiguous motion minutes (Garmin stress = -2) lasting at least `minMinutes` into walk/activity spans. */
export function detectMotionSpans(motionMinutes: Set<number>, minMinutes = 9): MotionSpan[] {
	const sorted = [...motionMinutes].sort((a, b) => a - b);
	if (sorted.length === 0) return [];
	const spans: MotionSpan[] = [];
	let start = sorted[0]!;
	let prev = sorted[0]!;
	for (let i = 1; i < sorted.length; i++) {
		const m = sorted[i]!;
		if (m <= prev + 3) {
			prev = m;
		} else {
			if (prev - start + 1 >= minMinutes) spans.push({ start: start * 60, end: (prev + 1) * 60 });
			start = m;
			prev = m;
		}
	}
	if (prev - start + 1 >= minMinutes) spans.push({ start: start * 60, end: (prev + 1) * 60 });
	return spans;
}
