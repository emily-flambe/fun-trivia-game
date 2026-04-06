import { useEffect, useState } from 'react';
import { getExercise, getNode, type ExerciseDetail, type NodeDetail } from '../lib/api';
import { LearnGrid } from './LearnGrid';
import { MapDisplay } from './MapDisplay';
import { PeriodicTable } from './PeriodicTable';
import { TextEntryQuiz } from './TextEntryQuiz';
import { TextEntryGridQuiz } from './TextEntryGridQuiz';
import { FillBlanksQuiz } from './FillBlanksQuiz';
import { LetterByLetterQuiz } from './LetterByLetterQuiz';
import { SequenceOrderingQuiz } from './SequenceOrderingQuiz';
import { ClassificationSortQuiz } from './ClassificationSortQuiz';

export function ExerciseView({ path, mode }: { path: string; mode: string }) {
	const [data, setData] = useState<ExerciseDetail | null>(null);
	const [nodeData, setNodeData] = useState<NodeDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		setLoading(true);
		setError(false);
		const nodePath = path.split('/').slice(0, -1).join('/');
		getExercise(path)
			.then((exerciseData) => {
				setData(exerciseData);
				if (nodePath) {
					getNode(nodePath).then(setNodeData).catch(() => {});
				}
			})
			.catch(() => setError(true))
			.finally(() => setLoading(false));
	}, [path]);

	if (loading) return <div className="text-center text-text-tertiary py-16">Loading...</div>;
	if (error || !data) return <div className="text-center text-incorrect py-16">Exercise not found</div>;

	const { exercise, items } = data;
	const nodeId = exercise.nodeId;

	// Compute next exercise navigation
	let nextExercisePath: string | null = null;
	let nextNodePath: string | null = null;
	if (nodeData) {
		const sortedExercises = [...nodeData.exercises].sort((a, b) => a.sortOrder - b.sortOrder);
		const currentIdx = sortedExercises.findIndex((e) => e.id === exercise.id);
		if (currentIdx !== -1 && currentIdx + 1 < sortedExercises.length) {
			nextExercisePath = sortedExercises[currentIdx + 1].id;
		} else if (nodeData.node.parentId !== null) {
			nextNodePath = nodeData.node.parentId;
		}
		// If last exercise and no parent, both remain null — Next button will be hidden
	}

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
							href={`#/exercise/${path}?mode=grid`}
							className="text-sm text-text-tertiary hover:text-accent transition-colors px-3 py-2 rounded-lg hover:bg-surface-hover"
						>
							List Quiz
						</a>
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
		if (exercise.displayType === 'map') {
			return (
				<div className="animate-in">
					<div className="flex items-center gap-3 mb-2">
						<a href={`#/node/${nodeId}`} className="text-text-tertiary hover:text-text-primary transition-colors">&larr;</a>
						<h2 className="text-lg font-semibold flex-1 tracking-tight">{exercise.name}</h2>
					</div>
					<div className="flex items-center gap-2 mb-6 justify-end">
						<a
							href={`#/exercise/${path}?mode=grid`}
							className="text-sm text-text-tertiary hover:text-accent transition-colors px-3 py-2 rounded-lg hover:bg-surface-hover"
						>
							List Quiz
						</a>
						<a
							href={`#/exercise/${path}?mode=quiz`}
							className="bg-action hover:bg-action-hover text-white px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200"
						>
							Quiz Me
						</a>
					</div>
					<MapDisplay items={items} exerciseId={exercise.id} />
				</div>
			);
		}
		return <LearnGrid exercise={exercise} items={items} exercisePath={path} />;
	}

	if (exercise.format === 'fill-blanks') {
		return <FillBlanksQuiz exercise={exercise} items={items} exercisePath={path} nextExercisePath={nextExercisePath} nextNodePath={nextNodePath} />;
	}

	if (exercise.format === 'letter-by-letter') {
		return <LetterByLetterQuiz exercise={exercise} items={items} exercisePath={path} nextExercisePath={nextExercisePath} nextNodePath={nextNodePath} />;
	}

	if (exercise.format === 'sequence-ordering') {
		return <SequenceOrderingQuiz exercise={exercise} items={items} exercisePath={path} nextExercisePath={nextExercisePath} nextNodePath={nextNodePath} />;
	}

	if (exercise.format === 'classification-sort') {
		return <ClassificationSortQuiz exercise={exercise} items={items} exercisePath={path} nextExercisePath={nextExercisePath} nextNodePath={nextNodePath} />;
	}

	if (exercise.format === 'text-entry' && mode === 'grid') {
		return <TextEntryGridQuiz exercise={exercise} items={items} exercisePath={path} nextExercisePath={nextExercisePath} nextNodePath={nextNodePath} />;
	}

	return <TextEntryQuiz exercise={exercise} items={items} exercisePath={path} mode={mode} nextExercisePath={nextExercisePath} nextNodePath={nextNodePath} />;
}
