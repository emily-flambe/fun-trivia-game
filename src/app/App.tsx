import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { CategoryView } from './components/CategoryView';
import { QuizView } from './components/QuizView';
import { LearnView } from './components/LearnView';

type Route =
	| { page: 'dashboard' }
	| { page: 'category'; id: string }
	| { page: 'quiz'; moduleId: string; mode: string };

function parseHash(): Route {
	const hash = window.location.hash.slice(1) || '/';
	const [path, query] = hash.split('?');
	const parts = path.split('/').filter(Boolean);

	if (parts[0] === 'category' && parts[1]) {
		return { page: 'category', id: parts[1] };
	}
	if (parts[0] === 'quiz' && parts[1]) {
		const params = new URLSearchParams(query || '');
		return { page: 'quiz', moduleId: parts[1], mode: params.get('mode') || 'quiz' };
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
			<main className={`mx-auto px-6 py-8 ${route.page === 'quiz' && route.mode === 'learn' ? 'max-w-6xl' : 'max-w-4xl'}`}>
				{route.page === 'dashboard' && <Dashboard />}
				{route.page === 'category' && <CategoryView categoryId={route.id} />}
				{route.page === 'quiz' && (
					route.mode === 'learn'
						? <LearnView moduleId={route.moduleId} />
						: <QuizView moduleId={route.moduleId} mode={route.mode} />
				)}
			</main>
		</div>
	);
}
