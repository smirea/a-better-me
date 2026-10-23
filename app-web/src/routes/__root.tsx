import { Outlet, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
	component: function RootComponent() {
		return (
			<main className='min-h-screen'>
				<Outlet />
			</main>
		);
	},
});
