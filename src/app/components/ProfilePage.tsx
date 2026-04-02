import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import {
	getUserStats,
	getQuizResults,
	getCategoryStats,
	getUserPreferences,
	updateUserPreferences,
	getQuizResultDetail,
	getQuizResultsByExercise,
	type UserStats,
	type QuizResultResponse,
	type CategoryStat,
	type UserPreferences,
	type QuizResultDetail,
	type QuizExerciseSummary,
} from '../lib/api';
import { LL_CATEGORIES } from '../../data/types';

type ProfileTab = 'summary' | 'categories' | 'activity' | 'quiz-log' | 'preferences';

const TABS: { id: ProfileTab; label: string }[] = [
	{ id: 'summary', label: 'Summary' },
	{ id: 'categories', label: 'Categories' },
	{ id: 'activity', label: 'Activity' },
	{ id: 'quiz-log', label: 'Quiz Log' },
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
				{activeTab === 'quiz-log' && <QuizLogTab />}
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
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [detailCache, setDetailCache] = useState<Record<string, QuizResultDetail>>({});
	const [detailLoading, setDetailLoading] = useState<string | null>(null);

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

	function handleCardClick(resultId: string) {
		if (expandedId === resultId) {
			setExpandedId(null);
			return;
		}
		setExpandedId(resultId);
		if (detailCache[resultId]) return;
		setDetailLoading(resultId);
		getQuizResultDetail(resultId)
			.then((detail) => setDetailCache((prev) => ({ ...prev, [resultId]: detail })))
			.catch(() => {})
			.finally(() => setDetailLoading(null));
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
			{results.map((r) => {
				const isEndless = r.exerciseId === 'endless';
				const formatLabel = isEndless
					? 'Endless'
					: r.format === 'fill-blanks'
						? 'Fill in the Blanks'
						: r.format === 'sequence-ordering'
							? 'Sequence Ordering'
						: r.format === 'letter-by-letter'
							? 'Letter by Letter'
							: 'Text Entry';
				const isExpanded = expandedId === r.id;
				const detail = detailCache[r.id] ?? null;
				const isLoadingDetail = detailLoading === r.id;

				return (
					<div key={r.id} className="bg-surface-raised rounded-xl overflow-hidden">
						<button
							onClick={() => handleCardClick(r.id)}
							className="w-full text-left p-4 hover:bg-surface-hover transition-all duration-200 group"
						>
							<div className="flex items-center justify-between mb-1">
								<span className="font-medium group-hover:text-accent transition-colors">{r.exerciseName}</span>
								<div className="flex items-center gap-2 shrink-0 ml-3">
									<span className="text-sm font-semibold text-accent">{r.score}/{r.total}</span>
									<span className={`text-text-tertiary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
										&#8964;
									</span>
								</div>
							</div>
							<div className="flex items-center justify-between text-sm text-text-tertiary">
								<span>{formatLabel}</span>
								<span>{formatDate(r.completedAt)}</span>
							</div>
						</button>

						{isExpanded && (
							<div className="border-t border-border-subtle px-4 pb-4 pt-3">
								{isLoadingDetail ? (
									<p className="text-sm text-text-tertiary text-center py-4">Loading...</p>
								) : detail ? (
									<ActivityDetail detail={detail} />
								) : (
									<p className="text-sm text-text-tertiary text-center py-4">Failed to load details.</p>
								)}
							</div>
						)}
					</div>
				);
			})}
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

function ActivityDetail({ detail }: { detail: QuizResultDetail }) {
	const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

	const toggleExpanded = (id: string) => {
		setExpanded((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});
	};

	return (
		<div className="space-y-1">
			{detail.items.map((item) => {
				const missed = detail.format === 'fill-blanks' && !item.userAnswer;
				const isExpanded = expanded.has(item.itemId);
				return (
					<div
						key={item.itemId}
						onClick={() => toggleExpanded(item.itemId)}
						className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 py-2 border-b border-border-subtle last:border-0 cursor-pointer hover:bg-surface-hover"
					>
						<div className="min-w-0">
							<p className={`text-sm font-medium ${isExpanded ? '' : 'truncate'}`}>{item.prompt}</p>
							<p className={`text-xs text-text-tertiary ${isExpanded ? '' : 'truncate'}`}>
								<span className="text-text-secondary">Answer:</span> {item.correctAnswer}
							</p>
							{missed ? (
								<p className="text-xs text-text-tertiary italic">Not answered</p>
							) : (
								<p className={`text-xs text-text-tertiary ${isExpanded ? '' : 'truncate'}`}>
									<span className="text-text-secondary">You said:</span> {item.userAnswer || <span className="italic">blank</span>}
								</p>
							)}
							{typeof item.hintsUsed === 'number' && item.hintsUsed > 0 && (
								<p className="text-xs text-text-tertiary">
									<span className="text-text-secondary">Hints used:</span> {item.hintsUsed}
								</p>
							)}
						</div>
						<div className="flex items-center gap-2">
							<span className="text-xs text-text-tertiary">{isExpanded ? '▼' : '▶'}</span>
							{missed ? (
								<span className="text-base font-bold text-red-400">&#x2715;</span>
							) : item.correct ? (
								<span className="text-base font-bold text-green-400">&#x2713;</span>
							) : (
								<span className="text-base font-bold text-red-400">&#x2715;</span>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}

// === Quiz Log Tab ===

function QuizLogTab() {
	const auth = useAuth();
	const [exercises, setExercises] = useState<QuizExerciseSummary[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!auth.authenticated) return;
		getQuizResultsByExercise()
			.then((data) => setExercises(data.exercises))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [auth.authenticated]);

	if (loading) return <TabLoading />;

	if (exercises.length === 0) {
		return (
			<div className="animate-in bg-surface-raised rounded-2xl p-8 text-center">
				<p className="text-text-secondary mb-2">No quiz results yet.</p>
				<a href="#/" className="text-action hover:text-action-hover font-medium">Start a quiz</a>
			</div>
		);
	}

	return (
		<div className="animate-in space-y-3">
			{/* Desktop table */}
			<div className="hidden sm:block">
				<div className="bg-surface-raised rounded-xl overflow-hidden">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border-subtle text-text-tertiary text-left">
								<th className="px-4 py-3 font-medium">Exercise</th>
								<th className="px-4 py-3 font-medium">Category</th>
								<th className="px-4 py-3 font-medium text-right">Last Score</th>
								<th className="px-4 py-3 font-medium text-right">Best Score</th>
								<th className="px-4 py-3 font-medium text-right">Taken</th>
								<th className="px-4 py-3 font-medium text-right">Last Taken</th>
							</tr>
						</thead>
						<tbody>
							{exercises.map((ex) => {
								const lastPct = ex.mostRecentTotal > 0
									? Math.round((ex.mostRecentScore / ex.mostRecentTotal) * 100)
									: 0;
								const bestPct = ex.bestTotal > 0
									? Math.round((ex.bestScore / ex.bestTotal) * 100)
									: 0;
								const category = ex.category.charAt(0).toUpperCase() + ex.category.slice(1).replace(/-/g, ' ');
								return (
									<tr key={ex.exerciseId} className="border-b border-border-subtle last:border-0 hover:bg-surface-hover transition-colors">
										<td className="px-4 py-3">
											<a href={`#/exercise/${ex.exerciseId}?mode=quiz`} className="font-medium hover:text-accent transition-colors">
												{ex.exerciseName}
											</a>
										</td>
										<td className="px-4 py-3 text-text-tertiary">{category}</td>
										<td className="px-4 py-3 text-right">
											<span className="font-semibold">{ex.mostRecentScore}/{ex.mostRecentTotal}</span>
											<span className="text-text-tertiary ml-1">({lastPct}%)</span>
										</td>
										<td className="px-4 py-3 text-right">
											<span className="font-semibold">{ex.bestScore}/{ex.bestTotal}</span>
											<span className="text-text-tertiary ml-1">({bestPct}%)</span>
										</td>
										<td className="px-4 py-3 text-right text-text-secondary">{ex.timesTaken}</td>
										<td className="px-4 py-3 text-right text-text-tertiary">{formatDate(ex.lastTaken)}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			{/* Mobile cards */}
			<div className="sm:hidden space-y-3">
				{exercises.map((ex) => {
					const lastPct = ex.mostRecentTotal > 0
						? Math.round((ex.mostRecentScore / ex.mostRecentTotal) * 100)
						: 0;
					const bestPct = ex.bestTotal > 0
						? Math.round((ex.bestScore / ex.bestTotal) * 100)
						: 0;
					const category = ex.category.charAt(0).toUpperCase() + ex.category.slice(1).replace(/-/g, ' ');
					return (
						<a
							key={ex.exerciseId}
							href={`#/exercise/${ex.exerciseId}?mode=quiz`}
							className="block bg-surface-raised rounded-xl p-4 hover:bg-surface-hover transition-all duration-200"
						>
							<div className="flex items-center justify-between mb-2">
								<span className="font-medium truncate">{ex.exerciseName}</span>
								<span className="text-sm font-semibold text-accent shrink-0 ml-2">
									{ex.mostRecentScore}/{ex.mostRecentTotal}
								</span>
							</div>
							<div className="grid grid-cols-3 gap-2 text-xs text-text-tertiary">
								<span>{category}</span>
								<span className="text-center">Best: {bestPct}%</span>
								<span className="text-right">{ex.timesTaken}x · {formatDate(ex.lastTaken)}</span>
							</div>
						</a>
					);
				})}
			</div>
		</div>
	);
}

// === Preferences Tab ===

function PreferencesTab() {
	const auth = useAuth();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [weights, setWeights] = useState<Record<string, number>>({});
	const [savedWeights, setSavedWeights] = useState<Record<string, number>>({});
	const [status, setStatus] = useState<string | null>(null);

	useEffect(() => {
		if (!auth.authenticated) return;
		getUserPreferences()
			.then((prefs) => {
				const merged = mergeWithDefaultWeights(prefs);
				setWeights(merged);
				setSavedWeights(merged);
			})
			.catch(() => {
				const defaults = getDefaultWeights();
				setWeights(defaults);
				setSavedWeights(defaults);
			})
			.finally(() => setLoading(false));
	}, [auth.authenticated]);

	if (loading) return <TabLoading />;

	const hasChanges = JSON.stringify(weights) !== JSON.stringify(savedWeights);

	function handleWeightChange(categoryId: string, rawValue: string) {
		const parsed = Number(rawValue);
		const nextValue = Number.isFinite(parsed) ? Math.min(10, Math.max(0, parsed)) : 0;
		setWeights((prev) => ({ ...prev, [categoryId]: nextValue }));
		setStatus(null);
	}

	async function handleSave() {
		setSaving(true);
		setStatus(null);
		try {
			const payload: UserPreferences = { categoryWeights: weights };
			const saved = await updateUserPreferences(payload);
			const merged = mergeWithDefaultWeights(saved);
			setWeights(merged);
			setSavedWeights(merged);
			setStatus('Saved.');
		} catch {
			setStatus('Failed to save. Try again.');
		} finally {
			setSaving(false);
		}
	}

	function handleReset() {
		const defaults = getDefaultWeights();
		setWeights(defaults);
		setStatus(null);
	}

	return (
		<div className="animate-in bg-surface-raised rounded-2xl p-5 sm:p-6">
			<div className="mb-4">
				<h3 className="text-lg font-semibold">Category mix</h3>
				<p className="text-sm text-text-secondary mt-1">
					Set how likely each category is to appear in Random Quiz and Endless mode.
				</p>
				<p className="text-xs text-text-tertiary mt-1">
					Use 0 to disable a category. Higher values (up to 10) make it appear more often.
				</p>
			</div>

			<div className="space-y-3">
				{LL_CATEGORIES.map((cat) => {
					const value = weights[cat.id] ?? 1;
					return (
						<label key={cat.id} className="flex items-center gap-3 bg-surface-bright rounded-xl px-3 py-2.5">
							<span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
							<span className="flex-1 text-sm sm:text-base">{cat.name}</span>
							<input
								type="range"
								min={0}
								max={10}
								step={1}
								value={value}
								onChange={(e) => handleWeightChange(cat.id, e.target.value)}
								className="w-32 sm:w-40 accent-accent"
							/>
							<span className="w-6 text-right text-sm font-medium text-text-secondary">{value}</span>
						</label>
					);
				})}
			</div>

			<div className="flex flex-wrap gap-3 mt-5">
				<button
					onClick={handleSave}
					disabled={!hasChanges || saving}
					className="bg-action hover:bg-action-hover disabled:bg-surface-bright disabled:text-text-tertiary text-white px-4 py-2 rounded-xl font-medium transition-all duration-200"
				>
					{saving ? 'Saving...' : 'Save preferences'}
				</button>
				<button
					onClick={handleReset}
					disabled={saving}
					className="bg-surface-bright hover:bg-surface-hover text-text-secondary px-4 py-2 rounded-xl font-medium transition-all duration-200"
				>
					Reset to equal weights
				</button>
				{status && <span className="text-sm text-text-tertiary self-center">{status}</span>}
			</div>
		</div>
	);
}

function getDefaultWeights(): Record<string, number> {
	return Object.fromEntries(LL_CATEGORIES.map((cat) => [cat.id, 1]));
}

function mergeWithDefaultWeights(preferences: UserPreferences): Record<string, number> {
	const defaults = getDefaultWeights();
	for (const [categoryId, value] of Object.entries(preferences.categoryWeights || {})) {
		if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10) {
			defaults[categoryId] = value;
		}
	}
	return defaults;
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
