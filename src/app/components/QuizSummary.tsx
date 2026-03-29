import type { ExerciseSummary, PublicItem, CheckAnswerResult } from '../lib/api';
import { ItemImage } from './ItemImage';
import { WikiLinks } from './WikiLinks';

interface AnswerRecord {
	itemId: string;
	correct: boolean;
	userAnswer: string;
	result: CheckAnswerResult;
}

interface Props {
	exercise: ExerciseSummary;
	answers: AnswerRecord[];
	items: PublicItem[];
	exercisePath: string;
	onRepeat: () => void;
	onRetryFailed: () => void;
	nextExercisePath: string | null;
	nextNodePath: string | null;
}

export function QuizSummary({ exercise, answers, items, exercisePath, onRepeat, onRetryFailed, nextExercisePath, nextNodePath }: Props) {
	const nodeId = exercise.nodeId;
	const correct = answers.filter((a) => a.correct).length;
	const total = answers.length;
	const wrong = answers.filter((a) => !a.correct);

	return (
		<div className="animate-in">
			<div className="flex items-center gap-3 mb-6">
				<a href={`#/node/${nodeId}`} className="text-text-tertiary hover:text-text-primary transition-colors">&larr; Back</a>
				<h2 className="text-2xl font-bold tracking-tight">{exercise.name}</h2>
			</div>

			<div className="bg-surface-raised rounded-2xl p-5 sm:p-8 mb-8 text-center">
				<div className="text-5xl font-extrabold mb-2 text-accent">
					{total > 0 ? `${correct} / ${total}` : 'No questions'}
				</div>
				{total > 0 && (
					<div className="text-text-secondary text-lg">
						{Math.round((correct / total) * 100)}% correct
					</div>
				)}
			</div>

			{wrong.length > 0 && (
				<div>
					<h3 className="text-lg font-semibold mb-3">Incorrect Answers</h3>
					<div className="space-y-3">
						{wrong.map((a) => {
							const item = items.find((i) => i.id === a.itemId);
							return (
								<div key={a.itemId} className="bg-surface-raised rounded-xl p-5 border-l-4 border-incorrect">
									{item?.data?.imageUrl && (
										<div className="mb-2">
											<ItemImage imageUrl={item.data.imageUrl} alt={item?.data?.prompt || a.itemId} size="sm" />
										</div>
									)}
									<div className="font-medium mb-1">{item?.data?.prompt || a.itemId}</div>
									<div className="text-sm flex flex-col sm:flex-row sm:gap-2">
										<span className="text-incorrect">Your answer: {a.userAnswer}</span>
										<span className="text-correct">Correct: {a.result.correctAnswer}</span>
									</div>
									<ul className="text-sm text-text-tertiary mt-1 list-disc list-outside ml-4 space-y-0.5">
									{a.result.explanation.split('\\n').map((line, i) => (
										<li key={i}>{line}</li>
									))}
								</ul>
								<WikiLinks links={item?.data?.links} />
								</div>
							);
						})}
					</div>
				</div>
			)}

			<div className="mt-6 flex flex-wrap gap-3">
				<button onClick={onRepeat} className="bg-action hover:bg-action-hover text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
					Retake
				</button>
				{wrong.length > 0 && (
					<button onClick={onRetryFailed} className="bg-surface-bright hover:bg-surface-hover text-accent border border-accent/30 px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
						Retake Failed Only
					</button>
				)}
				{nextExercisePath !== null ? (
					<a href={`#/exercise/${nextExercisePath}?mode=quiz`} className="bg-surface-bright hover:bg-surface-hover text-text-secondary px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
						Next
					</a>
				) : nextNodePath !== null ? (
					<a href={`#/node/${nextNodePath}`} className="bg-surface-bright hover:bg-surface-hover text-text-secondary px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
						Next
					</a>
				) : null}
				<a href="#/" className="bg-surface-bright hover:bg-surface-hover text-text-secondary px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
					Home
				</a>
			</div>
		</div>
	);
}
