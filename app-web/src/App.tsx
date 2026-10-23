import { RocketLaunch } from '@phosphor-icons/react';

export default function App() {
	return (
		<main className='flex min-h-screen items-center justify-center bg-slate-100 p-6'>
			<section className='w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm'>
				<div className='mb-5 flex items-center gap-2'>
					<RocketLaunch size={22} weight='duotone' />
					<h1 className='text-lg font-semibold text-slate-950'>Example Page</h1>
				</div>

				<div className='space-y-3 text-sm text-slate-700'>
					<p>
						<code className='rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-900'>@phosphor-icons/react</code>{' '}
						is installed. Replace{' '}
						<code className='rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-900'>RocketLaunch</code> with any
						icon from the Phosphor Icons catalog.
					</p>
					<div className='rounded-lg border border-slate-200 bg-white p-4 shadow-sm'>
						Tailwind CSS utilities are enabled in this template.
					</div>
					<div className='flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-white'>
						<RocketLaunch size={18} weight='fill' />
						<span>Tailwind utility classes are active.</span>
					</div>
					<div className='flex items-center gap-2'>
						<RocketLaunch size={24} weight='fill' />
						<span>Phosphor icon rendering works in this template.</span>
					</div>
				</div>
			</section>
		</main>
	);
}
