import { useEffect, useMemo, useRef, useState } from 'react';
import {
	checkAnswer,
	submitQuizResult,
	type ExerciseSummary,
	type MinefieldItemCheckResult,
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

interface RevealedInfo {
	isValid: boolean;
	explanation: string;
	playerSelected: boolean;
}

function shuffleArray<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function getItemLabel(item: PublicItem): string {
	return item.data?.label || item.data?.cardFront || item.data?.prompt || item.id;
}

export function MinefieldQuiz({ exercise, items, exercisePath, nextExercisePath, nextNodePath }: Props) {
	const auth = useAuth();
	const [revealed, setRevealed] = useState<Map<string, RevealedInfo>>(new Map());
	const [strikes, setStrikes] = useState(0);
	const [validFound, setValidFound] = useState(0);
	const [gameOver, setGameOver] = useState(false);
	const [checking, setChecking] = useState<string | null>(null);
	const [revealing, setRevealing] = useState(false);
	const [shuffledItems, setShuffledItems] = useState<PublicItem[]>([]);
	const [totalValid, setTotalValid] = useState<number | null>(null);
	const startTimeRef = useRef<number>(Date.now());
	const submittedRef = useRef(false);
	const [lastResultId, setLastResultId] = useState<string | null>(null);
	const [retryContext, setRetryContext] = useState<{ isRetry: boolean; parentResultId: string | null }>({ isRetry: false, parentResultId: null });
	const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
	const timerDoneRef = useRef(false);
	const gameOverRef = useRef(false);

	const maxStrikes = exercise.config?.maxStrikes ?? 3;
	const prompt = exercise.config?.prompt || 'Select all valid items. Avoid the traps!';
	const timeLimit = typeof exercise.config?.timeLimitSeconds === 'number' && exercise.config.timeLimitSeconds > 0
		? exercise.config.timeLimitSeconds
		: null;
	const isTimed = exercise.config?.timed === true || timeLimit !== null;

	// Initialize / reset
	useEffect(() => {
		setShuffledItems(shuffleArray(items));
		setRevealed(new Map());
		setStrikes(0);
		setValidFound(0);
		setGameOver(false);
		setChecking(null);
		setRevealing(false);
		setTotalValid(null);
		startTimeRef.current = Date.now();
		submittedRef.current = false;
		setLastResultId(null);
		setRetryContext({ isRetry: false, parentResultId: null });
		timerDoneRef.current = false;
		gameOverRef.current = false;
		setSecondsLeft(timeLimit);
	}, [items, timeLimit]);

	// Timer
	useEffect(() => {
		if (!isTimed || timeLimit === null || gameOver || timerDoneRef.current) return;
		const deadline = Date.now() + timeLimit * 1000;
		const intervalId = window.setInterval(() => {
			const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
			setSecondsLeft(next);
			if (next === 0 && !timerDoneRef.current) {
				timerDoneRef.current = true;
				void endGame();
			}
		}, 250);
		return () => window.clearInterval(intervalId);
	}, [isTimed, timeLimit, gameOver]);

	// Reveal all remaining items when game ends
	async function revealRemaining(currentRevealed: Map<string, RevealedInfo>) {
		setRevealing(true);
		const unrevealed = items.filter((item) => !currentRevealed.has(item.id));
		const results = await Promise.all(
			unrevealed.map(async (item) => {
				const res = await checkAnswer(exercisePath, { itemId: item.id }) as MinefieldItemCheckResult;
				return { itemId: item.id, isValid: res.isValid, explanation: res.explanation };
			})
		);
		const newRevealed = new Map(currentRevealed);
		for (const r of results) {
			newRevealed.set(r.itemId, { isValid: r.isValid, explanation: r.explanation, playerSelected: false });
		}
		setRevealed(newRevealed);

		// Compute total valid
		let total = 0;
		for (const info of newRevealed.values()) {
			if (info.isValid) total++;
		}
		setTotalValid(total);
		setRevealing(false);
		return { newRevealed, total };
	}

	async function endGame() {
		if (gameOverRef.current) return;
		gameOverRef.current = true;
		setGameOver(true);
		await revealRemaining(revealed);
	}

	// Handle tile click
	async function handleTileClick(item: PublicItem) {
		if (gameOver || revealed.has(item.id) || checking || revealing) return;
		setChecking(item.id);
		const res = await checkAnswer(exercisePath, { itemId: item.id }) as MinefieldItemCheckResult;
		setChecking(null);

		const info: RevealedInfo = { isValid: res.isValid, explanation: res.explanation, playerSelected: true };
		const newRevealed = new Map(revealed);
		newRevealed.set(item.id, info);
		setRevealed(newRevealed);

		let newStrikes = strikes;
		let newValidFound = validFound;

		if (res.isValid) {
			newValidFound = validFound + 1;
			setValidFound(newValidFound);
		} else {
			newStrikes = strikes + 1;
			setStrikes(newStrikes);
		}

		// Check end conditions
		const allRevealed = newRevealed.size === items.length;
		if (allRevealed || newStrikes >= maxStrikes) {
			gameOverRef.current = true;
			setGameOver(true);
			if (!allRevealed) {
				await revealRemaining(newRevealed);
			} else {
				// All items revealed — compute total valid
				let total = 0;
				for (const v of newRevealed.values()) {
					if (v.isValid) total++;
				}
				setTotalValid(total);
			}
		}
	}

	// Submit result when game over and totalValid is known
	useEffect(() => {
		if (!gameOver || totalValid === null || !auth.authenticated || submittedRef.current) return;
		submittedRef.current = true;
		const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
		const details = items.map((item) => {
			const info = revealed.get(item.id);
			return {
				itemId: item.id,
				correct: info?.playerSelected === true && info?.isValid === true,
				userAnswer: info?.playerSelected ? 'selected' : 'skipped',
				fuzzyMatch: false,
			};
		});
		void submitQuizResult({
			exerciseId: exercisePath,
			exerciseName: exercise.name,
			format: 'minefield',
			score: validFound,
			total: totalValid,
			durationSeconds,
			itemsDetail: details,
			isRetry: retryContext.isRetry,
			parentResultId: retryContext.parentResultId || undefined,
		}).then((saved) => setLastResultId(saved.id)).catch(() => {});
	}, [gameOver, totalValid, auth.authenticated, revealed]);

	function handleRetake() {
		const parentId = lastResultId;
		setShuffledItems(shuffleArray(items));
		setRevealed(new Map());
		setStrikes(0);
		setValidFound(0);
		setGameOver(false);
		setChecking(null);
		setRevealing(false);
		setTotalValid(null);
		startTimeRef.current = Date.now();
		submittedRef.current = false;
		timerDoneRef.current = false;
		gameOverRef.current = false;
		setSecondsLeft(timeLimit);
		setRetryContext({ isRetry: true, parentResultId: parentId });
	}

	// Strike indicators
	const strikeIndicators = useMemo(() => {
		const indicators: string[] = [];
		for (let i = 0; i < maxStrikes; i++) {
			indicators.push(i < strikes ? '\u25CF' : '\u25CB');
		}
		return indicators.join('');
	}, [strikes, maxStrikes]);

	const nodeId = exercise.nodeId;
	const revealedCount = revealed.size;

	// Game over summary
	const gameOverMessage = useMemo(() => {
		if (!gameOver || totalValid === null) return '';
		if (strikes >= maxStrikes) {
			return `Game over! ${strikes} strikes. You found ${validFound} of ${totalValid} valid items.`;
		}
		if (timerDoneRef.current && validFound < totalValid) {
			return `Time's up! You found ${validFound} of ${totalValid} valid items.`;
		}
		if (validFound === totalValid) {
			return `You found all ${totalValid} valid items!`;
		}
		return `You found ${validFound} of ${totalValid} valid items.`;
	}, [gameOver, totalValid, strikes, maxStrikes, validFound]);

	const isSuccess = gameOver && totalValid !== null && validFound === totalValid;

	return (
		<div className="animate-in">
			<div className="flex items-center gap-3 mb-4">
				<a href={`#/node/${nodeId}`} className="text-text-tertiary hover:text-text-primary transition-colors">&larr;</a>
				<h2 className="text-lg font-semibold flex-1 tracking-tight">{exercise.name}</h2>
				<span className="text-sm text-text-tertiary font-medium">
					Score: {validFound} | Strikes: {strikeIndicators}
				</span>
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

				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-5">
					{shuffledItems.map((item) => {
						const info = revealed.get(item.id);
						const isChecking = checking === item.id;
						const clickable = !gameOver && !info && !checking && !revealing;

						let tileClass = 'border-border-subtle bg-surface-raised';
						if (info) {
							if (info.isValid) {
								tileClass = info.playerSelected
									? 'border-correct-border bg-correct-bg'
									: 'border-correct-border bg-correct-bg opacity-60';
							} else {
								tileClass = info.playerSelected
									? 'border-incorrect-border bg-incorrect-bg'
									: 'border-incorrect-border bg-incorrect-bg opacity-60';
							}
						}

						return (
							<button
								key={item.id}
								type="button"
								onClick={() => void handleTileClick(item)}
								disabled={!clickable}
								className={`rounded-xl border p-3 sm:p-4 text-sm font-medium text-left transition-all duration-200 ${tileClass} ${clickable ? 'cursor-pointer hover:bg-surface-hover' : ''} ${isChecking ? 'animate-pulse' : ''}`}
							>
								<div className="flex items-start gap-2">
									{info && (
										<span className={`text-lg leading-none ${info.isValid ? 'text-correct' : 'text-incorrect'}`}>
											{info.isValid ? '\u2713' : '\u2717'}
										</span>
									)}
									<span>{getItemLabel(item)}</span>
								</div>
								{info && info.explanation && (
									<div className="text-xs text-text-tertiary mt-1">{info.explanation}</div>
								)}
							</button>
						);
					})}
				</div>

				{gameOver && totalValid !== null ? (
					<div>
						<div className={`rounded-xl p-5 mb-4 border ${isSuccess ? 'bg-correct-bg border-correct-border' : 'bg-incorrect-bg border-incorrect-border'}`}>
							<div className="font-semibold">{gameOverMessage}</div>
						</div>
						{revealing && (
							<div className="text-sm text-text-tertiary mb-4">Revealing remaining items...</div>
						)}
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
							onClick={() => void endGame()}
							disabled={revealing || revealedCount === 0}
							className="bg-action hover:bg-action-hover text-white disabled:bg-surface-bright disabled:text-text-tertiary px-5 py-2.5 rounded-xl font-medium transition-all duration-200"
						>
							{revealing ? 'Revealing...' : 'Finish'}
						</button>
						<span className="text-sm text-text-tertiary">
							{revealedCount} / {items.length} items revealed
						</span>
					</div>
				)}
			</div>
		</div>
	);
}
