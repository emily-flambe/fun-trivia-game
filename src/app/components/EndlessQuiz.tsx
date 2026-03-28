import { useState, useEffect, useRef, useCallback } from 'react';
import { getRandomItems, checkAnswer, submitQuizResult, type RandomItem, type CheckAnswerResult } from '../lib/api';
import { useAuth } from '../lib/auth-context';

interface AnswerRecord {
	itemId: string;
	exerciseId: string;
	correct: boolean;
	userAnswer: string;
	result: CheckAnswerResult;
}

const BATCH_SIZE = 20;
const PREFETCH_THRESHOLD = 5;

export function EndlessQuiz() {
	const auth = useAuth();
	const [queue, setQueue] = useState<RandomItem[]>([]);
	const [current, setCurrent] = useState(0);
	const [answers, setAnswers] = useState<AnswerRecord[]>([]);
	const [input, setInput] = useState('');
	const [currentResult, setCurrentResult] = useState<CheckAnswerResult | null>(null);
	const [checking, setChecking] = useState(false);
	const [status, setStatus] = useState<'loading' | 'in-progress' | 'showing-result' | 'stopped'>('loading');
	const [fetchingMore, setFetchingMore] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const nextButtonRef = useRef<HTMLButtonElement>(null);
	const startTimeRef = useRef<number>(Date.now());
	const submittedRef = useRef(false);
	const answersRef = useRef<AnswerRecord[]>([]);

	// Keep answersRef in sync for use in cleanup
	answersRef.current = answers;

	const submitSession = useCallback(() => {
		const currentAnswers = answersRef.current;
		if (submittedRef.current || currentAnswers.length === 0 || !auth.authenticated) return;
		submittedRef.current = true;
		const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
		submitQuizResult({
			exerciseId: 'endless',
			exerciseName: 'Endless Quiz',
			format: 'text-entry',
			score: currentAnswers.filter((a) => a.correct).length,
			total: currentAnswers.length,
			durationSeconds,
			itemsDetail: currentAnswers.map((a) => ({
				itemId: a.itemId,
				correct: a.correct,
				userAnswer: a.userAnswer,
				fuzzyMatch: a.result.fuzzyMatch,
			})),
		}).catch(() => {});
	}, [auth.authenticated]);

	// Initial fetch
	useEffect(() => {
		getRandomItems(BATCH_SIZE)
			.then((items) => {
				setQueue(items);
				setCurrent(0);
				setStatus(items.length > 0 ? 'in-progress' : 'stopped');
			})
			.catch(() => setStatus('stopped'));
		startTimeRef.current = Date.now();
		submittedRef.current = false;
	}, []);

	// Submit on unmount (navigate away)
	useEffect(() => {
		return () => {
			submitSession();
		};
	}, [submitSession]);

	// Submit on beforeunload (tab close)
	useEffect(() => {
		const onBeforeUnload = () => submitSession();
		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	}, [submitSession]);

	// Pre-fetch more items when running low
	useEffect(() => {
		const remaining = queue.length - (current + 1);
		if (remaining <= PREFETCH_THRESHOLD && !fetchingMore && status !== 'stopped' && status !== 'loading') {
			setFetchingMore(true);
			getRandomItems(BATCH_SIZE)
				.then((items) => {
					setQueue((prev) => [...prev, ...items]);
				})
				.catch(() => {})
				.finally(() => setFetchingMore(false));
		}
	}, [current, queue.length, fetchingMore, status]);

	// Focus input or next button
	useEffect(() => {
		if (status === 'in-progress' && inputRef.current) {
			inputRef.current.focus();
		} else if (status === 'showing-result' && nextButtonRef.current) {
			nextButtonRef.current.focus();
		}
	}, [current, status]);

	if (status === 'loading') {
		return <div className="text-center text-text-tertiary py-16">Loading...</div>;
	}

	if (status === 'stopped') {
		const correct = answers.filter((a) => a.correct).length;
		const total = answers.length;
		return (
			<div className="animate-in">
				<h2 className="text-2xl font-bold tracking-tight mb-6">Endless Quiz</h2>
				{total > 0 ? (
					<>
						<div className="bg-surface-raised rounded-2xl p-5 sm:p-8 mb-8 text-center">
							<div className="text-5xl font-extrabold mb-2 text-accent">
								{correct} / {total}
							</div>
							<div className="text-text-secondary text-lg">
								{Math.round((correct / total) * 100)}% correct
							</div>
						</div>
						<div className="flex flex-wrap gap-3">
							<button
								onClick={() => {
									setAnswers([]);
									setCurrent(0);
									setStatus('loading');
									submittedRef.current = false;
									startTimeRef.current = Date.now();
									getRandomItems(BATCH_SIZE).then((items) => {
										setQueue(items);
										setStatus(items.length > 0 ? 'in-progress' : 'stopped');
									});
								}}
								className="bg-action hover:bg-action-hover text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200"
							>
								New Session
							</button>
							<a href="#/" className="bg-surface-bright hover:bg-surface-hover text-text-secondary px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
								Home
							</a>
						</div>
					</>
				) : (
					<div className="bg-surface-raised rounded-2xl p-8 text-center">
						<p className="text-text-secondary mb-4">No questions available.</p>
						<a href="#/" className="text-action hover:text-action-hover font-medium">Go Home</a>
					</div>
				)}
			</div>
		);
	}

	const item = queue[current];
	if (!item) return null;

	const totalAnswered = answers.length;
	const totalCorrect = answers.filter((a) => a.correct).length;

	// Derive category name from nodeId (first segment)
	const categoryId = item.nodeId.split('/')[0];

	async function submitAnswer(userAnswer: string, forceIncorrect = false) {
		if (!item || checking) return;
		setChecking(true);
		const result = await checkAnswer(item.exerciseId, { itemId: item.id, answer: userAnswer }) as CheckAnswerResult;
		const correct = forceIncorrect ? false : result.correct;
		const finalResult = { ...result, correct };
		setCurrentResult(finalResult);
		setAnswers((prev) => [...prev, { itemId: item.id, exerciseId: item.exerciseId, correct, userAnswer, result: finalResult }]);
		setStatus('showing-result');
		setChecking(false);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		submitAnswer(input);
	}

	function handleNext() {
		setCurrent((prev) => prev + 1);
		setStatus('in-progress');
		setCurrentResult(null);
		setInput('');
	}

	function handleStop() {
		submitSession();
		setStatus('stopped');
	}

	return (
		<div className="animate-in">
			<div className="flex items-center gap-3 mb-4">
				<h2 className="text-lg font-semibold flex-1 tracking-tight">Endless Quiz</h2>
				<span className="text-sm text-text-tertiary font-medium">
					{totalCorrect}/{totalAnswered}
				</span>
				<button
					onClick={handleStop}
					className="text-sm font-medium text-text-tertiary hover:text-incorrect transition-colors px-3 py-1.5 rounded-lg hover:bg-incorrect-bg"
				>
					Stop
				</button>
			</div>

			<div className="bg-surface-raised rounded-2xl p-5 sm:p-8">
				<div className="text-xs text-text-tertiary mb-3 uppercase tracking-wider">
					{item.exerciseName} &middot; {categoryId.replace(/-/g, ' ')}
				</div>
				<div className="text-lg mb-6">{item.data?.prompt || `What is ${item.id}?`}</div>

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
										Incorrect — the answer is <span className="text-text-primary">{currentResult.correctAnswer}</span>
									</span>
								)}
							</div>
							<ul className="text-sm text-text-secondary list-disc list-outside ml-4 space-y-1">
								{currentResult.explanation.split('\\n').map((line, i) => (
									<li key={i}>{line}</li>
								))}
							</ul>
						</div>
						<button ref={nextButtonRef} onClick={handleNext} className="bg-action hover:bg-action-hover text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
							Next
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
						<div className="mt-3 flex justify-end">
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
