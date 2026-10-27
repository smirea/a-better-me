/**
 * The numbers the phone derives instead of storing, ported from `app-ios/Sources/App/Nutrition/Engine/` and
 * `Dashboard/NutritionMetrics.swift` so an agent reads the same trend, expenditure, and targets the app shows. Days are
 * `YYYY-MM-DD`; a weigh-in's day is its instant read in the owner's time zone, which the phone knows and the server is
 * told per request. See docs/decisions/agent-api.md.
 */

export type Day = string;
export type DayValue = { day: Day; value: number };

const DAY_MS = 86_400_000;
export const KG_PER_LB = 0.45359237;
const KCAL_PER_LB_PER_WEEK = 3500;

const epochDay = (day: Day) => Date.parse(`${day}T00:00:00Z`) / DAY_MS;
export const addDays = (day: Day, count: number): Day =>
	new Date((epochDay(day) + count) * DAY_MS).toISOString().slice(0, 10);
export const daysBetween = (start: Day, end: Day) => epochDay(end) - epochDay(start);
/** ISO weekday, Monday 1 through Sunday 7. */
export const weekday = (day: Day) => ((new Date(epochDay(day) * DAY_MS).getUTCDay() + 6) % 7) + 1;

export function eachDay(from: Day, through: Day): Day[] {
	const days: Day[] = [];
	for (let day = from; day <= through; day = addDays(day, 1)) days.push(day);
	return days;
}

export function isTimeZone(timeZone: string) {
	try {
		return !!new Intl.DateTimeFormat('en-CA', { timeZone }).resolvedOptions().timeZone;
	} catch {
		return false;
	}
}

/** The calendar day an instant falls on in `timeZone`. `en-CA` formats dates as `YYYY-MM-DD`. */
export const dayIn = (instant: string | Date, timeZone: string): Day =>
	new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
		new Date(instant),
	);

/** `DailyCombine.mean`: one value per day, several on a day averaged, oldest first. */
function dailyMean(points: DayValue[]): DayValue[] {
	const byDay = new Map<Day, number[]>();
	for (const { day, value } of points) byDay.set(day, [...(byDay.get(day) ?? []), value]);
	return [...byDay]
		.map(([day, values]) => ({ day, value: values.reduce((sum, value) => sum + value, 0) / values.length }))
		.toSorted((a, b) => (a.day < b.day ? -1 : 1));
}

/** `TrendWeight.dailyScale`: weigh-in days as weighed, gaps interpolated, days after the last one held. */
function dailyScale(weighIns: DayValue[], through: Day) {
	const days = dailyMean(weighIns);
	if (!days.length) return [];
	let next = 0;
	let previous = days[0]!;
	const last = days.at(-1)!.day;
	return eachDay(previous.day, through > last ? through : last).map(day => {
		const weighIn = days[next];
		if (weighIn?.day === day) {
			previous = weighIn;
			next += 1;
			return { day, value: weighIn.value, weighedIn: true };
		}
		if (weighIn) {
			const share = daysBetween(previous.day, day) / daysBetween(previous.day, weighIn.day);
			return { day, value: previous.value + (weighIn.value - previous.value) * share, weighedIn: false };
		}
		return { day, value: previous.value, weighedIn: false };
	});
}

/** `TrendWeight.seed`: the intercept of a least-squares line through the first week. */
function seed(values: number[]) {
	if (values.length === 1) return values[0]!;
	const meanX = (values.length - 1) / 2;
	const meanY = values.reduce((sum, value) => sum + value, 0) / values.length;
	let covariance = 0;
	let variance = 0;
	values.forEach((value, index) => {
		covariance += (index - meanX) * (value - meanY);
		variance += (index - meanX) ** 2;
	});
	return meanY - (covariance / variance) * meanX;
}

export type TrendDay = { day: Day; scaleKg: number; trendKg: number; weighedIn: boolean };

/** MacroFactor's Weight Trend V1, as `NutritionEngine.TrendWeight.daily`: an EMA with a 0.1 daily factor. */
export function weightTrend(weighIns: DayValue[], through: Day): TrendDay[] {
	const scale = dailyScale(weighIns, through);
	if (!scale.length) return [];
	let trend = seed(scale.slice(0, 7).map(day => day.value));
	return scale.map(({ day, value, weighedIn }) => {
		trend += 0.1 * (value - trend);
		return { day, scaleKg: value, trendKg: trend, weighedIn };
	});
}

/** `NutritionMetrics.weightInsights`: the last three weeks of trend, as a weekly rate, a daily balance, and 30 days on. */
export function weightInsights(trend: TrendDay[], today: Day) {
	const byDay = new Map(trend.map(day => [day.day, day.trendKg]));
	const current = byDay.get(today);
	if (current === undefined) return null;
	const before = byDay.get(addDays(today, -21));
	const weekly = before === undefined ? null : (current - before) / 3;
	return {
		trendKg: current,
		weeklyChangeKg: weekly,
		energyBalanceKcal: weekly === null ? null : ((weekly / KG_PER_LB) * KCAL_PER_LB_PER_WEEK) / 7,
		projectedKgIn30Days: weekly === null ? null : current + (weekly * 30) / 7,
	};
}

/** `DayIntake.energy`: an override counts, a partial day is skipped, and an empty day counts as 0 only when fasted. */
export function countedKcal(entriesKcal: number | null, status: string, override: Record<string, number> | null) {
	if (override) return override.k ?? 0;
	if (status === 'partial') return null;
	if (entriesKcal === null) return status === 'fasted' ? 0 : null;
	return entriesKcal;
}

export type ExpenditureDay = { day: Day; kcal: number; holding: boolean };

const WINDOW = 28;
const GATE = 7;
const KCAL_PER_KG = 3000 / KG_PER_LB;

/**
 * `NutritionEngine.Expenditure.daily` with the `v3` model: a day's estimate uses data through the day before, and
 * updates only when the seven days before hold three counted days and one weigh-in.
 */
export function expenditureDays(
	intake: Map<Day, number>,
	trend: Map<Day, number>,
	weighInDays: Set<Day>,
	initial: number,
	from: Day,
	through: Day,
): ExpenditureDay[] {
	let estimate = initial;
	const back = (day: Day, count: number) => Array.from({ length: count }, (_, index) => addDays(day, -index - 1));
	return eachDay(from, through).map(day => {
		const gate = back(day, GATE);
		const canUpdate = gate.filter(d => intake.has(d)).length >= 3 && gate.some(d => weighInDays.has(d));
		const window = back(day, WINDOW);
		const eaten = window.flatMap(d => (intake.has(d) ? [intake.get(d)!] : []));
		const endTrend = trend.get(window[0]!);
		const startTrend = trend.get(addDays(window.at(-1)!, -1));
		if (canUpdate && eaten.length && endTrend !== undefined && startTrend !== undefined) {
			const mean = eaten.reduce((sum, kcal) => sum + kcal, 0) / eaten.length;
			estimate += 0.015 * (mean - ((endTrend - startTrend) * KCAL_PER_KG) / WINDOW - estimate);
			return { day, kcal: estimate, holding: false };
		}
		return { day, kcal: estimate, holding: true };
	});
}

export type Profile = { sex?: unknown; heightCm?: unknown; birthDate?: unknown };
export type ExpenditureSettings = {
	staticKcal?: number | null;
	initialKcal?: number | null;
	calculationStart?: Day | null;
	activity?: string | null;
	exercise?: string | null;
};

const ACTIVITY: Record<string, number> = { mostlySedentary: 1.2, moderatelyActive: 1.4, veryActive: 1.6 };
const SESSIONS: Record<string, number> = { zero: 0, oneToThree: 0.075, fourToSix: 0.15, sevenPlus: 0.225 };

function fullYears(birth: Day, on: Day) {
	const [by, bm, bd] = birth.split('-').map(Number) as [number, number, number];
	const [y, m, d] = on.split('-').map(Number) as [number, number, number];
	return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/**
 * `NutritionMetrics.initialEstimate`: the MacroFactor Equation times the inferred activity factor. An unanswered
 * question reads as moderately active with four to six sessions, the one cell the factors are anchored on.
 */
export function initialEstimate(profile: Profile, settings: ExpenditureSettings, weightKg: number, on: Day) {
	const { heightCm, birthDate } = profile;
	if (typeof heightCm !== 'number' || typeof birthDate !== 'string') return null;
	const age = fullYears(birthDate, on);
	const bmr =
		129.6 * weightKg ** 0.55 +
		0.011 * heightCm * heightCm -
		(age > 60 ? 4.9 : 1.96) * age -
		(profile.sex === 'female' ? 213.8 : 0);
	const factor = (ACTIVITY[settings.activity ?? ''] ?? 1.4) + (SESSIONS[settings.exercise ?? ''] ?? 0.15);
	return Math.round(bmr * factor);
}

export type Expenditure =
	| { strategy: 'fixed' | 'updating' | 'holding'; start: Day; initialKcal: number | null; days: ExpenditureDay[] }
	| { strategy: null; missing: string; days: [] };

/** `NutritionMetrics.expenditure`, the one function the Dashboard and a check-in read. */
export function expenditure(input: {
	intake: Map<Day, number>;
	weighIns: DayValue[];
	trend: TrendDay[];
	settings: ExpenditureSettings;
	profile: Profile;
	today: Day;
}): Expenditure {
	const { intake, weighIns, trend, settings, profile, today } = input;
	const firsts = [...intake.keys(), ...weighIns.map(w => w.day)].toSorted();
	const start = settings.calculationStart ?? firsts[0];
	if (!start) return { strategy: null, missing: 'No weigh-ins or logged days yet.', days: [] };
	if (start > today) return { strategy: null, missing: `The calculation starts on ${start}.`, days: [] };
	if (settings.staticKcal) {
		const days = eachDay(start, today).map(day => ({ day, kcal: settings.staticKcal!, holding: false }));
		return { strategy: 'fixed', start, initialKcal: null, days };
	}
	const weightKg = (trend.find(day => day.day === start) ?? trend[0])?.trendKg;
	const initial =
		settings.initialKcal ?? (weightKg === undefined ? null : initialEstimate(profile, settings, weightKg, start));
	if (initial === null) {
		return {
			strategy: null,
			missing:
				'No initial estimate: set settings.nutrition.expenditure.initialKcal, or profile.heightCm and birthDate with a weigh-in.',
			days: [],
		};
	}
	const trendByDay = new Map(trend.map(day => [day.day, day.trendKg]));
	const days = expenditureDays(intake, trendByDay, new Set(weighIns.map(w => w.day)), initial, start, today);
	return { strategy: days.at(-1)!.holding ? 'holding' : 'updating', start, initialKcal: initial, days };
}

type Plan = { id: Day; targets: unknown };
export type DayTarget = { energy: number; protein: number; fat: number; carbs: number };

/** `NutritionPlan.effective(on:)` and `target(on:)`: the latest plan on or before the day, at its weekday. */
export function planOn<P extends Plan>(plans: P[], day: Day) {
	const plan = plans
		.filter(p => p.id <= day)
		.reduce<P | undefined>((latest, p) => (!latest || p.id > latest.id ? p : latest), undefined);
	return plan ? { plan, target: (plan.targets as DayTarget[])[weekday(day) - 1] ?? null } : null;
}
