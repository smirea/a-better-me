import type { Case, Expected } from './cases';
import { MILK_TOP5, PIZZA_TOP5, PIZZA_TOP10 } from './history';

const food = (
	name: string | string[],
	amount: number,
	unit: string | string[],
	meal: string,
	extra: Expected = {},
): Expected => ({ kind: 'food', name: typeof name === 'string' ? [name] : name, amount, unit, meal, ...extra });

const YOGURT_TOP5 = [
	'Yogurt, plain, whole milk',
	'Chobani Greek Yogurt, Vanilla, Nonfat',
	'Yogurt, Greek, plain, nonfat',
	'FAGE Total 2% Greek Yogurt, Plain',
	'Yogurt, fruit, lowfat, strawberry',
];

const pizzaStart = 'for dinner i had two slices of pizza um that match is wrong show me other pizzas';
const pizzaExpanded = `${pizzaStart} none of those show me more pizza options`;
const milkStart = 'for breakfast i drank 250 ml of milk that is the wrong milk show me the choices';
const milkPicked = `${milkStart} use the third one`;
const yogurtStart = 'for snack 170 grams of yogurt no the matched yogurt is wrong show me options';

export const HOLDOUT: Case[] = [
	{
		id: 'h-meal-01',
		use: 'meal',
		text: 'um for lunch a bowl of lentil soup and a couple of rye crackers',
		items: [
			food('lentil soup', 1, 'bowl', 'lunch'),
			food(['rye crackers', 'rye cracker'], 2, ['', 'cracker'], 'lunch'),
		],
	},
	{
		id: 'h-meal-02',
		use: 'meal',
		text: 'dinner was one and a half cups of couscous with 180 grans of roasted zucchini and half a tablespoon of olive oil',
		items: [
			food('couscous', 1.5, 'cup', 'dinner'),
			food('roasted zucchini', 180, 'g', 'dinner'),
			food('olive oil', 0.5, 'tbsp', 'dinner'),
		],
	},
	{
		id: 'h-meal-03',
		use: 'meal',
		text: 'breakfast was half a grapefruit and 300 milliliters of orange juice uh and cottage cheese',
		items: [
			food('grapefruit', 0.5, ['', 'grapefruit'], 'breakfast'),
			food('orange juice', 300, 'ml', 'breakfast'),
			food('cottage cheese', 0, '', 'breakfast'),
		],
	},
	{
		id: 'h-meal-04',
		use: 'meal',
		text: 'for snack a pear and 2 ounces of cashews then for dinner a bowl of mushroom risotto',
		items: [
			food('pear', 1, ['', 'pear'], 'snack'),
			food('cashews', 2, 'oz', 'snack'),
			food('mushroom risotto', 1, 'bowl', 'dinner'),
		],
	},
	{
		id: 'h-meal-05',
		use: 'meal',
		text: 'lunch a tuna wrap and 12 fl oz of sparkling water',
		items: [food('tuna wrap', 1, ['', 'wrap'], 'lunch'), food('sparkling water', 12, 'fl oz', 'lunch')],
	},
	{
		id: 'h-meal-06',
		use: 'meal',
		text: 'at 7:30 pm for dinner i ate a quarter pound of pulled pork with half a cup of coleslaw',
		items: [
			food('pulled pork', 0.25, 'lb', 'dinner', { time: '19:30' }),
			food('coleslaw', 0.5, 'cup', 'dinner', { time: '19:30' }),
		],
	},
	{
		id: 'h-meal-07',
		use: 'meal',
		text: 'for breakfast 0.2 kg of watermelon and half a liter of coconut water',
		items: [food('watermelon', 0.2, 'kg', 'breakfast'), food('coconut water', 0.5, 'l', 'breakfast')],
	},
	{
		id: 'h-meal-08',
		use: 'meal',
		time: '17:20',
		text: 'for snack around 4 i had a rice cake and two teaspoons of almond butter',
		items: [
			food('rice cake', 1, ['', 'cake', 'piece'], 'snack', { time: '16:00' }),
			food('almond butter', 2, 'tsp', 'snack', { time: '16:00' }),
		],
	},
	{
		id: 'h-day-01',
		use: 'day',
		text: 'today breakfast was a bagel and two tablespoons of cream cheese lunch was 2 cups of tomato soup and a bread roll for snack an apple and dinner was 200 grams of cod',
		items: [
			food('bagel', 1, ['', 'bagel'], 'breakfast'),
			food('cream cheese', 2, 'tbsp', 'breakfast'),
			food('tomato soup', 2, 'cup', 'lunch'),
			food('bread roll', 1, ['', 'roll'], 'lunch'),
			food('apple', 1, ['', 'apple'], 'snack'),
			food('cod', 200, 'g', 'dinner'),
		],
	},
	{
		id: 'h-day-02',
		use: 'day',
		text: 'yesterday for breakfast i ate 100 grams of muesli and 200 ml of soy milk lunch was a falafel wrap snack was two plums dinner was a bowl of chili and one cup of brown rice',
		items: [
			food('muesli', 100, 'g', 'breakfast', { day: -1 }),
			food('soy milk', 200, 'ml', 'breakfast', { day: -1 }),
			food('falafel wrap', 1, ['', 'wrap'], 'lunch', { day: -1 }),
			food(['plums', 'plum'], 2, ['', 'plum'], 'snack', { day: -1 }),
			food('chili', 1, 'bowl', 'dinner', { day: -1 }),
			food('brown rice', 1, 'cup', 'dinner', { day: -1 }),
		],
	},
	{
		id: 'h-day-03',
		use: 'day',
		text: 'forgot yesterday snack was a peach and 20 grams of pistachios today breakfast was a croissant lunch was a bowl of minestrone and dinner was 3 fish tacos',
		items: [
			food('peach', 1, ['', 'peach'], 'snack', { day: -1 }),
			food('pistachios', 20, 'g', 'snack', { day: -1 }),
			food('croissant', 1, ['', 'croissant'], 'breakfast'),
			food('minestrone', 1, 'bowl', 'lunch'),
			food(['fish tacos', 'fish taco'], 3, ['', 'taco'], 'dinner'),
		],
	},
	{
		id: 'h-day-04',
		use: 'day',
		time: '21:10',
		text: 'today breakfast at 8 am was two slices of pumpernickel and a tablespoon of jam lunch at 12:15 pm was a bowl of ramen snack at 4 pm was a nectarine dinner at 7:30 pm was 160 grams of tofu and a cup of green beans',
		items: [
			food('pumpernickel', 2, 'slice', 'breakfast', { time: '08:00' }),
			food('jam', 1, 'tbsp', 'breakfast', { time: '08:00' }),
			food('ramen', 1, 'bowl', 'lunch', { time: '12:15' }),
			food('nectarine', 1, ['', 'nectarine'], 'snack', { time: '16:00' }),
			food('tofu', 160, 'g', 'dinner', { time: '19:30' }),
			food('green beans', 1, 'cup', 'dinner', { time: '19:30' }),
		],
	},
	{
		id: 'h-day-05',
		use: 'day',
		text: 'breakfast a bowl of grits lunch two chicken burritos and a cup of black beans um snack 30 grams of walnuts dinner 250 grams of gnocchi and a cup of peas actually the walnuts were 15 grams',
		items: [
			food('grits', 1, 'bowl', 'breakfast'),
			food(['chicken burritos', 'chicken burrito'], 2, ['', 'burrito'], 'lunch'),
			food('black beans', 1, 'cup', 'lunch'),
			food('walnuts', 15, 'g', 'snack'),
			food('gnocchi', 250, 'g', 'dinner'),
			food('peas', 1, 'cup', 'dinner'),
		],
	},
	{
		id: 'h-day-06',
		use: 'day',
		text: 'today breakfast same breakfast as yesterday lunch was a bowl of gazpacho and a cheese sandwich snack a kiwi dinner 6 ounces of trout and a cup of polenta',
		items: [
			{ kind: 'copy', copy: 'yb', meal: 'breakfast' },
			food('gazpacho', 1, 'bowl', 'lunch'),
			food('cheese sandwich', 1, ['', 'sandwich'], 'lunch'),
			food('kiwi', 1, ['', 'kiwi'], 'snack'),
			food('trout', 6, 'oz', 'dinner'),
			food('polenta', 1, 'cup', 'dinner'),
		],
	},
	{
		id: 'h-day-07',
		use: 'day',
		text: 'yesterday breakfast a cinnamon roll lunch a bowl of split pea soup snack two apricots dinner a veggie burger and 100 grams of fries today breakfast two waffles',
		items: [
			food('cinnamon roll', 1, ['', 'roll'], 'breakfast', { day: -1 }),
			food('split pea soup', 1, 'bowl', 'lunch', { day: -1 }),
			food(['apricots', 'apricot'], 2, ['', 'apricot'], 'snack', { day: -1 }),
			food('veggie burger', 1, ['', 'burger'], 'dinner', { day: -1 }),
			food('fries', 100, 'g', 'dinner', { day: -1 }),
			food(['waffles', 'waffle'], 2, ['', 'waffle'], 'breakfast'),
		],
	},
	{
		id: 'h-day-08',
		use: 'day',
		text: 'um breakfast a cup of bran flakes and 150 ml of almond milk lunch a hummus sandwich and a cucumber snack a banana dinner a bowl of udon and a tablespoon of sesame seeds remove the cucumber',
		items: [
			food('bran flakes', 1, 'cup', 'breakfast'),
			food('almond milk', 150, 'ml', 'breakfast'),
			food('hummus sandwich', 1, ['', 'sandwich'], 'lunch'),
			food('banana', 1, ['', 'banana'], 'snack'),
			food('udon', 1, 'bowl', 'dinner'),
			food('sesame seeds', 1, 'tbsp', 'dinner'),
		],
	},
	{
		id: 'h-copy-01',
		use: 'copy',
		text: 'for lunch today repeat the salmon dinner from sunday',
		items: [{ kind: 'copy', copy: '2d', meal: 'lunch' }],
	},
	{
		id: 'h-copy-02',
		use: 'copy',
		text: 'repeat the breakfast i logged this morning for dinner and add a bowl of vegetable soup',
		items: [{ kind: 'copy', copy: 'tb', meal: 'dinner' }, food('vegetable soup', 1, 'bowl', 'dinner')],
	},
	{
		id: 'h-copy-03',
		use: 'copy',
		text: 'same lunch as yesterday today leave out the salad',
		items: [{ kind: 'copy', copy: 'yl', meal: 'lunch', except: ['yl-salad'] }],
	},
	{
		id: 'h-copy-04',
		use: 'copy',
		text: 'today breakfast repeat sundays breakfast but skip the syrup and the coffee',
		items: [{ kind: 'copy', copy: '2b', meal: 'breakfast', except: ['2b-syrup', '2b-coffee'] }],
	},
	{
		id: 'h-copy-05',
		use: 'copy',
		text: 'for snack today the same snack as yesterday and an orange',
		items: [{ kind: 'copy', copy: 'ys', meal: 'snack' }, food('orange', 1, ['', 'orange'], 'snack')],
	},
	{
		id: 'h-copy-06',
		use: 'copy',
		text: 'today lunch same lunch as yesterday then for dinner the steak dinner from last night',
		items: [
			{ kind: 'copy', copy: 'yl', meal: 'lunch' },
			{ kind: 'copy', copy: 'yd', meal: 'dinner' },
		],
	},
	{
		id: 'h-copy-07',
		use: 'copy',
		text: 'same breakfast as yesterday for today no wait i mean the breakfast from sunday',
		items: [{ kind: 'copy', copy: '2b', meal: 'breakfast' }],
	},
	{
		id: 'h-substitute-01',
		use: 'substitute',
		text: 'today lunch same lunch as yesterday but replace the rice with half a cup of barley',
		items: [{ kind: 'copy', copy: 'yl', meal: 'lunch', except: ['yl-rice'] }, food('barley', 0.5, 'cup', 'lunch')],
	},
	{
		id: 'h-substitute-02',
		use: 'substitute',
		text: 'same dinner as last night for dinner today but the steak should be 180 grams',
		items: [
			{ kind: 'copy', copy: 'yd', meal: 'dinner', except: ['yd-steak'] },
			food(['steak', 'ribeye steak', 'beef ribeye steak grilled'], 180, 'g', 'dinner', { ref: 'yd-steak' }),
		],
	},
	{
		id: 'h-substitute-03',
		use: 'substitute',
		text: 'breakfast today same as yesterday except swap blueberries for 60 grams of raspberries and leave out the chia',
		items: [
			{ kind: 'copy', copy: 'yb', meal: 'breakfast', except: ['yb-blue', 'yb-chia'] },
			food('raspberries', 60, 'g', 'breakfast'),
		],
	},
	{
		id: 'h-substitute-04',
		use: 'substitute',
		text: 'for snack one scoop of my usual whey protein shake actually make that one and a half scoops and a mandarin',
		items: [
			food(['whey protein shake', 'protein shake'], 1.5, 'scoop', 'snack', { ref: 'u-shake' }),
			food('mandarin', 1, ['', 'mandarin'], 'snack'),
		],
	},
	{
		id: 'h-substitute-05',
		use: 'substitute',
		text: 'for lunch just the grilled chicken breast i logged yesterday at lunch 220 grams of that and two cups of spinach',
		items: [
			food(['grilled chicken breast', 'chicken breast'], 220, 'g', 'lunch', { ref: 'yl-chicken' }),
			food('spinach', 2, 'cup', 'lunch'),
		],
	},
	{
		id: 'h-substitute-06',
		use: 'substitute',
		text: 'for breakfast my usual protein pancakes three pancakes and 250 ml of my usual plain kefir',
		items: [
			food(['protein pancakes', 'protein pancakes homemade'], 3, ['', 'pancake'], 'breakfast', { ref: 'u-pancake' }),
			food(['plain kefir', 'kefir'], 250, 'ml', 'breakfast', { ref: 'u-kefir' }),
		],
	},
	{
		id: 'h-substitute-07',
		use: 'substitute',
		text: 'same breakfast as yesterday for breakfast today but make the oats three quarters of a cup and add a teaspoon of cinnamon',
		items: [
			{ kind: 'copy', copy: 'yb', meal: 'breakfast', except: ['yb-oats'] },
			food(['oats', 'rolled oats', 'oatmeal'], 0.75, 'cup', 'breakfast', { ref: 'yb-oats' }),
			food('cinnamon', 1, 'tsp', 'breakfast'),
		],
	},
	{
		id: 'h-search-01',
		use: 'search',
		text: pizzaStart,
		shown: [{ item: 0, options: PIZZA_TOP5 }],
		items: [food('pizza', 2, 'slice', 'dinner', { options: true })],
	},
	{
		id: 'h-search-02',
		use: 'search',
		text: pizzaExpanded,
		shown: [{ item: 0, options: PIZZA_TOP10 }],
		items: [food('pizza', 2, 'slice', 'dinner', { options: true })],
	},
	{
		id: 'h-search-03',
		use: 'search',
		text: `${pizzaExpanded} yes the papa johns pepperoni one make it three slices`,
		shown: [{ item: 0, options: PIZZA_TOP10 }],
		items: [food(PIZZA_TOP10[8]!, 3, 'slice', 'dinner')],
	},
	{
		id: 'h-search-04',
		use: 'search',
		text: milkStart,
		shown: [{ item: 0, options: MILK_TOP5 }],
		items: [food('milk', 250, 'ml', 'breakfast', { options: true })],
	},
	{
		id: 'h-search-05',
		use: 'search',
		text: milkPicked,
		shown: [{ item: 0, options: MILK_TOP5 }],
		items: [food(MILK_TOP5[2]!, 250, 'ml', 'breakfast')],
	},
	{
		id: 'h-search-06',
		use: 'search',
		text: `${milkPicked} actually 300 ml of that milk and a fig`,
		shown: [{ item: 0, options: MILK_TOP5 }],
		items: [food(MILK_TOP5[2]!, 300, 'ml', 'breakfast'), food('fig', 1, ['', 'fig'], 'breakfast')],
	},
	{
		id: 'h-search-07',
		use: 'search',
		text: yogurtStart,
		shown: [{ item: 0, options: YOGURT_TOP5 }],
		items: [food('yogurt', 170, 'g', 'snack', { options: true })],
	},
	{
		id: 'h-search-08',
		use: 'search',
		text: `${yogurtStart} the plain greek nonfat one not the vanilla`,
		shown: [{ item: 0, options: YOGURT_TOP5 }],
		items: [food(YOGURT_TOP5[2]!, 170, 'g', 'snack')],
	},
	{
		id: 'h-correct-01',
		use: 'correct',
		text: 'for snack two dates and a cup of hot chocolate wait the first one make that four dates',
		items: [food(['dates', 'date'], 4, ['', 'date'], 'snack'), food('hot chocolate', 1, 'cup', 'snack')],
	},
	{
		id: 'h-correct-02',
		use: 'correct',
		text: 'for lunch a bowl of carrot soup and a sesame bagel no scratch the soup actually scratch the whole lunch',
		items: [],
	},
	{
		id: 'h-correct-03',
		use: 'correct',
		text: 'for dinner 150 grams of shrimp and a cup of noodles no i mean 200 grams of shrimp wait make that 175 grams and remove the noodles',
		items: [food('shrimp', 175, 'g', 'dinner')],
	},
	{
		id: 'h-correct-04',
		use: 'correct',
		text: 'for breakfast two slices of rye bread and a teaspoon of margarine actually the bread was for lunch keep the margarine at breakfast',
		items: [food('rye bread', 2, 'slice', 'lunch'), food('margarine', 1, 'tsp', 'breakfast')],
	},
	{
		id: 'h-live-01',
		use: 'live',
		text: 'um for lunch i had',
		items: [],
	},
	{
		id: 'h-live-02',
		use: 'live',
		text: 'um for lunch i had a bowl of pumpkin soup and two tablespoons of',
		items: [food('pumpkin soup', 1, 'bowl', 'lunch')],
	},
	{
		id: 'h-live-03',
		use: 'live',
		text: 'um for lunch i had a bowl of pumpkin soup and two tablespoons of sour cream wait the soup was half a bowl',
		items: [food('pumpkin soup', 0.5, 'bowl', 'lunch'), food('sour cream', 2, 'tbsp', 'lunch')],
	},
];
