/**
 * The maintenance estimate the planner uses, ported from `app-ios/Sources/App/Nutrition/Engine/Maintenance.swift`:
 * the incomplete-day screen, the periods dense enough to measure, their adjustment to today, and the prior they are
 * pooled with. See docs/decisions/nutrition.md, "Maintenance estimate".
 */
import { addDays, eachDay, type Day } from './engine';

const DAY_MS = 86_400_000;
const KG_PER_LB = 0.45359237;
const KCAL_PER_KG = 3000 / KG_PER_LB;

const epochDay = (day: Day) => Date.parse(`${day}T00:00:00Z`) / DAY_MS;
const daysBetween = (start: Day, end: Day) => epochDay(end) - epochDay(start);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const mean = (values: number[]) => sum(values) / values.length;
const median = (values: number[]) => {
	const sorted = values.toSorted((a, b) => a - b);
	const middle = sorted.length >> 1;
	return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

/** A day `DayIntake` counts. `marked` is a day marked complete or fasted, or entered totals, which the owner vouched for. */
export type CountedDay = { day: Day; kcal: number; proteinG: number; entries: number; marked: boolean };
export type IncompleteReason = 'farBelowTypical' | 'fewEntries' | 'lowProtein';
export type IncompleteDay = { day: Day; kcal: number; typicalKcal: number; reason: IncompleteReason };

const SCREEN = {
	nearDays: 60,
	nearMinimum: 14,
	farDays: 365,
	farMinimum: 7,
	farBelow: 0.6,
	light: 0.75,
	fewEntries: 0.4,
	lowProtein: 0.5,
};

/**
 * `Maintenance.screen`: a day far below the owner's typical intake, or a light day with few entries or little protein,
 * is left out as if marked incomplete. Typical is the median of the other days within 60 days, or within a year when the
 * 60 days hold too few, so a sparse logger's partial days are not compared with each other.
 */
export function screenIntake(days: CountedDay[]) {
	const reference = days.filter(day => !day.marked && day.kcal > 0);
	const incomplete: IncompleteDay[] = [];
	const counted = new Map<Day, number>();
	for (const day of days) {
		const typical = day.marked || day.kcal === 0 ? null : typicalOf(day, reference);
		const reason = typical && incompleteReason(day, typical);
		if (typical && reason) incomplete.push({ day: day.day, kcal: day.kcal, typicalKcal: typical.kcal, reason });
		else counted.set(day.day, day.kcal);
	}
	return { counted, incomplete };
}

function typicalOf(day: CountedDay, reference: CountedDay[]) {
	const within = (span: number) =>
		reference.filter(other => other.day !== day.day && Math.abs(daysBetween(other.day, day.day)) <= span);
	const near = within(SCREEN.nearDays);
	const others = near.length >= SCREEN.nearMinimum ? near : within(SCREEN.farDays);
	if (others.length < SCREEN.farMinimum) return null;
	return {
		kcal: median(others.map(o => o.kcal)),
		proteinG: median(others.map(o => o.proteinG)),
		entries: median(others.map(o => o.entries)),
	};
}

function incompleteReason(day: CountedDay, typical: { kcal: number; proteinG: number; entries: number }) {
	if (day.kcal < SCREEN.farBelow * typical.kcal) return 'farBelowTypical';
	if (day.kcal >= SCREEN.light * typical.kcal) return null;
	if (day.entries <= SCREEN.fewEntries * typical.entries) return 'fewEntries';
	if (day.proteinG < SCREEN.lowProtein * typical.proteinG) return 'lowProtein';
	return null;
}

const MODEL = {
	window: 21,
	loggedShare: 0.6,
	weighInsPerWindow: 6,
	maxPeriod: 91,
	/** Weight moves with water and glycogen for about two weeks after eating changes (a diet starts, a holiday ends). */
	settleDays: 14,
	activityDays: 28,
	/** Hall's rule of thumb (Lancet 2011): maintenance moves about 22 kcal a day per kg of body weight. */
	kcalPerKgWeight: 22,
	/** `Expenditure.Model.kcalPerStep`, the Step-Informed Updates constant. */
	kcalPerStep: 0.04,
	stepShare: 0.5,
	minStepChange: 1500,
	/** Resistance training is 3.5 METs (Compendium of Physical Activities, 02054): 2.5 above rest. */
	netWorkoutMets: 2.5,
	minWorkoutChange: 50,
	outlierMads: 3,
	outlierFloorKg: 1,
	/** Water swings last days, so neighboring residuals are not independent. */
	slopeErrorInflation: 2,
	/** How much unlogged days may differ from logged ones. */
	unloggedBias: 0.25,
	driftPerYear: 150,
	adjustmentError: 0.25,
	/** MacroFactor puts a BMR formula's median error at 335 kcal (macrofactor.com/algorithm-accuracy). */
	priorSd: 400,
};

export type Workout = { day: Day; minutes: number };
export type Adjustment = { kind: 'weight' | 'steps' | 'workouts'; before: number; now: number; kcal: number };
export type MaintenancePeriod = {
	start: Day;
	end: Day;
	days: number;
	loggedDays: number;
	weighIns: number;
	intakeKcal: number;
	weightChangeKg: number;
	meanWeightKg: number;
	measuredKcal: number;
	adjustments: Adjustment[];
	kcal: number;
	sdKcal: number;
	share: number;
};
export type Maintenance = {
	kcal: number;
	sdKcal: number;
	weightKg: number;
	periods: MaintenancePeriod[];
	prior: { kcal: number; source: 'initial' | 'bmr'; share: number } | null;
	incomplete: IncompleteDay[];
};

/**
 * `Maintenance.estimate`: today's maintenance from the stretches of the history dense enough to measure, each moved to
 * today's weight and activity, pooled with the prior by inverse variance, so a dense old period outweighs a thin recent
 * one and the prior carries a history with none. Data runs through yesterday.
 */
export function maintenance(input: {
	days: CountedDay[];
	weighIns: { day: Day; value: number }[];
	weightKg: number;
	steps: { day: Day; value: number }[];
	workouts: Workout[];
	prior: { kcal: number; source: 'initial' | 'bmr' } | null;
	from?: Day | null;
	today: Day;
}): Maintenance | null {
	const { weightKg, prior, today } = input;
	const end = addDays(today, -1);
	const { counted, incomplete } = screenIntake(input.days.filter(day => day.day <= end));
	const weighIns = dailyMeans(input.weighIns.filter(w => w.day <= end));
	const first = [...counted.keys(), ...weighIns.keys()].toSorted()[0];
	const start = input.from && first && input.from > first ? input.from : first;
	const periods = start ? measuredPeriods(counted, weighIns, start, end) : [];
	const now = activityNow(input.steps, input.workouts, end);
	const firstWorkout = input.workouts.map(w => w.day).toSorted()[0];
	const adjusted = periods.map(period =>
		adjust(period, { weightKg, today, now, steps: input.steps, workouts: input.workouts, firstWorkout }),
	);
	const sources = [
		...adjusted.map(p => ({ kcal: p.kcal, sd: p.sdKcal })),
		...(prior ? [{ kcal: prior.kcal, sd: MODEL.priorSd }] : []),
	];
	if (!sources.length) return null;
	const weights = sources.map(source => 1 / source.sd ** 2);
	const total = sum(weights);
	return {
		kcal: sum(sources.map((source, index) => source.kcal * weights[index]!)) / total,
		sdKcal: 1 / Math.sqrt(total),
		weightKg,
		periods: adjusted.map((period, index) => ({ ...period, share: weights[index]! / total })),
		prior: prior && { ...prior, share: weights.at(-1)! / total },
		incomplete,
	};
}

function dailyMeans(points: { day: Day; value: number }[]) {
	const byDay = Map.groupBy(points, point => point.day);
	return new Map([...byDay].map(([day, values]) => [day, mean(values.map(v => v.value))]));
}

type Measured = Omit<MaintenancePeriod, 'adjustments' | 'kcal' | 'share'> & { baseSd: number };

/**
 * Runs of days covered by a 21-day window with 60% of days counted and six weigh-ins, from their first to their last
 * counted day, less each run's settling days, split past 91 days.
 */
function measuredPeriods(counted: Map<Day, number>, weighIns: Map<Day, number>, start: Day, end: Day) {
	const days = eachDay(start, end);
	const covered = days.map(() => false);
	const loggedPrefix = [0];
	const weighInPrefix = [0];
	days.forEach((day, i) => {
		loggedPrefix.push(loggedPrefix[i]! + (counted.has(day) ? 1 : 0));
		weighInPrefix.push(weighInPrefix[i]! + (weighIns.has(day) ? 1 : 0));
	});
	for (let last = MODEL.window - 1; last < days.length; last++) {
		const first = last - MODEL.window + 1;
		const logged = loggedPrefix[last + 1]! - loggedPrefix[first]!;
		const weighed = weighInPrefix[last + 1]! - weighInPrefix[first]!;
		if (logged >= MODEL.loggedShare * MODEL.window && weighed >= MODEL.weighInsPerWindow) {
			for (let i = first; i <= last; i++) covered[i] = true;
		}
	}
	const runs: Day[][] = [];
	days.forEach((day, i) => {
		if (!covered[i]) return;
		if (i > 0 && covered[i - 1]) runs.at(-1)!.push(day);
		else runs.push([day]);
	});
	return runs.flatMap(covered => {
		const first = covered.findIndex(day => counted.has(day));
		const last = covered.findLastIndex(day => counted.has(day));
		const run = covered.slice(first + MODEL.settleDays, last + 1);
		if (run.length < MODEL.window) return [];
		const chunks = Math.ceil(run.length / MODEL.maxPeriod);
		const size = Math.ceil(run.length / chunks);
		return Array.from({ length: chunks }, (_, index) => run.slice(index * size, (index + 1) * size))
			.map(chunk => measure(chunk, counted, weighIns))
			.filter(period => period !== null);
	});
}

function measure(days: Day[], counted: Map<Day, number>, weighIns: Map<Day, number>): Measured | null {
	const intake = days.flatMap(day => (counted.has(day) ? [counted.get(day)!] : []));
	const points = days.flatMap((day, x) => (weighIns.has(day) ? [{ x, y: weighIns.get(day)! }] : []));
	const fit = robustLine(points);
	if (!intake.length || !fit) return null;
	const intakeKcal = mean(intake);
	const coverage = intake.length / days.length;
	const intakeSd = intake.length > 1 ? Math.sqrt(sum(intake.map(k => (k - intakeKcal) ** 2)) / (intake.length - 1)) : 0;
	const slopeSd = fit.slopeSe * KCAL_PER_KG * MODEL.slopeErrorInflation;
	return {
		start: days[0]!,
		end: days.at(-1)!,
		days: days.length,
		loggedDays: intake.length,
		weighIns: fit.used,
		intakeKcal,
		weightChangeKg: fit.slope * days.length,
		meanWeightKg: fit.intercept + (fit.slope * (days.length - 1)) / 2,
		measuredKcal: intakeKcal - fit.slope * KCAL_PER_KG,
		sdKcal: 0,
		baseSd: Math.hypot(slopeSd, intakeSd / Math.sqrt(intake.length), (1 - coverage) * MODEL.unloggedBias * intakeKcal),
	};
}

/** A least-squares line, refitted once without the weigh-ins more than three MADs (at least 1 kg) off it. */
function robustLine(points: { x: number; y: number }[]) {
	const first = line(points);
	if (!first) return null;
	const residuals = points.map(p => Math.abs(p.y - first.at(p.x)));
	const cutoff = Math.max(MODEL.outlierFloorKg, MODEL.outlierMads * 1.4826 * median(residuals));
	return line(points.filter((_, index) => residuals[index]! <= cutoff));
}

function line(points: { x: number; y: number }[]) {
	if (points.length < 3) return null;
	const mx = mean(points.map(p => p.x));
	const my = mean(points.map(p => p.y));
	const sxx = sum(points.map(p => (p.x - mx) ** 2));
	if (sxx === 0) return null;
	const slope = sum(points.map(p => (p.x - mx) * (p.y - my))) / sxx;
	const intercept = my - slope * mx;
	const at = (x: number) => intercept + slope * x;
	const residualSd = Math.sqrt(sum(points.map(p => (p.y - at(p.x)) ** 2)) / (points.length - 2));
	return { slope, intercept, at, slopeSe: residualSd / Math.sqrt(sxx), used: points.length };
}

type Activity = { steps: number | null; workoutMinutesPerDay: number | null };

function activityNow(steps: { day: Day; value: number }[], workouts: Workout[], end: Day): Activity {
	return activityOver(
		eachDay(addDays(end, -(MODEL.activityDays - 1)), end),
		steps,
		workouts,
		workouts.map(w => w.day).toSorted()[0],
	);
}

/** Mean steps over days with steps when half the days have them; workouts only once the history holds any. */
function activityOver(
	days: Day[],
	steps: { day: Day; value: number }[],
	workouts: Workout[],
	firstWorkout: Day | undefined,
): Activity {
	const inDays = new Set(days);
	const counts = steps.filter(s => inDays.has(s.day)).map(s => s.value);
	const done = workouts.filter(w => inDays.has(w.day));
	const known = firstWorkout !== undefined && days[0]! >= firstWorkout;
	return {
		steps: counts.length >= MODEL.stepShare * days.length ? mean(counts) : null,
		workoutMinutesPerDay: known ? sum(done.map(w => w.minutes)) / days.length : null,
	};
}

function adjust(
	period: Measured,
	context: {
		weightKg: number;
		today: Day;
		now: Activity;
		steps: { day: Day; value: number }[];
		workouts: Workout[];
		firstWorkout: Day | undefined;
	},
): Omit<MaintenancePeriod, 'share'> {
	const { weightKg, now } = context;
	const past = activityOver(eachDay(period.start, period.end), context.steps, context.workouts, context.firstWorkout);
	const adjustments: Adjustment[] = [
		{
			kind: 'weight',
			before: period.meanWeightKg,
			now: weightKg,
			kcal: (weightKg - period.meanWeightKg) * MODEL.kcalPerKgWeight,
		},
	];
	if (past.steps !== null && now.steps !== null && Math.abs(now.steps - past.steps) >= MODEL.minStepChange) {
		adjustments.push({
			kind: 'steps',
			before: past.steps,
			now: now.steps,
			kcal: MODEL.kcalPerStep * (now.steps - past.steps),
		});
	}
	if (past.workoutMinutesPerDay !== null && now.workoutMinutesPerDay !== null) {
		const kcal = ((now.workoutMinutesPerDay - past.workoutMinutesPerDay) / 60) * MODEL.netWorkoutMets * weightKg;
		if (Math.abs(kcal) >= MODEL.minWorkoutChange) {
			adjustments.push({
				kind: 'workouts',
				before: past.workoutMinutesPerDay * 7,
				now: now.workoutMinutesPerDay * 7,
				kcal,
			});
		}
	}
	const { baseSd, ...measured } = period;
	const years = daysBetween(period.end, context.today) / 365;
	const activity = sum(adjustments.filter(a => a.kind !== 'weight').map(a => Math.abs(a.kcal)));
	return {
		...measured,
		adjustments,
		kcal: period.measuredKcal + sum(adjustments.map(a => a.kcal)),
		sdKcal: Math.hypot(baseSd, MODEL.driftPerYear * years, MODEL.adjustmentError * activity),
	};
}
