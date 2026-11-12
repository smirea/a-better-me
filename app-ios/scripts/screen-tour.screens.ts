// Every screen `screen-tour` captures, each a tap path from a fresh launch on the Dashboard. Steps are agent-device
// `.ad` lines; `shot <suffix>` saves an extra screenshot mid-path.
// `after` runs once the screenshot is saved, to undo state the path left, such as a started workout.
export type Screen = { name: string; steps: string[]; after?: string[] };

const quote = (label: string) => `'label="${label}"'`;
const tap = (label: string) => [`wait ${quote(label)} 8000`, `press ${quote(label)}`];
// For a label a full-screen cover also names its window by, such as the live workout's Workout Options.
const tapButton = (label: string) => [`wait ${quote(label)} 8000`, `press 'role="button" label="${label}"'`];
const tapTab = (tab: 'Nutrition' | 'Workout' | 'More' | 'New') => [`press 'role="button" label="${tab}"'`, 'wait 800'];
const scrollTo = (label: string) => [`scroll down --until ${quote(label)}`];
const more = (row: string) => [
	...tapTab('More'),
	...(bottomRows.has(row) ? ['scroll bottom', 'wait 500'] : []),
	...tap(row),
];
// The trailing toolbar menu of a tab root (Day Options on the Food Log, Workout Tab Options on the Workout tab).
const trailingToolbarButton = ['press 364 84', 'wait 800'];
const bottomRows = new Set(['Exercises', 'Gym Profiles', 'Data Visibility', 'API Tokens']);
// The live workout's menu reads as a button or a popup button from one launch to the next, so it is tapped by position.
const discardWorkout = [
	'wait \'label="Workout Options"\' 8000',
	'press 36 88',
	...tap('Discard Workout'),
	...tap('Discard'),
	'wait 800',
];
const scrolled = (count = 1) => Array.from({ length: count }, () => 'scroll down').concat('wait 600');

export const screens: Screen[] = [
	{ name: 'add-choose', steps: tapTab('New') },

	{ name: 'dashboard', steps: ['shot top', ...scrolled(1), 'shot mid', ...scrolled(2)] },
	{ name: 'dashboard-customize', steps: [...tap('Customize Dashboard')] },
	{ name: 'dashboard-workouts-detail', steps: [...scrollTo('Workouts'), ...tap('Workouts'), 'wait 1000'] },
	{
		name: 'dashboard-weight-detail',
		steps: [...scrollTo('Weight Trend'), ...tap('Weight Trend'), 'wait 1000', 'shot top', ...scrolled(1)],
	},
	{ name: 'dashboard-expenditure-detail', steps: [...scrollTo('Expenditure'), ...tap('Expenditure'), 'wait 1000'] },
	{ name: 'dashboard-goal-progress', steps: [...scrollTo('Goal Progress'), ...tap('Goal Progress'), 'wait 1000'] },
	{
		name: 'dashboard-see-all-nutrition',
		steps: [`scroll down --until 'label="See All Nutrition"'`, ...tap('See All Nutrition')],
	},
	{ name: 'dashboard-see-all-body-metrics', steps: ['scroll bottom', 'wait 600', 'press 358 331'] },

	{ name: 'foodlog', steps: tapTab('Nutrition') },
	// Swipes the timeline back to yesterday, which the seed marks incomplete with edited totals, beside the page dots.
	{ name: 'foodlog-marked-day', steps: [...tapTab('Nutrition'), 'swipe 60 500 340 500', 'wait 800'] },
	{ name: 'foodlog-menu', steps: [...tapTab('Nutrition'), ...trailingToolbarButton] },
	{ name: 'foodlog-calendar', steps: [...tapTab('Nutrition'), ...tap('Calendar')] },
	{ name: 'foodlog-overview', steps: [...tapTab('Nutrition'), ...trailingToolbarButton, 'press 260 93'] },
	{ name: 'foodlog-select', steps: [...tapTab('Nutrition'), ...trailingToolbarButton, ...tap('Select All')] },
	{ name: 'foodlog-copy', steps: [...tapTab('Nutrition'), ...trailingToolbarButton, ...tap('Copy Day')] },
	{ name: 'nutrition-shortcuts', steps: [...tapTab('Nutrition'), ...tapTab('New')] },
	{ name: 'logger-search', steps: [...tapTab('Nutrition'), ...tap('Search for a food'), 'wait 800'] },
	{ name: 'logger-quick-add', steps: [...tapTab('Nutrition'), ...tap('Search for a food'), ...tap('Quick Add')] },
	{ name: 'logger-library', steps: [...tapTab('Nutrition'), ...tap('Your Foods')] },
	{ name: 'logger-photo', steps: [...tapTab('Nutrition'), ...tap('Search for a food'), ...tap('Photo')] },
	{ name: 'logger-ramble', steps: [...tapTab('Nutrition'), ...tap('Search for a food'), ...tap('Ramble')] },
	{
		name: 'logger-scan',
		steps: [...tapTab('Nutrition'), ...tap('Search for a food'), `press 'role="button" label="Scan"'`, 'wait 800'],
	},

	{ name: 'workout', steps: [...tapTab('Workout'), 'shot top', ...scrolled(1)] },
	{ name: 'workout-calendar', steps: [...tapTab('Workout'), ...tap('Calendar')] },
	{ name: 'workout-shortcuts', steps: [...tapTab('Workout'), ...tapTab('New')] },
	{ name: 'workout-history', steps: [...tapTab('Workout'), ...trailingToolbarButton, ...tap('Workout History')] },
	{ name: 'workout-archive', steps: [...tapTab('Workout'), ...trailingToolbarButton, ...tap('Archive')] },
	{
		name: 'workout-customize-sections',
		steps: [...tapTab('Workout'), ...trailingToolbarButton, ...tap('Customize Sections')],
	},
	{
		name: 'live-workout',
		steps: [...tapTab('Workout'), ...tapTab('New'), ...tap('Empty Workout'), 'wait 1200'],
		after: discardWorkout,
	},

	{ name: 'more', steps: [...tapTab('More'), 'shot top', ...scrolled(2)] },
	{ name: 'levels', steps: more('Levels') },
	{ name: 'strategy', steps: [...more('Strategy'), 'shot top', ...scrolled(1)] },
	{ name: 'settings-units', steps: more('Units') },
	{ name: 'settings-profile', steps: more('Profile') },
	{ name: 'changelog', steps: [...more('Changelog'), 'shot top', ...scrolled(2)] },
	{ name: 'settings-workout', steps: [...tapTab('More'), `press 'role="cell" label="Workout"'`] },
	{ name: 'exercises', steps: more('Exercises') },
	{ name: 'gym-profiles', steps: more('Gym Profiles') },
	{ name: 'settings-food-log', steps: more('Food Log') },
	{ name: 'settings-expenditure', steps: more('Expenditure') },
	{ name: 'settings-strategy', steps: [...more('Strategy'), 'press 362 84', 'wait 800', ...tap('Strategy Settings')] },
	{ name: 'foods-recipes', steps: more('Foods & Recipes') },
	{ name: 'settings-health', steps: more('Apple Health') },
	{ name: 'settings-data-visibility', steps: more('Data Visibility') },
	{ name: 'settings-api-tokens', steps: more('API Tokens') },
	{ name: 'dashboard-food-logging', steps: [...scrollTo('Food Logging'), ...tap('Food Logging'), 'wait 1000'] },
	{ name: 'dashboard-scale-weight', steps: ['scroll bottom', 'wait 500', ...tap('Scale Weight'), 'wait 1000'] },
	{ name: 'dashboard-steps', steps: ['scroll bottom', 'wait 600', 'press 56 617', 'wait 1000'] },
	{
		name: 'dashboard-add-remove',
		steps: [...tap('Customize Dashboard'), ...scrollTo('Add or Remove Nutrition'), ...tap('Add or Remove Nutrition')],
	},
	{ name: 'foodlog-entry-editor', steps: [...tapTab('Nutrition'), ...tap('Overnight Oats')] },
	{
		name: 'foodlog-select-copy',
		steps: [...tapTab('Nutrition'), ...trailingToolbarButton, ...tap('Select All'), ...tap('Copy')],
	},
	{
		name: 'foodlog-time-prompt',
		steps: [...tapTab('Nutrition'), ...trailingToolbarButton, ...tap('Select All'), ...tap('Modify Timestamp')],
	},
	{
		name: 'foodlog-strategy-wizard',
		steps: [...more('Strategy'), 'press 362 84', 'wait 800', ...tap('Edit Goal'), 'wait 1000'],
	},
	{
		name: 'strategy-maintenance-breakdown',
		steps: [
			...more('Strategy'),
			'press 362 84',
			'wait 800',
			...tap('Edit Goal'),
			'wait 1000',
			...tap('See the calculation'),
			'wait 1000',
		],
	},
	{
		name: 'foodlog-nutrient-goals',
		steps: [...more('Strategy'), 'press 362 84', 'wait 800', ...tap('Nutrient Goals')],
	},
	{ name: 'add-weight', steps: [...tapTab('Nutrition'), ...tapTab('New'), ...tap('Weight')] },
	{ name: 'add-edit-day', steps: [...tapTab('Nutrition'), ...tapTab('New'), ...tap('Edit Day')] },
	{
		name: 'logger-food-detail',
		steps: [...tapTab('Nutrition'), ...tap('Your Foods'), ...tap('Homemade Granola'), 'wait 800'],
	},
	{
		name: 'foods-recipe-detail',
		steps: [...more('Foods & Recipes'), 'press 80 185', 'wait 600', 'press 200 260', 'wait 1000'],
	},
	{ name: 'foods-create-food', steps: [...more('Foods & Recipes'), 'press 361 84', 'wait 800', 'press 260 93'] },
	{ name: 'workout-program-editor', steps: [...tapTab('Workout'), ...tap('Upper Lower, 3 workouts')] },
	{
		name: 'workout-detail',
		steps: [
			...tapTab('Workout'),
			...scrollTo('Workout Library'),
			'scroll down',
			...tap('Lower, Barbell Back Squat, Conventional Deadlift, 45° Leg Press'),
		],
	},
	{
		name: 'workout-summary',
		// Rows name their session's date, which the seed derives from the launch time, so the first row is tapped by position.
		steps: [...more('Workout History'), 'wait 1000', 'press 200 200', 'wait 1200'],
	},
	{ name: 'workout-create', steps: [...tapTab('Workout'), ...tapTab('New'), ...tap('New Workout')] },
	{ name: 'workout-new-program', steps: [...tapTab('Workout'), ...tapTab('New'), ...tap('New Program')] },
	{ name: 'workout-go-to-cycle', steps: [...tapTab('Workout'), ...tap('Cycle 1')] },
	{
		name: 'live-workout-add-exercise',
		steps: [...tapTab('Workout'), ...tapTab('New'), ...tap('Empty Workout'), ...tapButton('Add Exercise'), 'wait 1000'],
		after: [...tapButton('Close'), ...discardWorkout],
	},
	// The first muscle row, whichever muscle the seed's sets put there.
	{ name: 'levels-muscle', steps: [...more('Levels'), 'wait 1000', 'press 200 667'] },
	{ name: 'gym-editor', steps: [...more('Gym Profiles'), ...tap('Your Gym')] },
	{ name: 'gym-new', steps: [...more('Gym Profiles'), ...tap('Add New Gym Profile')] },
	{ name: 'exercises-custom', steps: [...more('Exercises'), ...tap('Create Custom Exercise')] },
	{
		name: 'settings-rest-timer',
		steps: [...tapTab('More'), `press 'role="cell" label="Workout"'`, ...tap('Rest Timer')],
	},
	{ name: 'settings-warm-up', steps: [...tapTab('More'), `press 'role="cell" label="Workout"'`, ...tap('Warm-Up')] },
	{
		name: 'settings-smart-progression',
		steps: [...tapTab('More'), `press 'role="cell" label="Workout"'`, ...tap('Smart Progression')],
	},
	{ name: 'settings-bmr', steps: [...more('Expenditure'), ...tap('BMR Equation')] },
	{ name: 'settings-hour-range', steps: [...more('Food Log'), ...tap('Hour Range')] },
	{ name: 'settings-nutrient-visibility', steps: [...more('Data Visibility'), ...tap('Nutrient Visibility')] },
];
