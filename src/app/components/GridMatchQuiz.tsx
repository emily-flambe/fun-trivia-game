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

interface CellState {
	status: 'unanswered' | 'correct' | 'incorrect';
	userAnswer?: string;
	result?: CheckAnswerResult;
}

interface GridConfig {
	rows: string[];
	columns: string[];
	prompt?: string;
}

interface Props {
	exercise: ExerciseSummary;
	items: PublicItem[];
	exercisePath: string;
	nextExercisePath: string | null;
	nextNodePath: string | null;
}

/** Build a lookup key for a cell from row + column labels. */
function cellKey(row: string, col: string): string {
	return `${row}::${col}`;
}

export function GridMatchQuiz({ exercise, items, exercisePath, nextExercisePath, nextNodePath }: Props) {
	const auth = useAuth();
	const [cellStates, setCellStates] = useState<Map<string, CellState>>(new Map());
	const [inputs, setInputs] = useState<Map<string, string>>(new Map());
	const [checkingKey, setCheckingKey] = useState<string | null>(null);
	const [complete, setComplete] = useState(false);
	const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
	const startTimeRef = useRef<number>(Date.now());
	const submittedRef = useRef(false);
	const [lastResultId, setLastResultId] = useState<string | null>(null);
	const [retryContext, setRetryContext] = useState<{ isRetry: boolean; parentResultId: string | null }>({ isRetry: false, parentResultId: null });

	// Parse grid config from exercise
	const config = exercise.config as GridConfig | undefined;
	const rows = config?.rows ?? [];
	const columns = config?.columns ?? [];

	// Build item lookup: cellKey -> item
	const cellItemMap = useRef<Map<string, PublicItem>>(new Map());

	useEffect(() => {
		const map = new Map<string, PublicItem>();
		for (const item of items) {
			const row = item.data?.row as string;
			const col = item.data?.column as string;
			if (row && col) {
				map.set(cellKey(row, col), item);
			}
		}
		cellItemMap.current = map;
	}, [items]);

	const initQuiz = useCallback((retry: { isRetry: boolean; parentResultId: string | null }) => {
		const states = new Map<string, CellState>();
		const inputMap = new Map<string, string>();
		for (const row of rows) {
			for (const col of columns) {
				const key = cellKey(row, col);
				if (cellItemMap.current.has(key)) {
					states.set(key, { status: 'unanswered' });
					inputMap.set(key, '');
				}
			}
		}
		setCellStates(states);
		setInputs(inputMap);
		setCheckingKey(null);
		setComplete(false);
		startTimeRef.current = Date.now();
		submittedRef.current = false;
		setRetryContext(retry);
	}, [rows, columns]);

	useEffect(() => {
		if (cellItemMap.current.size > 0) {
			initQuiz({ isRetry: false, parentResultId: null });
		}
	}, [items, initQuiz]);

	// Re-init when items load and cellItemMap populates
	useEffect(() => {
		const map = new Map<string, PublicItem>();
		for (const item of items) {
			const row = item.data?.row as string;
			const col = item.data?.column as string;
			if (row && col) {
				map.set(cellKey(row, col), item);
			}
		}
		cellItemMap.current = map;
		if (map.size > 0 && cellStates.size === 0) {
			initQuiz({ isRetry: false, parentResultId: null });
		}
	}, [items]);

	const totalCells = cellStates.size;
	const answeredCount = Array.from(cellStates.values()).filter((s) => s.status !== 'unanswered').length;
	const correctCount = Array.from(cellStates.values()).filter((s) => s.status === 'correct').length;
	const progressPct = totalCells > 0 ? (answeredCount / totalCells) * 100 : 0;

	// Build answers for QuizSummary
	const answers: AnswerRecord[] = complete
		? Array.from(cellStates.entries()).map(([key, state]) => {
			const item = cellItemMap.current.get(key);
			return {
				itemId: item?.id ?? key,
				correct: state.status === 'correct',
				userAnswer: state.userAnswer || '',
				result: state.result || { correct: false, correctAnswer: '', explanation: '', userAnswer: '', fuzzyMatch: false },
			};
		})
		: [];

	// Flatten items in grid order for QuizSummary
	const quizItems: PublicItem[] = complete
		? Array.from(cellStates.keys())
			.map((key) => cellItemMap.current.get(key))
			.filter((i): i is PublicItem => i != null)
		: [];

	// Submit result when complete
	useEffect(() => {
		if (complete && auth.authenticated && !submittedRef.current && totalCells > 0) {
			submittedRef.current = true;
			const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
			submitQuizResult({
				exerciseId: exercisePath,
				exerciseName: exercise.name,
				format: 'grid-match',
				score: correctCount,
				total: totalCells,
				durationSeconds,
				itemsDetail: Array.from(cellStates.entries()).map(([key, state]) => {
					const item = cellItemMap.current.get(key);
					return {
						itemId: item?.id ?? key,
						correct: state.status === 'correct',
						userAnswer: state.userAnswer || '',
						fuzzyMatch: state.result?.fuzzyMatch ?? false,
					};
				}),
				isRetry: retryContext.isRetry,
				parentResultId: retryContext.parentResultId || undefined,
			}).then((result) => setLastResultId(result.id)).catch(() => {});
		}
	}, [complete, auth.authenticated]);

	function focusNextUnanswered(afterKey: string) {
		const keys = Array.from(cellStates.keys());
		const idx = keys.indexOf(afterKey);
		for (let offset = 1; offset < keys.length; offset++) {
			const nextKey = keys[(idx + offset) % keys.length];
			if (cellStates.get(nextKey)?.status === 'unanswered') {
				inputRefs.current.get(nextKey)?.focus();
				return;
			}
		}
	}

	async function handleSubmitCell(key: string) {
		const answer = inputs.get(key)?.trim();
		if (!answer || checkingKey) return;

		const item = cellItemMap.current.get(key);
		if (!item) return;

		setCheckingKey(key);
		const result = await checkAnswer(exercisePath, { itemId: item.id, answer }) as CheckAnswerResult;
		const newState: CellState = {
			status: result.correct ? 'correct' : 'incorrect',
			userAnswer: answer,
			result,
		};

		setCellStates((prev) => {
			const next = new Map(prev);
			next.set(key, newState);
			const allAnswered = Array.from(next.values()).every((s) => s.status !== 'unanswered');
			if (allAnswered) {
				setTimeout(() => setComplete(true), 300);
			}
			return next;
		});
		setCheckingKey(null);
		focusNextUnanswered(key);
	}

	function handleGiveUp() {
		const unanswered = Array.from(cellStates.entries())
			.filter(([, s]) => s.status === 'unanswered')
			.map(([key]) => key);
		if (unanswered.length === 0) return;

		Promise.all(
			unanswered.map(async (key) => {
				const item = cellItemMap.current.get(key);
				if (!item) return null;
				const result = await checkAnswer(exercisePath, { itemId: item.id, answer: '(gave up)' }) as CheckAnswerResult;
				return { key, result };
			})
		).then((results) => {
			setCellStates((prev) => {
				const next = new Map(prev);
				for (const r of results) {
					if (!r) continue;
					next.set(r.key, {
						status: 'incorrect',
						userAnswer: '(gave up)',
						result: r.result,
					});
				}
				return next;
			});
			setComplete(true);
		});
	}

	function handleRepeat() {
		const parentId = lastResultId;
		initQuiz({ isRetry: true, parentResultId: parentId });
	}

	function handleRetryFailed() {
		const parentId = lastResultId;
		const failedKeys = new Set(
			Array.from(cellStates.entries())
				.filter(([, s]) => s.status === 'incorrect')
				.map(([key]) => key)
		);
		// Reset only failed cells
		setCellStates((prev) => {
			const next = new Map(prev);
			for (const key of failedKeys) {
				next.set(key, { status: 'unanswered' });
			}
			return next;
		});
		setInputs((prev) => {
			const next = new Map(prev);
			for (const key of failedKeys) {
				next.set(key, '');
			}
			return next;
		});
		setComplete(false);
		startTimeRef.current = Date.now();
		submittedRef.current = false;
		setRetryContext({ isRetry: true, parentResultId: parentId });
		// Focus first failed cell
		setTimeout(() => {
			for (const key of failedKeys) {
				inputRefs.current.get(key)?.focus();
				break;
			}
		}, 50);
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

	return (
		<div className="animate-in">
			<div className="flex items-center gap-3 mb-4">
				<a href={`#/node/${nodeId}`} className="text-text-tertiary hover:text-text-primary transition-colors">&larr;</a>
				<h2 className="text-lg font-semibold flex-1 tracking-tight">{exercise.name}</h2>
				<span className="text-sm text-text-tertiary font-medium">{answeredCount} / {totalCells}</span>
			</div>

			<div className="h-1 bg-border-subtle rounded-full mb-6">
				<div className="h-1 bg-gradient-to-r from-action to-accent rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
			</div>

			{config?.prompt && (
				<p className="text-sm text-text-secondary mb-4">{config.prompt}</p>
			)}

			<div className="bg-surface-raised rounded-2xl p-3 sm:p-5 overflow-x-auto">
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr>
							<th className="p-2 text-left text-text-tertiary font-medium border-b border-border-subtle" />
							{columns.map((col) => (
								<th key={col} className="p-2 text-center text-text-secondary font-semibold border-b border-border-subtle min-w-[120px]">
									{col}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row}>
								<td className="p-2 text-text-secondary font-semibold border-r border-border-subtle whitespace-nowrap">
									{row}
								</td>
								{columns.map((col) => {
									const key = cellKey(row, col);
									const state = cellStates.get(key);
									const hasItem = cellItemMap.current.has(key);
									const isChecking = checkingKey === key;

									if (!hasItem) {
										return <td key={col} className="p-2 text-center text-text-tertiary">—</td>;
									}

									if (!state || state.status === 'unanswered') {
										return (
											<td key={col} className="p-1">
												<form
													onSubmit={(e) => {
														e.preventDefault();
														handleSubmitCell(key);
													}}
												>
													<input
														ref={(el) => { if (el) inputRefs.current.set(key, el); }}
														type="text"
														value={inputs.get(key) || ''}
														onChange={(e) => setInputs((prev) => {
															const next = new Map(prev);
															next.set(key, e.target.value);
															return next;
														})}
														onKeyDown={(e) => {
															if (e.key === 'Tab') {
																const val = inputs.get(key)?.trim();
																if (val) {
																	e.preventDefault();
																	handleSubmitCell(key);
																}
															}
														}}
														className="w-full bg-surface-bright border border-border-default rounded-lg px-2 py-1.5 text-sm text-text-primary placeholder-text-tertiary/40 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all text-center"
														placeholder="?"
														autoComplete="off"
														disabled={isChecking}
													/>
												</form>
											</td>
										);
									}

									const isCorrect = state.status === 'correct';
									return (
										<td
											key={col}
											className={`p-2 text-center text-sm font-medium transition-colors duration-200 ${
												isCorrect ? 'bg-correct-bg/40 text-correct' : 'bg-incorrect-bg/40 text-incorrect'
											}`}
											title={state.result?.explanation}
										>
											{isCorrect ? (
												<span>{state.userAnswer}{state.result?.fuzzyMatch ? ' *' : ''}</span>
											) : (
												<span>
													{state.userAnswer !== '(gave up)' && (
														<span className="line-through mr-1 opacity-60">{state.userAnswer}</span>
													)}
													<span className="text-correct font-semibold">{state.result?.correctAnswer}</span>
												</span>
											)}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
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
