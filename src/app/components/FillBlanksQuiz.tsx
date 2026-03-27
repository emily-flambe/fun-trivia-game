import { useState, useRef, useEffect } from 'react';
import { checkAnswer, type ExerciseSummary, type PublicItem, type FillBlanksCheckResult } from '../lib/api';

interface FoundItem {
	itemId: string;
	position: number;
	userAnswer: string;
	fuzzyMatch: boolean;
}

interface Props {
	exercise: ExerciseSummary;
	items: PublicItem[];
	exercisePath: string;
}

export function FillBlanksQuiz({ exercise, items, exercisePath }: Props) {
	const [found, setFound] = useState<FoundItem[]>([]);
	const [input, setInput] = useState('');
	const [checking, setChecking] = useState(false);
	const [lastResult, setLastResult] = useState<{ text: string; success: boolean } | null>(null);
	const [gaveUp, setGaveUp] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const nodeId = exercise.nodeId;
	const ordered = exercise.config?.ordered ?? false;
	const prompt = exercise.config?.prompt || exercise.name;
	const totalItems = items.length;
	const foundIds = new Set(found.map((f) => f.itemId));

	useEffect(() => {
		if (!gaveUp && inputRef.current) inputRef.current.focus();
	}, [found.length, gaveUp]);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!input.trim() || checking || gaveUp) return;
		setChecking(true);
		setLastResult(null);

		const result = await checkAnswer(exercisePath, { answer: input }) as FillBlanksCheckResult;

		if (result.matched && result.matchedItemId && !foundIds.has(result.matchedItemId)) {
			setFound((prev) => [...prev, {
				itemId: result.matchedItemId!,
				position: result.position ?? 0,
				userAnswer: input,
				fuzzyMatch: result.fuzzyMatch,
			}]);
			setLastResult({ text: `Found: ${input}${result.fuzzyMatch ? ' (close enough)' : ''}`, success: true });
		} else if (result.matched && result.matchedItemId && foundIds.has(result.matchedItemId)) {
			setLastResult({ text: 'Already found!', success: false });
		} else {
			setLastResult({ text: `"${input}" — not a match`, success: false });
		}

		setInput('');
		setChecking(false);
	}

	function handleGiveUp() {
		setGaveUp(true);
	}

	const allFound = found.length === totalItems;
	const isComplete = allFound || gaveUp;

	// Build slots for display
	const slots: { position: number; found: FoundItem | null; label?: string }[] = [];
	for (let i = 0; i < totalItems; i++) {
		const item = items[i];
		slots.push({ position: i, found: null, label: item.data?.label });
	}

	// Place found items into slots
	if (ordered) {
		for (const f of found) {
			const slot = slots.find((s) => s.position === f.position);
			if (slot) slot.found = f;
		}
	} else {
		let slotIdx = 0;
		for (const f of found) {
			while (slotIdx < slots.length && slots[slotIdx].found) slotIdx++;
			if (slotIdx < slots.length) {
				slots[slotIdx].found = f;
				slotIdx++;
			}
		}
	}

	return (
		<div className="animate-in">
			<div className="flex items-center gap-3 mb-4">
				<a href={`#/node/${nodeId}`} className="text-text-tertiary hover:text-text-primary transition-colors">&larr;</a>
				<h2 className="text-lg font-semibold flex-1 tracking-tight">{exercise.name}</h2>
				<span className="text-sm text-text-tertiary font-medium">{found.length} / {totalItems}</span>
			</div>

			<div className="bg-surface-raised rounded-2xl p-8 mb-6">
				<div className="text-lg mb-6 font-medium">{prompt}</div>

				{/* Slots grid */}
				<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-6">
					{slots.map((slot, i) => (
						<div
							key={i}
							className={`rounded-xl p-3 min-h-[60px] flex items-center justify-center text-sm border transition-all duration-200 ${
								slot.found
									? 'bg-correct-bg border-correct-border text-correct font-medium'
									: 'bg-surface-bright border-border-subtle text-text-tertiary'
							}`}
						>
							{slot.found ? (
								<span>{slot.found.userAnswer}{slot.found.fuzzyMatch ? ' *' : ''}</span>
							) : (
								<span>{ordered ? `#${i + 1}` : '?'}</span>
							)}
						</div>
					))}
				</div>

				{/* Input or completion */}
				{!isComplete ? (
					<div>
						<form onSubmit={handleSubmit} className="flex gap-3">
							<input
								ref={inputRef}
								type="text"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder="Type a guess..."
								className="flex-1 bg-surface-bright border border-border-default rounded-xl px-4 py-3 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
								autoComplete="off"
								disabled={checking}
							/>
							<button
								type="submit"
								disabled={!input.trim() || checking}
								className="bg-action hover:bg-action-hover text-white disabled:bg-surface-bright disabled:text-text-tertiary px-5 py-3 rounded-xl font-medium transition-all duration-200"
							>
								{checking ? '...' : 'Check'}
							</button>
						</form>
						{lastResult && (
							<div className={`mt-3 text-sm font-medium ${lastResult.success ? 'text-correct' : 'text-incorrect'}`}>
								{lastResult.text}
							</div>
						)}
						<div className="mt-3 flex justify-end">
							<button
								onClick={handleGiveUp}
								className="text-sm font-medium text-text-tertiary hover:text-incorrect transition-colors px-3 py-1.5 rounded-lg hover:bg-incorrect-bg"
							>
								Give up
							</button>
						</div>
					</div>
				) : (
					<div>
						<div className={`rounded-xl p-5 mb-4 border ${allFound ? 'bg-correct-bg border-correct-border' : 'bg-incorrect-bg border-incorrect-border'}`}>
							<div className="font-semibold mb-1">
								{allFound ? (
									<span className="text-correct">All {totalItems} found!</span>
								) : (
									<span className="text-incorrect">Found {found.length} of {totalItems}</span>
								)}
							</div>
						</div>
						<div className="flex gap-3">
							<a href={`#/exercise/${exercisePath}?mode=quiz`} className="bg-action hover:bg-action-hover text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
								Try Again
							</a>
							<a href={`#/exercise/${exercisePath}?mode=learn`} className="bg-surface-bright hover:bg-surface-hover text-text-secondary px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
								Study
							</a>
							<a href={`#/node/${nodeId}`} className="bg-surface-bright hover:bg-surface-hover text-text-secondary px-5 py-2.5 rounded-xl font-medium transition-all duration-200">
								Back
							</a>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
