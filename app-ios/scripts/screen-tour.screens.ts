// Every screen `screen-tour` captures, each a tap path from a fresh launch on the Dashboard. Steps are agent-device
// `.ad` lines; `shot <suffix>` saves an extra screenshot mid-path.
// `after` runs once the screenshot is saved, to undo state the path left, such as a started workout.
export type Screen = { name: string; steps: string[]; after?: string[] };

const quote = (label: string) => `'label="${label}"'`;
const tap = (label: string) => [`wait ${quote(label)} 8000`, `press ${quote(label)}`];
// For a label a full-screen cover also names its window by, such as the live workout's Workout Options.
const tapButton = (label: string) => [`wait ${quote(label)} 8000`, `press 'role="button" label="${label}"'`];
const tapTab = (tab: 'Nutrition' | 'Workout' | 'Pings' | 'New') => [`press 'role="button" label="${tab}"'`, 'wait 800'];
const scrollTo = (label: string) => [`scroll down --until ${quote(label)}`];
// Settings opens from the gear on the Dashboard, where every path starts.
const openSettings = [...tap('Settings'), 'wait 800'];
// A row is pressed as a cell: the Dashboard under Settings holds buttons with the same labels (Levels, Workouts).
const settings = (row: string) => [
	...openSettings,
	...(bottomRows.has(row) ? ['scroll bottom', 'wait 500'] : []),
	`wait ${quote(row)} 8000`,
	`press 'role="cell" label="${row}"'`,
];
// The trailing toolbar menu of a tab root (Day Options on the Food Log, Workout Tab Options on the Workout tab).
const trailingToolbarButton = ['press 364 84', 'wait 800'];
const bottomRows = new Set([
	'Levels',
	'Workout History',
	'Workout',
	'Exercises',
	'Gym Profiles',
	'Data Visibility',
	'API Tokens',
]);
// The live workout's menu reads as a button or a popup button from one launch to the next, so it is tapped by position.
const discardWorkout = [
	'wait \'label="Workout Options"\' 8000',
	'press 36 88',
	...tap('Discard Workout'),
	...tap('Discard'),
	'wait 800',
];
// The day's supplements row and its tiles also exist on the pages beside today's, so a label matches three of each.
// They are tapped by position: the row, then its first tile.
const supplementsRow = ['wait \'label="Supplements"\' 8000', 'press 201 196', 'wait 600'];
// A library row's label carries its range, which moves with the seed's dates, so it is pressed by id.
const multivitamin = [
	'wait \'id="supplement-Essential Multivitamin"\' 8000',
	'press \'id="supplement-Essential Multivitamin"\'',
];
const loggerTab = (tab: string) => [...tapTab('Nutrition'), ...tap('Your Foods'), ...tapButton(tab)];
const scrolled = (count = 1) => Array.from({ length: count }, () => 'scroll down').concat('wait 600');

export const screens: Screen[] = [
	{ name: 'add-choose', steps: tapTab('New') },

	{ name: 'dashboard', steps: ['shot top', ...scrolled(1), 'shot mid', ...scrolled(2)] },
	{ name: 'dashboard-customize', steps: settings('Dashboard') },
	{ name: 'dashboard-levels', steps: [...tap('Levels'), 'wait 1000'] },
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

	{ name: 'pings', steps: tapTab('Pings') },
	// "+" turns the tab bar into the drawer of pings.
	{ name: 'pings-drawer', steps: [...tapTab('Pings'), ...tapTab('New'), 'wait 600'] },
	// A boolean lands as a row with a note, and Mood's chip opens into its steps.
	{
		name: 'pings-drawer-steps',
		steps: [...tapTab('Pings'), ...tapTab('New'), ...tap('Log Water'), ...tap('Log Mood'), 'wait 600'],
	},
	// Mood's row lands open, with its steps and their labels.
	{
		name: 'pings-added',
		steps: [
			...tapTab('Pings'),
			...tapTab('New'),
			...tap('Log Mood'),
			...tap('Mood 4, Good'),
			...tap('Close'),
			'wait 800',
		],
	},
	{
		name: 'ping-history',
		steps: [
			...tapTab('Pings'),
			...tapTab('New'),
			...tap('Log Mood'),
			...tap('Mood 4, Good'),
			...tap('Mood history'),
			'wait 1000',
		],
	},
	{ name: 'pings-manage', steps: [...tapTab('Pings'), ...tap('Ping Options'), ...tap('Edit Pings')] },
	{
		name: 'ping-editor',
		steps: [
			...tapTab('Pings'),
			...tap('Ping Options'),
			...tap('Edit Pings'),
			`press 'id="ping-Mood"'`,
			'wait 800',
			'shot top',
			...scrolled(1),
		],
	},
	{
		name: 'ping-new',
		steps: [...tapTab('Pings'), ...tap('Ping Options'), `press 'role="cell" label="New Ping"'`, 'wait 800'],
	},

	{ name: 'foodlog', steps: tapTab('Nutrition') },
	// Swipes the timeline back to yesterday, which the seed marks incomplete with edited totals, beside the page dots.
	{ name: 'foodlog-marked-day', steps: [...tapTab('Nutrition'), 'swipe 60 500 340 500', 'wait 800'] },
	{ name: 'foodlog-menu', steps: [...tapTab('Nutrition'), ...trailingToolbarButton] },
	{ name: 'foodlog-supplements', steps: [...tapTab('Nutrition'), ...supplementsRow] },
	{ name: 'foodlog-supplement', steps: [...tapTab('Nutrition'), ...supplementsRow, 'press 201 250', 'wait 600'] },
	{ name: 'foodlog-calendar', steps: [...tapTab('Nutrition'), ...tap('Calendar')] },
	{ name: 'foodlog-overview', steps: [...tapTab('Nutrition'), ...trailingToolbarButton, 'press 260 93'] },
	{ name: 'foodlog-select', steps: [...tapTab('Nutrition'), ...trailingToolbarButton, ...tap('Select All')] },
	{ name: 'foodlog-copy', steps: [...tapTab('Nutrition'), ...trailingToolbarButton, ...tap('Copy Day')] },
	{ name: 'logger-scan', steps: [...tapTab('Nutrition'), ...tapTab('New'), 'wait 800'] },
	{ name: 'logger-library', steps: [...tapTab('Nutrition'), ...tap('Your Foods')] },
	{ name: 'logger-search', steps: [...loggerTab('Search'), 'wait 800'] },
	{ name: 'logger-quick-add', steps: loggerTab('Quick Add') },
	{ name: 'logger-photo', steps: loggerTab('Photo') },
	{ name: 'logger-ramble', steps: loggerTab('Ramble') },

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

	{ name: 'settings', steps: [...openSettings, 'shot top', ...scrolled(2)] },
	{ name: 'levels', steps: settings('Levels') },
	{ name: 'strategy', steps: [...settings('Strategy'), 'shot top', ...scrolled(1)] },
	{ name: 'settings-units', steps: settings('Units') },
	{ name: 'settings-profile', steps: settings('Profile') },
	{ name: 'changelog', steps: [...settings('Changelog'), 'shot top', ...scrolled(2)] },
	{
		name: 'settings-workout',
		steps: [...openSettings, 'scroll bottom', 'wait 500', `press 'role="cell" label="Workout"'`],
	},
	{ name: 'exercises', steps: settings('Exercises') },
	{ name: 'gym-profiles', steps: settings('Gym Profiles') },
	{ name: 'settings-food-log', steps: settings('Food Log') },
	{ name: 'settings-expenditure', steps: settings('Expenditure') },
	{
		name: 'settings-strategy',
		steps: [...settings('Strategy'), 'press 362 84', 'wait 800', ...tap('Strategy Settings')],
	},
	{ name: 'foods-recipes', steps: settings('Foods & Recipes') },
	{ name: 'supplements', steps: [...settings('Supplements'), 'shot top', ...scrolled(1)] },
	// The seed's one supplement with two pictures, a tag, and a product page.
	{
		name: 'supplement',
		steps: [...settings('Supplements'), ...multivitamin, 'wait 600'],
	},
	{
		name: 'supplement-edit',
		steps: [...settings('Supplements'), ...multivitamin, ...tapButton('Edit'), 'wait 1000'],
	},
	{
		name: 'supplement-new',
		steps: [...settings('Supplements'), ...tap('New Supplement'), 'wait 800', 'shot top', ...scrolled(1)],
	},
	{ name: 'settings-health', steps: settings('Apple Health') },
	{ name: 'settings-data-visibility', steps: settings('Data Visibility') },
	{ name: 'settings-api-tokens', steps: settings('API Tokens') },
	{ name: 'dashboard-food-logging', steps: [...scrollTo('Food Logging'), ...tap('Food Logging'), 'wait 1000'] },
	{ name: 'dashboard-scale-weight', steps: ['scroll bottom', 'wait 500', ...tap('Scale Weight'), 'wait 1000'] },
	{ name: 'dashboard-steps', steps: ['scroll bottom', 'wait 600', 'press 56 617', 'wait 1000'] },
	{
		name: 'dashboard-add-remove',
		steps: [...settings('Dashboard'), ...scrollTo('Add or Remove Nutrition'), ...tap('Add or Remove Nutrition')],
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
		steps: [...settings('Strategy'), 'press 362 84', 'wait 800', ...tap('Edit Goal'), 'wait 1000'],
	},
	{
		name: 'strategy-maintenance-breakdown',
		steps: [
			...settings('Strategy'),
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
		steps: [...settings('Strategy'), 'press 362 84', 'wait 800', ...tap('Nutrient Goals')],
	},
	{ name: 'add-weight', steps: [...tapTab('Nutrition'), ...tapTab('New'), ...tap('Weight')] },
	{ name: 'add-edit-day', steps: [...tapTab('Nutrition'), ...tapTab('New'), ...tap('Edit Day')] },
	{
		name: 'logger-food-detail',
		steps: [...tapTab('Nutrition'), ...tap('Your Foods'), ...tap('Homemade Granola'), 'wait 800'],
	},
	{
		name: 'foods-recipe-detail',
		steps: [...settings('Foods & Recipes'), 'press 80 185', 'wait 600', 'press 200 260', 'wait 1000'],
	},
	{ name: 'foods-create-food', steps: [...settings('Foods & Recipes'), 'press 361 84', 'wait 800', 'press 260 93'] },
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
		steps: [...settings('Workout History'), 'wait 1000', 'press 200 200', 'wait 1200'],
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
	{ name: 'levels-muscle', steps: [...settings('Levels'), 'wait 1000', 'press 200 667'] },
	{ name: 'gym-editor', steps: [...settings('Gym Profiles'), ...tap('Your Gym')] },
	{ name: 'gym-new', steps: [...settings('Gym Profiles'), ...tap('Add New Gym Profile')] },
	{ name: 'exercises-custom', steps: [...settings('Exercises'), ...tap('Create Custom Exercise')] },
	{
		name: 'settings-rest-timer',
		steps: [...settings('Workout'), ...tap('Rest Timer')],
	},
	{ name: 'settings-warm-up', steps: [...settings('Workout'), ...tap('Warm-Up')] },
	{
		name: 'settings-smart-progression',
		steps: [...settings('Workout'), ...tap('Smart Progression')],
	},
	{ name: 'settings-bmr', steps: [...settings('Expenditure'), ...tap('BMR Equation')] },
	{ name: 'settings-hour-range', steps: [...settings('Food Log'), ...scrollTo('Hour Range'), ...tap('Hour Range')] },
	{ name: 'settings-nutrient-visibility', steps: [...settings('Data Visibility'), ...tap('Nutrient Visibility')] },
];
