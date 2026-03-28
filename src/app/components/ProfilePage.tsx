import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { getUserStats, getQuizResults, type UserStats, type QuizResultResponse } from '../lib/api';

export function ProfilePage() {
	const auth = useAuth();
	const [stats, setStats] = useState<UserStats | null>(null);
	const [results, setResults] = useState<QuizResultResponse[]>([]);
	const [totalResults, setTotalResults] = useState(0);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!auth.authenticated) {
			setLoading(false);
			return;
		}
		Promise.all([getUserStats(), getQuizResults(20, 0)])
			.then(([s, r]) => {
				setStats(s);
				setResults(r.results);
				setTotalResults(r.total);
			})
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [auth.authenticated]);

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

	if (loading) return <div className="text-center text-text-tertiary py-16">Loading...</div>;

	const accuracy = stats && stats.totalAttempted > 0
		? Math.round((stats.totalCorrect / stats.totalAttempted) * 100)
		: 0;

	function loadMore() {
		getQuizResults(20, results.length)
			.then((r) => setResults((prev) => [...prev, ...r.results]))
			.catch(() => {});
	}

	return (
		<div className="animate-in">
			<div className="mb-8">
				<h2 className="text-3xl font-bold tracking-tight mb-1">Profile</h2>
				<p className="text-text-secondary">{auth.email}</p>
			</div>

			{stats && (
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
					<StatCard label="Quizzes Taken" value={stats.totalQuizzes} />
					<StatCard label="Accuracy" value={`${accuracy}%`} />
					<StatCard label="Questions" value={stats.totalAttempted} />
					<StatCard label="Exercises" value={stats.exercisesCovered} />
				</div>
			)}

			<div>
				<h3 className="text-xl font-semibold mb-4 tracking-tight">Recent Activity</h3>
				{results.length === 0 ? (
					<div className="bg-surface-raised rounded-2xl p-8 text-center">
						<p className="text-text-secondary mb-2">No quiz results yet.</p>
						<a href="#/" className="text-action hover:text-action-hover font-medium">Start a quiz</a>
					</div>
				) : (
					<div className="space-y-3">
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
				)}
			</div>
		</div>
	);
}

function StatCard({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="bg-surface-raised rounded-xl p-4 text-center">
			<div className="text-2xl font-bold text-accent mb-1">{value}</div>
			<div className="text-sm text-text-tertiary">{label}</div>
		</div>
	);
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
