import { useState, useEffect } from 'react';
import { getRandomExerciseId, getAuthMe, type AuthState } from './lib/api';
import { Dashboard } from './components/Dashboard';
import { NodeView } from './components/NodeView';
import { ExerciseView } from './components/ExerciseView';

type Route =
	| { page: 'dashboard' }
	| { page: 'node'; path: string }
	| { page: 'exercise'; path: string; mode: string };

function parseHash(): Route {
	const hash = window.location.hash.slice(1) || '/';
	const [rawPath, query] = hash.split('?');
	const path = rawPath.replace(/^\//, '');

	if (path.startsWith('node/')) {
		const nodePath = path.slice('node/'.length);
		return { page: 'node', path: nodePath };
	}
	if (path.startsWith('exercise/')) {
		const exercisePath = path.slice('exercise/'.length);
		const params = new URLSearchParams(query || '');
		return { page: 'exercise', path: exercisePath, mode: params.get('mode') || 'quiz' };
	}
	return { page: 'dashboard' };
}

export function App() {
	const [route, setRoute] = useState<Route>(parseHash);
	const [auth, setAuth] = useState<AuthState>({ authenticated: false });

	useEffect(() => {
		const onHash = () => setRoute(parseHash());
		window.addEventListener('hashchange', onHash);
		return () => window.removeEventListener('hashchange', onHash);
	}, []);

	useEffect(() => {
		getAuthMe().then(setAuth).catch(() => {});
	}, []);

	return (
		<div className="min-h-screen bg-surface text-text-primary font-sans">
			<nav className="px-4 sm:px-6 py-4 flex items-center justify-between">
				<a href="#/" className="text-xl font-bold text-accent hover:text-accent-hover transition-colors tracking-tight">
					Trivia Trainer
				</a>
				<div className="flex items-center gap-1">
					<button
						onClick={() => getRandomExerciseId().then((id) => {
							if (id) window.location.hash = `/exercise/${id}?mode=quiz`;
						}).catch(() => {})}
						className="text-sm font-medium text-text-tertiary hover:text-accent transition-colors px-3 py-2 rounded-lg hover:bg-surface-hover"
					>
						Random
					</button>
					{auth.authenticated ? (
						<>
							<span className="text-sm text-text-secondary px-2 hidden sm:inline">{auth.email}</span>
							<a
								href={auth.logoutUrl || '/cdn-cgi/access/logout'}
								className="text-sm font-medium text-text-tertiary hover:text-incorrect transition-colors px-3 py-2 rounded-lg hover:bg-surface-hover"
							>
								Sign Out
							</a>
						</>
					) : auth.loginUrl ? (
						<a
							href={auth.loginUrl}
							className="text-sm font-medium text-action hover:text-action-hover transition-colors px-3 py-2 rounded-lg hover:bg-action-bg"
						>
							Sign In
						</a>
					) : null}
				</div>
			</nav>
			<main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
				{route.page === 'dashboard' && <Dashboard />}
				{route.page === 'node' && <NodeView path={route.path} />}
				{route.page === 'exercise' && <ExerciseView path={route.path} mode={route.mode} />}
			</main>
		</div>
	);
}
