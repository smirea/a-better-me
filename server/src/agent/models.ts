import { z } from 'zod';
import {
	BODY_METRIC_KINDS,
	BODY_WEIGHT_SOURCES,
	CALORIE_FLOORS,
	DAY_STATUSES,
	DIET_STYLES,
	FOOD_ROW_SOURCES,
	GOAL_KINDS,
	NOTE_COLORS,
	NUTRIENT_GOAL_MODES,
	PLAN_KINDS,
	PROGRAM_STYLES,
	PROTEIN_LEVELS,
	TRAINING_TYPES,
	WEIGHT_UNITS,
	foodNutrition,
	foodSnapshot,
	nutrientAmounts,
	nutrientID,
	serving,
} from '../../../shared/db/schema';

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

export const day = z.iso
	.date()
	.meta({ description: 'A calendar day, `YYYY-MM-DD`. It never moves through a time zone.' });
const minute = z.int().min(0).max(1439).meta({ description: 'Minutes since midnight, 0 through 1439.' });
const nonnegative = z.number().min(0);

export const NutrientAmounts = nutrientAmounts.meta({
	id: 'NutrientAmounts',
	description:
		'Sparse amounts keyed by nutrient id: `k` (kcal), `p`, `f`, `c`, and `nc` (net carbs) in grams, and USDA nutrient numbers such as `291` (fiber) in the registry unit. A missing id means not reported.',
});
export const Serving = serving.meta({
	id: 'Serving',
	description:
		'How much: `quantity` of `measure`. `measure.quantity` of the measure is `measure.servings` base servings, so the amounts are the nutrients times `measure.servings * quantity / measure.quantity`.',
});
export const FoodNutrition = foodNutrition.meta({
	id: 'FoodNutrition',
	description:
		'Nutrients per base serving, the grams or milliliters in one when known (which unlocks g, oz, lb, mL, fl oz, and cup), and the named measures, the first the default.',
});
export const FoodSnapshot = foodSnapshot.meta({
	id: 'FoodSnapshot',
	description: 'A food as logged. Editing or deleting the food later never changes it. `foodID` is provenance only.',
});

export const Food = z
	.object({
		id: z.string(),
		source: z.enum(FOOD_ROW_SOURCES),
		name: z.string(),
		brand: z.string().nullable(),
		barcode: z.string().nullable(),
		icon: z.string().nullable(),
		nutrition: FoodNutrition,
		archived: z.boolean(),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.meta({
		id: 'Food',
		description:
			'A food the owner made (`custom`, a UUID id) or a cached `usda` (`usda-<fdcId>`) or `open_food_facts` (`off-<barcode>`) food.',
	});
const foodFields = {
	name: z.string().trim().min(1),
	brand: z.string().nullable(),
	barcode: z.string().nullable(),
	icon: z.string().nullable().meta({ description: 'A food icon name; null for the default.' }),
	nutrition: FoodNutrition,
	archived: z.boolean(),
};
export const FoodCreate = z
	.object({
		id: z.string().optional().meta({
			description: 'A custom food: a UUID, generated when omitted. A cached food: `usda-<fdcId>` or `off-<barcode>`.',
		}),
		source: z.enum(FOOD_ROW_SOURCES).default('custom'),
		...foodFields,
		brand: foodFields.brand.default(null),
		barcode: foodFields.barcode.default(null),
		icon: foodFields.icon.default(null),
		archived: foodFields.archived.default(false),
	})
	.meta({ id: 'FoodCreate' });
export const FoodPatch = z.object(foodFields).partial().meta({ id: 'FoodPatch' });

const portionFields = {
	food: FoodSnapshot.optional().meta({ description: 'The food as eaten. Or give `foodId` or `recipeId` instead.' }),
	foodId: z.string().optional().meta({ description: 'Snapshot a stored food.' }),
	recipeId: z
		.guid()
		.optional()
		.meta({ description: 'Snapshot a stored recipe, one serving of its yield per base serving.' }),
	serving: Serving.optional().meta({ description: "Defaults to the quantity of the food's first measure." }),
};
const onePortion = [
	(value: { food?: unknown; foodId?: unknown; recipeId?: unknown }) =>
		[value.food, value.foodId, value.recipeId].filter(part => part !== undefined).length === 1,
	'Give exactly one of food, foodId, and recipeId',
] as const;

export const RecipeIngredient = z
	.object({ id: z.string(), food: FoodSnapshot, serving: Serving })
	.meta({ id: 'RecipeIngredient' });
export const Recipe = z
	.object({
		id: z.string(),
		name: z.string(),
		icon: z.string().nullable(),
		ingredients: z.array(RecipeIngredient),
		servings: z.number().meta({ description: 'How many servings the whole recipe makes.' }),
		cookedGrams: z.number().nullable().meta({ description: 'What everything it makes weighs once cooked.' }),
		steps: z.array(z.string()),
		prepMinutes: z.int().nullable(),
		cookMinutes: z.int().nullable(),
		link: z.string().nullable(),
		notes: z.string(),
		archived: z.boolean(),
		createdAt: z.string(),
		updatedAt: z.string(),
		nutrition: FoodNutrition.meta({
			description: 'Derived from the ingredients, per serving of the yield. Never stored, so it cannot drift.',
		}),
	})
	.meta({ id: 'Recipe' });
const IngredientInput = z
	.object({ id: id.default(newId), ...portionFields })
	.refine(...onePortion)
	.meta({ id: 'RecipeIngredientInput' });
const recipeFields = {
	name: z.string().trim().min(1),
	icon: z.string().nullable(),
	ingredients: z.array(IngredientInput),
	servings: z.number().positive(),
	cookedGrams: z.number().positive().nullable(),
	steps: z.array(z.string()),
	prepMinutes: count.nullable(),
	cookMinutes: count.nullable(),
	link: z.string().nullable(),
	notes: z.string(),
	archived: z.boolean(),
};
export const RecipeCreate = z
	.object({
		id: id.optional(),
		...recipeFields,
		icon: recipeFields.icon.default(null),
		ingredients: recipeFields.ingredients.default([]),
		servings: recipeFields.servings.default(1),
		cookedGrams: recipeFields.cookedGrams.default(null),
		steps: recipeFields.steps.default([]),
		prepMinutes: recipeFields.prepMinutes.default(null),
		cookMinutes: recipeFields.cookMinutes.default(null),
		link: recipeFields.link.default(null),
		notes: recipeFields.notes.default(''),
		archived: recipeFields.archived.default(false),
	})
	.meta({ id: 'RecipeCreate' });
export const RecipePatch = z
	.object(recipeFields)
	.partial()
	.meta({ id: 'RecipePatch', description: '`ingredients` and `steps` replace the whole list.' });

export const FoodEntry = z
	.object({
		id: z.string(),
		day,
		minute,
		food: FoodSnapshot,
		serving: Serving,
		amounts: NutrientAmounts.meta({ description: "What was eaten: the snapshot's nutrients scaled by the serving." }),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.meta({ id: 'FoodEntry', description: 'One logged food at a minute of a day. The log has no meals.' });
export const FoodEntryCreate = z
	.object({ id: id.optional(), day, minute: minute.default(720), ...portionFields })
	.refine(...onePortion)
	.meta({ id: 'FoodEntryCreate' });
export const FoodEntryPatch = z
	.object({ day, minute, food: FoodSnapshot, serving: Serving })
	.partial()
	.meta({ id: 'FoodEntryPatch' });

export const FoodFavorite = z
	.object({ id: z.string(), food: FoodSnapshot, serving: Serving, createdAt: z.string() })
	.meta({ id: 'FoodFavorite', description: 'A food saved at a chosen serving. Several may come from one food.' });
export const FoodFavoriteCreate = z
	.object({ id: id.optional(), ...portionFields })
	.refine(...onePortion)
	.meta({ id: 'FoodFavoriteCreate' });

export const FoodLogNote = z
	.object({
		id: z.string(),
		day,
		minute,
		title: z.string(),
		body: z.string(),
		color: z.enum(NOTE_COLORS),
	})
	.meta({ id: 'FoodLogNote', description: 'A titled note on a day of the food log. At most five a day.' });
const noteFields = { day, minute, title: z.string().trim().min(1), body: z.string(), color: z.enum(NOTE_COLORS) };
export const FoodLogNoteCreate = z
	.object({
		id: id.optional(),
		...noteFields,
		minute: minute.default(720),
		body: noteFields.body.default(''),
		color: noteFields.color.default('blue'),
	})
	.meta({ id: 'FoodLogNoteCreate' });
export const FoodLogNotePatch = z.object(noteFields).partial().meta({ id: 'FoodLogNotePatch' });

export const NutritionDay = z
	.object({
		id: day,
		status: z.enum(DAY_STATUSES).meta({
			description: '`partial`: incomplete, skipped by the expenditure algorithm. `fasted`: counts as zero when empty.',
		}),
		override: NutrientAmounts.nullable().meta({ description: "Replaces the log's totals for the day." }),
	})
	.meta({ id: 'NutritionDay', description: 'What the owner said about a day. The id is the day.' });
export const NutritionDayPut = z
	.object({ status: z.enum(DAY_STATUSES).default('none'), override: NutrientAmounts.nullable().default(null) })
	.meta({ id: 'NutritionDayPut' });

export const FoodLogDay = z
	.object({
		day,
		status: z.enum(DAY_STATUSES),
		override: NutrientAmounts.nullable(),
		totals: NutrientAmounts.meta({ description: "The entries' amounts summed. `override` replaces them when set." }),
		entries: z.array(FoodEntry),
		notes: z.array(FoodLogNote),
	})
	.meta({ id: 'FoodLogDay' });

export const BodyMetric = z
	.object({ id: z.string(), day, kind: z.enum(BODY_METRIC_KINDS), value: z.number(), updatedAt: z.string() })
	.meta({
		id: 'BodyMetric',
		description:
			'One value per day and kind, id `<day>/<kind>`: a percent for `visual_body_fat`, a count for `steps`, centimeters for the rest.',
	});
export const BodyMetricPut = z.object({ value: nonnegative }).meta({ id: 'BodyMetricPut' });

const DayTarget = z
	.object({ energy: nonnegative, protein: nonnegative, fat: nonnegative, carbs: nonnegative })
	.meta({ id: 'DayTarget', description: 'kcal and grams.' });
export const NutritionGoal = z
	.object({
		kind: z.enum(GOAL_KINDS),
		targetWeightKg: z.number().positive().optional(),
		ratePercentPerWeek: z.number().meta({ description: 'Percent of body weight per week, negative while losing.' }),
		startedOn: day,
	})
	.meta({ id: 'NutritionGoal' });
export const CoachingProgram = z
	.object({
		style: z.enum(PROGRAM_STYLES).default('coached'),
		diet: z.enum(DIET_STYLES).default('balanced'),
		protein: z.enum(PROTEIN_LEVELS).default('moderate'),
		floor: z.enum(CALORIE_FLOORS).default('standard'),
		training: z.enum(TRAINING_TYPES).default('lifting'),
		highDays: z
			.array(z.int().min(1).max(7))
			.default([])
			.meta({ description: 'ISO weekdays, Monday 1, that get more calories. Empty spreads them evenly.' }),
	})
	.meta({ id: 'CoachingProgram' });
export const NutritionPlan = z
	.object({
		id: day,
		kind: z.enum(PLAN_KINDS),
		goal: NutritionGoal,
		coaching: CoachingProgram,
		targets: z.array(DayTarget).length(7).meta({ description: 'Seven, Monday first.' }),
		expenditureKcal: z.number().nullable().meta({ description: 'What a check-in computed and used.' }),
		trendWeightKg: z.number().nullable(),
		createdAt: z.string(),
	})
	.meta({
		id: 'NutritionPlan',
		description:
			'The strategy from its day (the id) until the next plan. The plan for a day is the latest on or before it.',
	});
export const NutritionPlanPut = z
	.object({
		kind: z.enum(PLAN_KINDS).default('edit'),
		goal: NutritionGoal,
		coaching: CoachingProgram.default(CoachingProgram.parse({})),
		targets: z.array(DayTarget).length(7),
		expenditureKcal: z.number().positive().nullable().default(null),
		trendWeightKg: z.number().positive().nullable().default(null),
	})
	.meta({ id: 'NutritionPlanPut' });

export const NutrientGoal = z
	.object({
		id: z.string(),
		nutrient: z.string(),
		startsOn: day,
		mode: z.enum(NUTRIENT_GOAL_MODES),
		floor: z.number().nullable(),
		target: z.number().nullable(),
		ceiling: z.number().nullable(),
	})
	.meta({
		id: 'NutrientGoal',
		description:
			"A nutrient's bounds from a day on, id `<day>/<nutrient>`. `auto` uses the app's defaults, `none` shows no bounds, and a null bound under `custom` is hidden.",
	});
export const NutrientGoalPut = z
	.object({
		mode: z.enum(NUTRIENT_GOAL_MODES),
		floor: nonnegative.nullable().default(null),
		target: nonnegative.nullable().default(null),
		ceiling: nonnegative.nullable().default(null),
	})
	.meta({ id: 'NutrientGoalPut', description: 'The bounds apply only under `custom`.' });

const hour = z.int().min(0).max(23);
/** Mirrors `NutritionSettings` in the iOS app; a key the app does not know is ignored there. */
const NutritionSettingsPatch = z
	.object({
		energyUnit: z.enum(['kcal', 'kj']).meta({ description: 'Display only. The API always speaks kcal.' }),
		heightUnit: z
			.enum(['feetAndInches', 'centimeters'])
			.meta({ description: 'Display only. The API always speaks centimeters.' }),
		checkInWeekday: z.int().min(1).max(7),
		fastCheckIn: z.boolean(),
		coachingModules: z
			.object({ partialLogging: z.boolean(), weighIn: z.boolean(), fasting: z.boolean(), loggingBreak: z.boolean() })
			.partial(),
		standardFloorKcal: z.int().min(0).meta({ description: "The coached program's standard calorie floor." }),
		showOverages: z.boolean(),
		pinnedNutrients: z.array(nutrientID),
		hideAdditionalNutrients: z.boolean(),
		searchBranded: z.boolean().meta({ description: 'Include Open Food Facts branded foods in search.' }),
		favoriteMeasures: z.array(z.string()),
		timeline: z
			.object({
				firstHour: hour,
				lastHour: hour,
				hideEmptyHours: z.boolean(),
				hideFoodDetails: z.boolean(),
				hourlyTotals: z.boolean(),
				foodTimestamps: z.boolean(),
				alignment: z.enum(['left', 'right']),
				addFoodsToHour: z.enum(['plusIcon', 'longPress']),
				calendarWeekBanner: z.enum(['show', 'showAndPin', 'hide']),
				calendarScrolling: z.enum(['daily', 'weekly']),
				premove: z.boolean(),
			})
			.partial(),
		logger: z
			.object({
				bannerNutrients: z.array(nutrientID),
				nutritionDisplay: z.enum(['plateOnly', 'dayAndPlate', 'remainingAfterPlate']),
				timeSelection: z.enum(['datePicker', 'timePad']),
				optimization: z.enum(['speed', 'context']),
			})
			.partial(),
		shortcuts: z.array(
			z.enum(['yourFoods', 'search', 'barcode', 'quickAdd', 'recipes', 'favorites', 'editDay', 'weight']),
		),
		expenditure: z
			.object({
				staticKcal: z.number().positive().nullable(),
				initialKcal: z.number().positive().nullable(),
				calculationStart: day.nullable(),
				bmrEquation: z.enum(['macroFactor', 'cunningham']),
				activity: z.enum(['mostlySedentary', 'moderatelyActive', 'veryActive']).nullable(),
				exercise: z.enum(['zero', 'oneToThree', 'fourToSix', 'sevenPlus']).nullable(),
				athleticPursuits: z.enum(['exerciseRegularly', 'athlete', 'professionalAthlete', 'noneOfTheAbove']).nullable(),
				priorWeight: z.enum(['yes', 'no', 'notSure']).nullable(),
				priorProgress: z.enum(['gaining', 'losing', 'stable', 'notSure']).nullable(),
				algorithm: z.enum(['v1', 'v2', 'v3']),
				stepInformedUpdates: z.boolean(),
				predictiveGoalAdjustment: z.boolean(),
			})
			.partial(),
		hiddenNutrients: z.array(nutrientID),
		visibleBodyMetrics: z.array(z.enum(BODY_METRIC_KINDS)),
	})
	.partial()
	.meta({
		id: 'NutritionSettingsPatch',
		description:
			'Merges into the stored Nutrition settings, and `coachingModules`, `timeline`, `logger`, and `expenditure` key by key.',
	});

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
		nutrition: z
			.record(z.string(), z.unknown())
			.meta({ description: 'The Nutrition settings as stored. A key left out takes the app default.' }),
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
				heightCm: z.number().positive().meta({ description: 'Read by the BMR and the nutrient defaults.' }),
				birthDate: z.iso.date(),
			})
			.partial(),
		nutrition: NutritionSettingsPatch,
	})
	.partial()
	.meta({ id: 'SettingsPatch' });

export const BodyWeight = z
	.object({
		id: z.string(),
		measuredAt: z.string(),
		weightKg: z.number(),
		source: z.enum(BODY_WEIGHT_SOURCES),
		bodyFatPercent: z.number().nullable().meta({ description: "The scale's body fat, entered with the weight." }),
	})
	.meta({ id: 'BodyWeight' });
const bodyWeightFields = {
	weightKg: z.number().positive(),
	measuredAt: instant,
	bodyFatPercent: z.number().min(0).max(100).nullable(),
};
export const BodyWeightCreate = z
	.object({
		id: id.optional(),
		...bodyWeightFields,
		measuredAt: instant.default(() => new Date().toISOString()).meta({ description: 'Defaults to now.' }),
		bodyFatPercent: bodyWeightFields.bodyFatPercent.default(null),
	})
	.meta({ id: 'BodyWeightCreate' });
export const BodyWeightPatch = z.object(bodyWeightFields).partial().meta({ id: 'BodyWeightPatch' });

export const Deleted = z.object({ deleted: z.string() }).meta({ id: 'Deleted' });
