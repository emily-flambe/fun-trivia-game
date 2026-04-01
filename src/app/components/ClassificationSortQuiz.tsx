import { useEffect, useMemo, useRef, useState } from 'react';
import {
	checkAnswer,
	submitQuizResult,
	type ClassificationSortCheckResult,
	type ExerciseSummary,
	type PublicItem,
} from '../lib/api';
import { useAuth } from '../lib/auth-context';

interface Props {
	exercise: ExerciseSummary;
	items: PublicItem[];
	exercisePath: string;
	nextExercisePath: string | null;
	nextNodePath: string | null;
}

const UNASSIGNED_BUCKET = '';

function getItemLabel(item: PublicItem): string {
	return item.data?.label || item.data?.cardBack || item.data?.prompt || item.id;
}

function getValidCategories(item: PublicItem): string[] {
	const singular = typeof item.data?.category === 'string' && item.data.category ? [item.data.category] : [];
	const plural = Array.isArray(item.data?.categories)
		? item.data.categories.filter((c: unknown): c is string => typeof c === 'string' && c.length > 0)
		: [];
	return plural.length > 0 ? plural : singular;
}

function deriveCategories(exercise: ExerciseSummary, items: PublicItem[]): string[] {
	const configCategories = Array.isArray(exercise.config?.categories)
		? exercise.config.categories.filter((c): c is string => typeof c === 'string' && c.length > 0)
		: [];
	if (configCategories.length > 0) return configCategories;

	const categories = new Set<string>();
	for (const item of items) {
		for (const category of getValidCategories(item)) {
			categories.add(category);
		}
	}
	return [...categories].sort((a, b) => a.localeCompare(b));
}

function buildInitialAssignments(items: PublicItem[]): Record<string, string> {
	const assignments: Record<string, string> = {};
	for (const item of items) assignments[item.id] = UNASSIGNED_BUCKET;
	return assignments;
}

export function ClassificationSortQuiz({ exercise, items, exercisePath, nextExercisePath, nextNodePath }: Props) {
	const auth = useAuth();
	const [assignments, setAssignments] = useState<Record<string, string>>({});
	const [checking, setChecking] = useState(false);
	const [result, setResult] = useState<ClassificationSortCheckResult | null>(null);
	const [dragItemId, setDragItemId] = useState<string | null>(null);
	const startTimeRef = useRef<number>(Date.now());
	const submittedRef = useRef(false);
	const [lastResultId, setLastResultId] = useState<string | null>(null);
	const [retryContext, setRetryContext] = useState<{ isRetry: boolean; parentResultId: string | null }>({ isRetry: false, parentResultId: null });
	const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
	const timerDoneRef = useRef(false);

	const categories = useMemo(() => deriveCategories(exercise, items), [exercise, items]);
	const prompt = exercise.config?.prompt || 'Sort each item into the correct category.';
	const feedbackMode = exercise.config?.feedbackMode ?? 'end';
	const timeLimit = typeof exercise.config?.timeLimitSeconds === 'number' && exercise.config.timeLimitSeconds > 0
		? exercise.config.timeLimitSeconds
		: null;
	const isTimed = exercise.config?.timed === true || timeLimit !== null;

	useEffect(() => {
		setAssignments(buildInitialAssignments(items));
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
	}, [isTimed, timeLimit, result, assignments]);

	useEffect(() => {
		if (!result || !auth.authenticated || submittedRef.current) return;
		submittedRef.current = true;
		const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
		const details = result.placements.map((placement) => ({
			itemId: placement.itemId,
			correct: placement.correct,
			userAnswer: placement.userCategory,
			fuzzyMatch: false,
		}));
		void submitQuizResult({
			exerciseId: exercisePath,
			exerciseName: exercise.name,
			format: 'classification-sort',
			score: result.correctCount,
			total: result.total,
			durationSeconds,
			itemsDetail: details,
			isRetry: retryContext.isRetry,
			parentResultId: retryContext.parentResultId || undefined,
		}).then((saved) => setLastResultId(saved.id)).catch(() => {});
	}, [result, auth.authenticated, exercisePath, exercise.name, retryContext]);

	const placementsByItemId = useMemo(
		() => new Map((result?.placements ?? []).map((p) => [p.itemId, p])),
		[result]
	);

	const bucketIds = useMemo(() => [UNASSIGNED_BUCKET, ...categories], [categories]);

	const bucketItems = useMemo(() => {
		const byBucket = new Map<string, PublicItem[]>();
		for (const bucket of bucketIds) byBucket.set(bucket, []);
		for (const item of items) {
			const assigned = assignments[item.id] ?? UNASSIGNED_BUCKET;
			const bucket = categories.includes(assigned) ? assigned : UNASSIGNED_BUCKET;
			byBucket.get(bucket)?.push(item);
		}
		return byBucket;
	}, [bucketIds, items, assignments, categories]);

	const unassignedCount = bucketItems.get(UNASSIGNED_BUCKET)?.length ?? 0;

	function updateAssignment(itemId: string, category: string) {
		if (result) return;
		setAssignments((prev) => ({ ...prev, [itemId]: category }));
	}

	function moveToNextBucket(itemId: string) {
		if (result || categories.length === 0) return;
		setAssignments((prev) => {
			const current = prev[itemId] ?? UNASSIGNED_BUCKET;
			const idx = bucketIds.indexOf(current);
			const next = bucketIds[(idx + 1 + bucketIds.length) % bucketIds.length];
			return { ...prev, [itemId]: next };
		});
	}

	function getItemState(item: PublicItem): { correct: boolean; expectedCategories: string[] } | null {
		if (result) {
			const placement = placementsByItemId.get(item.id);
			if (!placement) return null;
			return { correct: placement.correct, expectedCategories: placement.expectedCategories };
		}
		if (feedbackMode !== 'immediate') return null;
		const assigned = assignments[item.id] ?? UNASSIGNED_BUCKET;
		if (!assigned) return null;
		const expectedCategories = getValidCategories(item);
		return { correct: expectedCategories.includes(assigned), expectedCategories };
	}

	async function handleCheck() {
		if (checking || result || categories.length === 0 || unassignedCount > 0) return;
		setChecking(true);
		const check = await checkAnswer(exercisePath, { assignments }) as ClassificationSortCheckResult;
		setResult(check);
		setChecking(false);
	}

	function handleRetake() {
		const parentId = lastResultId;
		setAssignments(buildInitialAssignments(items));
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
	const progressText = result ? `${result.correctCount} / ${result.total}` : `${items.length - unassignedCount} / ${items.length}`;

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

				{categories.length === 0 ? (
					<div className="rounded-xl p-4 border border-incorrect-border bg-incorrect-bg text-incorrect">
						This exercise has no categories configured.
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
						{bucketIds.map((bucket) => {
							const bucketLabel = bucket || 'Unassigned';
							const cards = bucketItems.get(bucket) ?? [];
							return (
								<div
									key={bucketLabel}
									onDragOver={(e) => e.preventDefault()}
									onDrop={(e) => {
										e.preventDefault();
										if (!dragItemId || result) return;
										updateAssignment(dragItemId, bucket);
										setDragItemId(null);
									}}
									className="rounded-xl border border-border-subtle bg-surface-bright p-3"
								>
									<div className="text-sm font-semibold mb-2">{bucketLabel} ({cards.length})</div>
									<div className="space-y-2 min-h-14">
										{cards.map((item) => {
											const state = getItemState(item);
											return (
												<div
													key={item.id}
													draggable={!result}
													onDragStart={() => setDragItemId(item.id)}
													className={`rounded-lg border px-3 py-2 ${state ? (state.correct ? 'border-correct-border bg-correct-bg' : 'border-incorrect-border bg-incorrect-bg') : 'border-border-subtle bg-surface-raised'}`}
												>
													<div className="font-medium text-sm mb-2">{getItemLabel(item)}</div>
													<div className="flex items-center justify-between gap-2">
														<button
															type="button"
															onClick={() => moveToNextBucket(item.id)}
															disabled={result !== null}
															className="text-xs px-2 py-1 rounded-lg bg-surface-raised hover:bg-surface-hover disabled:opacity-50"
														>
															Move
														</button>
														{state && !state.correct && (
															<span className="text-xs text-incorrect">Correct: {state.expectedCategories.join(' or ')}</span>
														)}
													</div>
												</div>
											);
										})}
									</div>
								</div>
							);
						})}
					</div>
				)}

				{result ? (
					<div>
						<div className={`rounded-xl p-5 mb-4 border ${result.correct ? 'bg-correct-bg border-correct-border' : 'bg-incorrect-bg border-incorrect-border'}`}>
							<div className="font-semibold">
								{result.correct ? 'Perfect sort!' : `Score: ${result.correctCount} / ${result.total}`}
							</div>
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
							disabled={checking || categories.length === 0 || unassignedCount > 0}
							className="bg-action hover:bg-action-hover text-white disabled:bg-surface-bright disabled:text-text-tertiary px-5 py-2.5 rounded-xl font-medium transition-all duration-200"
						>
							{checking ? 'Checking...' : 'Check Sort'}
						</button>
						<span className="text-sm text-text-tertiary">
							{unassignedCount > 0 ? `${unassignedCount} items left to categorize` : 'All items assigned'}
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
