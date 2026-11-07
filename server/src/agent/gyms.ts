import { z } from 'zod';
import type { Db, RowOf } from './db';
import { assertEquipment } from './exercises';
import * as M from './models';
import { route, type Route } from './route';

export function assertGym(db: Db, gymId: string | null | undefined) {
	if (gymId) db.find('gym_profiles', gymId, 'gym');
}

export const gymRoutes: Route[] = [
	route({
		method: 'GET',
		path: '/gyms',
		tag: 'Gyms',
		summary: 'List gym profiles',
		response: z.array(M.Gym),
		run: ({ db }) => db.all('gym_profiles', '1 ORDER BY created_at'),
	}),
	route({
		method: 'GET',
		path: '/gyms/{id}',
		tag: 'Gyms',
		summary: 'Get a gym profile',
		response: M.Gym,
		run: context => context.db.find('gym_profiles', context.params.id!, 'gym'),
	}),
	route({
		method: 'POST',
		path: '/gyms',
		tag: 'Gyms',
		summary: 'Create a gym profile',
		description: 'The first gym becomes the default.',
		body: M.GymCreate,
		response: M.Gym,
		run({ db, body, now }) {
			assertEquipment(Object.keys(body.equipment));
			const others = db.all('gym_profiles');
			const row: RowOf<'gym_profiles'> = {
				id: M.newId(),
				...body,
				isDefault: body.isDefault || !others.length,
				createdAt: now,
				updatedAt: now,
			};
			const demoted = row.isDefault ? others.filter(gym => gym.isDefault) : [];
			db.commit(
				db.put('gym_profiles', row),
				...demoted.map(gym => db.patch('gym_profiles', gym.id, { isDefault: false, updatedAt: now })),
			);
			return row;
		},
	}),
	route({
		method: 'PATCH',
		path: '/gyms/{id}',
		tag: 'Gyms',
		summary: 'Edit a gym profile',
		description: '`equipment` replaces the whole map.',
		body: M.GymPatch,
		response: M.Gym,
		run({ db, params, body, now }) {
			db.find('gym_profiles', params.id!, 'gym');
			if (body.equipment) assertEquipment(Object.keys(body.equipment));
			db.commit(db.patch('gym_profiles', params.id!, { ...body, updatedAt: now }));
			return db.find('gym_profiles', params.id!, 'gym');
		},
	}),
	route({
		method: 'POST',
		path: '/gyms/{id}/default',
		tag: 'Gyms',
		summary: 'Make the gym the default',
		response: M.Gym,
		run({ db, params, now }) {
			const row = db.find('gym_profiles', params.id!, 'gym');
			const changes = db
				.all('gym_profiles')
				.filter(gym => gym.isDefault !== (gym.id === row.id))
				.map(gym => db.patch('gym_profiles', gym.id, { isDefault: gym.id === row.id, updatedAt: now }));
			db.commit(...changes);
			return db.find('gym_profiles', row.id, 'gym');
		},
	}),
	route({
		method: 'DELETE',
		path: '/gyms/{id}',
		tag: 'Gyms',
		summary: 'Delete a gym profile',
		response: M.Deleted,
		run({ db, params }) {
			db.find('gym_profiles', params.id!, 'gym');
			db.commit(db.delete('gym_profiles', params.id!));
			return { deleted: params.id! };
		},
	}),
];
