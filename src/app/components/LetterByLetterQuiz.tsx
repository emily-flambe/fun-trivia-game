import { useEffect, useRef, useState } from 'react';
import {
	checkAnswer,
	revealAnswers,
	submitQuizResult,
	type CheckAnswerResult,
	type ExerciseSummary,
	type PublicItem,
	type RevealedItem,
} from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { countRevealableChars, maskAnswer, nextRevealCount } from '../lib/letter-by-letter';
import { ItemImage } from './ItemImage';
import { QuizSummary } from './QuizSummary';
import { WikiLinks } from './WikiLinks';

interface AnswerRecord {
	itemId: string;
	correct: boolean;
	userAnswer: string;
	hintsUsed: number;
	result: CheckAnswerResult;
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

export function LetterByLetterQuiz({ exercise, items, exercisePath, nextExercisePath, nextNodePath }: Props) {
	const auth = useAuth();
	const [quizItems, setQuizItems] = useState<PublicItem[]>([]);
	const [revealedItems, setRevealedItems] = useState<Record<string, RevealedItem>>({});
	const [current, setCurrent] = useState(0);
	const [answers, setAnswers] = useState<AnswerRecord[]>([]);
	const [input, setInput] = useState('');
	const [currentResult, setCurrentResult] = useState<CheckAnswerResult | null>(null);
	const [status, setStatus] = useState<'in-progress' | 'showing-result' | 'complete'>('in-progress');
	const [checking, setChecking] = useState(false);
	const [revealByItem, setRevealByItem] = useState<Record<string, number>>({});
	const [hintsByItem, setHintsByItem] = useState<Record<string, number>>({});
	const inputRef = useRef<HTMLInputElement>(null);
	const nextButtonRef = useRef<HTMLButtonElement>(null);
	const startTimeRef = useRef<number>(Date.now());
	const submittedRef = useRef(false);
	const [lastResultId, setLastResultId] = useState<string | null>(null);
	const [retryContext, setRetryContext] = useState<{ isRetry: boolean; parentResultId: string | null }>({ isRetry: false, parentResultId: null });

	useEffect(() => {
		let prepared = shuffleArray(items);
		setQuizItems(prepared);
		setCurrent(0);
		setAnswers([]);
		setInput('');
		setCurrentResult(null);
		setStatus(prepared.length > 0 ? 'in-progress' : 'complete');
		setRevealByItem({});
		setHintsByItem({});
		startTimeRef.current = Date.now();
		submittedRef.current = false;
		setLastResultId(null);
		setRetryContext({ isRetry: false, parentResultId: null });
	}, [items]);

	useEffect(() => {
		revealAnswers(exercisePath)
			.then((rows) => {
				const map: Record<string, RevealedItem> = {};
				for (const row of rows) map[row.id] = row;
				setRevealedItems(map);
			})
			.catch(() => {});
	}, [exercisePath]);

	useEffect(() => {
		if (status === 'in-progress' && inputRef.current) {
			inputRef.current.focus();
		} else if (status === 'showing-result' && nextButtonRef.current) {
			nextButtonRef.current.focus();
		}
	}, [status, current]);

	useEffect(() => {
		if (status === 'complete' && auth.authenticated && !submittedRef.current && answers.length > 0) {
			submittedRef.current = true;
			const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
			submitQuizResult({
				exerciseId: exercisePath,
				exerciseName: exercise.name,
				format: 'letter-by-letter',
				score: answers.filter((a) => a.correct).length,
				total: answers.length,
				durationSeconds,
				itemsDetail: answers.map((a) => ({
					itemId: a.itemId,
					correct: a.correct,
					userAnswer: a.userAnswer,
					fuzzyMatch: a.result.fuzzyMatch,
					hintsUsed: a.hintsUsed,
				})),
				isRetry: retryContext.isRetry,
				parentResultId: retryContext.parentResultId || undefined,
			}).then((result) => setLastResultId(result.id)).catch(() => {});
		}
	}, [status, auth.authenticated, answers, exercisePath, exercise.name, retryContext]);

	const item = quizItems[current];
	const revealed = item ? revealedItems[item.id] : undefined;
	const answerText = revealed?.answer ?? '';
	const revealableTotal = countRevealableChars(answerText);
	const revealCount = item ? (revealByItem[item.id] ?? Math.min(1, revealableTotal)) : 0;
	const hintsUsed = item ? (hintsByItem[item.id] ?? 0) : 0;
	const autoRevealSeconds = exercise.config?.autoRevealSeconds ?? 0;

	useEffect(() => {
		if (!item || !answerText) return;
		setRevealByItem((prev) => {
			if (prev[item.id] != null) return prev;
			return { ...prev, [item.id]: Math.min(1, countRevealableChars(answerText)) };
		});
	}, [item, answerText]);

	useEffect(() => {
		if (!item || !answerText || status !== 'in-progress' || autoRevealSeconds <= 0) return;
		const timer = setInterval(() => {
			setRevealByItem((prev) => {
				const currentReveal = prev[item.id] ?? Math.min(1, countRevealableChars(answerText));
				const next = nextRevealCount(answerText, currentReveal);
				if (next === currentReveal) return prev;
				return { ...prev, [item.id]: next };
			});
		}, autoRevealSeconds * 1000);
		return () => clearInterval(timer);
	}, [item, answerText, status, autoRevealSeconds]);

	if (status === 'complete') {
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

	if (!item) return null;

	const nodeId = exercise.nodeId;
	const progress = `${current + 1} / ${quizItems.length}`;
	const progressPct = (answers.length / quizItems.length) * 100;
	const maskedAnswer = answerText ? maskAnswer(answerText, revealCount) : 'Loading answer pattern...';

	async function submitAnswer(userAnswer: string, forceIncorrect = false) {
		if (!item || checking) return;
		setChecking(true);
		const result = await checkAnswer(exercisePath, { itemId: item.id, answer: userAnswer }) as CheckAnswerResult;
		const correct = forceIncorrect ? false : result.correct;
		const finalResult = { ...result, correct };
		setCurrentResult(finalResult);
		setAnswers((prev) => [...prev, { itemId: item.id, correct, userAnswer, hintsUsed, result: finalResult }]);
		setStatus('showing-result');
		setChecking(false);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		submitAnswer(input);
	}

	function handleHint() {
		if (!item || !answerText) return;
		setRevealByItem((prev) => {
			const currentReveal = prev[item.id] ?? Math.min(1, countRevealableChars(answerText));
			const next = nextRevealCount(answerText, currentReveal);
			return next === currentReveal ? prev : { ...prev, [item.id]: next };
		});
		setHintsByItem((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }));
	}

	function handleNext() {
		const nextIdx = current + 1;
		if (nextIdx >= quizItems.length) {
			setStatus('complete');
		} else {
			setCurrent(nextIdx);
			setStatus('in-progress');
			setCurrentResult(null);
			setInput('');
		}
	}

	function handleRepeat() {
		const parentId = lastResultId;
		const prepared = shuffleArray(items);
		setQuizItems(prepared);
		setCurrent(0);
		setAnswers([]);
		setInput('');
		setCurrentResult(null);
		setStatus(prepared.length > 0 ? 'in-progress' : 'complete');
		setRevealByItem({});
		setHintsByItem({});
		startTimeRef.current = Date.now();
		submittedRef.current = false;
		setRetryContext({ isRetry: true, parentResultId: parentId });
	}

	function handleRetryFailed() {
		const parentId = lastResultId;
		const failedIds = new Set(answers.filter((a) => !a.correct).map((a) => a.itemId));
		const failedItems = shuffleArray(items.filter((i) => failedIds.has(i.id)));
		setQuizItems(failedItems);
		setCurrent(0);
		setAnswers([]);
		setInput('');
		setCurrentResult(null);
		setStatus(failedItems.length > 0 ? 'in-progress' : 'complete');
		setRevealByItem({});
		setHintsByItem({});
		startTimeRef.current = Date.now();
		submittedRef.current = false;
		setRetryContext({ isRetry: true, parentResultId: parentId });
	}

	return (
		<div className="animate-in">
			<div className="flex items-center gap-3 mb-4">
				<a href={`#/node/${nodeId}`} className="text-text-tertiary hover:text-text-primary transition-colors">&larr;</a>
				<h2 className="text-lg font-semibold flex-1 tracking-tight">{exercise.name}</h2>
				<span className="text-sm text-text-tertiary font-medium">{progress}</span>
			</div>

			<div className="h-1 bg-border-subtle rounded-full mb-6">
				<div className="h-1 bg-gradient-to-r from-action to-accent rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
			</div>

			<div className="bg-surface-raised rounded-2xl p-5 sm:p-8">
				{item.data?.imageUrl && (
					<div key={item.id} className="flex justify-center mb-4">
						<ItemImage imageUrl={item.data.imageUrl} alt={item.data?.prompt || item.id} size="lg" />
					</div>
				)}
				<div className="text-lg mb-3">{item.data?.prompt || `What is ${item.id}?`}</div>
				<div className="mb-6 bg-surface-bright border border-border-subtle rounded-xl px-4 py-3">
					<div className="text-xs uppercase tracking-widest text-text-tertiary mb-1">Answer Pattern</div>
					<div className="text-lg font-mono tracking-wider">{maskedAnswer}</div>
				</div>

				{status === 'showing-result' && currentResult ? (
					<div>
						<div className={`rounded-xl p-5 mb-4 border ${
							currentResult.correct
								? 'bg-correct-bg border-correct-border'
								: 'bg-incorrect-bg border-incorrect-border'
						}`}>
							<div className="font-semibold mb-1">
								{currentResult.correct ? (
									<span className="text-correct">
										Correct!{currentResult.fuzzyMatch ? ' (close enough)' : ''}
									</span>
								) : (
									<span className="text-incorrect">
										Incorrect - the answer is <span className="text-text-primary">{currentResult.correctAnswer}</span>
									</span>
								)}
							</div>
							<div className="text-sm text-text-secondary mb-2">Hints used on this item: {hintsUsed}</div>
							<ul className="text-sm text-text-secondary list-disc list-outside ml-4 space-y-1">
								{currentResult.explanation.split('\n').map((line, i) => (
									<li key={i}>{line}</li>
								))}
							</ul>
							<WikiLinks links={item.data?.links} />
						</div>
						<button ref={nextButtonRef} onClick={handleNext} className="bg-action hover:bg-action-hover text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
							{current + 1 >= quizItems.length ? 'See Results' : 'Next'}
						</button>
					</div>
				) : (
					<div>
						<form onSubmit={handleSubmit} className="flex gap-3">
							<input
								ref={inputRef}
								type="text"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder="Type your answer..."
								className="flex-1 bg-surface-bright border border-border-default rounded-xl px-4 py-3 text-base text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
								autoComplete="off"
								disabled={checking}
							/>
							<button
								type="submit"
								disabled={!input.trim() || checking}
								className="bg-action hover:bg-action-hover text-white disabled:bg-surface-bright disabled:text-text-tertiary px-5 py-3 rounded-xl font-medium transition-all duration-200"
							>
								{checking ? '...' : 'Submit'}
							</button>
						</form>
						<div className="mt-3 flex justify-between">
							<button
								onClick={handleHint}
								disabled={checking || !answerText || revealCount >= revealableTotal}
								className="text-sm font-medium text-accent hover:text-action-hover transition-colors disabled:opacity-50 px-3 py-1.5 rounded-lg hover:bg-surface-hover"
							>
								Reveal next letter
							</button>
							<button
								onClick={() => submitAnswer('(gave up)', true)}
								disabled={checking}
								className="text-sm font-medium text-text-tertiary hover:text-incorrect transition-colors disabled:opacity-50 px-3 py-1.5 rounded-lg hover:bg-incorrect-bg"
							>
								Skip &amp; reveal answer
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
