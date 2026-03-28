import { useState, useEffect } from 'react';
import { getRandomExerciseId, getAuthMe, type AuthState } from './lib/api';
import { AuthProvider } from './lib/auth-context';
import { Dashboard } from './components/Dashboard';
import { NodeView } from './components/NodeView';
import { ExerciseView } from './components/ExerciseView';
import { EndlessQuiz } from './components/EndlessQuiz';
import { ProfilePage } from './components/ProfilePage';
import { Sidebar } from './components/Sidebar';

type Route =
	| { page: 'dashboard' }
	| { page: 'node'; path: string }
	| { page: 'exercise'; path: string; mode: string }
	| { page: 'endless' }
	| { page: 'profile'; tab: string };

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
	if (path === 'endless') {
		return { page: 'endless' };
	}
	if (path === 'profile' || path.startsWith('profile/')) {
		const tab = path.slice('profile'.length).replace(/^\//, '') || 'summary';
		return { page: 'profile', tab };
	}
	return { page: 'dashboard' };
}

export function App() {
	const [route, setRoute] = useState<Route>(parseHash);
	const [auth, setAuth] = useState<AuthState>({ authenticated: false });
	const [sidebarOpen, setSidebarOpen] = useState(false);

	useEffect(() => {
		const onHash = () => setRoute(parseHash());
		window.addEventListener('hashchange', onHash);
		return () => window.removeEventListener('hashchange', onHash);
	}, []);

	useEffect(() => {
		getAuthMe().then(setAuth).catch(() => {});
	}, []);

	const activePath = (route.page === 'node' || route.page === 'exercise') ? route.path : null;
	const activeType = route.page === 'node' ? 'node' as const
		: route.page === 'exercise' ? 'exercise' as const
		: null;
	const activeMode = route.page === 'exercise' ? route.mode : null;

	return (
		<AuthProvider value={auth}>
		<div className="h-screen flex flex-col bg-surface text-text-primary font-sans">
			{/* Top navigation bar */}
			<nav className="shrink-0 px-4 sm:px-6 py-3 flex items-center border-b border-border-subtle">
				<button
					onClick={() => setSidebarOpen(true)}
					className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-hover text-text-secondary -ml-1 mr-2"
					aria-label="Open navigation"
				>
					<svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
						<path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
					</svg>
				</button>
				<a href="#/" className="text-xl font-bold text-accent hover:text-accent-hover transition-colors tracking-tight">
					Trivia Trainer
				</a>
				<div className="flex items-center gap-1 ml-auto">
					<a
						href="#/endless"
						className="text-sm font-medium text-text-tertiary hover:text-accent transition-colors px-3 py-2 rounded-lg hover:bg-surface-hover"
					>
						Endless
					</a>
					<button
						onClick={() => getRandomExerciseId().then((id) => {
							if (id) window.location.hash = `/exercise/${id}?mode=quiz`;
						}).catch(() => {})}
						className="text-sm font-medium text-text-tertiary hover:text-accent transition-colors px-3 py-2 rounded-lg hover:bg-surface-hover"
					>
						Random Quiz
					</button>
					{auth.authenticated ? (
						<>
							<a
								href="#/profile"
								className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-hover text-text-secondary hover:text-accent transition-colors sm:hidden"
								aria-label="Profile"
							>
								<svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
									<circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
									<path d="M3 18c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
								</svg>
							</a>
							<a
								href="#/profile"
								className="text-sm text-text-secondary hover:text-accent transition-colors px-2 hidden sm:inline"
							>
								{auth.email}
							</a>
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

			{/* Sidebar + main content */}
			<div className="flex flex-1 min-h-0">
				<Sidebar
					activePath={activePath}
					activeType={activeType}
					activeMode={activeMode}
					isOpen={sidebarOpen}
					onClose={() => setSidebarOpen(false)}
				/>
				<main className="flex-1 overflow-y-auto min-w-0">
					<div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
						{route.page === 'dashboard' && <Dashboard />}
						{route.page === 'node' && <NodeView path={route.path} />}
						{route.page === 'exercise' && <ExerciseView path={route.path} mode={route.mode} />}
						{route.page === 'endless' && <EndlessQuiz />}
						{route.page === 'profile' && <ProfilePage tab={route.tab} />}
					</div>
				</main>
			</div>
		</div>
		</AuthProvider>
	);
}
