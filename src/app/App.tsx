import { useState, useEffect } from 'react';
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

	useEffect(() => {
		const onHash = () => setRoute(parseHash());
		window.addEventListener('hashchange', onHash);
		return () => window.removeEventListener('hashchange', onHash);
	}, []);

	return (
		<div className="min-h-screen bg-surface text-text-primary font-sans">
			<nav className="px-6 py-4 flex items-center justify-between">
				<a href="#/" className="text-xl font-bold text-accent hover:text-accent-hover transition-colors tracking-tight">
					Trivia Trainer
				</a>
			</nav>
			<main className="max-w-4xl mx-auto px-6 py-8">
				{route.page === 'dashboard' && <Dashboard />}
				{route.page === 'node' && <NodeView path={route.path} />}
				{route.page === 'exercise' && <ExerciseView path={route.path} mode={route.mode} />}
			</main>
		</div>
	);
}
