import { useEffect, useMemo, useRef, useState } from 'react';
import {
	checkAnswer,
	submitQuizResult,
	type ExerciseSummary,
	type PublicItem,
	type SequenceOrderingCheckResult,
} from '../lib/api';
import { useAuth } from '../lib/auth-context';

interface Props {
	exercise: ExerciseSummary;
	items: PublicItem[];
	exercisePath: string;
	nextExercisePath: string | null;
	nextNodePath: string | null;
}

interface PlacementSummary {
	itemId: string;
	label: string;
	correct: boolean;
	expectedPosition: number;
	userPosition: number;
}

function shuffleArray<T>(arr: T[]): T[] {
	const copy = [...arr];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

function getSequenceLabel(item: PublicItem): string {
	return item.data?.label || item.data?.cardBack || item.data?.prompt || item.id;
}

function reorderByMove(ids: string[], fromIdx: number, toIdx: number): string[] {
	if (fromIdx < 0 || toIdx < 0 || fromIdx >= ids.length || toIdx >= ids.length || fromIdx === toIdx) return ids;
	const next = [...ids];
	const [moved] = next.splice(fromIdx, 1);
	next.splice(toIdx, 0, moved);
	return next;
}

export function SequenceOrderingQuiz({ exercise, items, exercisePath, nextExercisePath, nextNodePath }: Props) {
	const auth = useAuth();
	const [order, setOrder] = useState<string[]>([]);
	const [checking, setChecking] = useState(false);
	const [result, setResult] = useState<SequenceOrderingCheckResult | null>(null);
	const [dragItemId, setDragItemId] = useState<string | null>(null);
	const startTimeRef = useRef<number>(Date.now());
	const submittedRef = useRef(false);
	const [lastResultId, setLastResultId] = useState<string | null>(null);
	const [retryContext, setRetryContext] = useState<{ isRetry: boolean; parentResultId: string | null }>({ isRetry: false, parentResultId: null });
	const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
	const timerDoneRef = useRef(false);

	const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
	const prompt = exercise.config?.prompt || 'Arrange these items in the correct order.';
	const timeLimit = typeof exercise.config?.timeLimitSeconds === 'number' && exercise.config.timeLimitSeconds > 0
		? exercise.config.timeLimitSeconds
		: null;
	const isTimed = exercise.config?.timed === true || timeLimit !== null;

	useEffect(() => {
		setOrder(shuffleArray(items.map((item) => item.id)));
		setChecking(false);
		setResult(null);
		setDragItemId(null);
		startTimeRef.current = Date.now();
		submittedRef.current = false;
		setLastResultId(null);
		setRetryContext({ isRetry: false, parentResultId: null });
		timerDoneRef.current = false;
		setSecondsLeft(timeLimit);
	}, [items, timeLimit]);

	useEffect(() => {
		if (!isTimed || timeLimit === null || result || timerDoneRef.current) return;
		const deadline = Date.now() + timeLimit * 1000;
		const intervalId = window.setInterval(() => {
			const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
			setSecondsLeft(next);
			if (next === 0 && !timerDoneRef.current) {
				timerDoneRef.current = true;
				void handleCheck();
			}
		}, 250);
		return () => window.clearInterval(intervalId);
	}, [isTimed, timeLimit, result, order]);

	useEffect(() => {
		if (!result || !auth.authenticated || submittedRef.current) return;
		submittedRef.current = true;
		const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
		const details = result.placements.map((placement) => ({
			itemId: placement.itemId,
			correct: placement.correct,
			userAnswer: `#${placement.userPosition}`,
			fuzzyMatch: false,
		}));
		void submitQuizResult({
			exerciseId: exercisePath,
			exerciseName: exercise.name,
			format: 'sequence-ordering',
			score: result.correctCount,
			total: result.total,
			durationSeconds,
			itemsDetail: details,
			isRetry: retryContext.isRetry,
			parentResultId: retryContext.parentResultId || undefined,
		}).then((saved) => setLastResultId(saved.id)).catch(() => {});
	}, [result, auth.authenticated, exercisePath, exercise.name, retryContext]);

	const placementSummary: PlacementSummary[] = useMemo(() => {
		if (!result) return [];
		return result.placements.map((placement) => ({
			itemId: placement.itemId,
			label: getSequenceLabel(byId.get(placement.itemId) || ({ id: placement.itemId, data: {} } as PublicItem)),
			correct: placement.correct,
			expectedPosition: placement.expectedPosition,
			userPosition: placement.userPosition,
		}));
	}, [result, byId]);

	function moveItem(fromIdx: number, toIdx: number) {
		setOrder((prev) => reorderByMove(prev, fromIdx, toIdx));
	}

	function handleKeyMove(e: React.KeyboardEvent<HTMLDivElement>, idx: number) {
		if (result || checking) return;
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			moveItem(idx, idx - 1);
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			moveItem(idx, idx + 1);
		}
	}

	async function handleCheck() {
		if (checking || result) return;
		setChecking(true);
		const check = await checkAnswer(exercisePath, { order }) as SequenceOrderingCheckResult;
		setResult(check);
		setChecking(false);
	}

	function handleRetake() {
		const parentId = lastResultId;
		setOrder(shuffleArray(items.map((item) => item.id)));
		setResult(null);
		setChecking(false);
		setDragItemId(null);
		startTimeRef.current = Date.now();
		submittedRef.current = false;
		timerDoneRef.current = false;
		setSecondsLeft(timeLimit);
		setRetryContext({ isRetry: true, parentResultId: parentId });
	}

	const nodeId = exercise.nodeId;
	const progressText = result ? `${result.correctCount} / ${result.total}` : `0 / ${items.length}`;

	return (
		<div className="animate-in">
			<div className="flex items-center gap-3 mb-4">
				<a href={`#/node/${nodeId}`} className="text-text-tertiary hover:text-text-primary transition-colors">&larr;</a>
				<h2 className="text-lg font-semibold flex-1 tracking-tight">{exercise.name}</h2>
				<span className="text-sm text-text-tertiary font-medium">{progressText}</span>
			</div>

			<div className="bg-surface-raised rounded-2xl p-5 sm:p-8">
				<div className="flex flex-wrap items-center justify-between gap-3 mb-4">
					<div className="text-base sm:text-lg font-medium">{prompt}</div>
					{isTimed && (
						<div className={`text-sm font-semibold px-3 py-1.5 rounded-lg ${secondsLeft !== null && secondsLeft <= 10 ? 'bg-incorrect-bg text-incorrect' : 'bg-surface-bright text-text-secondary'}`}>
							Time: {secondsLeft ?? 0}s
						</div>
					)}
				</div>

				<div className="space-y-2 mb-5">
					{order.map((itemId, idx) => {
						const item = byId.get(itemId);
						const label = item ? getSequenceLabel(item) : itemId;
						return (
							<div
								key={itemId}
								draggable={!result}
								onDragStart={() => setDragItemId(itemId)}
								onDragOver={(e) => e.preventDefault()}
								onDrop={(e) => {
									e.preventDefault();
									if (!dragItemId || result) return;
									const fromIdx = order.indexOf(dragItemId);
									moveItem(fromIdx, idx);
									setDragItemId(null);
								}}
								className="rounded-xl border border-border-subtle bg-surface-bright px-3 py-2 flex items-center gap-2"
							>
								<div
									tabIndex={result ? -1 : 0}
									onKeyDown={(e) => handleKeyMove(e, idx)}
									className="flex-1 flex items-center gap-3 min-w-0 outline-none focus:ring-1 focus:ring-accent/40 rounded"
								>
									<span className="text-sm text-text-tertiary w-7 text-right">#{idx + 1}</span>
									<span className="font-medium truncate">{label}</span>
								</div>
								<div className="flex items-center gap-1 shrink-0">
									<button
										type="button"
										onClick={() => moveItem(idx, idx - 1)}
										disabled={result !== null || idx === 0}
										className="px-2 py-1 rounded-lg text-xs bg-surface-raised hover:bg-surface-hover disabled:opacity-50"
									>
										Up
									</button>
									<button
										type="button"
										onClick={() => moveItem(idx, idx + 1)}
										disabled={result !== null || idx === order.length - 1}
										className="px-2 py-1 rounded-lg text-xs bg-surface-raised hover:bg-surface-hover disabled:opacity-50"
									>
										Down
									</button>
								</div>
							</div>
						);
					})}
				</div>

				{result ? (
					<div>
						<div className={`rounded-xl p-5 mb-4 border ${result.correct ? 'bg-correct-bg border-correct-border' : 'bg-incorrect-bg border-incorrect-border'}`}>
							<div className="font-semibold mb-2">
								{result.correct ? 'Perfect order!' : `Score: ${result.correctCount} / ${result.total}`}
							</div>
							{!result.correct && (
								<ul className="text-sm text-text-secondary list-disc list-outside ml-4 space-y-1">
									{placementSummary.filter((p) => !p.correct).map((p) => (
										<li key={p.itemId}>
											{p.label}: you placed #{p.userPosition}, correct is #{p.expectedPosition}
										</li>
									))}
								</ul>
							)}
						</div>
						<div className="flex flex-wrap gap-3">
							<button onClick={handleRetake} className="bg-action hover:bg-action-hover text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
								Retake
							</button>
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
				) : (
					<div className="flex flex-wrap items-center gap-3">
						<button
							onClick={() => void handleCheck()}
							disabled={checking || order.length === 0}
							className="bg-action hover:bg-action-hover text-white disabled:bg-surface-bright disabled:text-text-tertiary px-5 py-2.5 rounded-xl font-medium transition-all duration-200"
						>
							{checking ? 'Checking...' : 'Check Order'}
						</button>
						<span className="text-sm text-text-tertiary">Tip: drag items, tap Up/Down, or use Arrow Up/Down on a focused row.</span>
					</div>
				)}
			</div>
		</div>
	);
}
