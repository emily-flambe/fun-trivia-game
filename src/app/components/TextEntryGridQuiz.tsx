import { useState, useEffect, useRef, useCallback } from 'react';
import { checkAnswer, submitQuizResult, type ExerciseSummary, type PublicItem, type CheckAnswerResult } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { QuizSummary } from './QuizSummary';

interface AnswerRecord {
	itemId: string;
	correct: boolean;
	userAnswer: string;
	result: CheckAnswerResult;
}

interface ItemState {
	status: 'unanswered' | 'correct' | 'incorrect';
	userAnswer?: string;
	result?: CheckAnswerResult;
}

function shuffleArray<T>(arr: T[]): T[] {
	const copy = [...arr];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

interface Props {
	exercise: ExerciseSummary;
	items: PublicItem[];
	exercisePath: string;
	nextExercisePath: string | null;
	nextNodePath: string | null;
}

export function TextEntryGridQuiz({ exercise, items, exercisePath, nextExercisePath, nextNodePath }: Props) {
	const auth = useAuth();
	const [quizItems, setQuizItems] = useState<PublicItem[]>([]);
	const [itemStates, setItemStates] = useState<Map<string, ItemState>>(new Map());
	const [inputs, setInputs] = useState<Map<string, string>>(new Map());
	const [checkingId, setCheckingId] = useState<string | null>(null);
	const [complete, setComplete] = useState(false);
	const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
	const startTimeRef = useRef<number>(Date.now());
	const submittedRef = useRef(false);
	const [lastResultId, setLastResultId] = useState<string | null>(null);
	const [retryContext, setRetryContext] = useState<{ isRetry: boolean; parentResultId: string | null }>({ isRetry: false, parentResultId: null });

	const initQuiz = useCallback((sourceItems: PublicItem[], retry: { isRetry: boolean; parentResultId: string | null }) => {
		const shuffled = shuffleArray(sourceItems);
		setQuizItems(shuffled);
		setItemStates(new Map(shuffled.map((i) => [i.id, { status: 'unanswered' }])));
		setInputs(new Map(shuffled.map((i) => [i.id, ''])));
		setCheckingId(null);
		setComplete(false);
		startTimeRef.current = Date.now();
		submittedRef.current = false;
		setRetryContext(retry);
	}, []);

	useEffect(() => {
		initQuiz(items, { isRetry: false, parentResultId: null });
	}, [items, initQuiz]);

	// Focus first unanswered input on init
	useEffect(() => {
		if (quizItems.length > 0 && !complete) {
			const first = quizItems.find((i) => itemStates.get(i.id)?.status === 'unanswered');
			if (first) {
				setTimeout(() => inputRefs.current.get(first.id)?.focus(), 50);
			}
		}
	}, [quizItems.length, complete]);

	const answeredCount = Array.from(itemStates.values()).filter((s) => s.status !== 'unanswered').length;
	const correctCount = Array.from(itemStates.values()).filter((s) => s.status === 'correct').length;

	// Build answers for QuizSummary when complete
	const answers: AnswerRecord[] = complete
		? quizItems.map((item) => {
			const state = itemStates.get(item.id);
			return {
				itemId: item.id,
				correct: state?.status === 'correct',
				userAnswer: state?.userAnswer || '',
				result: state?.result || { correct: false, correctAnswer: '', explanation: '', userAnswer: '', fuzzyMatch: false },
			};
		})
		: [];

	// Submit result when complete
	useEffect(() => {
		if (complete && auth.authenticated && !submittedRef.current && quizItems.length > 0) {
			submittedRef.current = true;
			const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
			submitQuizResult({
				exerciseId: exercisePath,
				exerciseName: exercise.name,
				format: 'text-entry',
				score: correctCount,
				total: quizItems.length,
				durationSeconds,
				itemsDetail: quizItems.map((item) => {
					const state = itemStates.get(item.id);
					return {
						itemId: item.id,
						correct: state?.status === 'correct',
						userAnswer: state?.userAnswer || '',
						fuzzyMatch: state?.result?.fuzzyMatch ?? false,
					};
				}),
				isRetry: retryContext.isRetry,
				parentResultId: retryContext.parentResultId || undefined,
			}).then((result) => setLastResultId(result.id)).catch(() => {});
		}
	}, [complete, auth.authenticated]);

	function focusNextUnanswered(afterItemId: string) {
		const idx = quizItems.findIndex((i) => i.id === afterItemId);
		for (let offset = 1; offset < quizItems.length; offset++) {
			const nextItem = quizItems[(idx + offset) % quizItems.length];
			if (itemStates.get(nextItem.id)?.status === 'unanswered') {
				inputRefs.current.get(nextItem.id)?.focus();
				return;
			}
		}
	}

	async function handleSubmitItem(itemId: string) {
		const answer = inputs.get(itemId)?.trim();
		if (!answer || checkingId) return;

		setCheckingId(itemId);
		const result = await checkAnswer(exercisePath, { itemId, answer }) as CheckAnswerResult;
		const newState: ItemState = {
			status: result.correct ? 'correct' : 'incorrect',
			userAnswer: answer,
			result,
		};

		setItemStates((prev) => {
			const next = new Map(prev);
			next.set(itemId, newState);
			const allAnswered = Array.from(next.values()).every((s) => s.status !== 'unanswered');
			if (allAnswered) {
				setTimeout(() => setComplete(true), 300);
			}
			return next;
		});
		setCheckingId(null);
		focusNextUnanswered(itemId);
	}

	function handleGiveUp() {
		const unanswered = quizItems.filter((i) => itemStates.get(i.id)?.status === 'unanswered');
		if (unanswered.length === 0) return;

		Promise.all(
			unanswered.map(async (item) => {
				const result = await checkAnswer(exercisePath, { itemId: item.id, answer: '(gave up)' }) as CheckAnswerResult;
				return { itemId: item.id, result };
			})
		).then((results) => {
			setItemStates((prev) => {
				const next = new Map(prev);
				for (const { itemId, result } of results) {
					next.set(itemId, {
						status: 'incorrect',
						userAnswer: '(gave up)',
						result,
					});
				}
				return next;
			});
			setComplete(true);
		});
	}

	function handleRepeat() {
		const parentId = lastResultId;
		initQuiz(items, { isRetry: true, parentResultId: parentId });
	}

	function handleRetryFailed() {
		const parentId = lastResultId;
		const failedIds = new Set(
			quizItems.filter((i) => itemStates.get(i.id)?.status === 'incorrect').map((i) => i.id)
		);
		const failedItems = items.filter((i) => failedIds.has(i.id));
		initQuiz(failedItems, { isRetry: true, parentResultId: parentId });
	}

	if (complete) {
		return (
			<QuizSummary
				exercise={exercise}
				answers={answers}
				items={quizItems}
				exercisePath={exercisePath}
				onRepeat={handleRepeat}
				onRetryFailed={handleRetryFailed}
				nextExercisePath={nextExercisePath}
				nextNodePath={nextNodePath}
			/>
		);
	}

	const nodeId = exercise.nodeId;
	const progressPct = quizItems.length > 0 ? (answeredCount / quizItems.length) * 100 : 0;

	return (
		<div className="animate-in">
			<div className="flex items-center gap-3 mb-4">
				<a href={`#/node/${nodeId}`} className="text-text-tertiary hover:text-text-primary transition-colors">&larr;</a>
				<h2 className="text-lg font-semibold flex-1 tracking-tight">{exercise.name}</h2>
				<span className="text-sm text-text-tertiary font-medium">{answeredCount} / {quizItems.length}</span>
			</div>

			<div className="h-1 bg-border-subtle rounded-full mb-6">
				<div className="h-1 bg-gradient-to-r from-action to-accent rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
			</div>

			<div className="space-y-2">
				{quizItems.map((item) => {
					const state = itemStates.get(item.id);
					const isAnswered = state?.status !== 'unanswered';
					const isCorrect = state?.status === 'correct';
					const isChecking = checkingId === item.id;

					return (
						<div
							key={item.id}
							className={`rounded-xl p-4 border transition-all duration-200 ${
								isCorrect
									? 'bg-correct-bg border-correct-border'
									: state?.status === 'incorrect'
										? 'bg-incorrect-bg border-incorrect-border'
										: 'bg-surface-raised border-border-subtle'
							}`}
						>
							<div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
								<div className="font-medium text-text-primary sm:w-1/3 sm:min-w-0 sm:flex-shrink-0">
									{item.data?.prompt || item.id}
								</div>
								<div className="flex-1">
									{isAnswered ? (
										<div className="flex items-center gap-2">
											{isCorrect ? (
												<span className="text-correct font-medium">
													{state.userAnswer}{state.result?.fuzzyMatch ? ' (close enough)' : ''}
												</span>
											) : (
												<span className="text-sm">
													<span className="text-incorrect">{state.userAnswer === '(gave up)' ? 'Skipped' : state.userAnswer}</span>
													<span className="text-text-tertiary mx-1">&rarr;</span>
													<span className="text-correct font-medium">{state.result?.correctAnswer}</span>
												</span>
											)}
										</div>
									) : (
										<form
											onSubmit={(e) => {
												e.preventDefault();
												handleSubmitItem(item.id);
											}}
											className="flex gap-2"
										>
											<input
												ref={(el) => { if (el) inputRefs.current.set(item.id, el); }}
												type="text"
												value={inputs.get(item.id) || ''}
												onChange={(e) => setInputs((prev) => {
													const next = new Map(prev);
													next.set(item.id, e.target.value);
													return next;
												})}
												placeholder="Type answer..."
												className="flex-1 bg-surface-bright border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
												autoComplete="off"
												disabled={isChecking}
											/>
											<button
												type="submit"
												disabled={!inputs.get(item.id)?.trim() || isChecking}
												className="bg-action hover:bg-action-hover text-white disabled:bg-surface-bright disabled:text-text-tertiary px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200"
											>
												{isChecking ? '...' : 'Go'}
											</button>
										</form>
									)}
								</div>
							</div>
						</div>
					);
				})}
			</div>

			<div className="mt-4 flex justify-end">
				<button
					onClick={handleGiveUp}
					className="text-sm font-medium text-text-tertiary hover:text-incorrect transition-colors px-3 py-1.5 rounded-lg hover:bg-incorrect-bg"
				>
					Give up &amp; reveal all
				</button>
			</div>
		</div>
	);
}
