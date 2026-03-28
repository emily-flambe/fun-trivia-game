import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import {
	getUserStats,
	getQuizResults,
	getCategoryStats,
	type UserStats,
	type QuizResultResponse,
	type CategoryStat,
} from '../lib/api';
import { LL_CATEGORIES } from '../../data/types';

type ProfileTab = 'summary' | 'categories' | 'activity' | 'preferences';

const TABS: { id: ProfileTab; label: string }[] = [
	{ id: 'summary', label: 'Summary' },
	{ id: 'categories', label: 'Categories' },
	{ id: 'activity', label: 'Activity' },
	{ id: 'preferences', label: 'Preferences' },
];

export function ProfilePage({ tab }: { tab: string }) {
	const auth = useAuth();
	const activeTab = (TABS.some((t) => t.id === tab) ? tab : 'summary') as ProfileTab;

	if (!auth.authenticated) {
		return (
			<div className="animate-in text-center py-16">
				<h2 className="text-2xl font-bold mb-2">Sign in to view your profile</h2>
				<p className="text-text-secondary mb-4">Track your quiz history and progress across categories.</p>
				{auth.loginUrl && (
					<a href={auth.loginUrl} className="bg-action hover:bg-action-hover text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
						Sign In
					</a>
				)}
			</div>
		);
	}

	return (
		<div className="animate-in">
			<div className="mb-6">
				<h2 className="text-3xl font-bold tracking-tight mb-1">Profile</h2>
				<p className="text-text-secondary">{auth.email}</p>
			</div>

			<nav role="tablist" aria-label="Profile sections" className="flex gap-1 mb-8 border-b border-border-subtle -mx-1 px-1 overflow-x-auto">
				{TABS.map((t) => (
					<a
						key={t.id}
						role="tab"
						aria-selected={activeTab === t.id}
						aria-controls={`tabpanel-${t.id}`}
						href={`#/profile/${t.id}`}
						className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-all duration-200 border-b-2 -mb-px ${
							activeTab === t.id
								? 'border-accent text-accent'
								: 'border-transparent text-text-tertiary hover:text-text-primary hover:border-border-default'
						}`}
					>
						{t.label}
					</a>
				))}
			</nav>

			<div role="tabpanel" id={`tabpanel-${activeTab}`} aria-label={TABS.find((t) => t.id === activeTab)?.label}>
				{activeTab === 'summary' && <SummaryTab />}
				{activeTab === 'categories' && <CategoriesTab />}
				{activeTab === 'activity' && <ActivityTab />}
				{activeTab === 'preferences' && <PreferencesTab />}
			</div>
		</div>
	);
}

// === Summary Tab ===

function SummaryTab() {
	const auth = useAuth();
	const [stats, setStats] = useState<UserStats | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!auth.authenticated) return;
		getUserStats()
			.then(setStats)
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [auth.authenticated]);

	if (loading) return <TabLoading />;

	if (!stats || stats.totalQuizzes === 0) {
		return (
			<div className="animate-in bg-surface-raised rounded-2xl p-8 text-center">
				<p className="text-text-secondary mb-2">No quiz results yet.</p>
				<a href="#/" className="text-action hover:text-action-hover font-medium">Start a quiz</a>
			</div>
		);
	}

	const accuracy = stats.totalAttempted > 0
		? Math.round((stats.totalCorrect / stats.totalAttempted) * 100)
		: 0;

	return (
		<div className="animate-in">
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
				<StatCard label="Quizzes Taken" value={stats.totalQuizzes} />
				<StatCard label="Accuracy" value={`${accuracy}%`} />
				<StatCard label="Questions" value={stats.totalAttempted} />
				<StatCard label="Exercises" value={stats.exercisesCovered} />
			</div>
		</div>
	);
}

// === Categories Tab ===

function CategoriesTab() {
	const auth = useAuth();
	const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!auth.authenticated) return;
		getCategoryStats()
			.then(setCategoryStats)
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [auth.authenticated]);

	if (loading) return <TabLoading />;

	// Build a map from category stats for quick lookup
	const statsMap = new Map(categoryStats.map((s) => [s.category, s]));

	// Merge LL_CATEGORIES with stats — show all 18 categories, even unattempted ones
	const merged = LL_CATEGORIES.map((cat) => {
		const stat = statsMap.get(cat.id);
		return {
			...cat,
			correct: stat?.correct ?? 0,
			attempted: stat?.attempted ?? 0,
			accuracy: stat && stat.attempted > 0
				? Math.round((stat.correct / stat.attempted) * 100)
				: null,
		};
	});

	// Sort: attempted categories first (by accuracy desc), then unattempted (alphabetical)
	const sorted = [...merged].sort((a, b) => {
		if (a.attempted > 0 && b.attempted === 0) return -1;
		if (a.attempted === 0 && b.attempted > 0) return 1;
		if (a.attempted === 0 && b.attempted === 0) return a.name.localeCompare(b.name);
		return (b.accuracy ?? 0) - (a.accuracy ?? 0);
	});

	const attempted = sorted.filter((c) => c.attempted > 0);
	const unattempted = sorted.filter((c) => c.attempted === 0);

	return (
		<div className="animate-in space-y-6">
			{attempted.length === 0 ? (
				<div className="bg-surface-raised rounded-2xl p-8 text-center">
					<p className="text-text-secondary mb-2">No quiz results yet.</p>
					<a href="#/" className="text-action hover:text-action-hover font-medium">Start a quiz</a>
				</div>
			) : (
				<div className="space-y-3">
					{attempted.map((cat) => (
						<CategoryRow key={cat.id} cat={cat} />
					))}
				</div>
			)}

			{unattempted.length > 0 && attempted.length > 0 && (
				<div>
					<h4 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-3">
						Not yet attempted
					</h4>
					<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
						{unattempted.map((cat) => (
							<a
								key={cat.id}
								href={`#/node/${cat.id}`}
								className="flex items-center gap-2.5 bg-surface-raised rounded-xl px-3.5 py-2.5 hover:bg-surface-hover transition-all duration-200 group"
							>
								<span
									className="w-2.5 h-2.5 rounded-full shrink-0 opacity-40 group-hover:opacity-70 transition-opacity"
									style={{ backgroundColor: cat.color }}
								/>
								<span className="text-sm text-text-tertiary group-hover:text-text-secondary transition-colors truncate">
									{cat.name}
								</span>
							</a>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function CategoryRow({ cat }: { cat: { id: string; name: string; color: string; correct: number; attempted: number; accuracy: number | null } }) {
	const pct = cat.accuracy ?? 0;

	return (
		<a
			href={`#/node/${cat.id}`}
			className="block bg-surface-raised rounded-xl p-4 hover:bg-surface-hover transition-all duration-200 group"
		>
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-2.5 min-w-0">
					<span
						className="w-3 h-3 rounded-full shrink-0"
						style={{ backgroundColor: cat.color }}
					/>
					<span className="font-medium group-hover:text-accent transition-colors truncate">
						{cat.name}
					</span>
				</div>
				<div className="flex items-center gap-3 shrink-0 ml-3">
					<span className="text-sm text-text-tertiary">
						{cat.correct}/{cat.attempted}
					</span>
					<span className="text-sm font-semibold min-w-[3ch] text-right" style={{ color: cat.color }}>
						{pct}%
					</span>
				</div>
			</div>
			<div className="h-2 bg-surface-bright rounded-full overflow-hidden">
				<div
					className="h-full rounded-full transition-all duration-500 ease-out"
					style={{
						width: `${pct}%`,
						backgroundColor: cat.color,
						opacity: 0.85,
					}}
				/>
			</div>
		</a>
	);
}

// === Activity Tab ===

function ActivityTab() {
	const auth = useAuth();
	const [results, setResults] = useState<QuizResultResponse[]>([]);
	const [totalResults, setTotalResults] = useState(0);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!auth.authenticated) return;
		getQuizResults(20, 0)
			.then((r) => {
				setResults(r.results);
				setTotalResults(r.total);
			})
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [auth.authenticated]);

	if (loading) return <TabLoading />;

	function loadMore() {
		getQuizResults(20, results.length)
			.then((r) => setResults((prev) => [...prev, ...r.results]))
			.catch(() => {});
	}

	if (results.length === 0) {
		return (
			<div className="animate-in bg-surface-raised rounded-2xl p-8 text-center">
				<p className="text-text-secondary mb-2">No quiz results yet.</p>
				<a href="#/" className="text-action hover:text-action-hover font-medium">Start a quiz</a>
			</div>
		);
	}

	return (
		<div className="animate-in space-y-3">
			{results.map((r) => (
				<a
					key={r.id}
					href={`#/exercise/${r.exerciseId}?mode=quiz`}
					className="block bg-surface-raised rounded-xl p-4 hover:bg-surface-hover transition-all duration-200 group"
				>
					<div className="flex items-center justify-between mb-1">
						<span className="font-medium group-hover:text-accent transition-colors">{r.exerciseName}</span>
						<span className="text-sm font-semibold text-accent">{r.score}/{r.total}</span>
					</div>
					<div className="flex items-center justify-between text-sm text-text-tertiary">
						<span>{r.format === 'fill-blanks' ? 'Fill in the Blanks' : 'Text Entry'}</span>
						<span>{formatDate(r.completedAt)}</span>
					</div>
				</a>
			))}
			{results.length < totalResults && (
				<button
					onClick={loadMore}
					className="w-full text-center text-sm font-medium text-action hover:text-action-hover py-3 rounded-xl hover:bg-surface-hover transition-all duration-200"
				>
					Load more
				</button>
			)}
		</div>
	);
}

// === Preferences Tab ===

function PreferencesTab() {
	return (
		<div className="animate-in bg-surface-raised rounded-2xl p-8 text-center">
			<p className="text-text-secondary">Preferences coming soon.</p>
		</div>
	);
}

// === Shared components ===

function StatCard({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="bg-surface-raised rounded-xl p-4 text-center">
			<div className="text-2xl font-bold text-accent mb-1">{value}</div>
			<div className="text-sm text-text-tertiary">{label}</div>
		</div>
	);
}

function TabLoading() {
	return <div className="text-center text-text-tertiary py-12">Loading...</div>;
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	if (diffMin < 1) return 'Just now';
	if (diffMin < 60) return `${diffMin}m ago`;
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr}h ago`;
	const diffDays = Math.floor(diffHr / 24);
	if (diffDays < 7) return `${diffDays}d ago`;
	return d.toLocaleDateString();
}
