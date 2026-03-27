import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { CategoryView } from './components/CategoryView';
import { QuizView } from './components/QuizView';

type Route =
	| { page: 'dashboard' }
	| { page: 'category'; id: string }
	| { page: 'quiz'; moduleId: string; mode: string };

function parseHash(): Route {
	const hash = window.location.hash.slice(1) || '/';
	const parts = hash.split('/').filter(Boolean);

	if (parts[0] === 'category' && parts[1]) {
		return { page: 'category', id: parts[1] };
	}
	if (parts[0] === 'quiz' && parts[1]) {
		const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
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
		<div className="min-h-screen bg-slate-900 text-slate-100 font-[system-ui]">
			<nav className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
				<a href="#/" className="text-xl font-bold text-sky-400 hover:text-sky-300 transition-colors">
					Trivia Trainer
				</a>
			</nav>
			<main className="max-w-5xl mx-auto px-4 py-6">
				{route.page === 'dashboard' && <Dashboard />}
				{route.page === 'category' && <CategoryView categoryId={route.id} />}
				{route.page === 'quiz' && <QuizView moduleId={route.moduleId} mode={route.mode} />}
			</main>
		</div>
	);
}
