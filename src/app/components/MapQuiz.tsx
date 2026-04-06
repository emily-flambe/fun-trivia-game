import { useState, useEffect, useRef, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from '@vnedyalk0v/react19-simple-maps';
import { checkAnswer, submitQuizResult, type ExerciseSummary, type PublicItem, type CheckAnswerResult } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { QuizSummary } from './QuizSummary';
import { WikiLinks } from './WikiLinks';
import geoData from '../../../public/countries-110m.json';

interface AnswerRecord {
	itemId: string;
	correct: boolean;
	userAnswer: string;
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

// Name mapping: item cardBack -> TopoJSON name (Natural Earth)
// Only entries where names differ need to be listed
const NAME_ALIASES: Record<string, string[]> = {
	'Czech Republic': ['Czechia'],
	'Czechia': ['Czech Republic'],
	'Bosnia and Herzegovina': ['Bosnia and Herz.'],
	'North Macedonia': ['Macedonia'],
	'Dominican Republic': ['Dominican Rep.'],
	'Central African Republic': ['Central African Rep.'],
	'South Sudan': ['S. Sudan'],
	'Democratic Republic of the Congo': ['Dem. Rep. Congo', 'DR Congo'],
	'Republic of the Congo': ['Congo'],
	'Ivory Coast': ["Côte d'Ivoire", "Cote d'Ivoire"],
	'East Timor': ['Timor-Leste'],
	'Eswatini': ['eSwatini', 'Swaziland'],
	'United States': ['United States of America'],
	'Trinidad and Tobago': ['Trinidad and Tobago'],
};

interface MapConfig {
	center: [number, number];
	scale: number;
}

function getMapConfig(exerciseId: string): MapConfig {
	if (exerciseId.includes('europe')) return { center: [15, 54], scale: 700 };
	if (exerciseId.includes('south-america')) return { center: [-58, -18], scale: 450 };
	if (exerciseId.includes('africa')) return { center: [20, 2], scale: 350 };
	if (exerciseId.includes('asia')) return { center: [85, 35], scale: 300 };
	if (exerciseId.includes('north-america')) return { center: [-95, 45], scale: 350 };
	return { center: [0, 20], scale: 147 };
}

// Build a lookup from geo name (lowercased) to the set of all matching item cardBack values
function buildGeoNameSet(items: PublicItem[]): Set<string> {
	const names = new Set<string>();
	for (const item of items) {
		const name = item.data?.cardBack || '';
		names.add(name.toLowerCase());
		const aliases = NAME_ALIASES[name];
		if (aliases) {
			for (const alias of aliases) {
				names.add(alias.toLowerCase());
			}
		}
	}
	return names;
}

// Check if a geography name matches a specific item
function geoMatchesItem(geoName: string, item: PublicItem): boolean {
	const cardBack = (item.data?.cardBack || '').toLowerCase();
	const geoLower = geoName.toLowerCase();
	if (geoLower === cardBack) return true;
	// Check if geo name is an alias for the item's cardBack
	const aliases = NAME_ALIASES[item.data?.cardBack || ''];
	if (aliases) {
		return aliases.some(a => a.toLowerCase() === geoLower);
	}
	// Check reverse: if item cardBack is an alias for the geo name
	for (const [canonical, aliasList] of Object.entries(NAME_ALIASES)) {
		if (aliasList.some(a => a.toLowerCase() === geoLower) && canonical.toLowerCase() === cardBack) {
			return true;
		}
	}
	return false;
}

interface Props {
	exercise: ExerciseSummary;
	items: PublicItem[];
	exercisePath: string;
	nextExercisePath: string | null;
	nextNodePath: string | null;
}

export function MapQuiz({ exercise, items, exercisePath, nextExercisePath, nextNodePath }: Props) {
	const auth = useAuth();
	const [quizItems, setQuizItems] = useState<PublicItem[]>([]);
	const [current, setCurrent] = useState(0);
	const [answers, setAnswers] = useState<AnswerRecord[]>([]);
	const [input, setInput] = useState('');
	const [currentResult, setCurrentResult] = useState<CheckAnswerResult | null>(null);
	const [checking, setChecking] = useState(false);
	const [status, setStatus] = useState<'in-progress' | 'showing-result' | 'complete'>('in-progress');
	const inputRef = useRef<HTMLInputElement>(null);
	const nextButtonRef = useRef<HTMLButtonElement>(null);
	const startTimeRef = useRef<number>(Date.now());
	const submittedRef = useRef(false);
	const [lastResultId, setLastResultId] = useState<string | null>(null);
	const [retryContext, setRetryContext] = useState<{ isRetry: boolean; parentResultId: string | null }>({ isRetry: false, parentResultId: null });

	const config = getMapConfig(exercise.id);
	const exerciseGeoNames = useMemo(() => buildGeoNameSet(items), [items]);

	useEffect(() => {
		const prepared = shuffleArray(items);
		setQuizItems(prepared);
		setCurrent(0);
		setAnswers([]);
		setInput('');
		setCurrentResult(null);
		setStatus(prepared.length > 0 ? 'in-progress' : 'complete');
		startTimeRef.current = Date.now();
		submittedRef.current = false;
		setLastResultId(null);
		setRetryContext({ isRetry: false, parentResultId: null });
	}, [items]);

	useEffect(() => {
		if (status === 'in-progress' && inputRef.current) {
			inputRef.current.focus();
		} else if (status === 'showing-result' && nextButtonRef.current) {
			nextButtonRef.current.focus();
		}
	}, [current, status]);

	useEffect(() => {
		if (status === 'complete' && auth.authenticated && !submittedRef.current && answers.length > 0) {
			submittedRef.current = true;
			const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
			submitQuizResult({
				exerciseId: exercisePath,
				exerciseName: exercise.name,
				format: 'text-entry',
				score: answers.filter((a) => a.correct).length,
				total: answers.length,
				durationSeconds,
				itemsDetail: answers.map((a) => ({
					itemId: a.itemId,
					correct: a.correct,
					userAnswer: a.userAnswer,
					fuzzyMatch: a.result.fuzzyMatch,
				})),
				isRetry: retryContext.isRetry,
				parentResultId: retryContext.parentResultId || undefined,
			}).then((result) => setLastResultId(result.id)).catch(() => {});
		}
	}, [status, auth.authenticated]);

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

	const item = quizItems[current];
	if (!item) return null;

	const nodeId = exercise.nodeId;
	const progress = `${current + 1} / ${quizItems.length}`;
	const progressPct = (answers.length / quizItems.length) * 100;

	async function submitAnswer(userAnswer: string, forceIncorrect = false) {
		if (!item || checking) return;
		setChecking(true);
		const result = await checkAnswer(exercisePath, { itemId: item.id, answer: userAnswer }) as CheckAnswerResult;
		const correct = forceIncorrect ? false : result.correct;
		const finalResult = { ...result, correct };
		setCurrentResult(finalResult);
		setAnswers((prev) => [...prev, { itemId: item.id, correct, userAnswer, result: finalResult }]);
		setStatus('showing-result');
		setChecking(false);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		submitAnswer(input);
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

			<div className="h-1 bg-border-subtle rounded-full mb-4">
				<div className="h-1 bg-gradient-to-r from-action to-accent rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
			</div>

			{/* Map with highlighted country */}
			<div className="rounded-xl overflow-hidden border border-border-subtle mb-4" style={{ background: '#c8dae8' }}>
				<ComposableMap
					projection="geoMercator"
					projectionConfig={{ center: config.center, scale: config.scale }}
					width={800}
					height={500}
					style={{ width: '100%', height: 'auto' }}
				>
					<ZoomableGroup>
						<Geographies geography={geoData}>
							{({ geographies }: { geographies: any[] }) =>
								geographies.map((geo) => {
									const geoName = geo.properties?.name || '';
									const isCurrentTarget = geoMatchesItem(geoName, item);
									const isInExercise = exerciseGeoNames.has(geoName.toLowerCase());
									// After answering, also highlight the correct country if user got it wrong
									const showAsCorrect = status === 'showing-result' && isCurrentTarget;

									return (
										<Geography
											key={geo.rsmKey}
											geography={geo}
											style={{
												default: {
													fill: showAsCorrect
														? (currentResult?.correct ? '#4a7c6f' : '#c07830')
														: isCurrentTarget
															? '#c07830'
															: isInExercise
																? '#e8ddd0'
																: '#d0cbc4',
													stroke: isCurrentTarget ? '#5a3a10' : isInExercise ? '#8a7a6a' : '#b0a898',
													strokeWidth: isCurrentTarget ? 1.5 : isInExercise ? 0.8 : 0.3,
													outline: 'none',
												},
												hover: {
													fill: showAsCorrect
														? (currentResult?.correct ? '#4a7c6f' : '#c07830')
														: isCurrentTarget
															? '#c07830'
															: isInExercise
																? '#e8ddd0'
																: '#d0cbc4',
													stroke: isCurrentTarget ? '#5a3a10' : isInExercise ? '#8a7a6a' : '#b0a898',
													strokeWidth: isCurrentTarget ? 1.5 : isInExercise ? 0.8 : 0.3,
													outline: 'none',
												},
												pressed: {
													fill: isCurrentTarget ? '#c07830' : isInExercise ? '#e8ddd0' : '#d0cbc4',
													stroke: '#8a7a6a',
													strokeWidth: 0.8,
													outline: 'none',
												},
												focused: {
													fill: isCurrentTarget ? '#c07830' : isInExercise ? '#e8ddd0' : '#d0cbc4',
													stroke: isCurrentTarget ? '#5a3a10' : isInExercise ? '#8a7a6a' : '#b0a898',
													strokeWidth: isCurrentTarget ? 1.5 : isInExercise ? 0.8 : 0.3,
													outline: 'none',
												},
											}}
										/>
									);
								})
							}
						</Geographies>
					</ZoomableGroup>
				</ComposableMap>
			</div>

			{/* Quiz input area */}
			<div className="bg-surface-raised rounded-2xl p-5 sm:p-8">
				<div className="text-lg mb-4">Name the highlighted country.</div>

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
								placeholder="Type the country name..."
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
