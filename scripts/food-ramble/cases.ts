import { MILK_TOP5, PIZZA_TOP10, PIZZA_TOP5 } from './history';

/**
 * A labelled item. Absent keys are not scored, except `ref`, `except`, `day`, `time`, and `options`, which default to
 * "none said" (null, [], 0, '', false) so an invented reference counts as a miss. A list means any of these values.
 * `name` lists accepted names: one matches when the output contains all its words and at most two more.
 */
export type Expected = {
	kind?: 'food' | 'copy';
	name?: string[];
	amount?: number | number[];
	unit?: string | string[];
	ref?: string | null | (string | null)[];
	copy?: string;
	except?: string[];
	meal?: string | string[];
	time?: string;
	day?: number;
	options?: boolean;
};

export type Use = 'meal' | 'day' | 'copy' | 'substitute' | 'search' | 'correct' | 'live';

export type Case = {
	id: string;
	use: Use;
	time?: string;
	text: string;
	shown?: { item: number; options: string[] }[];
	items: Expected[];
};

const MORNING = '08:15';
const BREAKFAST = ['', 'breakfast'];

const oats = (amount: number): Expected => ({ name: ['oats', 'oatmeal'], amount, unit: 'cup', meal: BREAKFAST });
const blueberries: Expected = { name: ['blueberries'], amount: 50, unit: 'g', meal: BREAKFAST };
const chia: Expected = { name: ['chia seeds', 'chia'], amount: 2, unit: 'tbsp', meal: BREAKFAST };
const kefir: Expected = {
	name: ['kefir'],
	amount: 200,
	unit: 'ml',
	meal: BREAKFAST,
	ref: [null, 'u-kefir', 'yb-kefir'],
};
const RAMBLE_1 =
	"i'm having 1 cup of oats and 50 grans of blueberries with 2 tablespoons of chia seeds and 200ml of kefir";

export const DEV: Case[] = [
	{ id: 'live-1', use: 'live', time: MORNING, text: "i'm having 1 cup of oats", items: [oats(1)] },
	{ id: 'live-2', use: 'live', time: MORNING, text: "i'm having 1 cup of oats and 50 grans of", items: [oats(1)] },
	{
		id: 'live-3',
		use: 'live',
		time: MORNING,
		text: "i'm having 1 cup of oats and 50 grans of blueberries with 2 tablespoons of chia",
		items: [oats(1), blueberries, chia],
	},
	{ id: 'live-4', use: 'live', time: MORNING, text: RAMBLE_1, items: [oats(1), blueberries, chia, kefir] },
	{
		id: 'meal-1',
		use: 'meal',
		time: MORNING,
		text: `${RAMBLE_1}, actual wait it's half of cup of oats`,
		items: [oats(0.5), blueberries, chia, kefir],
	},
	{
		id: 'meal-2',
		use: 'meal',
		time: MORNING,
		text: 'for breakfast two eggs and a slice of sourdough toast oh and a coffee with oat milk, no make it three eggs',
		items: [
			{ name: ['eggs', 'egg'], amount: 3, unit: ['', 'egg'], meal: 'breakfast' },
			{ name: ['sourdough toast', 'sourdough bread'], amount: 1, unit: 'slice', meal: 'breakfast' },
			{
				name: ['coffee with oat milk', 'coffee oat milk'],
				amount: [0, 1],
				meal: 'breakfast',
				ref: [null, 'u-coffee', '2b-coffee'],
			},
		],
	},
	{
		id: 'meal-3',
		use: 'meal',
		text: 'lunch was a turkey sandwich a bag of chips and a diet coke, actually scratch the chips',
		items: [
			{ name: ['turkey sandwich'], amount: 1, unit: ['', 'sandwich'], meal: 'lunch' },
			{ name: ['diet coke'], amount: 1, unit: ['', 'can', 'bottle'], meal: 'lunch' },
		],
	},
	{
		id: 'meal-4',
		use: 'meal',
		time: MORNING,
		text: 'a cup and a half of greek yogurt with a handful of almonds and a teaspoon of honey',
		items: [
			{ name: ['greek yogurt'], amount: 1.5, unit: 'cup' },
			{ name: ['almonds'], amount: 1, unit: 'handful' },
			{ name: ['honey'], amount: 1, unit: 'tsp' },
		],
	},
	{
		id: 'meal-5',
		use: 'meal',
		text: 'um so for dinner I had uh like 6 oz of salmon and some asparagus and two glasses of red wine',
		items: [
			{ name: ['salmon'], amount: 6, unit: 'oz', meal: 'dinner' },
			{ name: ['asparagus'], amount: 0, unit: '', meal: 'dinner' },
			{ name: ['red wine'], amount: 2, unit: 'glass', meal: 'dinner' },
		],
	},
	{
		id: 'day-1',
		use: 'day',
		text: 'i had my usual pancake for breakfast and at lunch i had 200grams of steak and a cup of broccoli, a barebells bar at 3pm',
		items: [
			{ name: ['pancake', 'pancakes', 'protein pancakes'], ref: 'u-pancake', amount: 0, meal: 'breakfast' },
			{ name: ['steak'], amount: 200, unit: 'g', meal: 'lunch' },
			{ name: ['broccoli'], amount: 1, unit: 'cup', meal: 'lunch' },
			{
				name: ['barebells bar', 'barebells protein bar'],
				amount: [0, 1],
				unit: ['', 'bar'],
				ref: [null, 'u-bar', 'ys-bar'],
				time: '15:00',
				meal: ['', 'snack'],
			},
		],
	},
	{
		id: 'day-2',
		use: 'day',
		text: 'breakfast was my usual coffee and two protein pancakes, lunch a chicken caesar salad, and dinner 150 grams of salmon with a cup of quinoa',
		items: [
			{ name: ['coffee', 'coffee with oat milk'], ref: 'u-coffee', amount: 0, meal: 'breakfast' },
			{
				name: ['protein pancakes', 'protein pancake'],
				ref: [null, 'u-pancake', '2b-pancake'],
				amount: 2,
				unit: ['', 'pancake'],
				meal: 'breakfast',
			},
			{ name: ['chicken caesar salad'], amount: [0, 1], meal: 'lunch' },
			{ name: ['salmon'], amount: 150, unit: 'g', meal: 'dinner' },
			{ name: ['quinoa'], amount: 1, unit: 'cup', meal: 'dinner' },
		],
	},
	{
		id: 'day-3',
		use: 'day',
		text: 'yesterday for dinner I had 2 slices of pizza and a beer',
		items: [
			{ name: ['pizza'], amount: 2, unit: 'slice', meal: 'dinner', day: -1 },
			{ name: ['beer'], amount: 1, unit: ['', 'can', 'bottle', 'beer'], meal: 'dinner', day: -1 },
		],
	},
	{
		id: 'day-4',
		use: 'day',
		text: 'so breakfast I had like a banana and uh peanut butter toast two slices and then for dinner a big bowl of chili',
		items: [
			{ name: ['banana'], amount: 1, unit: ['', 'banana'], meal: 'breakfast' },
			{ name: ['peanut butter toast'], amount: 2, unit: 'slice', meal: 'breakfast' },
			{ name: ['chili'], amount: 1, unit: 'bowl', meal: 'dinner' },
		],
	},
	{
		id: 'day-5',
		use: 'day',
		text: 'a protein shake at 10 am, a turkey wrap at 1, and an apple around 4 pm',
		items: [
			{ name: ['protein shake', 'whey protein shake'], ref: [null, 'u-shake'], time: '10:00' },
			{ name: ['turkey wrap'], time: '13:00', amount: [0, 1] },
			{ name: ['apple'], time: '16:00', amount: 1, unit: ['', 'apple'] },
		],
	},
	{
		id: 'copy-1',
		use: 'copy',
		text: 'I had the same breakfast today as yesterday and for lunch the steak dinner from last night',
		items: [
			{ kind: 'copy', copy: 'yb', meal: 'breakfast' },
			{ kind: 'copy', copy: 'yd', meal: 'lunch' },
		],
	},
	{ id: 'copy-2', use: 'copy', text: "add yesterday's lunch", items: [{ kind: 'copy', copy: 'yl', meal: 'lunch' }] },
	{
		id: 'copy-3',
		use: 'copy',
		text: 'same dinner as two days ago',
		items: [{ kind: 'copy', copy: '2d', meal: 'dinner' }],
	},
	{
		id: 'copy-4',
		use: 'copy',
		text: 'for breakfast the pancakes from sunday',
		items: [{ name: ['pancakes', 'protein pancakes'], ref: ['2b-pancake', 'u-pancake'], meal: 'breakfast' }],
	},
	{
		id: 'copy-5',
		use: 'copy',
		text: "log yesterday's snack again",
		items: [{ kind: 'copy', copy: 'ys', meal: 'snack' }],
	},
	{
		id: 'sub-1',
		use: 'substitute',
		text: "add yesterday's breakfast and actually now replace blueberries with 1 cup raspberries",
		items: [
			{ kind: 'copy', copy: 'yb', meal: 'breakfast', except: ['yb-blue'] },
			{ name: ['raspberries'], amount: 1, unit: 'cup', meal: 'breakfast' },
		],
	},
	{
		id: 'sub-2',
		use: 'substitute',
		text: 'same lunch as yesterday but no rice, add a cup of quinoa instead',
		items: [
			{ kind: 'copy', copy: 'yl', meal: 'lunch', except: ['yl-rice'] },
			{ name: ['quinoa'], amount: 1, unit: 'cup', meal: 'lunch' },
		],
	},
	{
		id: 'sub-3',
		use: 'substitute',
		text: 'the steak dinner from last night but with a sweet potato instead of the baked potato',
		items: [
			{ kind: 'copy', copy: 'yd', meal: 'dinner', except: ['yd-potato'] },
			{ name: ['sweet potato'], amount: 1, unit: ['', 'potato', 'sweet potato'], meal: 'dinner' },
		],
	},
	{
		id: 'sub-4',
		use: 'substitute',
		text: "yesterday's breakfast without the chia seeds",
		items: [{ kind: 'copy', copy: 'yb', meal: 'breakfast', except: ['yb-chia'] }],
	},
	{
		id: 'sub-5',
		use: 'substitute',
		text: "copy yesterday's breakfast but make the kefir 300 ml",
		items: [
			{ kind: 'copy', copy: 'yb', meal: 'breakfast', except: ['yb-kefir'] },
			{ name: ['kefir'], amount: 300, unit: 'ml', meal: 'breakfast', ref: [null, 'yb-kefir', 'u-kefir'] },
		],
	},
	{
		id: 'search-1',
		use: 'search',
		text: 'I had pizza and milk for breakfast',
		items: [
			{ name: ['pizza'], meal: 'breakfast' },
			{ name: ['milk'], meal: 'breakfast' },
		],
	},
	{
		id: 'search-2',
		use: 'search',
		text: 'I had pizza and milk for breakfast oh that pizza is not good show me options',
		shown: [
			{ item: 0, options: PIZZA_TOP5 },
			{ item: 1, options: MILK_TOP5 },
		],
		items: [
			{ name: ['pizza'], meal: 'breakfast', options: true },
			{ name: ['milk'], meal: 'breakfast' },
		],
	},
	{
		id: 'search-3',
		use: 'search',
		text: "I had pizza and milk for breakfast oh that pizza is not good show me options yeah let's go with the pepperoni 2 slices",
		shown: [
			{ item: 0, options: PIZZA_TOP10 },
			{ item: 1, options: MILK_TOP5 },
		],
		items: [
			{ name: [PIZZA_TOP10[5]!], amount: 2, unit: 'slice', meal: 'breakfast' },
			{ name: ['milk'], meal: 'breakfast' },
		],
	},
	{
		id: 'search-4',
		use: 'search',
		text: "pizza and milk for breakfast, the pizza's wrong show me more, ok the second one",
		shown: [
			{ item: 0, options: PIZZA_TOP10 },
			{ item: 1, options: MILK_TOP5 },
		],
		items: [
			{ name: [PIZZA_TOP10[1]!], meal: 'breakfast' },
			{ name: ['milk'], meal: 'breakfast' },
		],
	},
	{
		id: 'search-5',
		use: 'search',
		text: 'pizza and milk for breakfast, the milk should be the 2% one',
		shown: [
			{ item: 0, options: PIZZA_TOP5 },
			{ item: 1, options: MILK_TOP5 },
		],
		items: [
			{ name: ['pizza'], meal: 'breakfast' },
			{ name: [MILK_TOP5[0]!, '2% milk'], meal: 'breakfast' },
		],
	},
	{
		id: 'search-6',
		use: 'search',
		text: 'pizza and milk for breakfast, the milk is wrong, show me options for the milk',
		shown: [
			{ item: 0, options: PIZZA_TOP5 },
			{ item: 1, options: MILK_TOP5 },
		],
		items: [
			{ name: ['pizza'], meal: 'breakfast' },
			{ name: ['milk'], meal: 'breakfast', options: true },
		],
	},
	{
		id: 'correct-1',
		use: 'correct',
		text: 'two eggs and toast, no wait, three eggs and no toast',
		items: [{ name: ['eggs', 'egg'], amount: 3, unit: ['', 'egg'] }],
	},
	{
		id: 'correct-2',
		use: 'correct',
		text: '200 grams of chicken breast, sorry 250',
		items: [{ name: ['chicken breast'], amount: 250, unit: 'g' }],
	},
	{
		id: 'correct-3',
		use: 'correct',
		text: 'a protein shake with two scoops, actually make that one scoop, and a banana',
		items: [
			{ name: ['protein shake', 'whey protein shake'], amount: 1, unit: 'scoop', ref: [null, 'u-shake'] },
			{ name: ['banana'], amount: 1, unit: ['', 'banana'] },
		],
	},
	{
		id: 'correct-4',
		use: 'correct',
		text: 'hmm what did I have, oh right a blueberry muffin and an iced latte, the latte was a large one',
		items: [
			{ name: ['blueberry muffin'], amount: 1, unit: ['', 'muffin'] },
			{ name: ['iced latte', 'large iced latte'], amount: 1, unit: ['', 'large', 'latte'] },
		],
	},
	{
		id: 'correct-5',
		use: 'correct',
		text: 'for lunch a burrito bowl, and remove the burrito bowl, I had tacos, three of them',
		items: [{ name: ['tacos', 'taco'], amount: 3, unit: ['', 'taco'], meal: 'lunch' }],
	},
];
