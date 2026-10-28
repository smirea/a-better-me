import type { RambleRequest } from '../../server/src/food/ramble';

/** Tuesday 2026-10-27. Yesterday is Monday the 26th, Sunday is the 25th. */
export const TODAY = '2026-10-27';

const entry = (id: string, name: string, serving: string) => ({ id, name, serving });

export const MEALS: NonNullable<RambleRequest['meals']> = [
	{
		id: 'tb',
		day: '2026-10-27',
		meal: 'breakfast',
		entries: [entry('tb-eggs', 'Eggs, scrambled', '2 large'), entry('tb-toast', 'Sourdough toast', '1 slice')],
	},
	{
		id: 'yb',
		day: '2026-10-26',
		meal: 'breakfast',
		entries: [
			entry('yb-oats', 'Oats, rolled', '0.5 cup'),
			entry('yb-blue', 'Blueberries, raw', '50 g'),
			entry('yb-chia', 'Chia seeds', '2 tbsp'),
			entry('yb-kefir', 'Kefir, plain', '200 ml'),
		],
	},
	{
		id: 'yl',
		day: '2026-10-26',
		meal: 'lunch',
		entries: [
			entry('yl-chicken', 'Chicken breast, grilled', '150 g'),
			entry('yl-rice', 'Rice, white, cooked', '1 cup'),
			entry('yl-salad', 'Mixed green salad', '1 bowl'),
		],
	},
	{
		id: 'ys',
		day: '2026-10-26',
		meal: 'snack',
		entries: [entry('ys-bar', 'Barebells Protein Bar, Salty Peanut', '1 bar')],
	},
	{
		id: 'yd',
		day: '2026-10-26',
		meal: 'dinner',
		entries: [
			entry('yd-steak', 'Beef, ribeye steak, grilled', '250 g'),
			entry('yd-potato', 'Potato, baked', '1 medium'),
			entry('yd-broc', 'Broccoli, cooked', '1 cup'),
		],
	},
	{
		id: '2b',
		day: '2026-10-25',
		meal: 'breakfast',
		entries: [
			entry('2b-pancake', 'Protein pancakes (homemade)', '2 pancakes'),
			entry('2b-syrup', 'Maple syrup', '1 tbsp'),
			entry('2b-coffee', 'Coffee with oat milk', '1 mug'),
		],
	},
	{
		id: '2d',
		day: '2026-10-25',
		meal: 'dinner',
		entries: [entry('2d-salmon', 'Salmon, baked', '180 g'), entry('2d-quinoa', 'Quinoa, cooked', '1 cup')],
	},
];

export const USUAL: NonNullable<RambleRequest['usual']> = [
	entry('u-pancake', 'Protein pancakes (homemade)', '2 pancakes'),
	entry('u-coffee', 'Coffee with oat milk', '1 mug'),
	entry('u-bar', 'Barebells Protein Bar, Salty Peanut', '1 bar'),
	entry('u-shake', 'Whey protein shake', '1 scoop'),
	entry('u-kefir', 'Kefir, plain', '200 ml'),
];

/** What the phone's search would show for a plain "pizza", top 5 then expanded to 10. */
export const PIZZA_TOP5 = [
	'Pizza, cheese topping, regular crust, frozen, cooked',
	'Pizza Hut 14" Cheese Pizza, Hand-Tossed Crust',
	'Pizza, meat and vegetable topping, regular crust, frozen, cooked',
	'Domino\'s 14" Cheese Pizza, Classic Hand-Tossed Crust',
	'Pizza, cheese topping, thin crust, frozen, cooked',
];
export const PIZZA_TOP10 = [
	...PIZZA_TOP5,
	'Pizza, pepperoni topping, regular crust, frozen, cooked',
	'Little Caesars 14" Pepperoni Pizza, Large Deep Dish Crust',
	'Pizza, cheese topping, rising crust, frozen, cooked',
	'Papa John\'s 14" Pepperoni Pizza, Original Crust',
	'Pizza, meat topping, thick crust, frozen, cooked',
];
export const MILK_TOP5 = [
	'Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D',
	'Milk, whole, 3.25% milkfat, with added vitamin D',
	'Milk, lowfat, fluid, 1% milkfat, with added vitamin A and vitamin D',
	'Milk, nonfat, fluid, with added vitamin A and vitamin D (fat free or skim)',
	'Milk, chocolate, fluid, commercial, reduced fat',
];
