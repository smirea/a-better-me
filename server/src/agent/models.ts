import { z } from 'zod';
import { BODY_WEIGHT_SOURCES, WEIGHT_UNITS } from '../../../shared/db/schema';

/**
 * The agent API's request and response shapes. The JSON trees mirror the Swift `Codable` models in
 * `app-ios/Sources/App/Workouts/Model/`, whose synthesized decoders require every non-optional key, so a create schema
 * fills each one with the app's default: a tree the phone cannot decode would hide the whole row.
 */

/** Lowercase, like the app's row ids. Swift parses a tree's UUIDs in either case, though it writes them uppercase. */
export const newId = () => crypto.randomUUID();

const id = z.guid().meta({ description: 'UUID. Generated when omitted.' });
export const instant = z.iso
	.datetime({ offset: true })
	.overwrite(text => new Date(text).toISOString())
	.meta({ description: 'ISO 8601 instant, stored in UTC with milliseconds.' });
const count = z.int().min(0);
const kg = z.number().min(0);

export const SET_TYPES = ['standard', 'warmUp', 'drop', 'myo', 'failure'] as const;
export const MUSCLES = [
	'chest',
	'front_delts',
	'side_delts',
	'rear_delts',
	'lats',
	'upper_back',
	'upper_traps',
	'lower_back',
	'neck',
	'biceps',
	'triceps',
	'forearms',
	'abs',
	'obliques',
	'serratus',
	'glutes',
	'quads',
	'hamstrings',
	'adductors',
	'abductors',
	'hip_flexors',
	'calves',
	'tibs',
] as const;
export const METRICS = [
	'weight',
	'assistanceWeight',
	'weightPerSide',
	'weightPerSidePersistent',
	'reps',
	'repsPerSide',
	'duration',
	'durationPerSide',
	'distanceShort',
	'distanceShortPerSide',
	'distanceLong',
] as const;
export const EXERCISE_TYPES = ['compound', 'isolation', 'core', 'other'] as const;
export const EXERCISE_CATEGORIES = ['freeWeights', 'machines', 'bodyweight', 'cardio', 'other'] as const;
export const REGIONS = ['upper', 'lower', 'core', 'fullBody'] as const;
export const LATERALITIES = ['bilateral', 'unilateral', 'asymmetrical'] as const;
export const PROGRAM_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple'] as const;
export const REST_CATEGORIES = ['compoundUpper', 'compoundLower', 'upperIsolation', 'lowerIsolation', 'core'] as const;

export const SetTarget = z
	.object({
		repsMin: count.optional(),
		repsMax: count.optional(),
		rir: z.int().min(0).max(6).optional().meta({ description: 'Reps in reserve. 6 means "6+".' }),
		weightKg: kg.optional(),
		durationSeconds: count.optional(),
	})
	.meta({ id: 'SetTarget', description: 'What a set aims for. Every field is optional.' });

export const SetLog = z
	.object({
		weightKg: kg.optional(),
		reps: count.optional(),
		partialReps: count.optional(),
		rir: z.int().min(0).max(6).optional(),
		durationSeconds: count.optional(),
		distanceMeters: z.number().min(0).optional(),
		completedAt: instant.optional().meta({ description: "Defaults to the session's end, or its start." }),
	})
	.meta({
		id: 'SetLog',
		description: 'What was actually done. A set with a log is completed. Never set in templates.',
	});

const SubSet = z
	.object({ id: id.default(newId), target: SetTarget.optional(), log: SetLog.optional() })
	.meta({ id: 'SubSet', description: 'One drop of a drop set, or one mini-set of a myo set.' });

export const WorkoutSet = z
	.object({
		id: id.default(newId),
		type: z.enum(SET_TYPES).default('standard'),
		target: SetTarget.optional(),
		restSeconds: count.optional().meta({ description: "Overrides the exercise's rest after this set." }),
		log: SetLog.optional(),
		subSets: z.array(SubSet).default([]).meta({ description: 'Only for `drop` and `myo` sets.' }),
	})
	.meta({ id: 'WorkoutSet' });

const CycleTargets = z
	.object({ sets: z.array(WorkoutSet), skip: z.boolean().default(false) })
	.meta({ id: 'CycleTargets', description: 'The sets for one program cycle. `skip` drops the exercise that cycle.' });

export const BlockExercise = z
	.object({
		id: id.default(newId),
		exerciseID: z.string().meta({ description: 'A catalog exercise id or a `custom-` id, from GET /exercises.' }),
		sets: z.array(WorkoutSet),
		restSeconds: count
			.optional()
			.meta({ description: "Rest after each set. Falls back to the exercise's settings, then the settings default." }),
		note: z.string().optional(),
		cycleTargets: z.array(CycleTargets).optional().meta({
			description:
				'Program templates only: the sets of each training week, index 0 for week 1. A week past the end uses `sets`. The deload cycle is never stored; it is derived from the week beside it. Sessions started from the template copy the targets of their cycle.',
		}),
		equipment: z.array(z.string()).optional().meta({ description: 'Equipment ids of the chosen resistance option.' }),
		support: z.array(z.string()).optional().meta({ description: 'Equipment ids of the chosen support option.' }),
	})
	.meta({ id: 'BlockExercise' });

export const WorkoutBlock = z
	.object({ id: id.default(newId), exercises: z.array(BlockExercise).min(1) })
	.meta({ id: 'WorkoutBlock', description: 'One exercise, or a superset when it holds several.' });

export const Blocks = z.array(WorkoutBlock);
export type Blocks = z.output<typeof Blocks>;

export const Template = z
	.object({
		id: z.string(),
		name: z.string(),
		notes: z.string(),
		blocks: Blocks,
		createdAt: z.string(),
		updatedAt: z.string(),
		programId: z.string().nullable().meta({ description: 'Set when the template is a day of a program.' }),
		gymId: z.string().nullable(),
		archived: z.boolean(),
	})
	.meta({ id: 'Template', description: 'A reusable workout in the library, or a day of a program.' });

const templateFields = {
	name: z.string().trim().min(1),
	notes: z.string(),
	blocks: Blocks,
	gymId: z.guid().nullable(),
	archived: z.boolean(),
};
export const TemplateCreate = z
	.object({
		...templateFields,
		notes: templateFields.notes.default(''),
		blocks: Blocks.default([]),
		gymId: templateFields.gymId.default(null),
		archived: templateFields.archived.default(false),
	})
	.meta({ id: 'TemplateCreate' });
export const TemplatePatch = z.object(templateFields).partial().meta({ id: 'TemplatePatch' });

export const ProgramPosition = z
	.object({ programId: z.guid(), dayId: z.guid(), cycle: z.int().min(1) })
	.meta({ id: 'ProgramPosition', description: 'The program day and cycle a session trains.' });

export const Session = z
	.object({
		id: z.string(),
		name: z.string(),
		templateId: z.string().nullable(),
		startedAt: z.string(),
		endedAt: z.string().nullable().meta({ description: 'Null while the workout is in progress.' }),
		notes: z.string(),
		blocks: Blocks,
		programId: z.string().nullable(),
		programDayId: z.string().nullable(),
		cycle: z.int().nullable(),
		gymId: z.string().nullable(),
		pausedSeconds: z.int(),
		health: z
			.record(z.string(), z.unknown())
			.nullable()
			.meta({ description: 'What the phone saved to Apple Health for this workout. Read-only.' }),
	})
	.meta({ id: 'Session', description: 'A logged workout. Its sets carry `log` once done.' });

const sessionFields = {
	name: z.string().trim().min(1),
	templateId: z.guid().nullable(),
	startedAt: instant,
	endedAt: instant.nullable(),
	notes: z.string(),
	blocks: Blocks,
	program: ProgramPosition.nullable(),
	gymId: z.guid().nullable(),
	pausedSeconds: count,
};
export const SessionCreate = z
	.object({
		...sessionFields,
		name: sessionFields.name.optional().meta({ description: "Defaults to the template's name." }),
		templateId: sessionFields.templateId.default(null),
		endedAt: sessionFields.endedAt.default(null).meta({
			description:
				'Null starts a live workout on the phone; at most one can be in progress. Give it to log a finished one.',
		}),
		notes: sessionFields.notes.default(''),
		blocks: Blocks.optional().meta({
			description: "Defaults to the template's blocks, with the program cycle's targets applied when `program` is set.",
		}),
		program: sessionFields.program.default(null),
		gymId: sessionFields.gymId.optional(),
		pausedSeconds: sessionFields.pausedSeconds.default(0),
	})
	.meta({ id: 'SessionCreate' });
export const SessionPatch = z.object(sessionFields).partial().meta({ id: 'SessionPatch' });

export const ProgramDay = z
	.object({
		id: z.string(),
		templateID: z.string().optional().meta({ description: "The day's template. Absent on a rest day." }),
		restDoneInCycle: z.int().optional(),
	})
	.meta({ id: 'ProgramDay' });

export const ProgramConfig = z
	.looseObject({
		dayOrder: z
			.enum(['rolling', 'weekly'])
			.meta({ description: '`rolling` numbers days Day 1 to N. `weekly` is seven days from Monday.' }),
		deload: z.enum(['none', 'firstCycle', 'lastCycle']).meta({ description: 'A deload adds one cycle.' }),
		periodization: z.boolean().meta({ description: 'Whether exercises carry per-cycle `cycleTargets`.' }),
		runStartedAt: z.string().optional(),
		generator: z.record(z.string(), z.unknown()).optional(),
	})
	.meta({ id: 'ProgramConfig' });

export const Program = z
	.object({
		id: z.string(),
		name: z.string(),
		color: z.enum(PROGRAM_COLORS),
		icon: z.string().meta({ description: 'An SF Symbol name.' }),
		cycles: z.int(),
		currentCycle: z.int(),
		active: z.boolean(),
		archived: z.boolean(),
		config: ProgramConfig,
		days: z.array(ProgramDay),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.meta({ id: 'Program', description: 'A cycle of days, each a template or a rest day, repeated `cycles` times.' });

export const ProgramDetail = Program.extend({
	templates: z.array(Template).meta({ description: "The days' templates." }),
	upNext: z
		.object({
			dayId: z.string(),
			templateId: z.string().nullable().meta({ description: 'Null for a rest day.' }),
			cycle: z.int(),
		})
		.nullable()
		.meta({
			description:
				'The first day of the current cycle not done yet: a workout day without a finished session in this run, or an unticked rest day.',
		}),
}).meta({ id: 'ProgramDetail' });

const DayInput = z
	.object({
		id: z.guid().optional().meta({ description: 'Keep an existing day by its id. Generated when omitted.' }),
		templateId: z.guid().optional().meta({ description: 'An existing template to train that day.' }),
		template: TemplateCreate.optional().meta({ description: "A new template, created as this program's day." }),
	})
	.refine(day => !(day.templateId && day.template), 'Give templateId or template, not both')
	.meta({ id: 'ProgramDayInput', description: 'A workout day (`templateId` or `template`), or a rest day (neither).' });

const ConfigInput = z
	.object({
		dayOrder: z.enum(['rolling', 'weekly']),
		deload: z.enum(['none', 'firstCycle', 'lastCycle']),
		periodization: z.boolean(),
	})
	.partial()
	.meta({ id: 'ProgramConfigInput' });

const programFields = {
	name: z.string().trim().min(1),
	color: z.enum(PROGRAM_COLORS),
	icon: z.string().min(1),
	cycles: z.int().min(1),
	config: ConfigInput,
	days: z.array(DayInput).min(1),
};
export const ProgramCreate = z
	.object({
		...programFields,
		color: programFields.color.default('blue'),
		icon: programFields.icon.default('dumbbell.fill'),
		config: ConfigInput.default({}),
		activate: z.boolean().default(false).meta({ description: 'Make it the one active program.' }),
	})
	.meta({ id: 'ProgramCreate' });
export const ProgramPatch = z
	.object({
		...programFields,
		currentCycle: z.int().min(1),
		archived: z.boolean().meta({ description: 'Archiving also deactivates.' }),
		days: programFields.days.meta({
			description:
				'Replaces the days. Days not listed are dropped; their templates stay, use DELETE /templates to remove them.',
		}),
	})
	.partial()
	.meta({ id: 'ProgramPatch' });

const WeightOption = z.object({
	kg,
	count: count.optional().meta({ description: 'Omit for unlimited.' }),
	unit: z.enum(WEIGHT_UNITS).optional(),
});
export const EquipmentLoad = z
	.union([
		z.strictObject({ weights: z.strictObject({ options: z.array(WeightOption) }) }),
		z.strictObject({
			ranges: z.strictObject({
				options: z.array(z.object({ minKg: kg, maxKg: kg, incrementKg: z.number().positive() })),
				micro: z.object({ kind: z.enum(['dial', 'pin', 'plates']), weightsKg: z.array(kg) }).optional(),
			}),
		}),
		z.strictObject({ base: z.strictObject({ kg }) }),
		z.strictObject({
			bands: z.strictObject({ options: z.array(z.object({ color: z.string(), count: count.optional() })) }),
		}),
	])
	.meta({
		id: 'EquipmentLoad',
		description:
			"Exactly one key: `weights` (dumbbells, plates, bars), `ranges` (pin-stack machines), `base` (a loadable machine's own weight), or `bands`.",
	});
const GymEquipment = z
	.object({ load: EquipmentLoad.optional().meta({ description: "Omit to use the catalog's weights." }) })
	.meta({ id: 'GymEquipment' });
const EquipmentMap = z
	.record(z.string(), GymEquipment)
	.meta({ description: 'Keyed by equipment id from GET /equipment. A key present means the gym has it.' });

export const Gym = z
	.object({
		id: z.string(),
		name: z.string(),
		icon: z.string(),
		isDefault: z.boolean(),
		equipment: EquipmentMap,
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.meta({ id: 'Gym', description: 'A place to train and the equipment it has.' });

const gymFields = { name: z.string().trim().min(1), icon: z.string().min(1), equipment: EquipmentMap };
export const GymCreate = z
	.object({
		...gymFields,
		icon: gymFields.icon.default('building.2'),
		equipment: EquipmentMap.default({}),
		isDefault: z.boolean().default(false),
	})
	.meta({ id: 'GymCreate' });
export const GymPatch = z.object(gymFields).partial().meta({ id: 'GymPatch' });

export const Equipment = z
	.looseObject({ id: z.string(), name: z.string(), category: z.string(), weightOptionsKg: z.array(z.number()) })
	.meta({ id: 'Equipment' });

const exerciseShape = {
	id: z.string(),
	name: z.string(),
	alternativeNames: z.array(z.string()),
	type: z.enum(EXERCISE_TYPES),
	category: z.enum(EXERCISE_CATEGORIES),
	region: z.enum(REGIONS).nullable().optional(),
	laterality: z.enum(LATERALITIES),
	primaryMuscles: z.array(z.enum(MUSCLES)),
	secondaryMuscles: z.array(z.enum(MUSCLES)),
	movementPatterns: z.array(z.string()),
	metrics: z.array(z.enum(METRICS)).meta({ description: 'What each set records, in display order.' }),
	resistanceEquipment: z.array(z.string()).meta({ description: 'Alternative ways to load it.' }),
	resistanceEquipmentIDs: z.array(z.array(z.string())),
	supportEquipment: z.array(z.string()),
	supportEquipmentIDs: z.array(z.array(z.string())),
};
/** The stored `Exercise`, a catalog entry or a custom row's `exercise` column, with every key the app writes. */
export const StoredExercise = z.looseObject(exerciseShape);
export const Exercise = z
	.looseObject({ ...exerciseShape, custom: z.boolean(), archived: z.boolean() })
	.meta({ id: 'Exercise', description: "A catalog exercise, or one of the owner's `custom-` exercises." });

export const ExerciseSettings = z
	.object({
		pinnedNote: z.string().meta({ description: 'Shown on the exercise in every workout.' }),
		restSeconds: count.nullable().meta({ description: 'Rest override. Null uses the settings default.' }),
		doNotRecommend: z.boolean(),
	})
	.meta({ id: 'ExerciseSettings' });

export const ExerciseDetail = Exercise.extend({ settings: ExerciseSettings }).meta({ id: 'ExerciseDetail' });

const exerciseFields = {
	name: z.string().trim().min(1),
	type: z.enum(EXERCISE_TYPES),
	category: z.enum(EXERCISE_CATEGORIES),
	region: z.enum(REGIONS),
	laterality: z.enum(LATERALITIES),
	primaryMuscles: z.array(z.enum(MUSCLES)).min(1),
	secondaryMuscles: z.array(z.enum(MUSCLES)),
	metrics: z.array(z.enum(METRICS)).min(1).max(2),
	alternativeNames: z.array(z.string()),
	resistanceEquipmentIDs: z
		.array(z.array(z.string()).min(1))
		.meta({ description: 'Alternative loading options, each a list of equipment ids used together.' }),
	supportEquipmentIDs: z.array(z.array(z.string()).min(1)),
	bodyweightFraction: z.number().min(0).max(1).meta({ description: 'Share of body weight moved.' }),
	about: z.string().meta({ description: 'Description, as Markdown.' }),
};
export const ExerciseCreate = z
	.object({
		...exerciseFields,
		category: exerciseFields.category.default('other'),
		region: exerciseFields.region.optional(),
		laterality: exerciseFields.laterality.default('bilateral'),
		secondaryMuscles: exerciseFields.secondaryMuscles.default([]),
		alternativeNames: exerciseFields.alternativeNames.default([]),
		resistanceEquipmentIDs: exerciseFields.resistanceEquipmentIDs.default([]),
		supportEquipmentIDs: exerciseFields.supportEquipmentIDs.default([]),
		bodyweightFraction: exerciseFields.bodyweightFraction.default(0),
		about: exerciseFields.about.optional(),
	})
	.meta({ id: 'ExerciseCreate' });
export const ExercisePatch = z
	.object({ ...exerciseFields, archived: z.boolean().meta({ description: 'Hides it from the picker.' }) })
	.partial()
	.meta({ id: 'ExercisePatch' });
export const ExerciseSettingsPatch = ExerciseSettings.partial().meta({ id: 'ExerciseSettingsPatch' });

export const ExerciseHistory = z
	.array(
		z.object({
			sessionId: z.string(),
			sessionName: z.string(),
			startedAt: z.string(),
			note: z.string().nullable(),
			sets: z.array(WorkoutSet),
		}),
	)
	.meta({ id: 'ExerciseHistory', description: 'Newest first: every finished session that trained the exercise.' });

const Rest = z.object(
	Object.fromEntries(REST_CATEGORIES.map(key => [key, count])) as Record<
		(typeof REST_CATEGORIES)[number],
		typeof count
	>,
);
export const Settings = z
	.object({
		weightUnit: z.enum(WEIGHT_UNITS).meta({ description: 'The display unit. The API always speaks kilograms.' }),
		rest: Rest.meta({ description: 'Default rest seconds per exercise category.' }),
		workout: z.record(z.string(), z.unknown()),
		profile: z.record(z.string(), z.unknown()),
		dashboard: z.record(z.string(), z.unknown()),
		shortcuts: z.record(z.string(), z.unknown()),
	})
	.meta({ id: 'Settings' });
export const SettingsPatch = z
	.object({
		weightUnit: z.enum(WEIGHT_UNITS),
		rest: Rest.partial(),
		profile: z
			.object({
				sex: z.enum(['male', 'female']),
				liftingExperience: z.enum(['beginner', 'intermediate', 'advanced']),
				bodyWeightKg: z.number().positive(),
			})
			.partial(),
	})
	.partial()
	.meta({ id: 'SettingsPatch' });

export const BodyWeight = z
	.object({ id: z.string(), measuredAt: z.string(), weightKg: z.number(), source: z.enum(BODY_WEIGHT_SOURCES) })
	.meta({ id: 'BodyWeight' });
export const BodyWeightCreate = z
	.object({
		weightKg: z.number().positive(),
		measuredAt: instant.default(() => new Date().toISOString()).meta({ description: 'Defaults to now.' }),
	})
	.meta({ id: 'BodyWeightCreate' });

export const Deleted = z.object({ deleted: z.string() }).meta({ id: 'Deleted' });
