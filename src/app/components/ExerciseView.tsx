import { useEffect, useState } from 'react';
import { getExercise, type ExerciseDetail } from '../lib/api';
import { LearnGrid } from './LearnGrid';
import { PeriodicTable } from './PeriodicTable';
import { TextEntryQuiz } from './TextEntryQuiz';
import { FillBlanksQuiz } from './FillBlanksQuiz';

export function ExerciseView({ path, mode }: { path: string; mode: string }) {
	const [data, setData] = useState<ExerciseDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		setLoading(true);
		setError(false);
		getExercise(path)
			.then(setData)
			.catch(() => setError(true))
			.finally(() => setLoading(false));
	}, [path]);

	if (loading) return <div className="text-center text-text-tertiary py-16">Loading...</div>;
	if (error || !data) return <div className="text-center text-incorrect py-16">Exercise not found</div>;

	const { exercise, items } = data;
	const nodeId = exercise.nodeId;

	if (mode === 'learn') {
		if (exercise.displayType === 'periodic-table') {
			return (
				<div className="animate-in">
					<div className="flex items-center gap-3 mb-2">
						<a href={`#/node/${nodeId}`} className="text-text-tertiary hover:text-text-primary transition-colors">&larr;</a>
						<h2 className="text-lg font-semibold flex-1 tracking-tight">{exercise.name}</h2>
					</div>
					<div className="flex items-center gap-2 mb-6 justify-end">
						<a
							href={`#/exercise/${path}?mode=quiz`}
							className="bg-action hover:bg-action-hover text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
						>
							Quiz Me
						</a>
					</div>
					<PeriodicTable items={items} />
				</div>
			);
		}
		return <LearnGrid exercise={exercise} items={items} exercisePath={path} />;
	}

	if (exercise.format === 'fill-blanks') {
		return <FillBlanksQuiz exercise={exercise} items={items} exercisePath={path} />;
	}

	return <TextEntryQuiz exercise={exercise} items={items} exercisePath={path} mode={mode} />;
}
