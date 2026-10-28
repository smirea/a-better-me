import { describe, expect, test } from 'bun:test';
import { aliases } from './ramble';
import { LiveItems, LiveRambleRequest } from './ramble-live';

const input = LiveRambleRequest.parse({
	today: '2026-10-28',
	time: '08:15',
	meals: [
		{
			id: 'meal-a',
			day: '2026-10-27',
			meal: 'breakfast',
			entries: [
				{ id: 'oats-a', name: 'Oatmeal', serving: '1 cup' },
				{ id: 'berries-a', name: 'Blueberries', serving: '50 g' },
			],
		},
	],
	usual: [{ id: 'pancake-a', name: 'Protein pancake', serving: '2 pancakes' }],
});
const names = aliases({ ...input, transcript: '' });
const brief = (items: LiveItems) =>
	items.outline(input, names).items.map(({ kind, name, amount, unit, ref, copy, except, meal }) => ({
		kind,
		name,
		amount,
		unit,
		ref,
		copy,
		except,
		meal,
	}));

describe('LiveItems', () => {
	test('a correction edits the food it points at', () => {
		const items = new LiveItems();
		items.apply('add_food', { id: '1', name: 'oats', amount: 1, unit: 'cup', meal: 'breakfast' });
		items.apply('add_food', { id: '2', name: 'kefir', amount: 200, unit: 'ml' });
		expect(items.apply('edit_item', { id: '1', amount: 0.5 })).toEqual({ ok: true });
		expect(brief(items)).toEqual([
			{ kind: 'food', name: 'oats', amount: 0.5, unit: 'cup', ref: null, copy: null, except: [], meal: 'breakfast' },
			{ kind: 'food', name: 'kefir', amount: 200, unit: 'ml', ref: null, copy: null, except: [], meal: 'breakfast' },
		]);
	});

	test('a repeated add updates the food instead of adding a twin', () => {
		const items = new LiveItems();
		items.apply('add_food', { id: '1', name: 'Pizza' });
		expect(items.apply('add_food', { id: '2', name: 'pizza', amount: 2, unit: 'slice' })).toEqual({
			id: '1',
			note: 'Already in the list. Do not add it again; use edit_item to change it.',
		});
		expect(brief(items).map(item => [item.name, item.amount, item.unit])).toEqual([['pizza', 2, 'slice']]);
	});

	test('a copy maps its aliases to the phone ids, and a removed item is gone', () => {
		const items = new LiveItems();
		items.apply('add_copy', { id: '1', copy: 'm1', except: ['e2'] });
		items.apply('add_food', { id: '2', name: 'raspberries', amount: 1, unit: 'cup' });
		items.apply('add_food', { id: '3', name: 'pancake', ref: 'u1' });
		items.apply('remove_item', { id: '3' });
		expect(items.apply('edit_item', { id: '9', amount: 1 })).toEqual({ error: 'No item has that id.' });
		expect(brief(items)).toEqual([
			{
				kind: 'copy',
				name: '',
				amount: 0,
				unit: '',
				ref: null,
				copy: 'meal-a',
				except: ['berries-a'],
				meal: 'breakfast',
			},
			{
				kind: 'food',
				name: 'raspberries',
				amount: 1,
				unit: 'cup',
				ref: null,
				copy: null,
				except: [],
				meal: 'breakfast',
			},
		]);
	});
});
